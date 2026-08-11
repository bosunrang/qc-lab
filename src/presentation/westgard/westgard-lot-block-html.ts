type TestLike = Record<string, any>;

export function createWestgardLotBlockHtml(deps: {
  testValue: (test: TestLike, value: unknown) => string;
  empty: (title: string, message: string) => string;
  buildRows: (test: TestLike, level: unknown, lotNo: unknown, mean: unknown, sd: unknown, points: unknown[]) => { view: { rows: unknown[] }; key: string };
  pointRows: (rows: unknown[], test: TestLike) => string;
  rowsControl: (view: { rows: unknown[] }, key: string) => string;
}) {
  return (input: { test: TestLike; level: unknown; lotNo: unknown; mean: unknown; sd: unknown; points: unknown[]; badge: string; title: string; lotLabel: string; extraMeta?: string }) => {
    const meta = input.extraMeta || '';
    const heading = `<h3><span class="wg-level-title"><span>${input.title}</span><span class="wg-lot-name">${input.lotLabel}</span></span><span class="wg-level-meta"><span class="tag rej">${input.badge}</span><span>Mean ${deps.testValue(input.test, input.mean)}</span><span>SD ${deps.testValue(input.test, input.sd)}</span><span>${input.points.length} điểm</span>${meta}</span></h3>`;
    if (!input.points.length) return `<div class="panel wg-prev-lot">${heading}${deps.empty('Chưa có dữ liệu', 'Không tìm thấy điểm QC nào cho lô này.')}</div>`;
    const prepared = deps.buildRows(input.test, input.level, input.lotNo, input.mean, input.sd, input.points);
    return `<div class="panel wg-prev-lot">${heading}${deps.rowsControl(prepared.view, prepared.key)}<table class="wg-table"><thead><tr><th>#</th><th>Ngày</th><th class="num">Giá trị</th><th class="num">Z</th><th>Kết luận</th><th>Luật / bằng chứng</th><th>Loại sai số</th></tr></thead><tbody>${deps.pointRows(prepared.view.rows, input.test)}</tbody></table></div>`;
  };
}
