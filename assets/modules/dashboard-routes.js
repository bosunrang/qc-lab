/* ===== DASHBOARD PAGE ROUTE ===== */
function pageDash(){
  const tests=operationalTests(),missingWestgard=tests.filter(t=>!wgMemo.has(t.id));
  if(missingWestgard.length&&scheduleWestgardPrewarm(missingWestgard))return globalThis.dashboardLoadingPresentation(tests,missingWestgard.length,state.data,state.lab);
  const today=isoToday();
  const dashItems=globalThis.dashboardTestItems(tests,today);
  const dashboardKpi=globalThis.dashboardKpis(dashItems,tests.length),{totalPoints:totalPts,todayPoints:todayPts,rejected:rej,warnings:warn,missingToday:missingTodayCount,completeTests:doneTests,completionPercent:pct}=dashboardKpi;
  const noTarget=globalThis.dashboardMissingTargetItems(dashItems,levelsMissingTarget);
  const{urgent,watch}=globalThis.dashboardWestgardAlerts(dashItems.map(item=>({test:item.t,alerts:item.alerts})));
  const exp=globalThis.dashboardExpiringLotItems(dashItems,daysToExp);
  /* Nhiều xét nghiệm có thể dùng chung 1 lô (VD panel điện giải) -> gộp theo
     lô+mức, chỉ hiện 1 dòng/lô kèm số xét nghiệm dùng chung, thay vì lặp lại
     dòng cảnh báo hết hạn cho từng xét nghiệm riêng lẻ. */
  const expByLot=globalThis.dashboardExpiringLots(exp);
  const urgentHtml=globalThis.dashboardQcFollowupListHtml(urgent,5,'rej');
  const watchHtml=globalThis.dashboardQcFollowupListHtml(watch,4,'warn');
  /* Hồ sơ NCE quá hạn: lọc thô theo dueDate trước rồi mới gọi actionOverdue() — hàm đó
     phải chạy actionWorkflowStatus()/actionRerunStatus() nên chỉ đáng trả giá cho vài
     hồ sơ thật sự đã qua hạn, không phải cho toàn bộ nhật ký ở mỗi lần vẽ dashboard. */
  const overdue=globalThis.dashboardOverdueActions(state.actions||[],today);
  const overdueHtml=globalThis.dashboardOverdueActionListHtml(overdue,state.tests);
  const noTargetHtml=globalThis.dashboardMissingTargetListHtml(noTarget);
  const followHtml=globalThis.dashboardFollowupPanelHtml(urgentHtml,overdueHtml,noTargetHtml,watchHtml);
  const expHtml=globalThis.dashboardExpiringLotsHtml(expByLot.values());
  const dashStatusTabs=globalThis.dashboardStatusTabsHtml(dashItems,dashTestStatus);
  const statusItems=dashItems.filter(item=>globalThis.dashboardStatusFilter.matches(item,dashTestStatus));
  const testRows=globalThis.dashboardTestRowsHtml(statusItems);
  const testListHtml=globalThis.dashboardTestListHtml(statusItems.length,testRows);
  const done=todayPts;
  const shift=globalThis.dashboardShiftStatus({rejected:rej,overdueActions:overdue.length,warnings:warn,missingToday:missingTodayCount}),mood=shift.mood,moodText=shift.text;
  const headHtml=globalThis.dashboardHeadHtml(state.lab),progressHtml=globalThis.dashboardProgressHtml(doneTests,tests.length,pct),kpisHtml=globalThis.dashboardKpisHtml(globalThis.dashboardKpiItems({tests:tests.length,totalPoints:totalPts,rejected:rej,todayPoints:done})),testsPanelHtml=globalThis.dashboardTestPanelHtml({testsCount:tests.length,statusTabs:dashStatusTabs,query:dashTestQ,filteredCount:statusItems.length,testListHtml,emptyHtml:globalThis.dashboardEmptyTestsHtml(role()==='admin')});
  return globalThis.dashboardPageHtml({headHtml,todayText:vnDate(today),mood,moodText,progressHtml,kpisHtml,followHtml,expiringLotsHtml:expHtml,testsPanelHtml});
}

function dashTestFilter(value){
  dashTestQ=value;
  liveRowFilter('.dash-test-list tbody tr',dashTestQ,{countId:'dashTestCount',emptyId:'dashTestEmpty'});
}
function dashTestSetStatus(value){
  dashTestStatus=globalThis.dashboardStatusFilter.normalize(value);
  rerender();
}
function pageDashLoading(tests,pending){return globalThis.dashboardLoadingPresentation(tests,pending,state.data,state.lab);}
