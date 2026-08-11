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
  /* Thang S×O×D (Severity/Occurrence/Detectability) của ma trận rủi ro ISO 15189 —
     nguồn duy nhất, dùng chung với action-form.js (đánh giá nguy cơ ban đầu và nguy cơ
     còn lại đều cùng một thang, chỉ khác trường dữ liệu). */
  const RISK_SCALE=[1,2,3,4,5];
  const RELEASE_LABELS={released:'Đã cho phép hoạt động/trả kết quả trở lại'};
  /* Một nguồn nhãn duy nhất cho cả service (tóm tắt/xuất file) lẫn UI trang Actions —
     trước đây actionDetailCheck()/viewActionDetail() chép lại y hệt các map này. */
  const ACTION_LABELS={check:CHECK_LABELS,containment:CONTAINMENT_LABELS,patient:PATIENT_LABELS,cause:CAUSE_LABELS,source:SOURCE_LABELS,phase:PHASE_LABELS,risk:RISK_LABELS,release:RELEASE_LABELS};
  /* Cấp mã NCE và hạn xử lý mặc định: dùng chung cho trang Actions (mở hồ sơ thủ công)
     và entry-routes (hủy điểm QC tự mở hồ sơ) để hai luồng không sinh mã theo hai kiểu. */
  function nextNceId(today){
    return root.NceActionIdentityService.nextNceId(state.actions||[],today);
  }
  /* Ngày địa phương như isoToday(): toISOString() là giờ UTC nên ở UTC+7, từ 0h–7h
     sáng hạn xử lý bị lùi 1 ngày so với mọi ngày khác trong app (2026-07-27). */
  function nceDueDate(days=7){return root.NceActionIdentityService.dueDate(days);}
  function actionApprovalStatus(a){
    return root.NceActionBasics.actionApprovalStatus(a);
  }
  function actionRecordStatus(a){
    return root.NceActionBasics.actionRecordStatus(a);
  }
  function actionCancelled(a){
    return root.NceActionBasics.actionCancelled(a);
  }
  function actionApprovalLabel(a){
    return root.NceActionBasics.actionApprovalLabel(a);
  }
  function actionRecorded(a){
    return root.NceActionBasics.actionRecorded(a);
  }
  /* missingKeys đi kèm missing để giao diện tìm đúng ô còn thiếu mà đưa con trỏ tới —
     nhãn tiếng Việt một mình không đủ định vị, và "xử lý tức thời" (correction, mục 1)
     rất dễ bị nhầm với "hành động khắc phục" (action, mục 4–6). */
  function actionDraftStatus(a){
    return root.ActionDraftStatusService(a);
  }
  /* missingBySection gom cung mot danh sach thieu theo tung muc cua form, de dai tom
     tat tren muc dang thu gon khong phai tu suy doan lai dieu kien — mot nguon su that
     duy nhat cho ca viec chan khep vong lan viec hien "con thieu N muc". */
  function actionProtocolStatus(a){
    if(root.ActionProtocolService)return root.ActionProtocolService.protocolStatus(a);
    if(!a||!a.protocolVersion)return{required:false,complete:true,label:'Hồ sơ cũ',missing:[],missingBySection:{}};
    /* Khong co nhom 'eff': danh gia hieu luc la mot CONG RIENG (actionEffectivenessStatus)
       chu khong nam trong checklist khep vong, nen de mot nhom rong o day chi khien dai
       tom tat muc 8 luon bao "Da xong" cho ca ho so con trang. */
    const missing=[],bySection={ident:[],immediate:[],risk:[],check:[],cause:[],patient:[]};
    /* Truong nao thuoc muc nao tren form — nguon phat hien/giai doan/phu trach/han nam
       o khoi "Ho so", chi containment va correction moi thuoc muc 1. */
    const DRAFT_SECTION={date:'ident',eventSource:'ident',processPhase:'ident',by:'ident',dueDate:'ident',containmentStatus:'immediate',correction:'immediate',action:'cause',actionCompletedDate:'cause'};
    const need=(cond,label,section)=>{if(cond){missing.push(label);if(bySection[section])bySection[section].push(label);}};
    if(a.protocolVersion>=2){
      const draft=actionDraftStatus(a);
      draft.missing.forEach((label,i)=>{missing.push(label);const section=DRAFT_SECTION[draft.missingKeys[i]]||'ident';bySection[section].push(label);});
      need(!RISK_LABELS[a.riskLevel]||!RISK_SCALE.includes(+a.riskSeverity)||!RISK_SCALE.includes(+a.riskOccurrence)||!RISK_SCALE.includes(+a.riskDetectability),'đánh giá nguy cơ','risk');
      need(+a.protocolVersion>=3&&!!RISK_LABELS[a.riskLevel]&&[a.riskSeverity,a.riskOccurrence,a.riskDetectability].every(v=>RISK_SCALE.includes(+v))&&String(a.riskBasis||'').trim().length<5,'căn cứ phân loại nguy cơ theo SOP','risk');
      need(!!a.date&&!!a.dueDate&&a.dueDate<a.date,'hạn hoàn thành không được trước ngày ghi nhận sự cố','ident');
    }
    /* Chi ho so v1 moi can kiem rieng — v2 da kiem containment trong actionDraftStatus,
       lap lai se dem thanh hai muc thieu khac chuoi va thoi phong so tren dai tom tat. */
    need(a.protocolVersion<2&&!CONTAINMENT_LABELS[a.containmentStatus],'kiểm soát tức thời','immediate');
    need(+a.protocolVersion>=2&&a.containmentStatus==='held'&&String(a.containmentNote||'').trim().length<3,'ghi chú phạm vi kiểm soát tức thời','immediate');
    PROTOCOL_CHECKS.forEach(([key,label])=>{
      const low=label.toLocaleLowerCase('vi');
      need(!CHECK_LABELS[a[key]],low,'check');
      need(!!CHECK_LABELS[a[key]]&&['abnormal','na','checked-abnormal'].includes(a[key])&&String(a[key.replace('Status','Note')]||'').trim().length<3,`${low} (ghi chú)`,'check');
    });
    need(!CAUSE_LABELS[a.causeCategory]||String(a.cause||'').trim().length<5,'nguyên nhân','cause');
    need(String(a.action||'').trim().length<5,'hành động khắc phục','cause');
    need(+a.protocolVersion>=3&&String(a.action||'').trim().length>=5&&!a.actionCompletedDate,'ngày hoàn thành hành động khắc phục','cause');
    need(!!a.actionCompletedDate&&!!a.date&&a.actionCompletedDate<a.date,'ngày hoàn thành hành động không được trước ngày ghi nhận sự cố','cause');
    need(!!a.actionCompletedDate&&a.actionCompletedDate>isoToday(),'ngày hoàn thành hành động không được ở tương lai','cause');
    const releaseRequired=+a.protocolVersion>=3&&a.containmentStatus==='held';
    need(releaseRequired&&!RELEASE_LABELS[a.releaseStatus],'quyết định cho phép hoạt động/trả kết quả trở lại','cause');
    if(releaseRequired&&RELEASE_LABELS[a.releaseStatus]){
      const rerun=actionNeedsRerun(a)?actionRerunStatus(a):null;
      need(!a.releaseDate,'ngày cho phép hoạt động/trả kết quả trở lại','cause');
      need(String(a.releaseBy||'').trim().length<2,'người cho phép hoạt động/trả kết quả trở lại','cause');
      need(String(a.releaseNote||'').trim().length<5,'căn cứ cho phép hoạt động/trả kết quả trở lại','cause');
      need(!!a.releaseDate&&!!a.actionCompletedDate&&a.releaseDate<a.actionCompletedDate,'ngày cho phép trở lại không được trước ngày hoàn thành hành động','cause');
      need(!!a.releaseDate&&!!(rerun&&rerun.point&&rerun.point.date)&&a.releaseDate<rerun.point.date,'ngày cho phép trở lại không được trước QC chạy lại được dùng làm bằng chứng','cause');
      need(!!a.releaseDate&&a.releaseDate>isoToday(),'ngày cho phép trở lại không được ở tương lai','cause');
      need(a.releaseStatus==='released'&&actionNeedsRerun(a)&&!(rerun&&rerun.ok),'chỉ được cho phép trở lại sau khi QC chạy lại được chấp nhận','cause');
    }
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
    if(root.ActionProtocolService)return root.ActionProtocolService.protocolSummary(a);
    if(!a||!a.protocolVersion)return'';
    const checks=PROTOCOL_CHECKS.map(([key,label])=>`${label}: ${CHECK_LABELS[a[key]]||'Chưa ghi'}${a[key.replace('Status','Note')]?' ('+a[key.replace('Status','Note')]+')':''}`),residual=actionResidualRiskScore(a);
    return[
      ...(a.protocolVersion>=2?[`Mã NCE: ${a.nceId||'Chưa cấp'} · Nguồn: ${SOURCE_LABELS[a.eventSource]||'Chưa ghi'} · Giai đoạn: ${PHASE_LABELS[a.processPhase]||'Chưa ghi'}`,`Nguy cơ: ${RISK_LABELS[a.riskLevel]||'Chưa đánh giá'} · S×O×D ${a.riskSeverity||0}×${a.riskOccurrence||0}×${a.riskDetectability||0} = ${actionRiskScore(a)}${a.riskBasis?' · Căn cứ: '+a.riskBasis:''}`]:[]),
      `Kiểm soát tức thời: ${CONTAINMENT_LABELS[a.containmentStatus]||'Chưa ghi'}${a.containmentNote?' ('+a.containmentNote+')':''}`,
      ...(a.protocolVersion>=2?[`Xử lý tức thời: ${a.correction||'Chưa ghi'}`]:[]),
      ...checks,
      `Nguyên nhân: ${CAUSE_LABELS[a.causeCategory]||'Chưa phân loại'}${a.cause?' — '+a.cause:''}`,
      ...(a.protocolVersion>=3&&a.containmentStatus==='held'?[`Cho phép trở lại: ${RELEASE_LABELS[a.releaseStatus]||'Chưa xác nhận'}${a.releaseDate?' · '+vnDate(a.releaseDate):''}${a.releaseBy?' · '+a.releaseBy:''}${a.releaseNote?' — '+a.releaseNote:''}`]:[]),
      `Ảnh hưởng bệnh nhân: ${PATIENT_LABELS[a.patientImpact]||'Chưa ghi'}${a.patientAction?' — '+a.patientAction:''}`,
      ...(a.protocolVersion>=2?[`Hiệu lực: ${a.effectivenessStatus==='effective'?'Có hiệu lực':a.effectivenessStatus==='ineffective'?'Chưa hiệu lực':'Chưa đánh giá'}${a.effectivenessDate?' · '+vnDate(a.effectivenessDate):''}${a.effectivenessNote?' — '+a.effectivenessNote:''}${a.effectivenessBy?' · '+a.effectivenessBy:''}`]:[]),
      ...(a.protocolVersion>=3&&residual?[`Nguy cơ còn lại: ${RISK_LABELS[a.residualRiskLevel]||'Chưa phân loại'} · S×O×D ${a.residualSeverity||0}×${a.residualOccurrence||0}×${a.residualDetectability||0} = ${residual}${a.residualRiskBasis?' · Căn cứ: '+a.residualRiskBasis:''}`]:[]),
      ...(actionCancelled(a)?[`Hồ sơ đã hủy: ${a.cancelReason||'Không ghi lý do'}${a.cancelledBy?' · '+a.cancelledBy:''}${a.cancelledAt?' · '+a.cancelledAt:''}`]:[])
    ].join(' | ');
  }
  function actionRiskScore(a){
    return root.NceActionBasics.actionRiskScore(a);
  }
  function actionResidualRiskScore(a){
    return root.NceActionBasics.actionResidualRiskScore(a);
  }
  function actionActiveFollowUp(a){
    return root.NceActionIdentityService.activeFollowUp(state.actions||[],a);
  }
  /* "Chưa hiệu lực" KHÔNG được treo hồ sơ vô thời hạn: theo thực hành CAPA, hành động
     không hiệu lực phải mở một vòng điều tra mới. Khi đã chuyển sang hồ sơ tiếp theo
     (followUpNceId), hồ sơ này được khép lại với kết luận "chưa hiệu lực — đã chuyển",
     nếu không thì vẫn chặn để buộc người dùng escalate. */
  function actionEffectivenessStatus(a){
    if(root.ActionProtocolService)return root.ActionProtocolService.effectivenessStatus(a);
    if(!a||!(+a.protocolVersion>=2))return{required:false,complete:true,effective:true,label:'Không yêu cầu cho hồ sơ cũ',cls:'none',escalated:false};
    if(a.effectivenessStatus!=='pending'&&+a.protocolVersion>=3){
      if(String(a.effectivenessNote||'').trim().length<5||!a.effectivenessDate)return{required:true,complete:false,effective:false,label:'Cần ngày và bằng chứng đánh giá hiệu lực',cls:'rej',escalated:false};
      if(!a.actionCompletedDate)return{required:true,complete:false,effective:false,label:'Cần ngày hoàn thành hành động trước khi đánh giá hiệu lực',cls:'rej',escalated:false};
      const rerun=actionNeedsRerun(a)?actionRerunStatus(a):null,latestPrereq=[a.date,a.actionCompletedDate,a.releaseDate,rerun&&rerun.point&&rerun.point.date].filter(Boolean).sort().pop()||'';
      if(latestPrereq&&a.effectivenessDate<latestPrereq)return{required:true,complete:false,effective:false,label:'Ngày đánh giá hiệu lực không được trước hành động, quyết định cho phép hoặc QC chạy lại dùng làm bằng chứng',cls:'rej',escalated:false};
      if(a.effectivenessDate>isoToday())return{required:true,complete:false,effective:false,label:'Ngày đánh giá hiệu lực không được ở tương lai',cls:'rej',escalated:false};
    }
    if(a.effectivenessStatus==='effective'){
      if(+a.protocolVersion>=3){
        const residual=actionResidualRiskScore(a),initial=actionRiskScore(a);
        if(!residual||!RISK_LABELS[a.residualRiskLevel]||String(a.residualRiskBasis||'').trim().length<5)return{required:true,complete:false,effective:false,label:'Cần đánh giá đầy đủ nguy cơ còn lại và căn cứ SOP',cls:'rej',escalated:false};
        if(initial&&residual>initial)return{required:true,complete:false,effective:false,label:`RPN còn lại ${residual} cao hơn RPN ban đầu ${initial} — chưa thể kết luận có hiệu lực`,cls:'rej',escalated:false};
      }
      if(+a.protocolVersion<3&&(String(a.effectivenessNote||'').trim().length<5||!a.effectivenessDate))return{required:true,complete:false,effective:false,label:'Chờ đánh giá hiệu lực',cls:'warn',escalated:false};
      return{required:true,complete:true,effective:true,label:+a.protocolVersion>=3?`Đã xác nhận hiệu lực · RPN còn lại ${actionResidualRiskScore(a)}`:'Đã xác nhận hiệu lực',cls:'ok',escalated:false};
    }
    if(a.effectivenessStatus==='ineffective'){
      const followUp=String(a.followUpNceId||'').trim();
      return followUp&&actionActiveFollowUp(a)
        ?{required:true,complete:true,effective:false,label:`Chưa hiệu lực — đã chuyển ${followUp}`,cls:'warn',escalated:true}
        :{required:true,complete:false,effective:false,label:followUp?'Hồ sơ tiếp theo đã hủy hoặc không còn tồn tại — cần mở vòng mới':'Chưa hiệu lực — cần mở hồ sơ tiếp theo',cls:'rej',escalated:false};
    }
    return{required:true,complete:false,effective:false,label:'Chờ đánh giá hiệu lực',cls:'warn',escalated:false};
  }
  /* Quá hạn chỉ tính cho hồ sơ còn mở — khép vòng rồi thì hạn không còn ý nghĩa. */
  function actionOverdue(a){
    return root.ActionApprovalGates.overdue(a);
  }
  function actionCanApprove(a,user){
    return root.ActionApprovalGates.canApprove(a,user);
  }
  /* actionRerunStatus() quet toan bo state.data[testId], va gio con bi goi tu
     actionProtocolStatus() (nhanh release) lan actionEffectivenessStatus() chu khong
     chi tu actionWorkflowStatus() — do duoc 5 lan quet lai CUNG mot ho so cho moi dong
     bang nhat ky. Voi 40 000 diem x 600 ho so la 1 602ms moi lan ve, ma trang nay
     rerender o moi lan luu / loc / dong bo Firebase doi ve.
     Memo hoa theo id ho so, chu ky gom moi truong cua ho so ma phep tinh doc toi, nen
     sua ho so (vd doi actionCompletedDate) tu lam moi ma khong can clearDerived —
     quan trong vi luu ho so dung save({clearDerived:false}). Du lieu QC doi thi
     clearDerived()/clearDerivedForTest() goi invalidateActionCaches() nhu cac memo khac
     (wgMemo/acceptedMemo/cusumMemo). Ho so chua co id (object tam trong addAction)
     khong duoc memo de map khong phinh vo han. */
  const rerunMemo=new Map(),pointIndexMemo=new Map(),lotIndexMemo=new Map();
  function invalidateActionCaches(testId){
    if(root.ActionRerunService){root.ActionRerunService.invalidate(testId);if(root.ActionPointIndexService)root.ActionPointIndexService.invalidate();else{pointActionsMemo.ref=null;pointActionsMemo.index=null;}return;}
    if(testId==null){rerunMemo.clear();pointIndexMemo.clear();lotIndexMemo.clear();pointActionsMemo.ref=null;pointActionsMemo.index=null;return;}
    pointIndexMemo.delete(testId);
    [...lotIndexMemo.keys()].forEach(k=>{if(String(k).startsWith(testId+'|'))lotIndexMemo.delete(k);});
    [...rerunMemo.keys()].forEach(k=>{const hit=rerunMemo.get(k);if(hit&&hit.testId===testId)rerunMemo.delete(k);});
  }
  /* Diem cua dung (xet nghiem, muc, lo), da bo diem huy va sap theo ngay/lan chay.
     Khong dung pointsForLot() cua qc-domain vi cache do chi duoc xa qua clearDerived();
     index o day tu kiem chung bang tham chieu + do dai mang nhu rerunMemo, nen thay
     nguyen state hay them/bot diem deu tu truot. */
  function actionLotPoints(testId,level,lot){
    if(root.ActionRerunService)return root.ActionRerunService.lotPoints(testId,level,lot);
    const points=(state.data&&state.data[testId])||null,key=testId+'|'+level+'|'+(lot||''),hit=lotIndexMemo.get(key);
    if(hit&&hit.points===points&&hit.len===(points?points.length:-1))return hit.list;
    const list=root.NceActionQcIndex?root.NceActionQcIndex.actionLotPoints(points,level,lot,pointRunNo):(points||[]).filter(x=>!x.voided&&+x.level===+level&&(x.lot||'')===(lot||''))
      .sort((x,y)=>String(x.date||'').localeCompare(String(y.date||''))||pointRunNo(x)-pointRunNo(y));
    lotIndexMemo.set(key,{points,len:points?points.length:-1,list});
    return list;
  }
  function actionPointIndex(testId){
    if(root.ActionRerunService)return root.ActionRerunService.pointIndex(testId);
    const points=(state.data&&state.data[testId])||null,hit=pointIndexMemo.get(testId);
    if(hit&&hit.points===points&&hit.len===(points?points.length:-1))return hit.index;
    const index=root.NceActionQcIndex?root.NceActionQcIndex.actionPointIndex(points):new Map((points||[]).map(p=>[p.id,p]));
    pointIndexMemo.set(testId,{points,len:points?points.length:-1,index});
    return index;
  }
  function actionPoint(a){
    if(root.ActionRerunService)return root.ActionRerunService.point(a);
    return a&&a.pointId?actionPointIndex(a.testId).get(a.pointId)||null:null;
  }
  function actionEventDate(a){
    return root.ActionQcLink.eventDate(a);
  }
  function actionOpenedFromVoid(a,p){
    return root.NceActionRerunPolicy.openedFromVoid(a,p);
  }
  function actionNeedsRerun(a){
    return root.ActionQcLink.needsRerun(a);
  }
  /* Bằng chứng QC phải có quan hệ nhân-quả với hành động khắc phục. Hồ sơ v3 chỉ được
     dùng điểm phát sinh từ ngày hoàn thành hành động; hồ sơ nối tiếp còn phải bắt đầu
     từ ngày mở vòng mới để không tái sử dụng QC của vòng trước. Dữ liệu QC hiện chỉ có
     độ phân giải theo ngày, nên cùng ngày vẫn hợp lệ nhưng với điểm sự cố cùng ngày thì
     số lần chạy phải lớn hơn như rào cũ. */
  function actionRerunGateDate(a,p){
    return root.NceActionRerunPolicy.rerunGateDate(a,p);
  }
  function actionRerunSignature(a){
    const t=state.tests.find(x=>x.id===(a&&a.testId));
    if(root.NceActionRerunCacheKey)return root.NceActionRerunCacheKey.actionRerunCacheKey(a,t&&t.decimalPlaces);
    return[a.id,a.testId,a.pointId,+a.protocolVersion||0,a.actionCompletedDate||'',a.parentNceId||'',a.date||'',a.openedFromVoid?1:0,t&&t.decimalPlaces!=null?t.decimalPlaces:'auto'].join('|');
  }
  function computeActionRerunStatus(a){
    if(root.NceActionRerunEvaluator){
      const needed=actionNeedsRerun(a),t=state.tests.find(x=>x.id===a.testId),p=actionPoint(a),wg=t?activeWestgard(t):null,gateDate=p?actionRerunGateDate(a,p):'',runNo=p?pointRunNo(p):0;
      return root.NceActionRerunEvaluator.evaluateActionRerun({action:a,needed,point:p,gateDate,incidentRunNumber:runNo,candidates:p?actionLotPoints(a.testId,p.level,p.lot||''):[],runNumber:pointRunNo,verdictFor:id=>wg&&wg.byPoint.get(id)||{level:'ok'},formatValue:point=>fmtPointValue(point,t),formatDate:value=>vnDate(value)});
    }
    if(!actionNeedsRerun(a))return{needed:false,ok:true,label:'Không yêu cầu',cls:'none',point:null};
    const t=state.tests.find(x=>x.id===a.testId),p=actionPoint(a),wg=activeWestgard(t),runNo=pointRunNo(p);
    if(+a.protocolVersion>=3&&!a.actionCompletedDate)return{needed:true,ok:false,label:'Chờ hoàn thành hành động trước khi xác nhận QC chạy lại',cls:'warn',point:null};
    const gateDate=actionRerunGateDate(a,p);
    /* Duyet actionLotPoints() — da loc san dung muc + dung lo, da bo diem huy va da sap
       theo ngay/lan chay. Truoc day ham nay quet
       TOAN BO state.data[testId] cho tung ho so: voi 40 000 diem x 600 ho so la 5 894ms
       moi lan ve bang nhat ky. Mang da sap nen dung ngay o ung vien dau tien hop le. */
    let rerun=null;
    const candidates=actionLotPoints(a.testId,p.level,p.lot||'');
    for(let i=0;i<candidates.length;i++){
      const x=candidates[i];
      if(x.voided||x.id===p.id||+x.level!==+p.level||(x.lot||'')!==(p.lot||''))continue;
      if(x.date<gateDate)continue;
      if(!(x.date>p.date||(x.date===p.date&&pointRunNo(x)>runNo)))continue;
      if((wg.byPoint.get(x.id)||{level:'ok'}).level==='rej')continue;
      rerun=x;break;
    }
    if(rerun){const verdict=wg.byPoint.get(rerun.id)||{level:'ok'},warning=verdict.level==='warn';return{needed:true,ok:true,label:`${warning?'QC chấp nhận lại (cảnh báo)':'QC đạt lại'}: ${fmtPointValue(rerun,t)} (${rerun.runId||'lần sau'})`,cls:warning?'warn':'ok',point:rerun};}
    return{needed:true,ok:false,label:`Chờ QC chạy lại được chấp nhận${gateDate?' từ '+vnDate(gateDate):''}`,cls:'warn',point:null};
  }
  /* Memo TU KIEM CHUNG: ngoai chu ky cua ho so, con giu chinh THAM CHIEU mang diem QC
     va do dai cua no. Nho vay thay nguyen state (test swap state, boot lai, merge) hay
     them/bot diem deu tu truot cache ma khong phai trong cho ai do nho goi clearDerived.
     Sua gia tri tai cho van di qua save({testId}) -> clearDerivedForTest nhu moi memo
     khac trong app, nen invalidateActionCaches() ben duoi lo not truong hop do. */
  function actionRerunStatus(a){
    if(root.ActionRerunService)return root.ActionRerunService.status(a);
    if(!a||!a.id)return computeActionRerunStatus(a);
    const points=(state.data&&state.data[a.testId])||null,sig=actionRerunSignature(a),hit=rerunMemo.get(a.id);
    if(hit&&hit.sig===sig&&hit.points===points&&hit.len===(points?points.length:-1))return hit.result;
    const result=computeActionRerunStatus(a);
    rerunMemo.set(a.id,{sig,testId:a.testId,points,len:points?points.length:-1,result});
    return result;
  }
  function actionWorkflowStatus(a){
    if(root.ActionWorkflowStatusService)return root.ActionWorkflowStatusService(a);
    if(actionCancelled(a))return{complete:false,cancelled:true,cls:'none',label:'Đã hủy hồ sơ',stage:'cancelled',rerun:{needed:false,ok:false,label:'Hồ sơ đã hủy',cls:'none',point:null},protocol:actionProtocolStatus(a),effectiveness:actionEffectivenessStatus(a)};
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
  /* Index tu kiem chung nhu actionPointIndex/actionLotPoints: chu ky la tham chieu +
     do dai cua state.actions, nen them ho so moi tu lam moi index. pointId cua mot
     ho so da ton tai la bat bien (xem action-form.js) nen sua truong khac tai cho
     khong lam sai index. Truoc day pointActions() quet toan bo state.actions moi lan
     goi — trang Khac phuc su co goi lai ham nay cho tung dong trong currentIssues()
     roi issueRowHtml(), nen voi nhat ky lon (toi 100 000 ho so) la quet lai nhieu lan
     tren moi lan render. */
  const pointActionsMemo={ref:null,len:-1,index:null};
  function pointActionsIndex(){
    const list=state.actions||[];
    if(pointActionsMemo.ref===list&&pointActionsMemo.len===list.length)return pointActionsMemo.index;
    const index=new Map();
    list.forEach(a=>{const arr=index.get(a.pointId);if(arr)arr.push(a);else index.set(a.pointId,[a]);});
    pointActionsMemo.ref=list;pointActionsMemo.len=list.length;pointActionsMemo.index=index;
    return index;
  }
  function pointActions(pointId){
    if(root.ActionPointIndexService)return root.ActionPointIndexService.forPoint(pointId);
    return pointActionsIndex().get(pointId)||[];
  }
  function pointRealActions(pointId){
    if(root.PointWorkflowService)return root.PointWorkflowService.real(pointActions(pointId));
    return pointActions(pointId).filter(a=>!actionCancelled(a)&&actionRecorded(a));
  }
  function pointWorkflowComplete(pointId){
    if(root.PointWorkflowService)return root.PointWorkflowService.complete(pointActions(pointId));
    return pointRealActions(pointId).some(a=>actionWorkflowStatus(a).complete);
  }
  function pointWorkflowSummary(pointId){
    if(root.PointWorkflowService)return root.PointWorkflowService.summary(pointActions(pointId));
    const acts=pointActions(pointId);
    if(!acts.length)return{cls:'rej',label:'Chưa ghi khắc phục'};
    const real=pointRealActions(pointId);
    if(!real.length)return{cls:'rej',label:'Chưa ghi khắc phục'};
    const done=real.find(a=>actionWorkflowStatus(a).complete);
    if(done)return{cls:'ok',label:actionWorkflowStatus(done).label};
    return actionWorkflowStatus(real[real.length-1]);
  }

  root.ActionWorkflowService={ACTION_LABELS:root.NceActionLabels&&root.NceActionLabels.actionLabels||ACTION_LABELS,RISK_SCALE:root.NceActionLabels&&root.NceActionLabels.riskScale||RISK_SCALE,invalidateActionCaches,nextNceId,nceDueDate,actionApprovalStatus,actionRecordStatus,actionCancelled,actionApprovalLabel,actionRecorded,actionDraftStatus,actionProtocolStatus,actionProtocolSummary,actionRiskScore,actionResidualRiskScore,actionActiveFollowUp,actionEffectivenessStatus,actionOverdue,actionCanApprove,actionPoint,actionEventDate,actionNeedsRerun,actionRerunGateDate,actionRerunStatus,actionWorkflowStatus,pointActions,pointRealActions,pointWorkflowComplete,pointWorkflowSummary};
  Object.assign(root,root.ActionWorkflowService);
})(typeof globalThis!=='undefined'?globalThis:this);
