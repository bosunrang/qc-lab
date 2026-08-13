/* ===== AFTER RENDER ===== */
/* render() rebuilt #main.innerHTML mỗi lần -> mọi canvas là node MỚI, nên các
   IntersectionObserver/ResizeObserver gắn ở lượt render trước còn quan sát node
   đã rời DOM, không bao giờ tự nhả (leak). Service TypeScript gom observer của
   lượt hiện tại để afterRender() disconnect hết trước khi tạo lượt mới. */
function queueCanvasDraw(canvas){return globalThis.afterRenderCanvasService.queueCanvasDraw(canvas);}
function drawVisibleCanvas(canvas,draw){return globalThis.afterRenderCanvasService.drawVisibleCanvas(canvas,draw);}
function afterRender(){
  globalThis.afterRenderCanvasService.disconnectObservers();
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
  globalThis.defaultDateFieldsService.fill(['eDate','aDate'],vnDate(isoToday()));
  globalThis.postRenderPageActions.run(page,{reagent:rcCompute,sigma:sgRefresh});
  if(page==='entry'&&entryJumpToday){
    entryJumpToday=false;
    requestAnimationFrame(()=>globalThis.entryJumpScrollService.scroll());
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
  globalThis.configNavScrollService.restore();
}
