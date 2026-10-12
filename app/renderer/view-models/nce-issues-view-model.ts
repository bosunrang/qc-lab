// Mô hình danh sách sự cố NCE: một lần chạy lại đạt xác nhận vận hành đã ổn
// định, nhưng không được xoá biến cố QC đã bị loại trước khi hồ sơ khép vòng.
import type { NceRecord, QcPointView, TestSummary } from '../../shared/qc-api';

export interface NceIssuePoint {
  point: QcPointView;
  testName: string;
  unit: string;
  decimalPlaces: number;
  openRecord: NceRecord | null;
}

/**
 * Lần bị loại cần được lập và khép hồ sơ theo đúng điểm đã phát sinh, nên giữ
 * lại mọi điểm `rej` chưa có NCE được duyệt. Cảnh báo không bắt buộc NCE vẫn
 * chỉ theo điểm mới nhất như màn hình vận hành, để không biến lịch sử cảnh
 * báo thành hàng đợi khắc phục bắt buộc.
 */
export function nceIssuePoints(
  summaries: TestSummary[],
  points: QcPointView[],
  records: NceRecord[],
): NceIssuePoint[] {
  const activeLevels = new Map<string, { testName: string; unit: string; decimalPlaces: number }>();
  const latestWarningIds = new Set<string>();
  for (const summary of summaries) {
    for (const level of summary.levels) {
      activeLevels.set(`${summary.testId}:${level.level}`, {
        testName: summary.testName,
        unit: summary.unit,
        decimalPlaces: summary.decimalPlaces,
      });
      if (level.latestVerdict === 'warn' && level.latest) latestWarningIds.add(level.latest.id);
    }
  }

  const recordByPoint = new Map<string, NceRecord>();
  for (const record of records) {
    if (!record.point_id || record.record_status === 'cancelled') continue;
    const current = recordByPoint.get(record.point_id);
    if (!current || current.created_at < record.created_at) recordByPoint.set(record.point_id, record);
  }

  return points
    .filter((point) => point.verdict === 'rej' || latestWarningIds.has(point.id))
    .flatMap((point) => {
      const summary = activeLevels.get(`${point.test_id}:${point.level}`);
      if (!summary) return [];
      const record = recordByPoint.get(point.id) || null;
      // Chỉ hồ sơ được duyệt mới là khép vòng; hồ sơ đang điều tra vẫn phải
      // nằm trong hàng đợi để người dùng tiếp tục hoàn thiện.
      if (record?.approval_status === 'approved') return [];
      return [{ point, ...summary, openRecord: record }];
    })
    .sort((a, b) => b.point.date.localeCompare(a.point.date) || b.point.run_id.localeCompare(a.point.run_id, 'vi', { numeric: true }));
}
