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
function auditVerifyChain(activity=state.activity||[]){
  let prev='',checked=0,legacy=0;
  for(let i=0;i<activity.length;i++){
    const a=activity[i]||{};
    if(!a.hash&&!a.prevHash){legacy++;continue;}
    if(a.prevHash!==prev)return{ok:false,checked,legacy,brokenIndex:i,reason:'prevHash không khớp'};
    if(a.hash!==auditEntryHash(a))return{ok:false,checked,legacy,brokenIndex:i,reason:'hash không khớp'};
    prev=a.hash;checked++;
  }
  return{ok:true,checked,legacy,brokenIndex:-1,reason:''};
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
function auditRelinkChain(activity){
  let prev='';
  return(activity||[]).map(a=>{
    if(!a||(!a.hash&&!a.prevHash))return a;
    const relinked={...a,prevHash:prev};
    relinked.hash=auditEntryHash(relinked);
    prev=relinked.hash;
    return relinked;
  });
}
