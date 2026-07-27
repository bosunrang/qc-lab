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
function auditEntryParents(entry){
  const merge=Array.isArray(entry&&entry.mergePrevHashes)?entry.mergePrevHashes.filter(Boolean):[];
  return merge.length?[...new Set(merge.map(String))]:(entry&&entry.prevHash?[String(entry.prevHash)]:[]);
}
function auditVerifyChain(activity=state.activity||[]){
  const seen=new Set();let checked=0,legacy=0,roots=0;
  for(let i=0;i<activity.length;i++){
    const a=activity[i]||{};
    if(!a.hash&&!a.prevHash){legacy++;continue;}
    if(a.hash!==auditEntryHash(a))return{ok:false,checked,legacy,roots,brokenIndex:i,reason:'hash không khớp'};
    if(seen.has(a.hash))return{ok:false,checked,legacy,roots,brokenIndex:i,reason:'hash bị trùng'};
    const parents=auditEntryParents(a);
    if(!parents.length)roots++;
    else if(parents.some(hash=>!seen.has(hash)))return{ok:false,checked,legacy,roots,brokenIndex:i,reason:'prevHash không tồn tại trước đó'};
    seen.add(a.hash);checked++;
  }
  return{ok:true,checked,legacy,roots,brokenIndex:-1,reason:''};
}
function logAct(type,detail,target=''){
  state.activity=state.activity||[];
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
function auditNextSeq(){return(state.activity||[]).reduce((m,a)=>Math.max(m,+a.seq||0),0)+1;}
/* Audit sau đồng bộ là một DAG bất biến: hai máy có thể cùng nối bản ghi mới vào
   một hash gốc khi chạy offline. Không băm lại lịch sử để ép các nhánh thành một
   chuỗi tuyến tính — việc đó sẽ "hợp thức hóa" cả nội dung đã bị sửa. Thay vào đó,
   giữ nguyên từng hash và thêm một merge anchor mới tham chiếu mọi đầu nhánh.
   Anchor được tạo hoàn toàn từ tập head nên hai máy cho ra cùng id/hash. */
function auditChainHeads(activity){
  const hashes=new Set(),referenced=new Set();
  (activity||[]).forEach(a=>{if(a&&a.hash)hashes.add(String(a.hash));auditEntryParents(a).forEach(hash=>referenced.add(hash));});
  return[...hashes].filter(hash=>!referenced.has(hash)).sort();
}
function auditMergeChains(activity){
  const source=Array.isArray(activity)?activity:[],verification=auditVerifyChain(source);
  if(!verification.ok)return{...verification,activity:source,verification,anchored:false};
  const heads=auditChainHeads(source);
  if(heads.length<=1)return{ok:true,activity:source,verification,anchored:false};
  const key=auditSha256(heads.join('|')),id='audit_merge_'+key.slice(0,48);
  const existing=source.find(a=>a&&a.id===id);
  if(existing)return{ok:true,activity:source,verification,anchored:false};
  const times=source.map(a=>Date.parse(a&&a.ts)).filter(Number.isFinite),ts=new Date((times.length?Math.max(...times):0)+1).toISOString();
  const entry={id,seq:source.reduce((m,a)=>Math.max(m,+a.seq||0),0)+1,ts,user:'Hệ thống',username:'system',userId:'',role:'admin',type:'Hợp nhất nhật ký',detail:`Hợp nhất ${heads.length} nhánh audit hợp lệ sau đồng bộ`,target:'Đồng bộ',clientId:'merge',prevHash:heads[heads.length-1],mergePrevHashes:heads};
  entry.hash=auditEntryHash(entry);
  const merged=source.concat(entry),checked=auditVerifyChain(merged);
  return{...checked,activity:checked.ok?merged:source,verification:checked,anchored:checked.ok};
}
