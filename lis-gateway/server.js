'use strict';

const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {LisBridge,LisError}=require('./core');
const {JournalStore}=require('./store');

const ROOT=__dirname;
function readConfig(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function json(res,status,value){const body=JSON.stringify(value),headers={'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store'};if(res.lisCorsOrigin)headers['access-control-allow-origin']=res.lisCorsOrigin;res.writeHead(status,headers);res.end(body);}
function readBody(req,maxBytes=1024*1024){return new Promise((resolve,reject)=>{let size=0,parts=[];req.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){reject(new LisError('PAYLOAD_TOO_LARGE','Payload vượt quá 1 MB.',413));req.destroy();return;}parts.push(chunk);});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(parts).toString('utf8')||'{}'));}catch(error){reject(new LisError('INVALID_JSON','JSON không hợp lệ.'));}});req.on('error',reject);});}
function authorized(req,token){if(!token)return true;return req.headers.authorization===`Bearer ${token}`;}

function createLisServer(opts={}){
  const bridge=opts.bridge,token=opts.token||'',allowedOrigins=new Set(opts.allowedOrigins||['null','http://127.0.0.1:8080','http://localhost:8080']);
  if(!bridge)throw new Error('Thiếu LisBridge.');
  return http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      const origin=String(req.headers.origin||'');if(origin&&allowedOrigins.has(origin))res.lisCorsOrigin=origin;
      if(req.method==='OPTIONS'){if(origin&&!allowedOrigins.has(origin))return json(res,403,{error:'ORIGIN_DENIED',message:'Origin không được phép.'});res.writeHead(204,{'access-control-allow-origin':origin||'null','access-control-allow-methods':'GET, POST, PUT, OPTIONS','access-control-allow-headers':'content-type, authorization','access-control-max-age':'600'});return res.end();}
      if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,service:'qclab-lis-gateway',...bridge.status()});
      if(!authorized(req,token))return json(res,401,{error:'UNAUTHORIZED',message:'Bearer token không hợp lệ.'});
      if(req.method==='GET'&&url.pathname==='/api/v1/messages')return json(res,200,{items:bridge.listMessages(url.searchParams.get('limit'))});
      if(req.method==='PUT'&&url.pathname==='/api/v1/qc-status')return json(res,200,{qc:bridge.setQcStatus(await readBody(req))});
      if(req.method==='POST'&&url.pathname==='/api/v1/messages'){const result=bridge.ingest(await readBody(req));return json(res,result.duplicate?200:201,result);}
      return json(res,404,{error:'NOT_FOUND',message:'Endpoint không tồn tại.'});
    }catch(error){const status=error instanceof LisError?error.status:500;return json(res,status,{error:error.code||'INTERNAL_ERROR',message:status===500?'Lỗi LIS Gateway.':error.message});}
  });
}

if(require.main===module){
  const configFile=path.resolve(process.env.QCLAB_LIS_CONFIG||path.join(ROOT,'config.example.json')),config=readConfig(configFile),dataDir=path.resolve(process.env.QCLAB_LIS_DATA||path.join(ROOT,'.data')),store=new JournalStore(path.join(dataDir,'events.ndjson')),bridge=new LisBridge(config,store),host=process.env.QCLAB_LIS_HOST||'127.0.0.1',port=Number(process.env.QCLAB_LIS_PORT)||8787,token=process.env.QCLAB_LIS_TOKEN||'';
  if(host!=='127.0.0.1'&&host!=='localhost'&&!token)throw new Error('Phải đặt QCLAB_LIS_TOKEN trước khi bind ra ngoài localhost.');
  const server=createLisServer({bridge,token,allowedOrigins:config.allowedOrigins});server.listen(port,host,()=>{console.log(`QC Lab LIS Gateway: http://${host}:${port}`);console.log(`Config: ${configFile}`);console.log(`Journal: ${store.file}`);console.log(token?'Bearer token: đã bật':'Bearer token: tắt (chỉ phù hợp localhost thử nghiệm)');});
}

module.exports={createLisServer,readConfig};
