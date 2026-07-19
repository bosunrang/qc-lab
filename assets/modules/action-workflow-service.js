/* ===== ACTION WORKFLOW SERVICE ===== */
(function(root){
  function actionApprovalStatus(a){
    return(a&&['pending','approved','returned'].includes(a.approvalStatus))?a.approvalStatus:'pending';
  }
  function actionApprovalLabel(a){
    const s=actionApprovalStatus(a);
    return s==='approved'?'Đã duyệt':s==='returned'?'Trả lại':'Chờ duyệt';
  }
  function actionRecorded(a){
    return !!(a&&!a.autoCreated&&String(a.action||'').trim().length>=5&&String(a.by||'').trim());
  }
  function actionPoint(a){
    return a&&a.pointId?((state.data&&state.data[a.testId])||[]).find(p=>p.id===a.pointId)||null:null;
  }
  function actionNeedsRerun(a){
    const t=state.tests.find(x=>x.id===(a&&a.testId)),p=actionPoint(a);
    if(!t||!p)return false;
    if(p.voided)return true;
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
    const rerun=actionRerunStatus(a),approval=actionApprovalStatus(a),complete=(!rerun.needed||rerun.ok)&&approval==='approved';
    const cls=complete?'ok':approval==='returned'?'rej':'warn';
    const parts=[];
    if(rerun.needed)parts.push(rerun.label);
    parts.push(actionApprovalLabel(a));
    return{complete,cls,label:parts.join(' · '),rerun};
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

  root.ActionWorkflowService={actionApprovalStatus,actionApprovalLabel,actionRecorded,actionPoint,actionNeedsRerun,actionRerunStatus,actionWorkflowStatus,pointActions,pointRealActions,pointWorkflowComplete,pointWorkflowSummary};
  Object.assign(root,root.ActionWorkflowService);
})(typeof globalThis!=='undefined'?globalThis:this);
