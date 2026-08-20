/* ===== STATE ===== */
const teaAnalyteKey=v=>globalThis.teaAnalyteMetaService?globalThis.teaAnalyteMetaService.key(v):String(v==null?'':v).trim().toLowerCase();
const REFTESTS=Object.freeze(TEA_ANALYTE_CATALOG.map(row=>Object.freeze([row.name,row.unit,row.tea.clia,row.tea.ricos,row.section])));
const TEA_ANALYTE_META=Object.freeze(Object.fromEntries(TEA_ANALYTE_CATALOG.map(row=>{const aliases=[row.name,row.abbreviation].filter(Boolean),displayName=row.abbreviation&&teaAnalyteKey(row.abbreviation)!==teaAnalyteKey(row.name)?`${row.name} (${row.abbreviation})`:row.name;return[teaAnalyteKey(row.name),Object.freeze({analyteId:row.analyteId,displayName,standardName:row.name,abbreviation:row.abbreviation||'',aliases:Object.freeze(aliases),matrix:row.matrix})];})));
const TEA_ANALYTE_META_BY_ID=Object.freeze(Object.fromEntries(Object.values(TEA_ANALYTE_META).map(m=>[m.analyteId,m])));
/** @returns {any} */
function teaAnalyteBuiltInMeta(value){return globalThis.teaAnalyteMetaService.builtIn(value);}
function teaAnalyteMetaById(id){return globalThis.teaAnalyteMetaService.byId(id);}
/** @param {any} [record] @returns {any} */
function teaAnalyteMeta(name,record){return globalThis.teaAnalyteMetaService.meta(name,record);}
function teaAnalyteDisplay(name,record){return globalThis.teaAnalyteMetaService.display(name,record);}
const TEA_REFERENCE_SCHEMA_VERSION=3;
globalThis.teaReferenceSchemaVersion=TEA_REFERENCE_SCHEMA_VERSION;
const TEA_SOURCE_REGISTRY=Object.freeze({
  lab:Object.freeze({id:'qclab-standardized-tea',label:'TEa chuẩn hóa của phòng xét nghiệm',version:'Danh mục nội bộ',document:'Bảng TEa chuẩn hóa của phòng xét nghiệm',url:'',effectiveDate:'',reviewedDate:'',reviewedBy:'',status:'reviewed',note:'Giá trị TEa do phòng xét nghiệm lựa chọn, phê duyệt và duy trì nhất quán cho từng xét nghiệm.'}),
  clia:Object.freeze({id:'clia-cms-3355-f-2024',label:'CLIA PT (CMS-3355-F)',version:'CMS-3355-F / 42 CFR §§493.931, 493.941',document:'CLIA Proficiency Testing — Analytes and Acceptable Performance Criteria',url:'https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-493/subpart-I',effectiveDate:'2024-07-11',reviewedDate:'2026-07-16',reviewedBy:'QC Lab built-in registry',status:'reference',note:'Tiêu chí chấp nhận PT được dùng làm mục tiêu TEa tham khảo; không phải tuyên bố tuân thủ CLIA của đơn vị.'}),
  ricos:Object.freeze({id:'ricos-bv-2014',label:'Ricos / Westgard BV',version:'2014',document:'Desirable Specifications for Total Error derived from Biological Variation — Ricos et al.',url:'https://westgard.com/clia-and-quality-regulation-requirements/quality-requirements/biodatabase1.html',effectiveDate:'',reviewedDate:'2026-07-16',reviewedBy:'QC Lab built-in registry',status:'retired',note:'Bộ dữ liệu legacy, cập nhật lần cuối năm 2014; EFLM hiện quản lý cơ sở dữ liệu biological variation mới.'}),
  eflm:Object.freeze({id:'eflm-bv-live',label:'EFLM Biological Variation Database',version:'Live database',document:'EFLM Biological Variation Database',url:'https://biologicalvariation.eu/',effectiveDate:'',reviewedDate:'2026-07-16',reviewedBy:'QC Lab built-in registry',status:'dynamic',note:'Giá trị thay đổi theo database; phải lưu analyte, mức APS, ngày tra cứu và tài liệu/link tại thời điểm áp dụng.'})
});
const WG_RULE_REGISTRY=QCCore.WG_RULE_REGISTRY;   // bảng đăng ký luật, nguồn duy nhất — xem core.js
const WG_RULES=QCCore.WG_RULES;
const WG_DEFAULT=Object.fromEntries(WG_RULES.map(r=>[r,QCCore.WG_DEFAULT_ON.has(r)]));
const STATE_SCHEMA_VERSION=QCCore.STATE_SCHEMA_VERSION;
/* `state` và các cache dẫn xuất là GLOBAL PROPERTY (globalThis.X), không phải
   `let` lexical (Pha G hạ tầng, tách nền cho state.js — 2026-08-19). Lý do: chúng
   được ĐỌC/GHI TRẦN bởi hai file classic còn lại (qc-domain/state-storage)
   LẪN bundle (users-auth/action-workflow-service/firebase-sync đã retire vào
   đây). Với `let` lexical,
   bundle (IIFE) đọc/ghi được qua scope chain, nhưng khi state.js chuyển vào bundle
   sau này thì `let` sẽ nằm trong IIFE và các file classic không còn thấy → vỡ.
   Gán globalThis.X ngay bây giờ để: (1) mọi tham chiếu trần phân giải qua global
   object; (2) khi state.js port vào bundle, đúng dòng `globalThis.X=` này chuyển
   nguyên vẹn (khác `var`, vốn thành biến cục bộ IIFE). KHÔNG dùng accessor để
   tránh chi phí getter trên biến nóng nhất app; đây là data property thuần, cache
   Map giữ nguyên tham chiếu (invalidation chỉ .clear()/.delete(), không gán lại). */
globalThis.state={lab:/** @type {any} */({name:'',dept:'',address:''}),tests:[],machines:["Máy A"],instruments:[],assayGroups:[],qcPanels:[],lotTransitions:[],lotGroups:[],qcLots:[],data:{},actions:[],activity:[],activityAnchor:'',users:[],reagentTests:[],reagentOperators:[],reagentSampleTypes:['Mẫu bệnh nhân','Mẫu nội kiểm (IQC)','Mẫu ngoại kiểm (EQA)'],sigmaData:{},periodLocks:[],teaRefs:[],teaRegistryVersion:TEA_REFERENCE_SCHEMA_VERSION,westgardRules:{...WG_DEFAULT},configMigrationVersion:1,schemaVersion:STATE_SCHEMA_VERSION};
globalThis.mem=null;globalThis.pointsCache=new Map();globalThis.pointsIndexCache=new Map();globalThis.pointsLotCache=new Map();globalThis.wgMemo=new Map();globalThis.acceptedMemo=new Map();globalThis.cusumMemo=new Map();globalThis.derivedIndex=null;globalThis.startupProblem=null;
/* Cầu nối cho service TS: các Map này là lexical global của script cổ, không thể được
   bundle ES module đọc trực tiếp. Chỉ cấp đúng thao tác invalidation cần thiết. */
globalThis.legacyDerivedCacheState={pointCaches:()=>[pointsCache,pointsIndexCache,pointsLotCache,cusumMemo],westgardMemo:()=>wgMemo,acceptedMemo:()=>acceptedMemo,cusumMemo:()=>cusumMemo,resetDerivedIndex:()=>{derivedIndex=null;},resetStatus:()=>{statusMemo=new Map();},clearStatus:testId=>{if(statusMemo&&statusMemo.delete)statusMemo.delete(testId);}};if(globalThis.installDerivedCacheInvalidation)globalThis.installDerivedCacheInvalidation(globalThis.legacyDerivedCacheState);
function ensureShape(opts={}){const normalized=globalThis.qcStateFoundation(state,opts,{defaults:()=>({lab:/** @type {any} */({name:'',dept:'',address:''}),tests:[],machines:["Máy A"],instruments:[],assayGroups:[],qcPanels:[],lotTransitions:[],lotGroups:[],qcLots:[],data:{},actions:[],activity:[],activityAnchor:'',users:[],reagentTests:[],reagentOperators:[],reagentSampleTypes:['Mẫu bệnh nhân','Mẫu nội kiểm (IQC)','Mẫu ngoại kiểm (EQA)'],sigmaData:{},periodLocks:[],teaRefs:[],teaRegistryVersion:TEA_REFERENCE_SCHEMA_VERSION,westgardRules:{...WG_DEFAULT}}),sanitize:value=>QCCore.sanitizeBackup(value),schemaVersion:STATE_SCHEMA_VERSION,teaRegistryVersion:TEA_REFERENCE_SCHEMA_VERSION,westgardDefaults:WG_DEFAULT});state=normalized.state;return globalThis.qcStateLifecycle(state,{ensureLab:ensureLabBrandShape,ensureConfiguration:ensureConfigurationShape,repairRanges:repairAppliedRangeLimits,ensureReagent:source=>{if(typeof ReagentComparisonService!=='undefined')ReagentComparisonService.ensureOne(source,{id:uid()});},reconcileSigma:reconcileSigmaLevelsWithLotGroups,reconcileTea:()=>{if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();},normalizePointLots,pruneUnusedLevels:pruneUnusedTestLevels});}
/* Xóa mục Mức QC "ma": chưa từng gán lô, chưa từng có Mean, chưa có lịch sử
   Mean/SD và chưa có điểm QC nào — di sản của defaultAssayLevels() từng gán
   mặc định theo TOÀN BỘ mức lô đang có trong hệ thống (đã sửa ở
   manage-tests-actions.js), để lại các mục rỗng trên xét nghiệm không liên
   quan. Luôn giữ lại ít nhất 1 mức trên mỗi xét nghiệm — nếu lọc còn 0, giữ
   lại mục đầu tiên thay vì để mảng rỗng. */
function pruneUnusedTestLevels(){return globalThis.qcLevelReconciliation.pruneUnused(state);}
/* Các bản trước chỉ đổi Mean/SD khi áp dụng dải PXN nhưng để low/high của NSX
   trong cấu hình đang chạy. Tự chữa cả state cũ ở mọi cổng load/merge/import;
   chỉ chạm mức `applied:lab`, không thay giới hạn NSX hoặc cấu hình thủ công khác. */
function repairAppliedRangeLimits(){return globalThis.qcRangeLimitRepair(state);}
function uid(){return Math.random().toString(36).slice(2,9);}
/* Đồng bộ mức Sigma với quan hệ lô ↔ nhóm lô. Nhóm "Đã dừng/Dự kiến" vẫn được tính
   là còn quan hệ để giữ lịch sử; chỉ mức có lô đã bị tháo khỏi MỌI nhóm mới bị gỡ.
   Khi xét nghiệm vẫn còn mức hợp lệ trong nhóm, xóa luôn mọi khóa Sigma mồ côi khác
   (kể cả dữ liệu cũ mà qcLotId đã bị xóa từ một phiên bản trước). */
function reconcileSigmaLevelsWithLotGroups(){return globalThis.qcLevelReconciliation.reconcileSigma(state);}
function ensureConfigurationShape(){
  const migrateLegacyLots=!state.configMigrationVersion;
  state.instruments=state.instruments||[];state.assayGroups=state.assayGroups||[];state.qcPanels=state.qcPanels||[];state.lotTransitions=state.lotTransitions||[];state.lotGroups=state.lotGroups||[];state.qcLots=state.qcLots||[];
  globalThis.qcTestConfiguration(state,migrateLegacyLots,{uid,searchText,teaKey:teaAnalyteKey,builtInMeta:teaAnalyteBuiltInMeta,metaById:teaAnalyteMetaById,meta:teaAnalyteMeta,dedupeHistory:dedupeLotTargetHistory});
  globalThis.qcConfigurationRelations(state,{uid,switchesLot:transitionSwitchesLot,applyAcceptedTransition:applyAcceptedLotTransitionToConfig,normalizeLotGroups,syncLotDepletion:syncLotDepletionFromTransitions});state.configMigrationVersion=1;
}
/* Lô "đã hết QC" được suy ra từ hồ sơ chuyển tiếp đã "Chấp nhận lô mới".
   Các trạng thái dự kiến/chạy song song chỉ để theo dõi, chưa khóa lô cũ. */
function transitionSwitchesLot(tr){return ManageConfigService.transitionSwitchesLot(tr);}
function syncLotDepletionFromTransitions(){return ManageConfigService.syncLotDepletion(state);}
function dedupeLotTargetHistory(target){return globalThis.qcLotTargetHistory.dedupe(target);}
/* Mỗi xét nghiệm/mức/lô chỉ có một cấu hình Mean/SD chuẩn trong lịch sử. Điểm QC
   đã tự giữ snapshot qcMean/qcSd lúc nhập, nên không cần nhân đôi cùng một lô chỉ
   để nhớ các lần sửa form; làm vậy còn khiến bảng lịch sử đếm cùng điểm QC nhiều lần. */
function upsertLotTargetHistory(target,lot,values){return globalThis.qcLotTargetHistory.upsert(target,lot,values);}
function inspectAcceptedLotTransition(tr){
  const check=ManageConfigService.inspectAcceptedLotTransition(state,tr);
  return{from:check.from,to:check.to,panel:check.panel,rows:check.rows.map(x=>({t:x.test,cfg:x.config,nextHist:x.nextHistory})),missing:check.missing.map(x=>({t:x.test,cfg:x.config,nextHist:x.nextHistory})),valid:check.valid};
}
function applyAcceptedLotTransitionToConfig(tr){
  return ManageConfigService.applyAcceptedLotTransition({state,transition:tr,uid,today:isoToday,normalizeLotGroups,upsertHistory:upsertLotTargetHistory,onMergeGroup:(oldGroup,nextGroup)=>{try{if(typeof manageTargetGroup!=='undefined'&&manageTargetGroup===oldGroup.id)manageTargetGroup=nextGroup.id;}catch(e){}}});
}
function normalizeLotGroups(){return ManageConfigService.normalizeLotGroups(state,(removed,kept)=>{try{if(typeof manageTargetGroup!=='undefined'&&manageTargetGroup===removed.id)manageTargetGroup=kept;}catch(e){}});}
function clearDerived(){return globalThis.derivedCacheInvalidation.clearAll();}
function clearDerivedForTest(testId){return globalThis.derivedCacheInvalidation.clearForTest(testId);}
function userName(){return currentUser?(currentUser.name||currentUser.username||'Người dùng'):'Hệ thống';}
function staffInitials(name){return globalThis.qcStaffIdentity.initials(name);}
function currentStaff(){const name=userName();return{operatorId:currentUser&&currentUser.id||'',operatorUsername:currentUser&&currentUser.username||'',operatorName:name,operatorCode:currentUser&&currentUser.initials||staffInitials(name)};}
function pointStaff(p){return globalThis.qcStaffIdentity.point(p);}
function dateObj(s){return globalThis.qcDateFormat.dateObject(s);}
function daysToExp(exp){return globalThis.qcDateFormat.daysToExpiry(exp);}
function fmt(x,d=2){return globalThis.qcBasicFormat.number(x,d);}
const QC_DECIMALS_DEFAULT=2;             // mặc định 2 chữ số thập phân khi tạo xét nghiệm mới
const QC_DECIMALS_MAX=6;                 // trần chung cho MỌI chỗ kẹp số lẻ
const QC_STAT_EXTRA_DECIMALS=2;          // SD cần nhiều chữ số hơn giá trị đo
/* `.5` cũng là số: cho phép thiếu phần nguyên, nếu không thì người nhập ".5" bị coi là 0
   chữ số thập phân. Nhận cả dấu phẩy — thói quen nhập tiếng Việt. */
function qcValueDecimals(value){return globalThis.qcValueFormat.qcValueDecimals(value);}
/* SỐ LẺ CỦA GIÁ TRỊ ĐO — mặc định 2 chữ số, KHÔNG bao giờ lấy từ SD.
   Hai bài học nằm cả trong hàm này:

   1. KHÔNG suy từ SD. Bản đầu lấy max của mean/sd/low/high nên SD kéo số lẻ của giá trị
      lên: nhập "5.6" với SD 0.153 thì hiện "5.600". Đó là độ chính xác giả — con số trong
      hồ sơ nội kiểm ngụ ý độ phân giải của máy, không phải của phép thống kê.

   2. NHƯNG khi CHƯA cấu hình tay thì cũng không được để rơi về 0. Bỏ SD ra rồi thì điểm QC
      cũ (nhập trước khi có point.valueDecimals) chỉ còn suy từ chính val, mà val=4 thì
      String(4)="4" → 0 chữ số → Kali "4.0" hiện thành "4". Toàn bộ dữ liệu lịch sử mất
      phần thập phân trong im lặng. Vì vậy KHÔNG cấu hình thì mặc định là 2 và lấy MAX với
      độ chính xác người nhập: gõ "4" hay "4.0" đều ra "4.00", còn gõ "7.405" vẫn giữ
      nguyên "7.405" chứ không bị làm tròn.

   Thứ tự: cấu hình tay (0..6, kể cả 0 — một số xét nghiệm như đếm tế bào cần số nguyên)
   > max(mặc định 2, độ chính xác đã lưu của điểm) khi CHƯA cấu hình.
   `test.decimalPlaces==null` (chưa từng đụng ô này) PHẢI tách khỏi "đã chọn 0": Number(null)
   === 0, nên `Number(test.decimalPlaces)` một mình không phân biệt được hai trường hợp —
   phải kiểm raw trước khi ép kiểu, nếu không mọi xét nghiệm chưa cấu hình sẽ bị hiểu nhầm
   thành "đã chọn 0 chữ số" và mất luôn mặc định 2. */
function testDecimalPlaces(test,point=null){return globalThis.qcValueFormat.testDecimalPlaces(test,point);}
/* SỐ LẺ CỦA SD — nhiều hơn giá trị 2 chữ số, KHÔNG dùng chung với giá trị.
   Trước 2026-08-02 SD luôn là fmt(sd,3) và đó là chủ ý: người đọc báo cáo phải tự kiểm
   chứng được z-score và CV. Khi decimalPlaces được đặt tay là 1 mà SD dùng chung số lẻ thì
   SD 0.153 hiện thành "0.2" — mất hẳn khả năng đó. Cố tình KHÔNG suy số lẻ từ chính giá trị
   SD: SD tính ra là số thực có nhiễu dấu phẩy động (5.599999999999999), suy từ nó sẽ cho
   6 chữ số rác. */
function testStatDecimals(test){return globalThis.qcValueFormat.testStatDecimals(test);}
function fmtTestValue(test,value,point=null){return globalThis.qcValueFormat.formatValue(test,value,point);}
function fmtTestStat(test,value){return globalThis.qcValueFormat.formatStat(test,value);}
function fmtPointValue(point,test=null){return globalThis.qcValueFormat.formatPoint(point,test);}
function isoDate(d=new Date()){return globalThis.qcDateFormat.isoDate(d);}
function isoToday(){return globalThis.qcDateFormat.isoToday();}
function isoMonth(){return globalThis.qcDateFormat.isoMonth();}
async function requireUnlockedPeriod(date,action='sửa dữ liệu QC'){
  const ym=PeriodService.periodForDate(date),lock=ym?PeriodService.findLock(state,ym):null;if(!lock)return true;
  const text=`Kỳ ${monthVN(ym)} đã chốt bởi ${lock.lockedBy||'hệ thống'}${lock.lockedAt?' lúc '+formatDateTimeVN(lock.lockedAt):''}.`;
  await infoDialog(`Không thể ${action}: ${text} Muốn thay đổi cần admin mở khóa kỳ và ghi lý do.`);return false;
}
function vnDate(s){return globalThis.qcDateFormat.vnDate(s);}
function vnPeriod(s){return globalThis.qcDateFormat.vnPeriod(s);}
function monthVN(s){return globalThis.qcDateFormat.monthVN(s);}
function formatDateTimeVN(s){return globalThis.qcDateFormat.formatDateTimeVN(s);}
function safeName(s){return globalThis.qcBasicFormat.safeName(s);}
