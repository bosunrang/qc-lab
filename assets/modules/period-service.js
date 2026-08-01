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

  /* Đếm điểm QC rơi vào kỳ ĐÃ KHÓA, gộp theo kỳ. Thuần (không DOM, không đọc
     state.data) để mọi thao tác phá hủy hoặc viết lại HÀNG LOẠT đều hỏi được
     cùng một câu trước khi làm: "việc này có đụng vào kỳ đã chốt không?".
     Trước 2026-08-01 chỉ có addPoint/voidPoint/saveDateNote kiểm khóa kỳ, nên
     xóa cả xét nghiệm hoặc đổi số lô vẫn đi xuyên qua khóa mà không ai biết.
     Điểm đã hủy vẫn được tính: chúng vẫn là hồ sơ của kỳ đó. */
  function lockedPoints(state,points){
    const byPeriod=new Map();
    (Array.isArray(points)?points:[]).forEach(p=>{
      const ym=periodForDate(p&&p.date);
      if(!ym||!findLock(state,ym))return;
      byPeriod.set(ym,(byPeriod.get(ym)||0)+1);
    });
    const periods=[...byPeriod.keys()].sort();
    return{count:periods.reduce((n,ym)=>n+byPeriod.get(ym),0),periods,byPeriod};
  }

  root.PeriodService={normalizePeriod,periodForDate,findLock,lock,unlock,lockedPoints};
})(typeof globalThis!=='undefined'?globalThis:this);
