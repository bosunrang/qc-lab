type Item = { t: Record<string, any>; l: { level: unknown } };

export function createDashboardMissingTargetItemHtml(deps: {
  escape: (value: unknown) => string;
  testLabel: (test: Record<string, any>) => string;
  button: (label: string, action: string, variant: string) => string;
}) {
  return (item: Item) => `<div class="shift-item warn"><div><b>${deps.escape(deps.testLabel(item.t))} · M${item.l.level}</b><div class="meta">Chưa có Mean/SD hợp lệ — điểm QC mức này không được đánh giá Westgard</div></div>${deps.button('Gán Mean/SD', "go('manage');setManageTab('targets')", 'ghost sm')}</div>`;
}
