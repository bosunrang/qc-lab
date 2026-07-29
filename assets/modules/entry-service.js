/* ===== ENTRY SERVICE ===== */
(function(root){
  function nextRunIdFor(state,testId,date){
    const prefix=date+'-';
    const nums=((state.data&&state.data[testId])||[])
      .filter(p=>!p.voided)
      .map(p=>String(p.runId||''))
      .filter(x=>x.startsWith(prefix))
      .map(x=>parseInt(x.slice(prefix.length)))
      .filter(Number.isFinite);
    return prefix+(nums.length?Math.max(...nums)+1:1);
  }

  function cleanRunId(value){
    return QCCore.cleanText(value,120).trim();
  }

  function buildEntryWindow({points=[],days=30,start='',end='',today=''}){
    const all=Array.isArray(points)?points.slice():[];
    const ordered=all.slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||pointRunNoFor(a)-pointRunNoFor(b));
    const safeEnd=end||today||((ordered.length&&ordered[ordered.length-1].date)||'');
    let safeStart=start;
    if(!safeStart&&safeEnd){
      const date=new Date(safeEnd+'T00:00:00Z');
      const span=Math.max(1,Number(days)||30)-1;
      date.setUTCDate(date.getUTCDate()-span);
      safeStart=date.toISOString().slice(0,10);
    }
    return{all,pts:ordered.filter(p=>p.date>=safeStart&&p.date<=safeEnd),start:safeStart,end:safeEnd};
  }

  function pointRunNoFor(point){
    const match=/(?:^|-)(\d+)$/.exec(String(point&&point.runId||''));
    return match?Number(match[1]):1;
  }

  function groupByMachine(tests,fallback='(Chưa gán máy)'){
    const groups=new Map();
    (Array.isArray(tests)?tests:[]).forEach(test=>{
      const machine=String(test&&test.machine||'').trim()||fallback;
      if(!groups.has(machine))groups.set(machine,[]);
      groups.get(machine).push(test);
    });
    return new Map([...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0],'vi')));
  }

  function buildSheetCalendar(month,today){
    const todayMonth=/^\d{4}-\d{2}-\d{2}$/.test(String(today||''))?String(today).slice(0,7):'';
    const activeMonth=/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month||''))?String(month):todayMonth;
    const match=/^(\d{4})-(\d{2})$/.exec(activeMonth);
    if(!match)return{activeMonth:'',year:0,month:0,start:'',end:'',days:[],yearMin:0,yearMax:0};
    const year=Number(match[1]),monthNo=Number(match[2]);
    const end=new Date(Date.UTC(year,monthNo,0)).toISOString().slice(0,10);
    const days=Array.from({length:Number(end.slice(-2))},(_,index)=>`${activeMonth}-${String(index+1).padStart(2,'0')}`);
    const currentYear=/^\d{4}-\d{2}-\d{2}$/.test(String(today||''))?Number(String(today).slice(0,4)):year;
    return{activeMonth,year,month:monthNo,start:`${activeMonth}-01`,end,days,yearMin:Math.min(year,currentYear-5),yearMax:Math.max(year,currentYear+5)};
  }

  function summarizeRunStatus(levelPoints,verdictById){
    let worst='ok',rulesAll=[],warnRules=[],rejRules=[],hasPoint=false;
    const verdict=point=>{
      const value=verdictById&&typeof verdictById.get==='function'?verdictById.get(point.id):typeof verdictById==='function'?verdictById(point):null;
      return value||{level:'ok',rules:[]};
    };
    (Array.isArray(levelPoints)?levelPoints:[]).forEach(points=>{
      const rows=Array.isArray(points)?points.filter(Boolean):[];
      if(!rows.length)return;
      hasPoint=true;
      const accepted=[...rows].reverse().find(point=>verdict(point).level!=='rej')||rows[rows.length-1];
      const result=verdict(accepted),rules=Array.isArray(result.rules)?result.rules:[];
      if(result.level==='rej')worst='rej';
      else if(result.level==='warn'&&worst!=='rej')worst='warn';
      rulesAll=rulesAll.concat(rules);
      rules.forEach(rule=>{if(rule==='1-2s'||result.level==='warn')warnRules.push(rule);else rejRules.push(rule);});
    });
    return{hasPoint,worst,rulesAll,warnRules,rejRules};
  }

  function buildPointView(/** @type {{point?:any,verdict?:any,mean?:number,sd?:number,previousLot?:any}} */{point,verdict={},mean,sd,previousLot}={}){
    const level=verdict&&verdict.level||'ok',rules=Array.isArray(verdict&&verdict.rules)?verdict.rules:[];
    const verdictZ=Number(verdict&&verdict.z),value=Number(point&&point.val),targetMean=Number(mean),targetSd=Number(sd);
    const z=Number.isFinite(verdictZ)?verdictZ:Number.isFinite(value)&&Number.isFinite(targetMean)&&Number.isFinite(targetSd)&&targetSd!==0?(value-targetMean)/targetSd:NaN;
    const isPrevious=previousLot!==undefined;
    return{level,rules,z,isPrevious,valueClass:isPrevious?'prev':level==='warn'?'warn':level==='rej'?'rej':'ok'};
  }

  // Chuẩn hóa dữ liệu thô từ ô nhập trước khi router chạy các kiểm tra nghiệp vụ.
  function preparePointInput({tid,level,date,value,runId,cfg,staff,id}){
    const errors=[];
    const cleanTid=QCCore.cleanId(tid);
    const cleanDate=QCCore.cleanText(date,20).trim();
    const numericLevel=Number(level);
    const val=typeof value==='number'?value:parseFloat(String(value==null?'':value).trim());
    if(!cleanTid)errors.push('missing-test');
    if(!Number.isFinite(numericLevel))errors.push('invalid-level');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate))errors.push('invalid-date');
    if(!Number.isFinite(val))errors.push('invalid-value');
    if(!cfg||typeof cfg!=='object')errors.push('missing-config');
    if(errors.length)return{ok:false,errors};
    return{ok:true,point:{
      tid:cleanTid,
      level:numericLevel,
      date:cleanDate,
      val,
      runId:cleanRunId(runId)||`${cleanDate}-1`,
      cfg,
      staff:staff||{},
      id:id||''
    }};
  }

  function saveDateNote(state,tid,date,value){
    if(root.PeriodService&&root.PeriodService.findLock(state,root.PeriodService.periodForDate(date)))return{error:'period-locked'};
    const rows=((state.data&&state.data[tid])||[]).filter(p=>!p.voided&&p.date===date);
    if(!rows.length)return null;
    const note=QCCore.cleanText(value,1000).trim();
    rows.forEach(p=>{p.note=note;});
    return{note,rows};
  }

  function addPoint(state,{tid,level,date,val,runId,cfg,staff,id}){
    if(root.PeriodService&&root.PeriodService.findLock(state,root.PeriodService.periodForDate(date)))return{error:'period-locked'};
    state.data=state.data||{};
    state.data[tid]=state.data[tid]||[];
    const dayNote=((state.data[tid]||[]).find(p=>!p.voided&&p.date===date&&String(p.note||'').trim())||{}).note||'';
    const point={id,date,runId,level,val,lot:cfg.lot||'',qcMean:cfg.mean,qcSd:cfg.sd,note:dayNote,...staff};
    state.data[tid].push(point);
    return point;
  }

  function recordPoint(state,input){
    const prepared=preparePointInput(input||{});
    if(!prepared.ok)return prepared;
    const saved=addPoint(state,prepared.point);
    if(saved&&saved.error)return{ok:false,error:saved.error,point:prepared.point};
    if(!saved)return{ok:false,error:'save-failed',point:prepared.point};
    return{ok:true,point:saved};
  }

  function voidPoint(state,{tid,pointId,reason,kind='analytical',openNce=true,rule='Không có luật Westgard',errorType='—',qcVerdict='invalid',staff,nowIso,today,id,nceId,dueDate,formatDate,formatNumber}){
    const p=((state.data&&state.data[tid])||[]).find(x=>x.id===pointId);
    if(!p||p.voided)return null;
    if(root.PeriodService&&root.PeriodService.findLock(state,root.PeriodService.periodForDate(p.date)))return{error:'period-locked'};
    /* ISO 15189 đòi lý do cho MỌI thao tác sửa/hủy dữ liệu. Nhãn loại hủy là phân loại,
       không thay được lời giải thích — nên ghi chú tự do luôn được nối vào voidReason,
       và với loại "khác" thì bắt buộc vì nhãn không nói lên điều gì. */
    const normalizedKind=['data-entry','analytical','other'].includes(kind)?kind:'other';
    const kindLabel=normalizedKind==='analytical'?'Kết quả QC thực tế không hợp lệ':normalizedKind==='data-entry'?'Nhập sai dữ liệu':'';
    const note=QCCore.cleanText(reason,1000).trim();
    if(!kindLabel&&note.length<5)return{error:'reason-too-short'};
    const clean=kindLabel?(note?`${kindLabel} — ${note}`:kindLabel):note;
    p.voided=true;
    p.voidReason=clean;
    p.voidKind=normalizedKind;
    p.voidRequiresRerun=!!openNce;
    p.voidedAt=nowIso;
    p.voidedBy=staff.operatorName||staff.operatorUsername||'';
    state.actions=state.actions||[];
    const existing=[...state.actions].reverse().find(a=>a.pointId===p.id&&+a.protocolVersion>=2&&a.recordStatus!=='cancelled'&&(a.approvalStatus||'pending')!=='approved');
    let action=existing||null;
    if(openNce&&!action)action={
      id,
      protocolVersion:3,
      nceId,
      date:p.date||today,
      createdAt:nowIso,
      updatedAt:nowIso,
      openedFromVoid:true,
      createdByUserId:staff.operatorId||'',
      createdByUsername:staff.operatorUsername||'',
      contentEditorUserIds:[staff.operatorId||''].filter(Boolean),
      contentEditorUsernames:[String(staff.operatorUsername||'').trim().toLowerCase()].filter(Boolean),
      testId:tid,
      level:p.level,
      lot:p.lot||'',
      pointId:p.id,
      rule:QCCore.cleanText(rule,200).trim()||'Không có luật Westgard',
      errorType:QCCore.cleanText(errorType,120).trim()||'—',
      qcVerdict:['warn','rej','invalid'].includes(qcVerdict)?qcVerdict:'invalid',
      eventSource:'iqc',
      processPhase:'exam',
      correction:`Hủy điểm ngày ${formatDate(p.date)}, lần ${p.runId||'—'}, giá trị ${formatNumber(p.val)}. Lý do: ${clean}`,
      by:p.voidedBy,
      dueDate:dueDate||'',
      containmentStatus:'',
      effectivenessStatus:'pending',
      approvalStatus:'pending',
      recordStatus:'active',
      approvedAt:'',
      approvedBy:'',
      approvalNote:''
    };
    if(openNce&&!existing)state.actions.push(action);
    return{point:p,action,reason:clean,openNce:!!openNce,reusedAction:!!existing};
  }

  function buildSheetRowsData({levels,sheetStart,sheetEnd,sheetDays,pointsByLevel,previousPointsByLevel,pointRunNo}){
    const groupsByDate=new Map();
    (levels||[]).forEach(l=>{
      // `key` = định danh cột (mức+lô) khi có lô chạy song song; không có thì
      // rơi về `level` như cũ, nên caller cũ và test cũ không phải đổi gì.
      const level=(l&&l.key!=null)?l.key:(l&&l.level);
      const prev=(previousPointsByLevel&&previousPointsByLevel[level])||[];
      const cur=(pointsByLevel&&pointsByLevel[level])||[];
      prev.concat(cur).filter(p=>p&&p.date>=sheetStart&&p.date<=sheetEnd).forEach(p=>{
        const runId=p.runId||`${p.date}-1`,key=p.date+'|'+runId;
        let byRun=groupsByDate.get(p.date);if(!byRun){byRun=new Map();groupsByDate.set(p.date,byRun);}
        if(!byRun.has(key))byRun.set(key,{date:p.date,runId,levels:{}});
        byRun.get(key).levels[level]=p;
      });
    });
    return(sheetDays||[]).map(day=>{
      const byRun=groupsByDate.get(day);
      if(!byRun)return{date:day,runs:[{date:day,runId:'',runNo:1,levels:{}}]};
      const runs=[...byRun.values()].sort((a,b)=>String(a.runId||'').localeCompare(String(b.runId||''),'vi',{numeric:true}));
      const nums=runs.map(g=>String(g.runId||'')).filter(x=>x.startsWith(day+'-')).map(x=>parseInt(x.slice(day.length+1))).filter(Number.isFinite);
      const maxRun=nums.length?Math.max(...nums):runs.length;
      runs.forEach((g,i)=>{const n=String(g.runId||'').startsWith(day+'-')?parseInt(String(g.runId).slice(day.length+1)):i+1;g.runNo=Number.isFinite(n)?n:i+1;});
      runs.push({date:day,runId:day+'-'+(maxRun+1),runNo:maxRun+1,levels:{},nextRun:true});
      return{date:day,runs};
    });
  }

  function sheetFirstRunNo(dayGroup){
    const nums=(dayGroup&&dayGroup.runs||[]).map(r=>r.runNo).filter(Number.isFinite);
    return nums.length?Math.min(...nums):1;
  }

  function sheetLevelRuns(dayGroup,level){
    return(dayGroup&&dayGroup.runs||[]).filter(r=>r.levels&&r.levels[level]).sort((a,b)=>a.runNo-b.runNo);
  }

  root.EntryService={nextRunIdFor,cleanRunId,preparePointInput,saveDateNote,addPoint,recordPoint,voidPoint,buildEntryWindow,groupByMachine,buildSheetCalendar,summarizeRunStatus,buildPointView,buildSheetRowsData,sheetFirstRunNo,sheetLevelRuns};
  root.nextRunId=function(testId,date){return nextRunIdFor(state,testId,date);};
  root.cleanEntryRunId=cleanRunId;
})(typeof globalThis!=='undefined'?globalThis:this);
