import type { HistoryQcPointView } from '../../shared/qc-api';

/** Diễn giải dữ liệu đánh giá từ main; không tính lại luật hoặc ngưỡng Z. */
export function historyQcConclusion(point: Pick<HistoryQcPointView, 'verdict' | 'rules' | 'run_rejected_by'>) {
  const runRejected = point.run_rejected_by.length > 0;
  const tone = point.verdict === 'rej' || runRejected ? 'rej' : point.verdict === 'warn' ? 'warn' : point.verdict === 'ok' ? 'ok' : 'none';
  const label = tone === 'rej' ? 'Loại' : tone === 'warn' ? 'Cảnh báo' : tone === 'ok' ? 'Đạt' : 'Chưa đánh giá';
  const reasons = [
    point.rules.length ? `Luật Westgard: ${point.rules.join(', ')}` : '',
    runRejected ? `Lần chạy bị loại ở ${point.run_rejected_by.map((level) => `Mức ${level}`).join(', ')}` : '',
  ].filter(Boolean);
  const details = [
    point.rules.join(', '),
    runRejected && point.verdict !== 'rej' ? `Bị loại theo ${point.run_rejected_by.map((level) => `Mức ${level}`).join(', ')}` : '',
  ].filter(Boolean);
  return { label, tone, details, title: reasons.join('. ') || (tone !== 'none' ? 'Kết luận Westgard của lần chạy' : 'Chưa có kết quả đánh giá Westgard cho điểm này') };
}
