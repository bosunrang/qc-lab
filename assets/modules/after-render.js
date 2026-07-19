/* ===== AFTER RENDER ===== */
/* render() rebuilt #main.innerHTML mỗi lần -> mọi canvas là node MỚI, nên các
   IntersectionObserver/ResizeObserver gắn ở lượt render trước còn quan sát node
   đã rời DOM, không bao giờ tự nhả (leak). ljObservers gom lại observer của lượt
   hiện tại để afterRender() disconnect hết trước khi tạo lượt mới. */
let ljObservers=[];
let ljDrawQueue=new Set(),ljDrawFrame=0;
function queueCanvasDraw(canvas){
  if(!canvas||!canvas._ljDraw)return;
  ljDrawQueue.add(canvas);
  if(ljDrawFrame)return;
  ljDrawFrame=requestAnimationFrame(()=>{
    ljDrawFrame=0;
    const queue=[...ljDrawQueue];ljDrawQueue.clear();
    queue.forEach(c=>{if((c.isConnected!==false)&&c._ljDraw)c._ljDraw();});
  });
}
function drawVisibleCanvas(c,fn){
  c._ljDraw=fn;
  const run=()=>queueCanvasDraw(c);
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))run();},{rootMargin:'160px'});
    io.observe(c);ljObservers.push(io);
  }else run();
  if('ResizeObserver' in window){
    let lastW=0;
    const ro=new ResizeObserver(()=>{const w=Math.round(c.getBoundingClientRect().width);if(w>0&&w!==lastW){lastW=w;run();}});
    ro.observe(c);ljObservers.push(ro);
  }
}
function afterRender(){
  ljObservers.forEach(o=>o.disconnect());ljObservers=[];
  document.querySelectorAll('canvas.ljc').forEach(c=>drawVisibleCanvas(c,()=>{const t=state.tests.find(x=>x.id===c.dataset.test);if(!t)return;const l=lvlCfg(t,parseInt(c.dataset.level));if(!l)return;const chart=ChartViewModel.buildLeveyJennings({points:acceptedLotPoints(t,l.level),mean:l.mean,sd:l.sd});drawLJ(c,chart.points,chart.mean,chart.sd);}));
  document.querySelectorAll('canvas.entryLJStack').forEach(c=>drawVisibleCanvas(c,()=>{const t=state.tests.find(x=>x.id===c.dataset.test);if(!t)return;const l=lvlCfg(t,parseInt(c.dataset.level));if(!l)return;const lot=c.dataset.lot||l.lot||'',key=`${l.level}|${lot}`,cache=entryLjRenderCache&&entryLjRenderCache.testId===c.dataset.test&&entryLjRenderCache.start===c.dataset.start&&entryLjRenderCache.end===c.dataset.end?entryLjRenderCache.levels.get(key):null,source=cache||acceptedLotPoints(t,l.level),mean=Number.isFinite(+c.dataset.mean)?+c.dataset.mean:l.mean,sd=Number.isFinite(+c.dataset.sd)?+c.dataset.sd:l.sd,chart=ChartViewModel.buildLeveyJennings({points:source,start:c.dataset.start,end:c.dataset.end,lot,mean,sd});drawLJ(c,chart.points,chart.mean,chart.sd);}));
  document.querySelectorAll('canvas.wgLJMulti').forEach(c=>drawVisibleCanvas(c,()=>{const t=state.tests.find(x=>x.id===c.dataset.test);if(!t)return;drawLJMultiZ(c,ChartViewModel.buildMultiLevel({views:wgMultiViews(t)}),t);}));
  // Levey-Jennings tổng hợp cho nhóm lô đã dừng/lưu trữ (pageWestgardArchived, router-render.js):
  // lấy các mức của đúng xét nghiệm đang chọn trong nhóm đó, không phải cấu hình sống hiện hành.
  document.querySelectorAll('canvas.wgLJMultiArchived').forEach(c=>drawVisibleCanvas(c,()=>{
    const t=state.tests.find(x=>x.id===c.dataset.test),group=state.lotGroups.find(g=>g.id===c.dataset.group);
    if(!t||!group)return;
    drawLJMultiZ(c,ChartViewModel.buildMultiLevel({views:wgArchivedMultiViews(levelsForLotGroup(group).filter(r=>r.t.id===t.id))}),t);
  }));
  document.querySelectorAll('canvas.cusumChart').forEach(c=>drawVisibleCanvas(c,()=>{
    const t=state.tests.find(x=>x.id===c.dataset.test);if(!t)return;
    const l=lvlCfg(t,parseInt(c.dataset.level));if(!l)return;
    const chart=ChartViewModel.buildCusum({points:operationalLotPoints(t,l.level),series:cusumSeries(t,l)});
    drawCUSUM(c,chart.points,chart.series);
  }));
  const today=isoToday();['eDate','aDate'].forEach(id=>{const el=document.getElementById(id);if(el&&!el.value)el.value=vnDate(today);});
  if(page==='reagent')requestAnimationFrame(rcCompute);
  if(page==='sigma')requestAnimationFrame(sgRefresh);
  if(page==='entry'&&entryJumpToday){
    entryJumpToday=false;
    requestAnimationFrame(()=>{
      const wrap=document.querySelector('.qc-sheet-wrap'),row=document.querySelector('.qc-sheet tbody tr.today');
      if(wrap&&row)wrap.scrollTo({top:Math.max(0,row.offsetTop-86),behavior:'smooth'});
    });
  }
  updateSaveStatus();
  updateBackupBanner();
  /* render() rebuilds #main.innerHTML on every tab click/search keystroke
     while on Cấu hình chung, so .config-shell-nav is a brand-new element
     each time and its horizontal scroll (from swiping to reach a tab off
     to the right) resets to 0 — the nav visibly snaps back to showing
     "Tổng quan" first right after picking a further tab. Reapply the last
     known scroll position on the fresh node, and keep tracking it via a
     scroll listener (the old node's listener is simply GC'd with it). */
  const cfgNav=document.querySelector('.config-shell-nav');
  if(cfgNav){
    cfgNav.scrollLeft=configNavScroll;
    cfgNav.addEventListener('scroll',()=>{configNavScroll=cfgNav.scrollLeft;},{passive:true});
  }
}
