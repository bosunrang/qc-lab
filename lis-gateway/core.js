'use strict';

const crypto=require('node:crypto');

const QC_STATUS=new Set(['unknown','ok','warn','rej']);
const FORBIDDEN_PHI=['patientId','patientName','patientDob','dateOfBirth','phone','address'];

class LisError extends Error{
  constructor(code,message,status=400){super(message);this.name='LisError';this.code=code;this.status=status;}
}

function text(value,max=160){return String(value==null?'':value).trim().slice(0,max);}
function iso(value){const raw=text(value,50),time=Date.parse(raw);return raw&&Number.isFinite(time)?new Date(time).toISOString():'';}
function canonical(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return'['+value.map(canonical).join(',')+']';return'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';}
function fingerprint(value){return crypto.createHash('sha256').update(canonical(value)).digest('hex');}
function mappingKey(analyzerId,testCode){return text(analyzerId).toUpperCase()+'\u0000'+text(testCode).toUpperCase();}

function normalizeResult(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new LisError('INVALID_MESSAGE','Message phải là object JSON.');
  const phi=FORBIDDEN_PHI.find(key=>input[key]!=null&&String(input[key]).trim());
  if(phi)throw new LisError('PHI_NOT_ALLOWED',`Prototype không nhận trường dữ liệu bệnh nhân: ${phi}.`);
  const result={messageId:text(input.messageId,120),analyzerId:text(input.analyzerId,80),testCode:text(input.testCode,80),measuredAt:iso(input.measuredAt),value:input.value,unit:text(input.unit,40),specimenRef:text(input.specimenRef,120),flags:Array.isArray(input.flags)?input.flags.slice(0,20).map(v=>text(v,40)).filter(Boolean):[]};
  if(!result.messageId)throw new LisError('MESSAGE_ID_REQUIRED','Thiếu messageId.');
  if(!result.analyzerId)throw new LisError('ANALYZER_REQUIRED','Thiếu analyzerId.');
  if(!result.testCode)throw new LisError('TEST_CODE_REQUIRED','Thiếu testCode.');
  if(!result.measuredAt)throw new LisError('MEASURED_AT_INVALID','measuredAt phải là thời gian ISO hợp lệ.');
  if(typeof result.value==='number'){if(!Number.isFinite(result.value))throw new LisError('VALUE_INVALID','Giá trị kết quả không hợp lệ.');}
  else{result.value=text(result.value,240);if(!result.value)throw new LisError('VALUE_REQUIRED','Thiếu giá trị kết quả.');}
  return result;
}

function normalizeQc(input){
  const result={qclabTestId:text(input&&input.qclabTestId,120),status:text(input&&input.status,20).toLowerCase(),asOf:iso(input&&input.asOf),reason:text(input&&input.reason,500),instrumentId:text(input&&input.instrumentId,120),evidenceDate:text(input&&input.evidenceDate,20),evidencePointId:text(input&&input.evidencePointId,120),rules:Array.isArray(input&&input.rules)?input.rules.slice(0,20).map(v=>text(v,40)).filter(Boolean):[]};
  if(!result.qclabTestId)throw new LisError('QC_TEST_REQUIRED','Thiếu qclabTestId.');
  if(!QC_STATUS.has(result.status))throw new LisError('QC_STATUS_INVALID','QC status phải là unknown, ok, warn hoặc rej.');
  if(!result.asOf)throw new LisError('QC_TIME_INVALID','QC asOf phải là thời gian ISO hợp lệ.');
  return result;
}

function buildMappingIndex(config){
  const map=new Map();
  (config&&config.mappings||[]).forEach((row,index)=>{
    const analyzerId=text(row&&row.analyzerId,80),testCode=text(row&&row.testCode,80),qclabTestId=text(row&&row.qclabTestId,120);
    if(!analyzerId||!testCode||!qclabTestId)throw new LisError('MAPPING_INVALID',`Mapping ${index+1} thiếu analyzerId, testCode hoặc qclabTestId.`);
    const key=mappingKey(analyzerId,testCode);if(map.has(key))throw new LisError('MAPPING_DUPLICATE',`Mapping trùng ${analyzerId}/${testCode}.`);
    map.set(key,{analyzerId,testCode,qclabTestId,expectedUnit:text(row.expectedUnit,40),displayName:text(row.displayName,160)});
  });
  return map;
}

/* 90 phút, KHÔNG phải 720. Bản đầu tin một trạng thái QC suốt 12 giờ: app tắt lúc 8h thì
   20h gateway vẫn trả `accepted` cho kết quả bệnh nhân. `asOf` phản ánh "lần cuối app nói
   chuyện với gateway", không phải "lần cuối chạy QC" — nên nó chỉ có nghĩa khi app gửi
   nhịp đều. Client nay gửi heartbeat mỗi 30 phút (LIS_HEARTBEAT_MS), nên 90 phút = chịu
   được 2 nhịp lỡ trước khi chuyển sang `held`. Rút ngắn luôn nghiêng về phía an toàn:
   quá hạn thì GIỮ kết quả lại chứ không phát hành. */
const DEFAULT_STALE_MINUTES=90;
function gateDecision(message,mapping,qc,nowMs=Date.now(),staleMinutes=DEFAULT_STALE_MINUTES){
  if(!mapping)return{decision:'held',code:'UNMAPPED_TEST',reason:'Chưa mapping mã máy sang xét nghiệm QC Lab.'};
  if(mapping.expectedUnit&&message.unit&&mapping.expectedUnit.toLowerCase()!==message.unit.toLowerCase())return{decision:'held',code:'UNIT_MISMATCH',reason:`Đơn vị máy (${message.unit}) khác mapping (${mapping.expectedUnit}).`};
  if(!qc)return{decision:'held',code:'QC_UNKNOWN',reason:'Chưa có trạng thái QC cho xét nghiệm.'};
  const ageMinutes=(nowMs-Date.parse(qc.asOf))/60000;
  if(!Number.isFinite(ageMinutes)||ageMinutes<0||ageMinutes>staleMinutes)return{decision:'held',code:'QC_STALE',reason:`Trạng thái QC quá hạn ${staleMinutes} phút.`};
  if(qc.status==='unknown')return{decision:'held',code:'QC_UNKNOWN',reason:qc.reason||'Chưa đủ bằng chứng QC.'};
  if(qc.status==='rej')return{decision:'held',code:'QC_REJECTED',reason:qc.reason||'QC bị loại theo Westgard.'};
  if(qc.status==='warn')return{decision:'review',code:'QC_ALERT',reason:qc.reason||'QC cảnh báo, cần duyệt thủ công.'};
  return{decision:'accepted',code:'QC_ACCEPTED',reason:qc.reason||'QC được chấp nhận.'};
}

class LisBridge{
  constructor(config={},store){
    this.config={...config,staleMinutes:Number(config.staleMinutes)>0?Number(config.staleMinutes):DEFAULT_STALE_MINUTES};
    this.mappings=buildMappingIndex(this.config);this.store=store;this.messages=new Map();this.qc=new Map();
    (store&&store.load?store.load():[]).forEach(event=>this.applyEvent(event));
  }
  applyEvent(event){if(event&&event.type==='message'&&event.record)this.messages.set(event.record.message.messageId,event.record);else if(event&&event.type==='qc-status'&&event.qc)this.qc.set(event.qc.qclabTestId,event.qc);}
  append(event){if(this.store&&this.store.append)this.store.append(event);this.applyEvent(event);}
  setQcStatus(input){const qc=normalizeQc(input),event={type:'qc-status',recordedAt:new Date().toISOString(),qc};this.append(event);return qc;}
  /* Gửi cả loạt trong MỘT request. Trước đây app PUT tuần tự từng xét nghiệm, mỗi cái
     timeout 5s — 50 xét nghiệm là tới 250s treo, và trong lúc treo mọi cập nhật QC mới
     đều bị bỏ. Chuẩn hóa TOÀN BỘ trước rồi mới ghi: một phần tử hỏng làm hỏng cả lô thay
     vì ghi được nửa chừng rồi mới ném lỗi, để app không phải đoán xem đã tới đâu. */
  setQcStatusMany(list){
    if(!Array.isArray(list))throw new LisError('QC_BATCH_INVALID','items phải là mảng.');
    if(list.length>500)throw new LisError('QC_BATCH_TOO_LARGE','Tối đa 500 trạng thái mỗi lần.');
    const normalized=list.map(normalizeQc),recordedAt=new Date().toISOString();
    normalized.forEach(qc=>this.append({type:'qc-status',recordedAt,qc}));
    return normalized;
  }
  ingest(input,nowMs=Date.now()){
    const message=normalizeResult(input),hash=fingerprint(message),existing=this.messages.get(message.messageId);
    if(existing){if(existing.fingerprint!==hash)throw new LisError('MESSAGE_ID_CONFLICT','messageId đã tồn tại với nội dung khác.',409);return{...existing,duplicate:true};}
    const mapping=this.mappings.get(mappingKey(message.analyzerId,message.testCode))||null,qc=mapping?this.qc.get(mapping.qclabTestId)||null:null,gate=gateDecision(message,mapping,qc,nowMs,this.config.staleMinutes);
    const record={id:'lis_'+hash.slice(0,24),receivedAt:new Date(nowMs).toISOString(),fingerprint:hash,message,mapping,gate};
    this.append({type:'message',recordedAt:record.receivedAt,record});return{...record,duplicate:false};
  }
  listMessages(limit=100){return[...this.messages.values()].sort((a,b)=>String(b.receivedAt).localeCompare(String(a.receivedAt))).slice(0,Math.max(1,Math.min(1000,Number(limit)||100)));}
  status(){const counts={accepted:0,review:0,held:0};this.messages.forEach(row=>counts[row.gate.decision]++);return{messages:this.messages.size,qcStatuses:this.qc.size,mappings:this.mappings.size,counts};}
}

module.exports={LisBridge,LisError,normalizeResult,normalizeQc,buildMappingIndex,gateDecision,fingerprint,DEFAULT_STALE_MINUTES};
