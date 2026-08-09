// Browser-level regression check for the main record-changing UI workflows.
// This deliberately crosses DOM -> route handler -> state -> audit, complementing
// the fast vm tests that exercise services without a rendered application.
'use strict';
const { openSeededSession } = require('./lib/seed-browser-session');

const PASSWORD='QCLab-test-2026';
const passes=[],fails=[];
function check(name,ok,detail=''){if(ok)passes.push(name);else fails.push(name+(detail?' — '+detail:''));}
async function dialogClick(page,label){const box=page.locator('#dialogRoot .modal');await box.waitFor();await box.getByRole('button',{name:label,exact:true}).click();}
async function closeInfo(page){await dialogClick(page,'Đã hiểu');}
async function reauthenticate(page){await page.locator('#reauthPassword').waitFor();await page.locator('#reauthPassword').fill(PASSWORD);await dialogClick(page,'Xác thực');}
async function installPassword(page){await page.evaluate(async password=>{state.users[0].passHash=await hashPass(password);state.users[0].mustChangePassword=false;currentUser=state.users[0];},PASSWORD);}

async function checkEntryLifecycle(page){
  await page.evaluate(()=>go('entry'));await page.waitForSelector('.qc-sheet');
  const before=await page.evaluate(()=>state.data[state.tests[0].id].length);
  const saved=await page.evaluate(async()=>{const t=state.tests[0],date=isoToday();await entryInlineSave(t.id,1,date,'140.12','UI-CHECK-1');const p=state.data[t.id].find(x=>x.runId==='UI-CHECK-1');return{count:state.data[t.id].length,id:p&&p.id,date:p&&p.date,lot:p&&p.lot,qcMean:p&&p.qcMean,qcSd:p&&p.qcSd,audit:(state.activity||[]).at(-1)&&state.activity.at(-1).type,msg:document.getElementById('entryMsg').textContent};});
  check('Nhập QC từ route UI tạo đúng một điểm',saved.count===before+1&&!!saved.id,JSON.stringify(saved));
  check('Điểm QC chốt lô và Mean/SD lúc nhập',saved.lot==='1101'&&saved.qcMean===140&&saved.qcSd===2.5,JSON.stringify(saved));
  check('Nhập QC ghi audit và phản hồi thành công',saved.audit==='Thêm điểm QC'&&/lưu/i.test(saved.msg),JSON.stringify(saved));

  await page.evaluate(id=>voidQcPoint(state.tests[0].id,id),saved.id);await page.waitForSelector('#voidKindInput');
  await page.selectOption('#voidKindInput','data-entry');await page.fill('#voidReasonInput','Nhập nhầm kết quả khi kiểm tra UI');
  await page.locator('#modalRoot').getByRole('button',{name:'Xác nhận hủy',exact:true}).click();
  await dialogClick(page,'Hủy điểm QC');
  const voided=await page.evaluate(id=>{const t=state.tests[0],p=state.data[t.id].find(x=>x.id===id);return{voided:p&&p.voided,kind:p&&p.voidKind,actions:state.actions.length,audit:state.activity.at(-1)&&state.activity.at(-1).type,msg:document.getElementById('entryMsg').textContent};},saved.id);
  check('Hủy do nhập sai giữ bản ghi và đánh dấu void',voided.voided===true&&voided.kind==='data-entry',JSON.stringify(voided));
  check('Hủy do nhập sai không tự mở NCE',voided.actions===0,JSON.stringify(voided));
  check('Hủy QC ghi audit và thông báo trên trang',voided.audit==='Hủy điểm QC'&&/hủy/i.test(voided.msg),JSON.stringify(voided));
}

async function checkManageForms(page){
  await page.evaluate(()=>{go('manage');setManageTab('instruments');openConfigInstrument();});await page.waitForSelector('#cfgInstName');
  await page.fill('#cfgInstName','AU5800 UI');await page.fill('#cfgInstSection','Hóa sinh');await page.fill('#cfgInstMfr','Beckman Coulter');await page.fill('#cfgInstSerial','UI-5800');
  await page.locator('#modalRoot').getByRole('button',{name:'Thêm máy xét nghiệm',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));
  const added=await page.evaluate(()=>{const i=state.instruments.find(x=>x.name==='AU5800 UI');return{id:i&&i.id,section:i&&i.section,serial:i&&i.serial,audit:state.activity.at(-1)&&state.activity.at(-1).type};});
  check('Form thêm máy lưu đủ dữ liệu',!!added.id&&added.section==='Hóa sinh'&&added.serial==='UI-5800',JSON.stringify(added));
  check('Thêm máy ghi audit',added.audit==='Thêm máy xét nghiệm',JSON.stringify(added));

  await page.evaluate(id=>openConfigInstrument(id),added.id);await page.fill('#cfgInstSection','Hóa sinh 2');await page.locator('#modalRoot').getByRole('button',{name:'Lưu thay đổi',exact:true}).click();
  const edited=await page.evaluate(id=>{const i=state.instruments.find(x=>x.id===id);return{section:i.section,audit:state.activity.at(-1).type};},added.id);
  check('Form sửa máy cập nhật đúng bản ghi',edited.section==='Hóa sinh 2'&&edited.audit==='Cập nhật máy',JSON.stringify(edited));

  await page.evaluate(()=>openConfigAssay());await page.waitForSelector('#cfgAssayName');
  await page.fill('#cfgAssayName','Calcium UI');await page.fill('#cfgAssayUnit','mmol/L');await page.selectOption('#cfgAssayInstrument','I1');await page.selectOption('#cfgAssayDecimals','3');await page.fill('#cfgAssayMethod','ISE');await page.fill('#cfgAssayTea','5');
  const details=page.locator('#modalRoot details.assay-advanced').last();await details.locator('summary').click();await page.check('#cfgAssayCusumOn');await page.fill('#cfgAssayCusumK','0.7');await page.fill('#cfgAssayCusumH','5');
  await page.locator('#modalRoot').getByRole('button',{name:'Thêm xét nghiệm',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));
  const assay=await page.evaluate(()=>{const t=state.tests.find(x=>x.displayName==='Calcium UI'||x.name==='Calcium UI');return{id:t&&t.id,decimals:t&&t.decimalPlaces,levels:t&&t.levels.length,cusum:t&&t.cusum,data:t&&state.data[t.id],audit:state.activity.at(-1)&&state.activity.at(-1).type};});
  check('Form thêm xét nghiệm tạo data branch và một mức mặc định',!!assay.id&&Array.isArray(assay.data)&&assay.levels===1,JSON.stringify(assay));
  check('Số thập phân và CUSUM được lưu từ DOM',assay.decimals===3&&assay.cusum&&assay.cusum.on===true&&assay.cusum.k===0.7&&assay.cusum.h===5,JSON.stringify(assay));
  check('Thêm xét nghiệm ghi audit',assay.audit==='Thêm xét nghiệm',JSON.stringify(assay));
}

async function checkRangeTargetDisplay(page){
  const target=await page.evaluate(()=>{const t=state.tests[0],l=t.levels[0];t.decimalPlaces=2;l.mfgMean=140;l.mfgSd=2.5;l.low=135;l.high=145;assignRangeTarget(l,140.053846154,0.54379086239,'lab');go('manage');manageTab='targets';manageTargetPanel='P1';manageTargetGroup='G1';manageTargetLevel='1';rerender();return{mean:l.mean,sd:l.sd,low:l.low,high:l.high};});
  await page.locator('.target-row[data-test="T-NA"][data-lot="L1101"]').waitFor();
  const values=await page.locator('.target-row[data-test="T-NA"][data-lot="L1101"]').evaluate(row=>({mean:row.querySelector('.tm-mean').value,low:row.querySelector('.tm-low').value,high:row.querySelector('.tm-high').value,sd:row.querySelector('.tm-sd').value}));
  check('Áp dụng dải PXN cập nhật đủ Mean/SD và hai giới hạn',target.low===target.mean-2*target.sd&&target.high===target.mean+2*target.sd,JSON.stringify(target));
  check('Màn Mean/SD rút gọn số theo độ chính xác xét nghiệm',values.mean==='140.05'&&values.low==='138.97'&&values.high==='141.14'&&values.sd==='0.5438',JSON.stringify(values));
}

async function checkLotTransitionPicker(page){
  await page.evaluate(()=>{state.qcLots.push({id:'L-FAST',lotNo:'FAST-NEW',level:1,exp:'2028-12-31',active:true});go('manage');setManageTab('transitions');openLotTransitionV2();});
  await page.locator('#cfgTransFrom').waitFor();
  const structure={fromOptions:await page.locator('#cfgTransFromList option').count(),toOptions:await page.locator('#cfgTransToList option').count(),fromRole:await page.locator('#cfgTransFrom').getAttribute('role'),toggles:await page.locator('.lot-choice-toggle').count()};
  check('Lô cũ/mới có ô tìm kiếm gọn, không có nút xổ xuống rời',structure.fromOptions>=3&&structure.toOptions>=3&&structure.fromRole==='combobox'&&structure.toggles===0,JSON.stringify(structure));
  await page.fill('#cfgTransFrom','1101');await page.fill('#cfgTransTo','FAST');
  const selected=await page.evaluate(()=>({from:lotTransitionSelectedId('cfgTransFrom'),to:lotTransitionSelectedId('cfgTransTo')}));
  check('Gõ số hoặc một phần ký tự chọn đúng lô duy nhất',selected.from==='L1101'&&selected.to==='L-FAST',JSON.stringify(selected));
  await page.locator('#modalRoot').getByRole('button',{name:'Thêm hồ sơ chuyển lô',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));
  const saved=await page.evaluate(()=>state.lotTransitions.find(x=>x.fromLotId==='L1101'&&x.toLotId==='L-FAST'));
  check('Combobox lưu đúng ID lô vào hồ sơ chuyển tiếp',!!saved,JSON.stringify(saved));
}

async function checkPeriodLock(page){
  await page.evaluate(()=>{go('report');reportLockYm='2026-06';reportLockPeriod();});await dialogClick(page,'Khóa kỳ');await reauthenticate(page);await closeInfo(page);
  let status=await page.evaluate(()=>({locked:(state.periodLocks||[]).some(x=>x.ym==='2026-06'),audit:state.activity.at(-1)&&state.activity.at(-1).type}));
  check('Khóa kỳ qua UI + re-auth tạo period lock',status.locked&&status.audit==='Khóa kỳ báo cáo',JSON.stringify(status));
  await page.evaluate(()=>reportUnlockPeriod('2026-06'));await page.fill('#unlockReasonInput','Bổ sung đối soát theo biên bản');await page.locator('#modalRoot').getByRole('button',{name:'Xác nhận mở khóa',exact:true}).click();await reauthenticate(page);await closeInfo(page);
  status=await page.evaluate(()=>({locked:(state.periodLocks||[]).some(x=>x.ym==='2026-06'),audit:state.activity.at(-1)&&state.activity.at(-1).type,detail:state.activity.at(-1)&&state.activity.at(-1).detail}));
  check('Mở khóa qua UI + re-auth gỡ đúng kỳ',!status.locked&&status.audit==='Mở khóa kỳ báo cáo',JSON.stringify(status));
  check('Audit mở khóa giữ lý do',/Bổ sung đối soát/.test(status.detail||''),JSON.stringify(status));
}

async function checkBackupRestore(page){
  const backup=await page.evaluate(async()=>{const next=JSON.parse(JSON.stringify(state));next.lab={...(next.lab||{}),name:'LAB SAU RESTORE UI'};return(await createBackupPackage(next)).text;});
  await page.evaluate(()=>go('settings'));await page.locator('#imp').waitFor({state:'attached'});
  await page.locator('#imp').setInputFiles({name:'ui-workflow-backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});await page.locator('#dialogRoot .confirm-modal').waitFor();
  check('Chọn file backup chưa tự thay state',await page.evaluate(()=>state.lab.name!=='LAB SAU RESTORE UI'));
  await dialogClick(page,'Nhập backup');await page.locator('#reauthPassword').waitFor();
  const downloadPromise=page.waitForEvent('download');await page.fill('#reauthPassword',PASSWORD);await dialogClick(page,'Xác thực');await downloadPromise;
  await page.locator('#dialogRoot .info-modal').waitFor();const restored=await page.evaluate(()=>({lab:state.lab.name,audit:state.activity.at(-1)&&state.activity.at(-1).type,chain:QCCore.verifyAuditChain(state.activity,state.activityAnchor).ok}));await closeInfo(page);
  check('Restore UI thay dữ liệu sau xác nhận + re-auth',restored.lab==='LAB SAU RESTORE UI',JSON.stringify(restored));
  check('Restore UI ghi audit và giữ chuỗi hash hợp lệ',restored.audit==='Nhập backup'&&restored.chain===true,JSON.stringify(restored));
}

async function main(){
  const session=await openSeededSession({headless:true}),runtimeErrors=[];
  session.page.on('pageerror',e=>runtimeErrors.push('pageerror: '+e.message));session.page.on('console',m=>{if(m.type()==='error')runtimeErrors.push('console: '+m.text());});
  try{await installPassword(session.page);await checkEntryLifecycle(session.page);await checkManageForms(session.page);await checkRangeTargetDisplay(session.page);await checkLotTransitionPicker(session.page);await checkPeriodLock(session.page);await checkBackupRestore(session.page);check('Không có lỗi runtime/console',runtimeErrors.length===0,runtimeErrors.join(' | '));}
  finally{await session.close();}
  console.log(`UI workflow check: ${passes.length} đạt, ${fails.length} lỗi`);passes.forEach(x=>console.log('  ✓ '+x));if(fails.length){fails.forEach(x=>console.error('  ✗ '+x));process.exitCode=1;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
