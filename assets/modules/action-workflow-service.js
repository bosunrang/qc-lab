/* ===== ACTION WORKFLOW SERVICE ===== */
(function(root){
  const PROTOCOL_CHECKS=[
    ['qcMaterialStatus','Vật liệu QC'],
    ['instrumentStatus','Máy phân tích'],
    ['reagentStatus','Hóa chất / calibrator'],
    ['calibrationStatus','Hiệu chuẩn'],
    ['lotToLotStatus','So sánh lot-to-lot']
  ];
  const CHECK_LABELS={ok:'Đạt',abnormal:'Bất thường',na:'Không áp dụng','not-needed':'Không cần','checked-ok':'Đạt','checked-abnormal':'Bất thường'};
  const CONTAINMENT_LABELS={held:'Đã dừng/giữ kết quả liên quan',none:'Không có kết quả bệnh nhân liên quan'};
  const PATIENT_LABELS={none:'Không có mẫu/kết quả bị ảnh hưởng',held:'Đã giữ kết quả để rà soát',affected:'Có kết quả cần xử lý lại'};
  const CAUSE_LABELS={qc:'Vật liệu QC',operator:'Thao tác',instrument:'Thiết bị',reagent:'Hóa chất / calibrator',calibration:'Hiệu chuẩn',environment:'Môi trường',unknown:'Chưa xác định'};
  const SOURCE_LABELS={iqc:'Nội kiểm IQC',eqa:'Ngoại kiểm EQA',instrument:'Cảnh báo thiết bị',clinical:'Phản hồi lâm sàng',audit:'Đánh giá / audit',other:'Nguồn khác'};
  const PHASE_LABELS={pre:'Trước xét nghiệm',exam:'Trong xét nghiệm',post:'Sau xét nghiệm'};
  const RISK_LABELS={low:'Thấp',medium:'Trung bình',high:'Cao',critical:'Nghiêm trọng'};
  /* Một nguồn nhãn duy nhất cho cả service (tóm tắt/xuất file) lẫn UI trang Actions —
     trước đây actionDetailCheck()/viewActionDetail() chép lại y hệt các map này. */
  const ACTION_LABELS={check:CHECK_LABELS,containment:CONTAINMENT_LABELS,patient:PATIENT_LABELS,cause:CAUSE_LABELS,source:SOURCE_LABELS,phase:PHASE_LABELS,risk:RISK_LABELS};
  /* Cấp mã NCE và hạn xử lý mặc định: dùng chung cho trang Actions (mở hồ sơ thủ công)
     và entry-routes (hủy điểm QC tự mở hồ sơ) để hai luồng không sinh mã theo hai kiểu. */
  function nextNceId(today){
    const day=String(today||'').replace(/-/g,'');let value='';
    do{value=`NCE-${day}-${String(uid()).replace(/[^a-z0-9]/gi,'').slice(-4).toUpperCase()}`;}while((state.actions||[]).some(a=>a.nceId===value));
    return value;
  }
  /* Ngày địa phương như isoToday(): toISOString() là giờ UTC nên ở UTC+7, từ 0h–7h
     sáng hạn xử lý bị lùi 1 ngày so với mọi ngày khác trong app (2026-07-27). */
  function nceDueDate(days=7){const d=new Date();d.setDate(d.getDate()+days);return isoDate(d);}
  function actionApprovalStatus(a){
    return(a&&['pending','approved','returned'].includes(a.approvalStatus))?a.approvalStatus:'pending';
  }
  function actionApprovalLabel(a){
    const s=actionApprovalStatus(a);
    return s==='approved'?'Đã duyệt':s==='returned'?'Trả lại':'Chờ duyệt';
  }
  function actionRecorded(a){
    return !!(a&&!a.autoCreated&&String(a.by||'').trim()&&(a.protocolVersion>=2?String(a.correction||'').trim().length>=5:String(a.action||'').trim().length>=5));
  }
  /* missingKeys đi kèm missing để giao diện tìm đúng ô còn thiếu mà đưa con trỏ tới —
     nhãn tiếng Việt một mình không đủ định vị, và "xử lý tức thời" (correction, mục 1)
     rất dễ bị nhầm với "hành động khắc phục" (action, mục 4–6). */
  function actionDraftStatus(a){
    if(!a||!(+a.protocolVersion>=2))return{complete:actionRecorded(a),missing:actionRecorded(a)?[]:['hành động và người thực hiện'],missingKeys:actionRecorded(a)?[]:['action']};
    const missing=[],missingKeys=[];
    const need=(cond,label,key)=>{if(cond){missing.push(label);missingKeys.push(key);}};
    need(!SOURCE_LABELS[a.eventSource],'nguồn phát hiện','eventSource');
    need(!PHASE_LABELS[a.processPhase],'giai đoạn quá trình','processPhase');
    need(!CONTAINMENT_LABELS[a.containmentStatus],'kiểm soát tức thời (mục 1)','containmentStatus');
    need(String(a.correction||'').trim().length<5,'xử lý tức thời đã thực hiện — ô cuối mục 1, tối thiểu 5 ký tự','correction');
    need(!String(a.by||'').trim(),'người phụ trách','by');
    need(!String(a.dueDate||'').trim(),'hạn hoàn thành','dueDate');
    return{complete:!missing.length,missing,missingKeys};
  }
  /* missingBySection gom cung mot danh sach thieu theo tung muc cua form, de dai tom
     tat tren muc dang thu gon khong phai tu suy doan lai dieu kien — mot nguon su that
     duy nhat cho ca viec chan khep vong lan viec hien "con thieu N muc". */
  function actionProtocolStatus(a){
    if(!a||!a.protocolVersion)return{required:false,complete:true,label:'Hồ sơ cũ',missing:[],missingBySection:{}};
    /* Khong co nhom 'eff': danh gia hieu luc la mot CONG RIENG (actionEffectivenessStatus)
       chu khong nam trong checklist khep vong, nen de mot nhom rong o day chi khien dai
       tom tat muc 8 luon bao "Da xong" cho ca ho so con trang. */
    const missing=[],bySection={ident:[],immediate:[],risk:[],check:[],cause:[],patient:[]};
    /* Truong nao thuoc muc nao tren form — nguon phat hien/giai doan/phu trach/han nam
       o khoi "Ho so", chi containment va correction moi thuoc muc 1. */
    const DRAFT_SECTION={eventSource:'ident',processPhase:'ident',by:'ident',dueDate:'ident',containmentStatus:'immediate',correction:'immediate',action:'cause'};
    const need=(cond,label,section)=>{if(cond){missing.push(label);if(bySection[section])bySection[section].push(label);}};
    if(a.protocolVersion>=2){
      const draft=actionDraftStatus(a);
      draft.missing.forEach((label,i)=>{missing.push(label);const section=DRAFT_SECTION[draft.missingKeys[i]]||'ident';bySection[section].push(label);});
      need(!RISK_LABELS[a.riskLevel]||![1,2,3,4,5].includes(+a.riskSeverity)||![1,2,3,4,5].includes(+a.riskOccurrence)||![1,2,3,4,5].includes(+a.riskDetectability),'đánh giá nguy cơ','risk');
    }
    /* Chi ho so v1 moi can kiem rieng — v2 da kiem containment trong actionDraftStatus,
       lap lai se dem thanh hai muc thieu khac chuoi va thoi phong so tren dai tom tat. */
    need(a.protocolVersion<2&&!CONTAINMENT_LABELS[a.containmentStatus],'kiểm soát tức thời','immediate');
    PROTOCOL_CHECKS.forEach(([key,label])=>{
      const low=label.toLocaleLowerCase('vi');
      need(!CHECK_LABELS[a[key]],low,'check');
      need(!!CHECK_LABELS[a[key]]&&['abnormal','na','checked-abnormal'].includes(a[key])&&String(a[key.replace('Status','Note')]||'').trim().length<3,`${low} (ghi chú)`,'check');
    });
    need(!CAUSE_LABELS[a.causeCategory]||String(a.cause||'').trim().length<5,'nguyên nhân','cause');
    need(String(a.action||'').trim().length<5,'hành động khắc phục','cause');
    need(!PATIENT_LABELS[a.patientImpact],'đánh giá ảnh hưởng bệnh nhân','patient');
    need(['held','affected'].includes(a.patientImpact)&&String(a.patientAction||'').trim().length<5,'xử lý kết quả bệnh nhân','patient');
    /* Mục 1 nói "không có kết quả bệnh nhân liên quan" mà mục 7 lại kết luận có kết quả
       bị giữ/cần xử lý lại thì một trong hai ghi sai — không cho khép vòng với hồ sơ
       tự mâu thuẫn. Chiều ngược lại (giữ kết quả rồi rà soát thấy không ảnh hưởng) là
       hợp lệ nên không chặn. */
    need(a.containmentStatus==='none'&&['held','affected'].includes(a.patientImpact),'mâu thuẫn giữa mục 1 (không có kết quả liên quan) và mục 7','patient');
    const unique=[...new Set(missing)];
    const missingBySection={};Object.keys(bySection).forEach(k=>{missingBySection[k]=[...new Set(bySection[k])];});
    return{required:true,complete:!unique.length,label:unique.length?'Thiếu: '+unique.join(', '):'Đã hoàn tất checklist điều tra',missing:unique,missingBySection};
  }
  function actionProtocolSummary(a){
    if(!a||!a.protocolVersion)return'';
    const checks=PROTOCOL_CHECKS.map(([key,label])=>`${label}: ${CHECK_LABELS[a[key]]||'Chưa ghi'}${a[key.replace('Status','Note')]?' ('+a[key.replace('Status','Note')]+')':''}`);
    return[
      ...(a.protocolVersion>=2?[`Mã NCE: ${a.nceId||'Chưa cấp'} · Nguồn: ${SOURCE_LABELS[a.eventSource]||'Chưa ghi'} · Giai đoạn: ${PHASE_LABELS[a.processPhase]||'Chưa ghi'}`,`Nguy cơ: ${RISK_LABELS[a.riskLevel]||'Chưa đánh giá'} · S×O×D ${a.riskSeverity||0}×${a.riskOccurrence||0}×${a.riskDetectability||0} = ${actionRiskScore(a)}`]:[]),
      `Kiểm soát tức thời: ${CONTAINMENT_LABELS[a.containmentStatus]||'Chưa ghi'}${a.containmentNote?' ('+a.containmentNote+')':''}`,
      ...(a.protocolVersion>=2?[`Xử lý tức thời: ${a.correction||'Chưa ghi'}`]:[]),
      ...checks,
      `Nguyên nhân: ${CAUSE_LABELS[a.causeCategory]||'Chưa phân loại'}${a.cause?' — '+a.cause:''}`,
      `Ảnh hưởng bệnh nhân: ${PATIENT_LABELS[a.patientImpact]||'Chưa ghi'}${a.patientAction?' — '+a.patientAction:''}`
    ].join(' | ');
  }
  function actionRiskScore(a){
    const values=[a&&a.riskSeverity,a&&a.riskOccurrence,a&&a.riskDetectability].map(Number);
    return values.every(v=>Number.isInteger(v)&&v>=1&&v<=5)?values.reduce((x,v)=>x*v,1):0;
  }
  /* "Chưa hiệu lực" KHÔNG được treo hồ sơ vô thời hạn: theo thực hành CAPA, hành động
     không hiệu lực phải mở một vòng điều tra mới. Khi đã chuyển sang hồ sơ tiếp theo
     (followUpNceId), hồ sơ này được khép lại với kết luận "chưa hiệu lực — đã chuyển",
     nếu không thì vẫn chặn để buộc người dùng escalate. */
  function actionEffectivenessStatus(a){
    if(!a||!(+a.protocolVersion>=2))return{required:false,complete:true,effective:true,label:'Không yêu cầu cho hồ sơ cũ',cls:'none',escalated:false};
    if(a.effectivenessStatus==='effective'&&String(a.effectivenessNote||'').trim().length>=5&&a.effectivenessDate)return{required:true,complete:true,effective:true,label:'Đã xác nhận hiệu lực',cls:'ok',escalated:false};
    if(a.effectivenessStatus==='ineffective'){
      const followUp=String(a.followUpNceId||'').trim();
      return followUp
        ?{required:true,complete:true,effective:false,label:`Chưa hiệu lực — đã chuyển ${followUp}`,cls:'warn',escalated:true}
        :{required:true,complete:false,effective:false,label:'Chưa hiệu lực — cần mở hồ sơ tiếp theo',cls:'rej',escalated:false};
    }
    return{required:true,complete:false,effective:false,label:'Chờ đánh giá hiệu lực',cls:'warn',escalated:false};
  }
  /* Quá hạn chỉ tính cho hồ sơ còn mở — khép vòng rồi thì hạn không còn ý nghĩa. */
  function actionOverdue(a){
    const due=String(a&&a.dueDate||'').trim();
    if(!due||!actionRecorded(a)||actionWorkflowStatus(a).complete)return{overdue:false,days:0,label:''};
    const today=isoToday();
    if(due>=today)return{overdue:false,days:0,label:''};
    const days=Math.round((Date.parse(today+'T00:00:00Z')-Date.parse(due+'T00:00:00Z'))/86400000);
    return{overdue:true,days,label:`Quá hạn ${days} ngày`};
  }
  function identityText(value){return String(value||'').trim().toLocaleLowerCase('vi');}
  function actionCanApprove(a,user){
    if(!a||!user)return false;
    if(a.createdByUserId&&user.id)return String(a.createdByUserId)!==String(user.id);
    if(a.createdByUsername&&user.username)return identityText(a.createdByUsername)!==identityText(user.username);
    const creator=identityText(a.by),identities=[user.name,user.username].map(identityText).filter(Boolean);
    return !creator||!identities.includes(creator);
  }
  function actionPoint(a){
    return a&&a.pointId?((state.data&&state.data[a.testId])||[]).find(p=>p.id===a.pointId)||null:null;
  }
  function actionNeedsRerun(a){
    const t=state.tests.find(x=>x.id===(a&&a.testId)),p=actionPoint(a);
    if(!t||!p)return false;
    if(p.voided)return p.voidRequiresRerun==null?p.voidKind!=='data-entry':!!p.voidRequiresRerun;
    const f=activeWestgard(t).byPoint.get(p.id);
    return !!(f&&f.level==='rej');
  }
  function actionRerunStatus(a){
    if(!actionNeedsRerun(a))return{needed:false,ok:true,label:'Không yêu cầu',cls:'none',point:null};
    const t=state.tests.find(x=>x.id===a.testId),p=actionPoint(a),wg=activeWestgard(t),runNo=pointRunNo(p);
    const rerun=((state.data&&state.data[a.testId])||[])
      .filter(x=>!x.voided&&x.id!==p.id&&x.level===p.level&&(x.date>p.date||(x.date===p.date&&pointRunNo(x)>runNo))&&(x.lot||'')===(p.lot||''))
      .sort((x,y)=>String(x.date||'').localeCompare(String(y.date||''))||pointRunNo(x)-pointRunNo(y))
      .find(x=>{const f=wg.byPoint.get(x.id)||{level:'ok'};return f.level!=='rej';});
    if(rerun){const verdict=wg.byPoint.get(rerun.id)||{level:'ok'},warning=verdict.level==='warn';return{needed:true,ok:true,label:`${warning?'QC chấp nhận lại (cảnh báo)':'QC đạt lại'}: ${fmt(rerun.val)} (${rerun.runId||'lần sau'})`,cls:warning?'warn':'ok',point:rerun};}
    return{needed:true,ok:false,label:'Chờ QC chạy lại không bị loại',cls:'warn',point:null};
  }
  function actionWorkflowStatus(a){
    if(!actionRecorded(a))return{complete:false,cls:'rej',label:'Chưa ghi khắc phục',rerun:{needed:false,ok:false,label:'Chưa ghi khắc phục',cls:'rej',point:null}};
    const rerun=actionRerunStatus(a),approval=actionApprovalStatus(a),protocol=actionProtocolStatus(a),effectiveness=actionEffectivenessStatus(a);
    let stage='investigating',label='Đang điều tra',cls='warn';
    if(protocol.complete&&rerun.needed&&!rerun.ok){stage='rerun';label=rerun.label;}
    else if(protocol.complete&&effectiveness.required&&!effectiveness.complete){stage='effectiveness';label=effectiveness.label;cls=effectiveness.cls;}
    else if(protocol.complete&&(!rerun.needed||rerun.ok)&&effectiveness.complete&&approval==='returned'){stage='returned';label='Trả lại để bổ sung';cls='rej';}
    else if(protocol.complete&&(!rerun.needed||rerun.ok)&&effectiveness.complete&&approval!=='approved'){stage='approval';label='Chờ duyệt';}
    else if(protocol.complete&&(!rerun.needed||rerun.ok)&&effectiveness.complete&&approval==='approved'){stage='closed';label='Đã khép vòng';cls='ok';}
    const complete=stage==='closed';
    return{complete,cls,label,stage,rerun,protocol,effectiveness};
  }
  function pointActions(pointId){
    return(state.actions||[]).filter(a=>a.pointId===pointId);
  }
  function pointRealActions(pointId){
    return pointActions(pointId).filter(actionRecorded);
  }
  function pointWorkflowComplete(pointId){
    return pointRealActions(pointId).some(a=>actionWorkflowStatus(a).complete);
  }
  function pointWorkflowSummary(pointId){
    const acts=pointActions(pointId);
    if(!acts.length)return{cls:'rej',label:'Chưa ghi khắc phục'};
    const real=pointRealActions(pointId);
    if(!real.length)return{cls:'rej',label:'Chưa ghi khắc phục'};
    const done=real.find(a=>actionWorkflowStatus(a).complete);
    if(done)return{cls:'ok',label:actionWorkflowStatus(done).label};
    return actionWorkflowStatus(real[real.length-1]);
  }

  root.ActionWorkflowService={ACTION_LABELS,nextNceId,nceDueDate,actionApprovalStatus,actionApprovalLabel,actionRecorded,actionDraftStatus,actionProtocolStatus,actionProtocolSummary,actionRiskScore,actionEffectivenessStatus,actionOverdue,actionCanApprove,actionPoint,actionNeedsRerun,actionRerunStatus,actionWorkflowStatus,pointActions,pointRealActions,pointWorkflowComplete,pointWorkflowSummary};
  Object.assign(root,root.ActionWorkflowService);
})(typeof globalThis!=='undefined'?globalThis:this);
