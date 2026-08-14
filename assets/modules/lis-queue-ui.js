/* ===== LIS GATEWAY UI =====
   UI cấu hình và hàng chờ. Đồng bộ/nhập dữ liệu nằm trong LISClientService (TypeScript). */
async function lisGatewaySaveSettings(){
  if(!requireAdmin('Chỉ quản trị mới được cấu hình LIS Gateway.'))return;
  const enabled=!!document.getElementById('lisGatewayEnabled').checked,tokenEl=document.getElementById('lisGatewayToken'),current=lisGatewayConfig(),input={enabled,url:document.getElementById('lisGatewayUrl').value,token:String(tokenEl&&tokenEl.value||''),savedToken:current.token},plan=globalThis.lisSettingsService.prepare(input),url=plan.ok?plan.settings.url:lisNormalizeGatewayUrl(input.url),token=plan.ok?plan.settings.token:String(input.token).trim()||current.token;
  if((plan&&!plan.ok&&plan.error==='invalid-url')||!url){await infoDialog('Prototype chỉ cho phép http://127.0.0.1:8787 hoặc http://localhost:8787.');return;}
  if((plan&&!plan.ok&&plan.error==='missing-token')||(enabled&&!token)){await infoDialog('Cần dán Bearer token của Gateway. Token được in ra khi chạy npm run lis:gateway.');return;}
  try{localStorage.setItem(LIS_GATEWAY_STORAGE_KEY,JSON.stringify(plan&&plan.ok?plan.settings:{enabled,url,token}));}catch(e){await infoDialog('Không lưu được cấu hình LIS Gateway trên máy này.');return;}
  if(tokenEl)tokenEl.value='';
  if(!enabled){clearInterval(lisGatewayRuntime.pollT);lisGatewayRuntime.pollT=null;lisGatewayRuntime.pending=[];lisGatewayRuntime.unresolved=[];lisGatewaySetStatus('off','Đã tắt');await infoDialog('Đã tắt nhận kết quả QC từ LIS trên máy này.',{type:'success'});return;}
  lisGatewayStart();
  const result=await lisGatewayPull({manual:true});
  if(result.ok)await infoDialog(`Đã kết nối. ${result.pending} kết quả chờ nhận${result.unresolved?`, ${result.unresolved} chưa khớp cấu hình mapping`:''}.`,{type:'success'});
}

function lisQueueValueText(record){
  return globalThis.lisQueuePresentation.valueText(record);
}
function lisOnclick(fnName,messageId){return globalThis.lisQueuePresentation.onclick(fnName,messageId);}
function lisQueueRowHtml(record){
  return globalThis.lisQueuePresentation.rowHtml(record);
}
function lisQueueSectionHtml(title,records,emptyText){
  return globalThis.lisQueuePresentation.sectionHtml(title,records,emptyText);
}
function lisRenderQueueModal(){
  const pending=lisGatewayRuntime.pending||[],unresolved=lisGatewayRuntime.unresolved||[];
  openModal(globalThis.lisQueuePresentation.modalHtml(pending,unresolved));
}
async function lisOpenQueueModal(){
  if(!lisGatewayConfig().enabled){await infoDialog('Hãy bật LIS Gateway và lưu cấu hình trước khi xem hàng chờ.',{type:'warning'});return;}
  const result=await lisGatewayPull({manual:true});if(!result.ok)return;lisRenderQueueModal();
}
async function lisQueueRefresh(){await lisGatewayPull();lisRenderQueueModal();}
async function lisQueueImport(messageId){if((await lisImportResult(messageId)).ok)lisRenderQueueModal();}
async function lisQueueReject(messageId){
  if(!await confirmDialog({kicker:'Hàng chờ LIS',title:'Bỏ kết quả QC này?',message:'Kết quả sẽ được đánh dấu đã bỏ ở Gateway và biến khỏi hàng chờ. Middleware có thể gửi lại nếu cần.',confirmLabel:'Bỏ',cancelLabel:'Hủy'}))return;
  if((await lisRejectResult(messageId)).ok)lisRenderQueueModal();
}
