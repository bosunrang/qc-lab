/* ===== SETTINGS / CLOUD ===== */
async function checkStorageUsage(){let estimate=null;try{if(typeof navigator!=='undefined'&&navigator.storage&&typeof navigator.storage.estimate==='function')estimate=await navigator.storage.estimate();}catch(e){}await infoDialog(globalThis.settingsStorageUsageText(state.data,estimate),{title:'Dung lượng cục bộ',type:'success'});}
async function saveLab(){if(!requireAdmin())return;const input={name:document.getElementById('labName').value,dept:document.getElementById('labDept').value,address:document.getElementById('labAddr').value};globalThis.SettingsProfileCommand.saveLab(input);await infoDialog('Đã lưu thông tin đơn vị.',{type:'success'});}
function ensureLabBrandShape(){state.lab=state.lab||{};Object.assign(state.lab,globalThis.settingsBrandProfile(state.lab));}
async function saveBrand(){
  if(!requireAdmin())return;
  const input={brandTitle:document.getElementById('brandTitle').value,brandSub:document.getElementById('brandSub').value,logoText:document.getElementById('logoText').value};
  globalThis.SettingsProfileCommand.saveBrand(input);await infoDialog('Đã lưu logo và tên hiển thị.',{type:'success'});
}
function readBrandInputs(){
  const title=document.getElementById('brandTitle'),sub=document.getElementById('brandSub'),txt=document.getElementById('logoText');
  globalThis.SettingsProfileCommand.updateDraft({brandTitle:title?title.value:state.lab&&state.lab.brandTitle,brandSub:sub?sub.value:state.lab&&state.lab.brandSub,logoText:txt?txt.value:state.lab&&state.lab.logoText});
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
    const title=document.getElementById('brandTitle'),sub=document.getElementById('brandSub'),txt=document.getElementById('logoText');globalThis.SettingsProfileCommand.saveLogo({brandTitle:title?title.value:state.lab&&state.lab.brandTitle,brandSub:sub?sub.value:state.lab&&state.lab.brandSub,logoText:txt?txt.value:state.lab&&state.lab.logoText},c.toDataURL('image/png'));
  };img.onerror=async()=>{await infoDialog('Không đọc được ảnh logo.');};img.src=String(r.result);};
  r.readAsDataURL(f);
}
function clearLogo(){if(!requireAdmin())return;globalThis.SettingsProfileCommand.clearLogo();}
async function saveFb(){
  if(!requireAdmin())return;
  const input={labCode:document.getElementById('fbCode').value,email:document.getElementById('fbEmail').value,password:document.getElementById('fbPassword').value,config:document.getElementById('fbConfig').value};let plan;
  try{plan=globalThis.firebaseSettingsService.prepare(input);}catch(e){await infoDialog(e&&e.message?e.message:'Firebase config không hợp lệ.');return;}
  if(!plan.ok){await infoDialog('Nhập email và mật khẩu Firebase Authentication để kết nối an toàn.');return;}
  const code=plan.labCode,email=plan.email,password=plan.password,cfg=plan.config;
  try{
    setCloudStatus('Đang kết nối Firebase...',false);markSaved('đang kết nối','Firebase');
    await globalThis.SettingsFirebaseCommand.connect({labCode:code,email,password,config:cfg});
    await infoDialog('Đã xác thực và bật đồng bộ Firebase.\nVào Realtime Database xem tại: '+(fbDataPath()||'qclab-shared/{labCode}'),{type:'success'});
  }catch(e){
    const msg=e&&e.message?e.message:'Kiểm tra tài khoản và cấu hình.';
    setCloudStatus(msg.indexOf('permission_denied')>=0?'Chưa được cấp quyền Firebase':'Đăng nhập Firebase thất bại',false);
    const user=(typeof firebase!=='undefined'&&firebase.auth&&firebase.auth().currentUser)||fb.authUser||null;await infoDialog(msg.indexOf('permission_denied')>=0?globalThis.settingsFirebaseAclHelp(code,user&&user.uid||'UID_TAI_KHOAN_FIREBASE'):'Không thể đăng nhập Firebase: '+msg);
  }
}
async function clearFb(){
  if(!requireAdmin())return;
  await globalThis.SettingsFirebaseCommand.clear();await infoDialog('Đã ngắt đám mây. Dữ liệu vẫn lưu cục bộ.',{type:'success'});
}
async function copyFirebaseRules(){
  const text=globalThis.settingsFirebaseRulesText();
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(text);
    else{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}
    await infoDialog('Đã copy Firebase Rules.',{type:'success'});
  }catch(e){await infoDialog('Không copy được tự động. Bạn có thể chọn và copy trong thẻ Firebase Rules.');}
}
/* ===== SETTINGS PAGE ROUTE ===== */
function pageSettings(){
  const fbcfg=getFbCfg()||{};
  const liscfg=lisGatewayConfig();
  const lockedCloud=!!(fbcfg&&fbcfg.locked);
  const logo=brandLogo();
  const brandPreview=globalThis.settingsBrandPreviewHtml({logo,markText:brandMarkText(),title:brandTitle(),subtitle:brandSub()});
  const firebaseRulesPanel=globalThis.settingsFirebaseRulesPanelHtml(globalThis.settingsFirebaseGuideHtml(),globalThis.settingsFirebaseRulesText());
  return globalThis.settingsPageLayoutHtml({profileHtml:globalThis.settingsUnitProfileHtml(state.lab)+globalThis.settingsBrandPanelHtml({title:brandTitle(),subtitle:brandSub(),markText:brandMarkText(),previewHtml:brandPreview}),adminHtml:globalThis.settingsAdminToolsHtml(backupStatusText(),backupCapacityText()),firebaseHtml:globalThis.settingsFirebaseConnectionPanelHtml({labCode:fbcfg.labCode,email:fbcfg.email,config:fbcfg.config,locked:lockedCloud,dataPath:fbDataPath()}),lisHtml:globalThis.settingsLisGatewayPanelHtml({url:liscfg.url,token:liscfg.token,enabled:liscfg.enabled,status:lisGatewayRuntime.status,statusText:lisGatewayStatusText()}),rulesHtml:firebaseRulesPanel});
}
