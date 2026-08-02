'use strict';

const http=require('node:http');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {LisBridge,LisError}=require('./core');
const {JournalStore}=require('./store');

const ROOT=__dirname;
function readConfig(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function json(res,status,value){const body=JSON.stringify(value),headers={'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store'};if(res.lisCorsOrigin)headers['access-control-allow-origin']=res.lisCorsOrigin;res.writeHead(status,headers);res.end(body);}
function readBody(req,maxBytes=1024*1024){return new Promise((resolve,reject)=>{let size=0,parts=[];req.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){reject(new LisError('PAYLOAD_TOO_LARGE','Payload vượt quá 1 MB.',413));req.destroy();return;}parts.push(chunk);});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(parts).toString('utf8')||'{}'));}catch(error){reject(new LisError('INVALID_JSON','JSON không hợp lệ.'));}});req.on('error',reject);});}

/* So sánh token theo thời gian hằng định. Chênh lệch thời gian của `===` trên chuỗi là
   kênh phụ thật với một dịch vụ nhận request không giới hạn tần suất. */
function tokenMatches(header,token){
  const got=Buffer.from(String(header||''),'utf8'),want=Buffer.from(`Bearer ${token}`,'utf8');
  return got.length===want.length&&crypto.timingSafeEqual(got,want);
}
/* KHÔNG có nhánh "không có token thì cho qua". Bản đầu có `if(!token)return true`, mà
   `npm run lis:gateway` lại không đặt QCLAB_LIS_TOKEN — nên mặc định là mở toang: đo được
   `GET /api/v1/messages` trả 200 khi không gửi gì. Với một cổng quyết định phát hành kết
   quả bệnh nhân, fail-open là mặc định sai. createLisServer() nay từ chối khởi tạo khi
   thiếu token, còn tiến trình chính tự sinh và lưu token nếu người dùng chưa đặt. */
function authorized(req,token){return tokenMatches(req.headers.authorization,token);}

/* Bắt buộc content-type JSON cho mọi request CÓ THÂN. Đây là rào chống CSRF, không phải
   chuyện sạch sẽ API: `POST` kèm `content-type: text/plain` là "simple request" nên trình
   duyệt KHÔNG preflight, mà bản đầu lại JSON.parse bất kể content-type — đo được một trang
   `https://evil.example` bất kỳ POST thẳng vào /api/v1/messages và nhận 201, ghi rác vào
   journal. Đòi application/json biến request thành non-simple, buộc phải preflight, và
   preflight thì đi qua allowlist origin bên dưới. */
function requireJsonBody(req){
  const type=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
  if(type!=='application/json')throw new LisError('UNSUPPORTED_MEDIA_TYPE','Content-Type phải là application/json.',415);
}

function createLisServer(opts={}){
  const bridge=opts.bridge,token=String(opts.token||''),allowedOrigins=new Set(opts.allowedOrigins||['null','http://127.0.0.1:8080','http://localhost:8080']);
  if(!bridge)throw new Error('Thiếu LisBridge.');
  if(!token)throw new Error('Thiếu token. LIS Gateway không chạy ở chế độ không xác thực.');
  return http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      const origin=String(req.headers.origin||'');if(origin&&allowedOrigins.has(origin))res.lisCorsOrigin=origin;
      if(req.method==='OPTIONS'){if(origin&&!allowedOrigins.has(origin))return json(res,403,{error:'ORIGIN_DENIED',message:'Origin không được phép.'});res.writeHead(204,{'access-control-allow-origin':origin||'null','access-control-allow-methods':'GET, POST, PUT, OPTIONS','access-control-allow-headers':'content-type, authorization','access-control-max-age':'600'});return res.end();}
      /* /health là endpoint liveness nên không đòi token — vì vậy nó KHÔNG được kèm
         bridge.status(): số message/mapping/trạng thái QC là thông tin vận hành của phòng
         xét nghiệm, đưa cho người chưa xác thực là rò rỉ không cần thiết. Ai cần số liệu
         thì gọi /api/v1/status có token. */
      if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,service:'qclab-lis-gateway'});
      if(!authorized(req,token))return json(res,401,{error:'UNAUTHORIZED',message:'Bearer token không hợp lệ.'});
      if(req.method==='GET'&&url.pathname==='/api/v1/status')return json(res,200,{ok:true,...bridge.status()});
      /* MIDDLEWARE LIS DAY KET QUA QC VAO DAY. Nhan mot ban ghi hoac ca lo {items:[...]}.
         Ca lo duoc chuan hoa het roi moi ghi: mot phan tu hong lam hong ca lo thay vi ghi
         nua chung, de ben gui khong phai doan da toi dau ma retry. */
      if(req.method==='POST'&&url.pathname==='/api/v1/qc-results'){
        requireJsonBody(req);const body=await readBody(req);
        if(Array.isArray(body&&body.items)){
          if(body.items.length>500)throw new LisError('BATCH_TOO_LARGE','Toi da 500 ket qua moi lan.');
          const items=body.items.map(x=>bridge.ingest(x));
          return json(res,201,{items,nhan:items.filter(x=>!x.duplicate).length,trung:items.filter(x=>x.duplicate).length});
        }
        const result=bridge.ingest(body);return json(res,result.duplicate?200:201,result);
      }
      /* QC Lab keo ve. `resolvable=false` de xem rieng nhung ban ghi chua khop mapping. */
      if(req.method==='GET'&&url.pathname==='/api/v1/qc-results'){
        const q=url.searchParams,r=q.get('resolvable');
        return json(res,200,{items:bridge.listResults({status:q.get('status')||'pending',limit:q.get('limit'),resolvable:r==null?null:r!=='false'})});
      }
      /* QC Lab bao da nhan vao du lieu noi kiem hay da bo. Khong xoa ban ghi: journal la
         vet cho thay dieu gi da toi va ai quyet dinh gi voi no. */
      if(req.method==='POST'&&url.pathname==='/api/v1/qc-results/decide'){requireJsonBody(req);return json(res,200,{record:bridge.decide(await readBody(req))});}
      return json(res,404,{error:'NOT_FOUND',message:'Endpoint không tồn tại.'});
    }catch(error){const status=error instanceof LisError?error.status:500;return json(res,status,{error:error.code||'INTERNAL_ERROR',message:status===500?'Lỗi LIS Gateway.':error.message});}
  });
}

/* Token do người dùng đặt qua env là ưu tiên; nếu chưa có thì sinh một lần và lưu cạnh
   journal để `npm run lis:gateway` vẫn chạy được ngay mà KHÔNG bao giờ ở trạng thái mở.
   File token nằm trong lis-gateway/.data/ (đã gitignore). */
function resolveToken(dataDir){
  const fromEnv=String(process.env.QCLAB_LIS_TOKEN||'').trim();
  if(fromEnv)return{token:fromEnv,source:'env'};
  const file=path.join(dataDir,'token.txt');
  try{const saved=fs.readFileSync(file,'utf8').trim();if(saved)return{token:saved,source:'file',file};}catch(error){}
  const token=crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(dataDir,{recursive:true});
  fs.writeFileSync(file,token+'\n',{encoding:'utf8',mode:0o600});
  return{token,source:'new',file};
}

if(require.main===module){
  const configFile=path.resolve(process.env.QCLAB_LIS_CONFIG||path.join(ROOT,'config.example.json')),config=readConfig(configFile),dataDir=path.resolve(process.env.QCLAB_LIS_DATA||path.join(ROOT,'.data')),store=new JournalStore(path.join(dataDir,'events.ndjson')),bridge=new LisBridge(config,store),host=process.env.QCLAB_LIS_HOST||'127.0.0.1',port=Number(process.env.QCLAB_LIS_PORT)||8787;
  const {token,source,file}=resolveToken(dataDir);
  const server=createLisServer({bridge,token,allowedOrigins:config.allowedOrigins});
  server.listen(port,host,()=>{
    console.log(`QC Lab LIS Gateway: http://${host}:${port}`);
    console.log(`Config: ${configFile}`);
    console.log(`Journal: ${store.file}`);
    if(source==='env')console.log('Bearer token: lấy từ QCLAB_LIS_TOKEN.');
    else console.log(`Bearer token (${source==='new'?'vừa sinh, lưu tại':'đọc từ'} ${file}):\n  ${token}\nDán token này vào Cài đặt → LIS Gateway của QC Lab.`);
  });
}

module.exports={createLisServer,readConfig,resolveToken};
