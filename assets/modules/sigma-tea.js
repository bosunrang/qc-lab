/* ===== LỚP GIẢI TEa CỦA TRANG SIX SIGMA =====
   Tách khỏi sigma.js ngày 2026-08-01 sau khi `npm run coverage-map` cho thấy
   sigma.js 85 KB chỉ có 34,4% mã từng chạy và 51 hàm chưa test nào chạm tới —
   phần lớn điểm mù nằm ở đúng lớp này, thứ vừa THUẦN (không đụng DOM) vừa quyết
   định con số TEa đi vào mọi phép Sigma, MU và báo cáo.

   Ranh giới: file này trả lời "TEa của xét nghiệm này bằng bao nhiêu, theo nguồn
   nào, truy vết ra sao" — bảng TEa hiệu lực (mặc định REFTESTS phủ bởi
   state.teaRefs), khớp xét nghiệm với dòng tham chiếu, quy tắc CLIA
   phần trăm/tuyệt đối/lớn hơn, và ảnh chụp truy vết TEa gắn vào từng kỳ.
   Nó KHÔNG biết gì về Sigma, MU, biểu đồ hay modal — những thứ đó ở lại sigma.js.
   Chỉ đọc `state`, gọi `fmt()`/`vnDate()` lúc format, nên nạp được vào sandbox
   `vm` và test bằng Node (tests/sigma-tea.test.js).
   Nạp NGAY TRƯỚC sigma.js trong index.html: SG_TEA_DEFAULT_REF và SG_CLIA_FIXED
   đọc TEA_SOURCE_REGISTRY/TEA_ANALYTE_CATALOG ngay lúc nạp. */
const SG_TEA_SOURCES=[
  ['eflm','EFLM - nhập từ database'],
  ['clia','CLIA PT (CMS-3355-F)'],
  ['ricos','Ricos / Westgard biological variation']
];
const SG_TEA_DEFAULT_REF={
  eflm:TEA_SOURCE_REGISTRY.eflm.document,
  clia:TEA_SOURCE_REGISTRY.clia.document,
  ricos:TEA_SOURCE_REGISTRY.ricos.document
};
/* Giới hạn tuyệt đối CLIA CMS-3355-F (hiệu lực 2024-07-11), đã quy đổi về
   đúng đơn vị mặc định của REFTESTS. Không tự quy đổi các cặp đơn vị không
   tương thích chắc chắn (ví dụ CK-MB U/L so với ng/mL, Urea so với BUN). */
const SG_CLIA_FIXED=Object.freeze(Object.fromEntries(TEA_ANALYTE_CATALOG.filter(row=>Number.isFinite(row.tea.cliaAbsolute)&&row.tea.cliaAbsolute>0).map(row=>[row.analyteId,{absolute:row.tea.cliaAbsolute,unit:row.tea.cliaAbsoluteUnit||row.unit||''}])));
function teaRefName(v){return String(v==null?'':v).trim().toLowerCase();}
function teaRefSearchKey(v){return typeof searchText==='function'?searchText(v):teaRefName(v);}
function teaRefRecordForName(name,analyteId=''){const key=teaRefSearchKey(name),rows=state&&state.teaRefs||[];return(analyteId&&rows.find(r=>r.analyteId===analyteId))||rows.find(r=>teaRefSearchKey(r.name)===key)||rows.find(r=>teaAnalyteMeta(r.name,r).aliases.some(a=>teaRefSearchKey(a)===key))||null;}
function testDisplayName(t){if(!t)return'';return t.displayName||teaAnalyteDisplay(t.name,teaRefRecordForName(t.name,t.analyteId))||t.name||'';}
function sgUnitKey(v){return String(v==null?'':v).trim().toLowerCase().replace(/[μµ]/g,'u').replace(/\s+/g,'').replace(/lit(er|re)/g,'l');}
function sgUnitsMatch(a,b){const x=sgUnitKey(a),y=sgUnitKey(b);return!!x&&!!y&&x===y;}
function teaRefIsDefault(value){return REFTESTS.some(r=>teaAnalyteMeta(r[0]).analyteId===value||teaRefName(r[0])===teaRefName(value));}
function sgTeaStoredRef(t){return teaRefRecordForName(t&&t.name,t&&t.analyteId);}
function sgTeaSourceMeta(t,src=sgTeaSource(t)){
  const base=TEA_SOURCE_REGISTRY[src]||{},stored=src==='eflm'?null:sgTeaStoredRef(t),custom=stored&&stored.sources&&stored.sources[src]||{},meta={...base,...Object.fromEntries(Object.entries(custom).filter(([,v])=>String(v??'').trim()!==''))};
  if(src==='eflm'){
    meta.reviewedDate=t&&t.eflmLookupDate||meta.reviewedDate||'';
    meta.reviewedBy=t&&t.teaApprovedBy||meta.reviewedBy||'';
    if(t&&/^https:\/\//i.test(String(t.eflmRef||'')))meta.url=t.eflmRef;
  }
  return meta;
}
function sgCliaCriterion(name,unit,percent,record){const analyteId=record&&record.analyteId||teaAnalyteMeta(name,record).analyteId,fixed=SG_CLIA_FIXED[analyteId],hasCustom=record&&(['percent','absolute','greater-of'].includes(record.cliaRule)||Number.isFinite(+record.cliaAbsolute)&&+record.cliaAbsolute>0),p=Number(percent),a=hasCustom?Number(record.cliaAbsolute):fixed&&fixed.absolute,rule=hasCustom?(record.cliaRule||((p>0&&a>0)?'greater-of':a>0?'absolute':'percent')):(a>0?(p>0?'greater-of':'absolute'):'percent');return{rule,percent:Number.isFinite(p)&&p>0?p:null,absolute:Number.isFinite(a)&&a>0?a:null,unit:hasCustom?(record.cliaAbsoluteUnit||unit||''):(fixed&&fixed.unit||unit||'')};}
/* Bảng TEa tham chiếu HIỆU LỰC = REFTESTS mặc định phủ bởi state.teaRefs do người
   dùng sửa/thêm. Registry v2 ghép bằng analyteId ổn định; tên chỉ còn là nhánh
   tương thích dữ liệu v1. Tuple giữ 5 cột cũ, criterion ở [5], analyteId ở [6]. */
function effectiveTeaRefs(){
  const over=new Map();(state&&state.teaRefs||[]).forEach(r=>{const key=r.analyteId||teaAnalyteMeta(r.name,r).analyteId||('custom-'+String(r.id||teaRefName(r.name)).replace(/[^A-Za-z0-9_-]/g,''));if(key)over.set(key,r);});
  const out=REFTESTS.map(([name,unit,clia,ricos,section])=>{const analyteId=teaAnalyteMeta(name).analyteId,o=over.get(analyteId);return o?[o.name,o.unit,o.clia,o.ricos,o.section,sgCliaCriterion(o.name,o.unit,o.clia,o),analyteId]:[name,unit,clia,ricos,section,sgCliaCriterion(name,unit,clia,null),analyteId];});
  (state&&state.teaRefs||[]).forEach(r=>{const analyteId=r.analyteId||teaAnalyteMeta(r.name,r).analyteId||('custom-'+String(r.id||teaRefName(r.name)).replace(/[^A-Za-z0-9_-]/g,''));if(analyteId&&!teaRefIsDefault(analyteId))out.push([r.name,r.unit,r.clia,r.ricos,r.section,sgCliaCriterion(r.name,r.unit,r.clia,r),analyteId]);});
  return out;
}
/* refs: bảng effectiveTeaRefs() đã dựng sẵn (truyền từ sgRows() để khỏi build lại
   cho mỗi kỳ/mức trong cùng một lượt tính) — bỏ trống thì tự build (dùng lẻ/tests). */
function sgRef(t,refs){
  const n=teaRefName(t.name);
  if(!n&&!t.analyteId)return undefined;
  const list=refs||effectiveTeaRefs();
  if(t.analyteId){const byId=list.find(r=>r[6]===t.analyteId);if(byId)return byId;}
  const searchKey=teaRefSearchKey(t.name),aliasExact=list.find(r=>teaAnalyteMeta(r[0],teaRefRecordForName(r[0])).aliases.some(a=>teaRefSearchKey(a)===searchKey));
  if(aliasExact)return aliasExact;
  // Khớp CHÍNH XÁC trước, để tên ngắn ("CK") không nuốt tên dài hơn có mục riêng
  // ("CK-MB") qua so khớp prefix. Chỉ khi không có khớp chính xác mới tới prefix,
  // và prefix chọn tên tham chiếu DÀI NHẤT (đặc trưng nhất) để khử nhập nhằng.
  const exact=list.find(r=>n===String(r[0]).toLowerCase());
  if(exact)return exact;
  let best=null,bestLen=-1;
  list.forEach(r=>{const r0=teaRefName(r[0]),next=n.charAt(r0.length);if(n.startsWith(r0)&&(!next||/[\s([\]/{},;:.-]/.test(next))&&r0.length>bestLen){best=r;bestLen=r0.length;}});
  return best||undefined;
}
function sgTeaSource(t){return SG_TEA_SOURCES.some(x=>x[0]===t.teaSource)?t.teaSource:'ricos';}
/* ref (Bảng TEa) chỉ cần cho nhánh 'clia'/'ricos' — tính bên trong từng nhánh đó
   thay vì luôn tính trước ở đầu hàm, để nhánh 'eflm' (không dùng ref) khỏi build
   effectiveTeaRefs() một cách vô ích. */
function sgTeaInfo(t,src,target,refs){
  const tea=parseFloat(t.tea);
  if(src==='eflm'){
    const hasEflmTrace=t.teaSource==='eflm'||!!(t.eflmAnalyte||t.eflmRef||t.eflmLookupDate);
    const value=hasEflmTrace&&isFinite(tea)&&tea>0?tea:0;return{tea:value,criterion:{rule:'percent',percent:value,absolute:null,unit:'%'}};
  }
  if(src==='clia'){
    const ref=sgRef(t,refs),c=ref&&ref[5]||{rule:'percent',percent:ref&&+ref[2]||null,absolute:null,unit:ref&&ref[1]||''},den=Math.abs(Number(target)),absoluteUsable=c.absolute>0&&sgUnitsMatch(t&&t.unit,c.unit),unitMismatch=c.absolute>0&&!absoluteUsable;let allowable=null;
    if(c.rule==='percent'&&c.percent>0)return{tea:c.percent,criterion:c};
    if(den>0){const pct=c.percent>0?den*c.percent/100:null,abs=absoluteUsable?c.absolute:null;allowable=c.rule==='absolute'?abs:c.rule==='greater-of'?(abs!=null?Math.max(pct||0,abs):pct):pct;}
    return{tea:allowable>0?allowable/den*100:(c.percent||0),criterion:c,needsTarget:!(den>0),unitMismatch,absoluteUsable};
  }
  if(src==='ricos'){const ref=sgRef(t,refs),value=ref&&Number.isFinite(+ref[3])&&+ref[3]>0?+ref[3]:0;return{tea:value,criterion:{rule:'percent',percent:value,absolute:null,unit:'%'}};}
  const value=isFinite(tea)&&tea>0?tea:0;return{tea:value,criterion:{rule:'percent',percent:value,absolute:null,unit:'%'}};
}
function sgTeaBySource(t,src,target,refs){return sgTeaInfo(t,src,target,refs).tea;}
function sgTea(t){return sgTeaBySource(t,sgTeaSource(t));}
function sgTeaCriterionText(t,src=sgTeaSource(t)){const info=sgTeaInfo(t,src),c=info.criterion;if(src!=='clia'||!c)return info.tea?fmt(info.tea,2)+'%':'chưa có';if(info.unitMismatch){const note=' (không áp dụng giới hạn tuyệt đối: đơn vị phải là '+(c.unit||'đơn vị quy định')+')';return c.percent>0?'±'+fmt(c.percent,2)+'%'+note:'chưa tính được'+note;}if(c.rule==='absolute')return '±'+fmt(c.absolute,4)+' '+(c.unit||'đơn vị');if(c.rule==='greater-of')return 'mức lớn hơn giữa ±'+fmt(c.percent,2)+'% và ±'+fmt(c.absolute,4)+' '+(c.unit||'đơn vị');return c.percent>0?'±'+fmt(c.percent,2)+'%':'chưa có';}
function sgTeaLabel(src){return (SG_TEA_SOURCES.find(x=>x[0]===src)||SG_TEA_SOURCES.find(x=>x[0]==='ricos'))[1];}
function sgTeaRefText(t){const src=sgTeaSource(t),meta=sgTeaSourceMeta(t,src),parts=[meta.document||SG_TEA_DEFAULT_REF[src]||''];if(meta.version)parts.push('Phiên bản: '+meta.version);if(meta.effectiveDate)parts.push('Hiệu lực: '+vnDate(meta.effectiveDate));if(src==='eflm'){if(t.eflmAnalyte)parts.push('Analyte: '+t.eflmAnalyte);if(t.eflmAps)parts.push('APS: '+t.eflmAps);if(t.eflmLookupDate)parts.push('Tra cứu: '+vnDate(t.eflmLookupDate));if(t.eflmRef)parts.push(t.eflmRef);}else if(meta.reviewedDate)parts.push('Rà soát: '+vnDate(meta.reviewedDate));return parts.filter(Boolean).join(' · ');}
function sgTeaSnapshot(t){const src=sgTeaSource(t),info=sgTeaInfo(t,src),meta=sgTeaSourceMeta(t,src),base={teaSource:src,teaLabel:sgTeaLabel(src),teaReference:sgTeaRefText(t),teaCapturedAt:new Date().toISOString(),teaSourceId:meta.id||'',teaSourceVersion:meta.version||'',teaSourceUrl:meta.url||'',teaEffectiveDate:meta.effectiveDate||'',teaReviewedDate:meta.reviewedDate||'',teaReviewedBy:meta.reviewedBy||''};return info.tea>0&&!info.needsTarget?{tea:info.tea,...base}:base;}
function sgEnsureTeaSnapshot(t,e){if(!e||e.teaSource)return e;e&&Object.assign(e,sgTeaSnapshot(t));return e;}
function sgLevelTarget(t,L,level){if(Number.isFinite(+L.sourceTargetMean)&&+L.sourceTargetMean!==0)return+L.sourceTargetMean;const cfg=(t.levels||[]).find(x=>+x.level===+level);return cfg&&Number.isFinite(+cfg.mean)&&+cfg.mean!==0?+cfg.mean:null;}
function sgSetLevelTeaSnapshot(t,e,level,force=false){e.lv=e.lv||{};const L=e.lv[level]=e.lv[level]||{};if(!force&&Number.isFinite(+L.tea)&&+L.tea>0)return L;const src=e.teaSource||sgTeaSource(t),target=sgLevelTarget(t,L,level),info=sgTeaInfo(t,src,target),c=info.criterion||{},effectiveRule=info.unitMismatch&&c.percent>0?'percent':c.rule;['tea','teaTarget','teaCriterionRule','teaCriterionPercent','teaCriterionAbsolute','teaCriterionUnit'].forEach(k=>delete L[k]);if(info.tea>0)L.tea=info.tea;if(Number.isFinite(+target))L.teaTarget=+target;
  // Chỉ ghi lại quy tắc khi thực sự có TEa được áp dụng — nếu không có tiêu chí nào
  // dùng được (vd: chỉ có giới hạn tuyệt đối nhưng đơn vị lệch, không có phần trăm
  // thay thế), đừng để lại nhãn 'absolute'/'greater-of' mồ côi không kèm giá trị.
  if(info.tea>0)L.teaCriterionRule=effectiveRule||'percent';if(c.percent>0)L.teaCriterionPercent=c.percent;if(c.absolute>0&&!info.unitMismatch)L.teaCriterionAbsolute=c.absolute;if(c.unit&&!info.unitMismatch)L.teaCriterionUnit=c.unit;return L;}
function sgEntryTea(t,e,level,refs){const L=e&&e.lv&&e.lv[level]||{};if(Number.isFinite(+L.tea)&&+L.tea>0)return+L.tea;if(e&&Number.isFinite(+e.tea)&&+e.tea>0)return+e.tea;return sgTeaBySource(t,e&&e.teaSource||sgTeaSource(t),sgLevelTarget(t,L,level),refs);}
