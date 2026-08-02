/* ===== SETTINGS / CLOUD ===== */
function storageBytesText(bytes){const n=Math.max(0,Number(bytes)||0),units=['B','KB','MB','GB','TB'];let value=n,unit=0;while(value>=1024&&unit<units.length-1){value/=1024;unit++;}return(value<10&&unit>0?value.toFixed(1):Math.round(value).toLocaleString('vi-VN'))+' '+units[unit];}
function storageUsageText(data,estimate){const points=Object.values(data||{}).reduce((sum,list)=>sum+(Array.isArray(list)?list.length:0),0),e=estimate&&typeof estimate==='object'?estimate:null;if(!e)return`Số điểm QC: ${points.toLocaleString('vi-VN')}.\n\nTrình duyệt này không cung cấp thông tin hạn mức lưu trữ.`;const usage=Math.max(0,Number(e.usage)||0),quota=Math.max(0,Number(e.quota)||0),indexed=e.usageDetails&&Number.isFinite(Number(e.usageDetails.indexedDB))?Math.max(0,Number(e.usageDetails.indexedDB)):null,ratio=quota?Math.min(100,usage/quota*100):null;return`Số điểm QC: ${points.toLocaleString('vi-VN')}.\nDung lượng IndexedDB: ${indexed==null?'trình duyệt không tách riêng':storageBytesText(indexed)}.\nTổng dung lượng app đang dùng: ${storageBytesText(usage)}${quota?' / '+storageBytesText(quota):''}${ratio==null?'':' ('+ratio.toFixed(2)+'%)'}.`;}
async function checkStorageUsage(){let estimate=null;try{if(typeof navigator!=='undefined'&&navigator.storage&&typeof navigator.storage.estimate==='function')estimate=await navigator.storage.estimate();}catch(e){}await infoDialog(storageUsageText(state.data,estimate),{title:'Dung lượng cục bộ',type:'success'});}
async function saveLab(){if(!requireAdmin())return;state.lab={...(state.lab||{}),name:QCCore.cleanText(document.getElementById('labName').value),dept:QCCore.cleanText(document.getElementById('labDept').value),address:QCCore.cleanText(document.getElementById('labAddr').value,5000)};save({clearDerived:false});await infoDialog('Đã lưu thông tin đơn vị.',{type:'success'});}
function ensureLabBrandShape(){
  state.lab=state.lab||{};
  state.lab.brandTitle=QCCore.cleanText(state.lab.brandTitle||'QC Lab',80);
  state.lab.brandSub=QCCore.cleanText(state.lab.brandSub||'Nội kiểm xét nghiệm',120);
  state.lab.logoText=QCCore.cleanText(state.lab.logoText||'QC',8).slice(0,4);
  state.lab.logoData=QCCore.cleanText(state.lab.logoData||'',120000);
}
async function saveBrand(){
  if(!requireAdmin())return;
  state.lab=state.lab||{};
  state.lab.brandTitle=QCCore.cleanText(document.getElementById('brandTitle').value||'QC Lab',80);
  state.lab.brandSub=QCCore.cleanText(document.getElementById('brandSub').value||'Nội kiểm xét nghiệm',120);
  state.lab.logoText=QCCore.cleanText(document.getElementById('logoText').value||'QC',8).slice(0,4);
  save({clearDerived:false});renderBrand();rerender();await infoDialog('Đã lưu logo và tên hiển thị.',{type:'success'});
}
function readBrandInputs(){
  state.lab=state.lab||{};
  const title=document.getElementById('brandTitle'),sub=document.getElementById('brandSub'),txt=document.getElementById('logoText');
  if(title)state.lab.brandTitle=QCCore.cleanText(title.value||'QC Lab',80);
  if(sub)state.lab.brandSub=QCCore.cleanText(sub.value||'Nội kiểm xét nghiệm',120);
  if(txt)state.lab.logoText=QCCore.cleanText(txt.value||'QC',8).slice(0,4);
}
async function pickLogo(e){
  if(!requireAdmin())return;
  const f=e&&e.target&&e.target.files&&e.target.files[0];
  const nameEl=document.getElementById('logoFileName');
  if(!f)return;
  if(nameEl)nameEl.textContent=f.name;
  if(!/^image\//.test(f.type)){await infoDialog('Vui lòng chọn file ảnh.');return;}
  const r=new FileReader();
  r.onload=()=>{const img=new Image();img.onload=()=>{
    const size=160,c=document.createElement('canvas'),ctx=c.getContext('2d');c.width=size;c.height=size;
    ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);
    const scale=Math.min(size/img.width,size/img.height),w=img.width*scale,h=img.height*scale,x=(size-w)/2,y=(size-h)/2;
    ctx.drawImage(img,x,y,w,h);
    readBrandInputs();state.lab.logoData=c.toDataURL('image/png');
    save({clearDerived:false});renderBrand();rerender();
  };img.onerror=async()=>{await infoDialog('Không đọc được ảnh logo.');};img.src=String(r.result);};
  r.readAsDataURL(f);
}
function clearLogo(){if(!requireAdmin())return;state.lab=state.lab||{};state.lab.logoData='';save({clearDerived:false});renderBrand();rerender();}
function firebaseAclHelp(code){
  const user=(typeof firebase!=='undefined'&&firebase.auth&&firebase.auth().currentUser)||fb.authUser||null;
  const uid=user&&user.uid||'UID_TAI_KHOAN_FIREBASE';
  return `Đăng nhập Firebase đã thành công nhưng tài khoản chưa có quyền với mã phòng "${code}".\n\nVào Realtime Database → Data và tạo:\nqclab-acl/${code}/${uid} = true\n\nSau đó bấm Lưu & kết nối lại.`;
}
async function saveFb(){
  if(!requireAdmin())return;
  const code=document.getElementById('fbCode').value.trim()||'default',email=document.getElementById('fbEmail').value.trim(),password=document.getElementById('fbPassword').value;
  let cfg;try{cfg=parseFirebaseConfig(document.getElementById('fbConfig').value);}catch(e){await infoDialog(e&&e.message?e.message:'Firebase config không hợp lệ.');return;}
  if(!email||!password){await infoDialog('Nhập email và mật khẩu Firebase Authentication để kết nối an toàn.');return;}
  try{
    setCloudStatus('Đang kết nối Firebase...',false);markSaved('đang kết nối','Firebase');
    if(typeof firebase==='undefined'||typeof firebase.auth!=='function')throw new Error('Chưa tải được Firebase Authentication.');
    await ensureFirebaseApp(cfg);
    await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    await firebase.auth().signInWithEmailAndPassword(email,password);
    localStorage.setItem('qclab_fb',JSON.stringify({labCode:code,email,anonymous:false,config:cfg}));
    fbDisconnect();
    setCloudStatus(email+' · '+code,true);
    document.getElementById('fbPassword').value='';
    await initFirebase();
    if(fb.ref){
      const snap=await fb.ref.once('value');
      if(snap.exists())markSaved('đã kết nối','Đã tải dữ liệu từ Firebase');
      else{fb.ready=true;fb.initialized=true;await syncNow();}
    }
    await infoDialog('Đã xác thực và bật đồng bộ Firebase.\nVào Realtime Database xem tại: '+(fbDataPath()||'qclab-shared/{labCode}'),{type:'success'});
  }catch(e){
    const msg=e&&e.message?e.message:'Kiểm tra tài khoản và cấu hình.';
    setCloudStatus(msg.indexOf('permission_denied')>=0?'Chưa được cấp quyền Firebase':'Đăng nhập Firebase thất bại',false);
    await infoDialog(msg.indexOf('permission_denied')>=0?firebaseAclHelp(code):'Không thể đăng nhập Firebase: '+msg);
  }
}
function parseFirebaseConfig(raw){
  raw=String(raw||'').trim();
  if(!raw)throw new Error('Dán Firebase config trước khi kết nối.');
  let text=raw;
  try{return validateFirebaseConfig(JSON.parse(text));}catch(e){}
  const start=text.indexOf('{'),end=text.lastIndexOf('}');
  if(start<0||end<=start)throw new Error('Không tìm thấy object firebaseConfig. Hãy dán đoạn Config từ Firebase console.');
  text=text.slice(start,end+1)
    .replace(/\/\*[\s\S]*?\*\//g,'')
    .replace(/(^|[^:])\/\/.*$/gm,'$1')
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g,'$1"$2":')
    .replace(/,\s*([}\]])/g,'$1');
  try{return validateFirebaseConfig(JSON.parse(text));}
  catch(e){throw new Error('Firebase config không hợp lệ. Có thể dán nguyên đoạn từ tab Config của Firebase console, ví dụ: const firebaseConfig = { ... };');}
}
function validateFirebaseConfig(cfg){
  if(!cfg||typeof cfg!=='object'||Array.isArray(cfg))throw new Error('Firebase config phải là một object.');
  const required=['apiKey','authDomain','databaseURL','projectId','appId'],missing=required.filter(k=>!String(cfg[k]||'').trim());
  if(missing.length)throw new Error('Firebase config thiếu: '+missing.join(', ')+'.');
  return cfg;
}
async function clearFb(){
  if(!requireAdmin())return;
  localStorage.removeItem('qclab_fb');fbDisconnect();
  try{if(typeof firebase!=='undefined'&&typeof firebase.auth==='function')await firebase.auth().signOut();}catch(e){}
  fb.authUser=null;setCloudStatus('Đang chạy cục bộ',false);markSaved('đã lưu cục bộ','Đã ngắt Firebase');await infoDialog('Đã ngắt đám mây. Dữ liệu vẫn lưu cục bộ.',{type:'success'});
}
function firebaseRulesText(){
  return `{
  "rules": {
    ".read": false,
    ".write": false,
    "qclab-acl": {
      "$labCode": {
        "$uid": {
          ".read": "auth != null && auth.uid === $uid",
          ".write": false
        }
      }
    },
    "qclab-shared": {
      "$labCode": {
        ".read":  "auth != null && root.child('qclab-acl').child($labCode).child(auth.uid).exists()",
        ".write": "auth != null && root.child('qclab-acl').child($labCode).child(auth.uid).exists()",
        ".validate": "newData.hasChildren(['_ts'])",
        "_ts": { ".validate": "newData.isNumber()" },
        "_client": { ".validate": "newData.isString()" }
      }
    }
  }
}`;
}
function firebaseGuideHtml(){
  const step=(n,title,body)=>`<div class="fb-step"><div class="fb-num">${n}</div><div class="fb-step-body"><h4>${title}</h4>${body}</div></div>`;
  return `<details class="firebase-guide"><summary>Hướng dẫn Firebase chi tiết</summary>
    <div class="firebase-guide-body">
      <div class="alert info">Mặc định ai cũng đọc/ghi được (Anonymous). Làm 5 bước dưới để chỉ tài khoản được duyệt mới đồng bộ được.</div>
      ${step(1,'Bật đăng nhập Email/Password','<p>Firebase Console → Authentication → Sign-in method: tắt <b>Anonymous</b>, bật <b>Email/Password</b>.</p>')}
      ${step(2,'Tạo tài khoản, lấy UID','<p>Authentication → Users → Add user — mỗi máy/người 1 tài khoản, sau đó copy <b>User UID</b>.</p>')}
      ${step(3,'Thêm UID vào danh sách được phép','<p>Realtime Database → Data, tạo đúng cấu trúc theo mã phòng (labCode) đang dùng:</p><pre>qclab-acl\n  khoaXN\n    UID_TAI_KHOAN_1: true\n    UID_TAI_KHOAN_2: true</pre><p>Đổi labCode thành <code>labA</code> thì ACL nằm ở <code>qclab-acl/labA/{uid}</code>.</p>')}
      ${step(4,'Dán Rules','<p>Realtime Database → Rules → dán nguyên nội dung khung <b>Firebase Rules</b> bên dưới → Publish. Không sửa <code>$labCode</code>/<code>$uid</code>.</p>')}
      ${step(5,'Kết nối trong app','<p>Thẻ Đồng bộ đám mây → nhập labCode, email/mật khẩu, dán Firebase config → bấm <b>Lưu &amp; kết nối</b>.</p>')}
      <section><h4>Kiểm tra nhanh</h4><ul class="fb-check">
        <li><b>✓</b> UID có trong ACL — đồng bộ được.</li>
        <li><b>✕</b> UID không có trong ACL — bị từ chối đọc/ghi.</li>
        <li><b>ℹ</b> <code>qclab-shared/{labCode}</code>: dữ liệu app tự đồng bộ · <code>qclab-acl/{labCode}</code>: danh sách UID bạn tự tạo.</li>
      </ul></section>
    </div>
  </details>`;
}
async function copyFirebaseRules(){
  const text=firebaseRulesText();
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(text);
    else{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}
    await infoDialog('Đã copy Firebase Rules.',{type:'success'});
  }catch(e){await infoDialog('Không copy được tự động. Bạn có thể chọn và copy trong thẻ Firebase Rules.');}
}
/* ===== SETTINGS PAGE ROUTE ===== */
function pageSettings(){
  const fbcfg=getFbCfg()||{};
  const liscfg=typeof lisGatewayConfig==='function'?lisGatewayConfig():{enabled:false,url:'http://127.0.0.1:8787'};
  const lockedCloud=!!(fbcfg&&fbcfg.locked);
  const logo=brandLogo();
  const brandPreview=`<div class="brand-preview"><div class="brand-mark">${logo?`<img src="${escAttr(logo)}" alt="">`:esc(brandMarkText())}</div><div><b>${esc(brandTitle())}</b><small>${esc(brandSub())}</small></div></div>`;
  return headOnly('Cài đặt & Đồng bộ','Thông tin đơn vị, backup và kết nối Firebase')+
   `<div class="settings-profile-grid">
    <div class="panel"><h3 role="heading" aria-level="2">Thông tin đơn vị</h3>
      <div class="settings-unit-fields"><div><label>Tên bệnh viện / đơn vị</label><input id="labName" aria-label="Tên bệnh viện / đơn vị" value="${escAttr(state.lab.name||'')}"></div>
        <div><label>Khoa / phòng</label><input id="labDept" aria-label="Khoa / phòng" value="${escAttr(state.lab.dept||'')}"></div>
        <div><label>Địa chỉ</label><input id="labAddr" aria-label="Địa chỉ" value="${escAttr(state.lab.address||'')}"></div></div>
     <div class="settings-panel-actions">${btn('Lưu thông tin','saveLab()','teal')}</div>
    </div>
    <div class="panel"><h3>Logo & tên phần mềm</h3>
     <div class="grid2">
       <div>
         <label>Tên hiển thị trên thanh bên</label><input id="brandTitle" aria-label="Tên hiển thị trên thanh bên" value="${escAttr(brandTitle())}">
         <label>Dòng phụ</label><input id="brandSub" aria-label="Dòng phụ" value="${escAttr(brandSub())}">
         <label>Chữ trong logo khi chưa dùng ảnh</label><input id="logoText" aria-label="Chữ trong logo khi chưa dùng ảnh" maxlength="4" value="${escAttr(brandMarkText())}">
       </div>
       <div>
         <label>Logo hiện tại</label>${brandPreview}
         <label>Chọn ảnh logo</label>
         <div class="file-pick">${btn('Chọn tệp',"document.getElementById('logoFile').click()",'ghost sm','',{attrs:{type:'button'}})}<span id="logoFileName" class="hint">Chưa chọn tệp</span></div>
         <input id="logoFile" type="file" accept="image/*" style="display:none" onchange="pickLogo(event)">
         <div class="hint settings-brand-note">Nên dùng ảnh vuông PNG/JPG, dung lượng nhỏ. Logo được lưu cùng dữ liệu phần mềm.</div>
       </div>
     </div>
     <div class="settings-panel-actions">${btn('Lưu logo','saveBrand()','teal')}${btn('Bỏ ảnh logo','clearLogo()','ghost')}</div>
    </div>
   </div>
   <div class="panel"><h3>Quản trị dữ liệu</h3>
     <div class="admin-tools">
        <div class="admin-tool"><b>Xuất backup</b><span>Lưu toàn bộ dữ liệu hiện tại ra file để cất giữ hoặc chuyển sang máy khác. ${backupStatusText()} ${backupCapacityText()}</span>${btn('Xuất backup','exportData()','ghost')}</div>
        <div class="admin-tool"><b>Nhập backup</b><span>Khôi phục dữ liệu từ file đã xuất trước đó. File trên 128 MB vẫn nhập được nhưng sẽ hỏi xác nhận; chỉ tài khoản quản trị được phép nhập.</span>${btn('Chọn file backup',"document.getElementById('imp').click()",'ghost')}<input id="imp" type="file" accept="application/json" style="display:none" onchange="importData(event)"></div>
        <div class="admin-tool"><b>Kiểm tra backup</b><span>Kiểm tra checksum, cấu trúc, số điểm và khoảng ngày mà không thay đổi dữ liệu đang vận hành.</span>${btn('Chọn file để kiểm tra',"document.getElementById('verifyBackup').click()",'ghost')}<input id="verifyBackup" type="file" accept="application/json" style="display:none" onchange="verifyBackupFile(event)"></div>
        <div class="admin-tool"><b>Dung lượng cục bộ</b><span>Xem số điểm QC và tỷ lệ IndexedDB/trình duyệt đang sử dụng.</span>${btn('Kiểm tra dung lượng','checkStorageUsage()','ghost')}</div>
        <div class="admin-tool"><b>Xóa sạch dữ liệu test</b><span>Đưa app về trạng thái trắng, giữ tài khoản đăng nhập hiện tại để không bị khóa.</span>${btn('Xóa sạch dữ liệu','resetAllData()','danger')}</div>
      </div></div>
   <div class="panel firebase-sync-panel"><h3>Đồng bộ đám mây (Firebase Realtime Database)</h3>
     <div class="firebase-auth-grid"><div><label>Mã phòng</label><input id="fbCode" aria-label="Mã phòng" value="${escAttr(fbcfg.labCode||'khoaXN')}" ${lockedCloud?'readonly':''}></div>
       <div><label>Email Firebase Authentication</label><input id="fbEmail" aria-label="Email Firebase Authentication" type="email" autocomplete="username" value="${escAttr(fbcfg.email||'')}"></div>
       <div><label>Mật khẩu Firebase</label><input id="fbPassword" type="password" autocomplete="current-password" placeholder="Chỉ dùng để đăng nhập, không lưu"></div></div>
     ${lockedCloud?`<div class="hint" style="margin-top:6px">Bản deploy này khóa sẵn <code>${esc(fbDataPath())}</code>. Muốn đổi mã phòng cần sửa <code>assets/modules/app-meta.js</code>.</div>`:''}
     <label>Firebase config (dán nguyên đoạn từ tab Config của Firebase console)</label>
     <textarea id="fbConfig" class="firebase-config-input" ${lockedCloud?'readonly':''} placeholder='const firebaseConfig = {
  apiKey: "...",
  authDomain: "yourapp.firebaseapp.com",
  databaseURL: "https://yourapp-default-rtdb.firebaseio.com",
  projectId: "yourapp",
  storageBucket: "yourapp.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};'>${fbcfg.config?JSON.stringify(fbcfg.config,null,2):''}</textarea>
     <div class="firebase-actions">${btn('Lưu &amp; kết nối','saveFb()','teal')} ${btn('Ngắt đám mây','clearFb()','ghost')}</div></div>
   <div class="panel lis-gateway-panel"><h3>LIS Gateway (thử nghiệm)</h3>
     <div class="lis-gateway-body"><div class="lis-gateway-grid"><div><label for="lisGatewayUrl">Địa chỉ Gateway cục bộ</label><input id="lisGatewayUrl" value="${escAttr(liscfg.url)}" placeholder="http://127.0.0.1:8787"></div><div><label for="lisGatewayToken">Bearer token${liscfg.token?' (đã lưu — để trống nếu giữ nguyên)':''}</label><input id="lisGatewayToken" type="password" autocomplete="off" placeholder="${liscfg.token?'••••••••':'Dán token in ra khi chạy npm run lis:gateway'}"></div><label class="lis-gateway-toggle"><input id="lisGatewayEnabled" type="checkbox" ${liscfg.enabled?'checked':''}><span>Tự động kiểm tra hàng chờ mỗi 5 phút</span></label></div>
       <div id="lisGatewayStatus" class="alert ${lisGatewayRuntime.status==='ok'?'ok':lisGatewayRuntime.status==='error'?'rej':''}">${esc(lisGatewayStatusText())}</div>
       <div class="hint">Lấy kết quả nội kiểm mà middleware LIS đã đẩy vào Gateway. Kết quả KHÔNG tự thành điểm QC — phải mở hàng chờ và xác nhận từng dòng thì mới ghi vào dữ liệu nội kiểm. Không nhận dữ liệu bệnh nhân. Prototype chỉ cho phép localhost:8787.</div></div>
     <div class="settings-panel-actions">${btn('Lưu &amp; kiểm tra','lisGatewaySaveSettings()','teal')}${btn('Xem hàng chờ QC','lisOpenQueueModal()','ghost')}</div></div>
   <div class="panel"><h3>Firebase Rules</h3>
     ${firebaseGuideHtml()}
     <div class="rules-tools"><span>Copy cố định vào Realtime Database → Rules. Không sửa <code>$labCode</code> hoặc <code>$uid</code>.</span>${btn('Copy rules','copyFirebaseRules()','ghost sm')}</div>
     <pre class="rules-code" tabindex="0">${esc(firebaseRulesText())}</pre></div>`;
}
