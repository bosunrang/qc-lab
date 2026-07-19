/* ===== PERIOD LOCK SERVICE ===== */
(function(root){
  function normalizePeriod(value){
    const text=QCCore.cleanText(value,20).trim();
    const m=/^(\d{4})-(\d{1,2})$/.exec(text);
    if(!m)return'';
    const month=Number(m[2]);
    return month>=1&&month<=12?m[1]+'-'+String(month).padStart(2,'0'):'';
  }

  function periodForDate(value){
    const m=/^(\d{4})-(\d{2})-\d{2}$/.exec(String(value||''));
    return m?m[1]+'-'+m[2]:'';
  }

  function findLock(state,ym){
    const period=normalizePeriod(ym);
    return period?((state&&state.periodLocks)||[]).find(x=>normalizePeriod(x&&x.ym)===period)||null:null;
  }

  function lock(state,{ym,lockedAt,lockedBy,note,id}){
    const period=normalizePeriod(ym);
    if(!period)return{error:'invalid-period'};
    if(findLock(state,period))return{error:'already-locked'};
    state.periodLocks=Array.isArray(state.periodLocks)?state.periodLocks:[];
    const record={id:id||'',ym:period,lockedAt:lockedAt||'',lockedBy:QCCore.cleanText(lockedBy,120).trim(),note:QCCore.cleanText(note,1000).trim()};
    state.periodLocks.push(record);
    return{lock:record};
  }

  function unlock(state,{ym,reason}){
    const period=normalizePeriod(ym),cleanReason=QCCore.cleanText(reason,1000).trim();
    if(!period)return{error:'invalid-period'};
    if(cleanReason.length<5)return{error:'reason-too-short'};
    const index=((state&&state.periodLocks)||[]).findIndex(x=>normalizePeriod(x&&x.ym)===period);
    if(index<0)return{error:'not-locked'};
    const removed=state.periodLocks.splice(index,1)[0];
    return{lock:removed,reason:cleanReason};
  }

  root.PeriodService={normalizePeriod,periodForDate,findLock,lock,unlock};
})(typeof globalThis!=='undefined'?globalThis:this);
