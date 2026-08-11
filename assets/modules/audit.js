/* ===== AUDIT LOG =====
   Nghiệp vụ chuỗi hash, xoay vòng và cache nằm trong AuditService TypeScript.
   File này chỉ giữ các API global tương thích cho UI classic. */
function auditCanonical(value){return QCCore.auditCanonical(value);}
function auditSha256(ascii){return QCCore.auditSha256(ascii);}
function auditEntryPayload(entry){const{hash,prevHash,...payload}=entry||{};return payload;}
function auditEntryHash(entry){return QCCore.auditEntryHash(entry);}
function auditVerifyChain(activity=state.activity||[],anchor=(typeof state!=='undefined'&&state&&state.activityAnchor)||''){return QCCore.verifyAuditChain(activity,anchor);}
function auditService(){return globalThis.AuditService;}
/* Ngưỡng giữ ở bridge để test và UI cũ vẫn có thể đọc/chỉnh; service lấy động mỗi lần xoay vòng. */
let ACTIVITY_HARD_CAP=50000,ACTIVITY_ROTATE_TO=40000;
const AUDIT_AUTO_VERIFY_MAX=5000;
function auditRuntimeConfig(){return{hardCap:ACTIVITY_HARD_CAP,rotateTo:ACTIVITY_ROTATE_TO,autoVerifyMax:AUDIT_AUTO_VERIFY_MAX};}
function auditActor(){return{user:userName(),username:currentUser&&currentUser.username||'',userId:currentUser&&currentUser.id||'',role:role(),clientId:fb&&fb.clientId||''};}
function auditLastHash(){return auditService().lastHash();}
function auditLastHashOf(list){return auditService().lastHashOf(list);}
function auditArchiveCut(activity,cutoffIso){return auditService().archiveCut(activity,cutoffIso);}
function auditPushRaw(type,detail,target=''){return auditService().pushRaw(type,detail,target);}
function auditRotateOverflow(){return auditService().rotateOverflow();}
function logAct(type,detail,target=''){return auditService().log(type,detail,target);}
function auditChainSignature(){return auditService().chainSignature();}
function auditChainStatus(force=false){return auditService().chainStatus(force);}
function auditVerifyChainNow(){auditService().resetChainCache();auditChainStatus(true);rerender();}
function auditNextSeq(){return auditService().nextSeq();}
function auditRelinkChain(activity,anchor=''){return auditService().relinkChain(activity,anchor);}
