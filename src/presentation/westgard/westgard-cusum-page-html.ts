type Level = Record<string, any>;

export function createWestgardCusumPageHtml<T extends Record<string, any>>(deps: {
  empty: (title: string, message: string, action?: string) => string;
  button: (label: string, action: string, variant: string) => string;
  escape: (value: unknown) => string;
  testValue: (test: T, value: unknown) => string;
  format: (value: unknown, decimals?: number) => string;
  quote: (value: unknown) => string;
}) {
  return (input: { test: T; cfg: { on: boolean; k: number; h: number }; levels: Array<Level & { pts: unknown[] }>; canWrite: boolean }) => {
    if (!input.cfg.on) {
      const action = input.canWrite ? deps.button('Mở cấu hình xét nghiệm', `openConfigAssay('${deps.quote(input.test.id)}')`, 'teal') : '';
      return `<div class="panel">${deps.empty('Chưa bật CUSUM cho xét nghiệm này', 'Bật trong cấu hình xét nghiệm để xem biểu đồ xu hướng CUSUM.', action)}</div>`;
    }
    if (!input.levels.length) return `<div class="panel">${deps.empty('Chưa có mức QC đang vận hành', 'Cần Panel QC, Nhóm lô QC và Mean/SD hợp lệ trước khi vẽ CUSUM.')}</div>`;
    return input.levels.map(level => {
      const title = `<h3><span class="wg-level-title"><span>Mức ${level.level}</span><span class="wg-lot-name">Lô ${deps.escape(level.lot || '?')}</span></span><span class="wg-level-meta"><span>Mean ${deps.testValue(input.test, level.mean)}</span><span>SD ${deps.testValue(input.test, level.sd)}</span><span>${level.pts.length} điểm</span><span>k=${deps.format(input.cfg.k, 2)} · h=${deps.format(input.cfg.h, 2)}</span></span></h3>`;
      if (!level.pts.length) return `<div class="panel">${title}${deps.empty('Chưa có dữ liệu', 'LOT đang dùng chưa có điểm QC.')}</div>`;
      return `<div class="panel">${title}<div class="hint wg-panel-intro">Đường CUSUM+ (teal)/CUSUM− (xanh tím) cộng dồn độ lệch z-score qua từng điểm; vượt vạch đứt ±h là dấu hiệu trôi/shift kéo dài. Đường xám mờ là trung bình động 5 điểm, chỉ để tham khảo hình dạng xu hướng.</div><div class="chart-scroll" tabindex="0"><canvas class="cusumChart" data-test="${deps.escape(input.test.id)}" data-level="${level.level}" width="1400" height="430"></canvas></div></div>`;
    }).join('');
  };
}
