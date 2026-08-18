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
    return root.ActionProtocolService.protocolStatus(a);
  }
  function actionProtocolSummary(a){
    return root.ActionProtocolService.protocolSummary(a);
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
    return root.ActionProtocolService.effectivenessStatus(a);
  }
  /* Quá hạn chỉ tính cho hồ sơ còn mở — khép vòng rồi thì hạn không còn ý nghĩa. */
  function actionOverdue(a){
    return root.ActionApprovalGates.overdue(a);
  }
  function actionCanApprove(a,user){
    return root.ActionApprovalGates.canApprove(a,user);
  }
  /* Cache thực tế (rerun/point/lot index) đã chuyển sang ActionRerunService/
     ActionPointIndexService (TypeScript) — xem cache tự kiểm chứng ở đó. */
  function invalidateActionCaches(testId){
    root.ActionRerunService.invalidate(testId);root.ActionPointIndexService.invalidate();return;
  }
  function actionLotPoints(testId,level,lot){
    return root.ActionRerunService.lotPoints(testId,level,lot);
  }
  function actionPointIndex(testId){
    return root.ActionRerunService.pointIndex(testId);
  }
  function actionPoint(a){
    return root.ActionRerunService.point(a);
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
  function actionRerunStatus(a){
    return root.ActionRerunService.status(a);
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
  function pointActions(pointId){
    return root.ActionPointIndexService.forPoint(pointId);
  }
  function pointRealActions(pointId){
    return root.PointWorkflowService.real(pointActions(pointId));
  }
  function pointWorkflowComplete(pointId){
    return root.PointWorkflowService.complete(pointActions(pointId));
  }
  function pointWorkflowSummary(pointId){
    return root.PointWorkflowService.summary(pointActions(pointId));
  }

  root.ActionWorkflowService={ACTION_LABELS:root.NceActionLabels&&root.NceActionLabels.actionLabels||ACTION_LABELS,RISK_SCALE:root.NceActionLabels&&root.NceActionLabels.riskScale||RISK_SCALE,invalidateActionCaches,nextNceId,nceDueDate,actionApprovalStatus,actionRecordStatus,actionCancelled,actionApprovalLabel,actionRecorded,actionDraftStatus,actionProtocolStatus,actionProtocolSummary,actionRiskScore,actionResidualRiskScore,actionActiveFollowUp,actionEffectivenessStatus,actionOverdue,actionCanApprove,actionPoint,actionEventDate,actionNeedsRerun,actionRerunGateDate,actionRerunStatus,actionWorkflowStatus,pointActions,pointRealActions,pointWorkflowComplete,pointWorkflowSummary};
  Object.assign(root,root.ActionWorkflowService);
})(typeof globalThis!=='undefined'?globalThis:this);
