type DashboardPageInput = {
  headHtml: string;
  todayText: string;
  mood: string;
  moodText: string;
  progressHtml: string;
  kpisHtml: string;
  followHtml: string;
  expiringLotsHtml: string;
  testsPanelHtml: string;
};

export function createDashboardPageHtml() {
  return (input: DashboardPageInput) => `${input.headHtml}
   <div class="dash-hero">
     <div class="dash-status"><div class="eyebrow">Trạng thái trực ca · ${input.todayText}</div><h2>${input.mood}</h2><p>${input.moodText}</p>${input.progressHtml}</div>
     ${input.kpisHtml}
   </div>
   <div class="dash-main">
     <div class="panel"><h2 class="panel-title">Cần xử lý / Theo dõi</h2>${input.followHtml}</div>
     <div class="panel"><h2 class="panel-title">Lô & hạn dùng</h2><div class="dash-list">${input.expiringLotsHtml}</div></div>
   </div>
   ${input.testsPanelHtml}`;
}
