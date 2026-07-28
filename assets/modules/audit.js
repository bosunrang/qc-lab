/* ===== AUDIT LOG ===== */
function auditCanonical(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return'['+value.map(auditCanonical).join(',')+']';
  return'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+auditCanonical(value[k])).join(',')+'}';
}
/* SHA-256 thuần JS để logAct vẫn đồng bộ. Dùng cho tamper-evident audit chain,
   không dùng cho mật khẩu (mật khẩu vẫn dùng PBKDF2 trong users-auth.js). */
function auditSha256(ascii){
  function rightRotate(value,amount){return(value>>>amount)|(value<<(32-amount));}
  const mathPow=Math.pow,maxWord=mathPow(2,32),lengthProperty='length',words=[];
  /** @type {any} */
  const self=auditSha256;
  let hash=self.h=self.h||[],k=self.k=self.k||[],primeCounter=k[lengthProperty],isComposite={};
  for(let candidate=2;primeCounter<64;candidate++){
    if(!isComposite[candidate]){
      for(let i=0;i<313;i+=candidate)isComposite[i]=candidate;
      hash[primeCounter]=(mathPow(candidate,.5)*maxWord)|0;
      k[primeCounter++]=(mathPow(candidate,1/3)*maxWord)|0;
    }
  }
  ascii=unescape(encodeURIComponent(String(ascii)));
  const asciiBitLength=ascii[lengthProperty]*8;
  ascii+='\x80';
  while(ascii[lengthProperty]%64-56)ascii+='\x00';
  for(let i=0;i<ascii[lengthProperty];i++)words[i>>2]|=ascii.charCodeAt(i)<<((3-i)%4)*8;
  words[words[lengthProperty]]=((asciiBitLength/maxWord)|0);
  words[words[lengthProperty]]=asciiBitLength;
  for(let j=0;j<words[lengthProperty];){
    const w=words.slice(j,j+=16),oldHash=hash;
    hash=hash.slice(0,8);
    for(let i=0;i<64;i++){
      const w15=w[i-15],w2=w[i-2];
      const a=hash[0],e=hash[4];
      const temp1=hash[7]+(rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25))+((e&hash[5])^((~e)&hash[6]))+k[i]+(w[i]=i<16?w[i]:(w[i-16]+(rightRotate(w15,7)^rightRotate(w15,18)^(w15>>>3))+w[i-7]+(rightRotate(w2,17)^rightRotate(w2,19)^(w2>>>10)))|0);
      const temp2=(rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash=[(temp1+temp2)|0].concat(hash);
      hash[4]=(hash[4]+temp1)|0;
      hash.pop();
    }
    for(let i=0;i<8;i++)hash[i]=(hash[i]+oldHash[i])|0;
  }
  let result='';
  for(let i=0;i<8;i++)for(let j=3;j+1;j--){const b=(hash[i]>>(j*8))&255;result+=((b<16)?0:'')+b.toString(16);}
  return result;
}
function auditEntryPayload(entry){const{hash,prevHash,...payload}=entry||{};return payload;}
function auditEntryHash(entry){return auditSha256(String(entry&&entry.prevHash||'')+'|'+auditCanonical(auditEntryPayload(entry)));}
function auditLastHash(){
  for(let i=(state.activity||[]).length-1;i>=0;i--){const h=state.activity[i]&&state.activity[i].hash;if(h)return h;}
  return '';
}
/* anchor = hash dong cuoi cua phan da bi cat khoi nhat ky (luu tru / xoay vong).
   Bat dau tu neo thay vi tu '' cho phep phan con lai GIU NGUYEN hash goc — vua re
   (cat la O(1) thay vi bam lai ca chuoi) vua dung nghia tamper-evident hon: file CSV
   luu tru noi thang vao chuoi dang song bang mat ma, khong chi bang mot dong ghi chu. */
function auditVerifyChain(activity=state.activity||[],anchor=(typeof state!=='undefined'&&state&&state.activityAnchor)||''){
  let prev=String(anchor||''),checked=0,legacy=0;
  for(let i=0;i<activity.length;i++){
    const a=activity[i]||{};
    if(!a.hash&&!a.prevHash){legacy++;continue;}
    if(a.prevHash!==prev)return{ok:false,checked,legacy,brokenIndex:i,reason:'prevHash không khớp'};
    if(a.hash!==auditEntryHash(a))return{ok:false,checked,legacy,brokenIndex:i,reason:'hash không khớp'};
    prev=a.hash;checked++;
  }
  return{ok:true,checked,legacy,brokenIndex:-1,reason:''};
}
/* GIỚI HẠN NHẬT KÝ (log rotation). state.activity không có ngưỡng tự nhiên: mỗi
   thao tác nghiệp vụ đều qua logAct, nên 1–2 năm vận hành có thể phình snapshot
   tới mức hydrate/serialize/sync Firebase đều chậm hẳn. Hai cơ chế bổ sung nhau:
   - Lưu trữ CÓ CHỦ ĐÍCH (archiveActivityLog ở users-auth.js): admin chọn mốc
     thời gian, app xuất CSV phần cũ TRƯỚC rồi mới cắt — đây là đường khuyến
     nghị, dòng đã cắt vẫn truy xuất được từ file.
   - Xoay vòng TỰ ĐỘNG (auditRotateOverflow bên dưới): van an toàn khi nhật ký
     vượt ACTIVITY_HARD_CAP mà chưa ai lưu trữ — giữ ACTIVITY_ROTATE_TO dòng mới
     nhất, KHÔNG xuất CSV (logAct đồng bộ, không thể tự bật download giữa một
     thao tác khác). Mất phần cũ là đánh đổi có ý thức để tránh hỏng cả hệ thống
     lưu trữ; dòng checkpoint ghi lại hash đỉnh của phần đã loại để còn điểm
     đối chiếu nếu lab giữ backup. Khai báo `let` để test chỉnh ngưỡng thấp
     (cùng lý do LS_FULL_ROTATE_MAX_INCREMENTALS ở state-storage.js). */
/* Tran ha tu 120 000/100 000: chi phi con lai la auditVerifyChain(), do duoc ~1 921ms
   cho 20 000 dong nen 50 000 la ~4,8s — chap nhan duoc khi da co cache + chi chay theo
   yeu cau (xem auditChainStatus). Nguong cu 120 000 cho ~11,5s moi lan kiem. */
let ACTIVITY_HARD_CAP=50000,ACTIVITY_ROTATE_TO=40000;
function auditLastHashOf(list){
  for(let i=(list||[]).length-1;i>=0;i--){const h=list[i]&&list[i].hash;if(h)return h;}
  return '';
}
/* Tách phần nhật ký CŨ HƠN cutoffIso (ISO string) để lưu trữ. Dòng thiếu/sai ts
   được giữ lại phía retained (an toàn hơn là xóa nhầm dòng không định tuổi
   được). tipHash = hash đỉnh của phần bị cắt — điểm đối chiếu mật mã giữa file
   CSV lưu trữ và chuỗi còn lại (CSV xuất kèm cột PrevHash/Hash nên kiểm chứng
   độc lập được: hash cuối file phải bằng tipHash trong dòng checkpoint). */
function auditArchiveCut(activity,cutoffIso){
  const cutoff=String(cutoffIso||''),segment=[],retained=[];
  (activity||[]).forEach(a=>{
    const ts=String(a&&a.ts||'');
    if(ts&&ts<cutoff)segment.push(a);else retained.push(a);
  });
  return{segment,retained,tipHash:auditLastHashOf(segment)};
}
function auditPushRaw(type,detail,target=''){
  state.activity=state.activity||[];
  /* Neo chi co nghia khi con dong de noi vao. Nhat ky rong ma con neo cu (xoa nhat ky,
     nhap backup, reset) se lam auditVerifyChain() bao "audit bi sua" gia ngay tu dong
     dau tien — giu bat bien nay o day de moi duong dung lai nhat ky deu duoc bao ve,
     khong phai nho tung noi goi nho tay. */
  if(!state.activity.length&&state.activityAnchor)state.activityAnchor='';
  const entry={
    id:uid(),
    seq:auditNextSeq(),
    ts:new Date().toISOString(),
    user:userName(),
    username:currentUser&&currentUser.username||'',
    userId:currentUser&&currentUser.id||'',
    role:role(),
    type,
    detail,
    target,
    clientId:fb&&fb.clientId||'',
    prevHash:auditLastHash()
  };
  entry.hash=auditEntryHash(entry);
  state.activity.push(entry);
}
/* Cat prefix va DAT NEO thay vi relink: relink phai bam lai SHA-256 cho tung dong con
   lai — do duoc 2 235ms cho 20 000 dong, tuc ~11 GIAY o nguong xoay vong. Ham nay chay
   ben trong logAct(), giua mot thao tac khong lien quan (dang luu diem QC), nen 11 giay
   do la treo giao dien khong bao truoc. Dat neo lam viec do thanh O(1). */
function auditRotateOverflow(){
  const list=state.activity||[];
  if(list.length<=ACTIVITY_HARD_CAP)return;
  const dropped=list.slice(0,list.length-ACTIVITY_ROTATE_TO),tip=auditLastHashOf(dropped);
  state.activity=list.slice(-ACTIVITY_ROTATE_TO);
  if(tip)state.activityAnchor=tip;
  auditPushRaw('Xoay vòng nhật ký hoạt động',`Nhật ký vượt ${ACTIVITY_HARD_CAP} dòng: tự động loại ${dropped.length} dòng cũ nhất, giữ lại ${ACTIVITY_ROTATE_TO} dòng mới nhất (không xuất CSV). Hash đỉnh phần đã loại: ${tip||'—'}. Nên dùng "Lưu trữ nhật ký cũ" ở trang Nhật ký để có file CSV trước khi cắt.`,'Nhật ký');
}
function logAct(type,detail,target=''){
  auditPushRaw(type,detail,target);
  auditRotateOverflow();
}
/* Kiem chuoi la O(n) SHA-256 (~1 921ms/20 000 dong) nhung pageAudit() goi no o MOI lan
   render, ma doi trang / doi bo loc / go tim kiem deu rerender() — tuc la o nguong tran
   thi moi cu bam la mot lan dung hinh. Cache theo chu ky (so dong + hash cuoi + neo):
   loc/phan trang khong lam chu ky doi nen chi kiem lai khi nhat ky that su thay doi.
   Voi nhat ky lon thi khong tu kiem nua — tra ve trang thai 'idle' de giao dien moi
   nguoi dung bam kiem, thay vi treo giao dien khong bao truoc. */
let auditChainCache={sig:'',result:null};
const AUDIT_AUTO_VERIFY_MAX=5000;
function auditChainSignature(){
  const list=state.activity||[],last=list[list.length-1]||{};
  return `${list.length}|${last.hash||''}|${state.activityAnchor||''}`;
}
function auditChainStatus(force=false){
  const sig=auditChainSignature();
  if(auditChainCache.sig===sig&&auditChainCache.result)return auditChainCache.result;
  const list=state.activity||[];
  if(!force&&list.length>AUDIT_AUTO_VERIFY_MAX)return{idle:true,total:list.length};
  const result={...auditVerifyChain(),idle:false};
  auditChainCache={sig,result};
  return result;
}
function auditVerifyChainNow(){auditChainCache={sig:'',result:null};auditChainStatus(true);rerender();}
function auditNextSeq(){return(state.activity||[]).reduce((m,a)=>Math.max(m,+a.seq||0),0)+1;}
/* Tính lại chuỗi hash theo ĐÚNG thứ tự hiện tại của mảng — dùng sau khi Firebase
   merge (fbMerge()) ghép activity của 2 máy lại. mergePointArray() trộn theo
   từng phần tử (khóa id) chứ không theo mốc thời gian logic của TỪNG chuỗi hash
   riêng: nó xếp "toàn bộ activity của remote trước, rồi nối phần chỉ-có-ở-local
   vào sau", nên hai dòng vốn liền kề trong chuỗi hash gốc của một máy (vd 2 dòng
   máy A ghi lúc đang offline) có thể bị chen dòng của máy B vào giữa sau khi
   merge — khiến auditVerifyChain() báo "prevHash không khớp" dù không ai sửa gì,
   chỉ vì thứ tự mảng đổi. Quét lại theo thứ tự SAU merge và nối lại prevHash/hash
   cho khớp chính thứ tự đó biến mảng đã merge thành MỘT chuỗi hợp lệ mới (giống
   một lần "reorg"), không cần đổi gì ở auditVerifyChain(). Dòng "legacy" (không
   có cả hash lẫn prevHash — vd nhập từ backup cũ, xem importData() ở data-io.js)
   được giữ nguyên, không ép vào chuỗi, khớp với cách auditVerifyChain() đã bỏ
   qua các dòng đó. Hàm này idempotent: gọi lại trên một chuỗi đã hợp lệ sẵn cho
   ra đúng hash/prevHash cũ, nên gọi vô điều kiện sau mỗi lần merge là an toàn. */
function auditRelinkChain(activity,anchor=''){
  let prev=String(anchor||'');
  return(activity||[]).map(a=>{
    if(!a||(!a.hash&&!a.prevHash))return a;
    const relinked={...a,prevHash:prev};
    relinked.hash=auditEntryHash(relinked);
    prev=relinked.hash;
    return relinked;
  });
}
