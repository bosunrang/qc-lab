/* ===== LIS GATEWAY UI =====
   UI cấu hình và hàng chờ. Đồng bộ/nhập dữ liệu nằm trong LISClientService (TypeScript). */
async function lisGatewaySaveSettings(){
  if(!requireAdmin('Chỉ quản trị mới được cấu hình LIS Gateway.'))return;
  const enabled=!!document.getElementById('lisGatewayEnabled').checked,url=lisNormalizeGatewayUrl(document.getElementById('lisGatewayUrl').value),tokenEl=document.getElementById('lisGatewayToken'),token=String(tokenEl&&tokenEl.value||'').trim()||lisGatewayConfig().token;
  if(!url){await infoDialog('Prototype chỉ cho phép http://127.0.0.1:8787 hoặc http://localhost:8787.');return;}
  if(enabled&&!token){await infoDialog('Cần dán Bearer token của Gateway. Token được in ra khi chạy npm run lis:gateway.');return;}
  try{localStorage.setItem(LIS_GATEWAY_STORAGE_KEY,JSON.stringify({enabled,url,token}));}catch(e){await infoDialog('Không lưu được cấu hình LIS Gateway trên máy này.');return;}
  if(tokenEl)tokenEl.value='';
  if(!enabled){clearInterval(lisGatewayRuntime.pollT);lisGatewayRuntime.pollT=null;lisGatewayRuntime.pending=[];lisGatewayRuntime.unresolved=[];lisGatewaySetStatus('off','Đã tắt');await infoDialog('Đã tắt nhận kết quả QC từ LIS trên máy này.',{type:'success'});return;}
  lisGatewayStart();
  const result=await lisGatewayPull({manual:true});
  if(result.ok)await infoDialog(`Đã kết nối. ${result.pending} kết quả chờ nhận${result.unresolved?`, ${result.unresolved} chưa khớp cấu hình mapping`:''}.`,{type:'success'});
}

function lisQueueValueText(record){
  const m=record.message,r=record.resolved,t=r&&r.ok?state.tests.find(x=>x.id===r.qclabTestId):null;
  const text=t&&typeof fmtTestValue==='function'?fmtTestValue(t,m.value):fmt(m.value,3);
  return text+(m.unit?' '+esc(m.unit):'');
}
function lisOnclick(fnName,messageId){return escAttr(`${fnName}('${jsq(messageId)}')`);}
function lisQueueRowHtml(record){
  const m=record.message,r=record.resolved,when=formatDateTimeVN(m.measuredAt)||m.measuredAt||'—';
  if(r&&r.ok){
    const t=state.tests.find(x=>x.id===r.qclabTestId);
    return`<tr><td>${esc(when)}</td><td><b>${esc((typeof testDisplayName==='function'?testDisplayName(t):null)||r.displayName||r.qclabTestId)}</b><div class="hint">M${esc(r.level)} · Lô ${esc(r.lot||'—')}</div></td><td class="num">${lisQueueValueText(record)}</td><td>${esc(m.runId||'—')}${m.operator?' · '+esc(m.operator):''}</td><td class="acts">${btn('Nhận',lisOnclick('lisQueueImport',m.messageId),'teal sm')}${btn('Bỏ',lisOnclick('lisQueueReject',m.messageId),'ghost sm')}</td></tr>`;
  }
  return`<tr><td>${esc(when)}</td><td><b>${esc(m.analyzerId)}/${esc(m.testCode)}</b><div class="hint">${esc((r&&r.reason)||'Chưa khớp cấu hình')}</div></td><td class="num">${lisQueueValueText(record)}</td><td>${esc(m.runId||'—')}${m.operator?' · '+esc(m.operator):''}</td><td class="acts">${btn('Bỏ',lisOnclick('lisQueueReject',m.messageId),'ghost sm')}</td></tr>`;
}
function lisQueueSectionHtml(title,records,emptyText){
  if(!records.length)return`<h4>${esc(title)}</h4><div class="hint">${esc(emptyText)}</div>`;
  const rows=records.map(lisQueueRowHtml).join('');
  return`<h4>${esc(title)} (${records.length})</h4><div class="table-wrap"><table class="lis-queue-table"><thead><tr><th>Thời gian đo</th><th>Xét nghiệm</th><th class="num">Giá trị</th><th>Lần chạy · NV</th><th><span class="sr-only">Thao tác</span></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function lisRenderQueueModal(){
  const pending=lisGatewayRuntime.pending||[],unresolved=lisGatewayRuntime.unresolved||[];
  const body=(pending.length||unresolved.length)?lisQueueSectionHtml('Sẵn sàng nhận',pending,'')+(unresolved.length?`<div class="flow-panel">${lisQueueSectionHtml('Chưa khớp cấu hình',unresolved,'')}</div>`:''):emptyState('Hàng chờ trống','Không có kết quả QC nào đang chờ từ LIS Gateway.','');
  openModal(`<div class="modal" style="width:820px"><div class="modal-h"><h3>QC chờ nhập từ LIS</h3>${modalCloseButton('closeModal()')}</div><div class="modal-b" tabindex="0">${body}</div><div class="modal-f">${btn('Làm mới','lisQueueRefresh()','ghost')}${btn('Đóng','closeModal()','ghost')}</div></div>`);
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
