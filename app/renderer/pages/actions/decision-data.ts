import type { NceDecisionRow } from '../../../shared/qc-api';

/** Chỉ đọc đối tượng đã lưu; JSON rỗng, lỗi hoặc khác dạng không làm vỡ hồ sơ. */
export function decisionPayload<T extends object>(row: Pick<NceDecisionRow, 'payload_json'>): Partial<T> {
  try {
    const value: unknown = JSON.parse(row.payload_json || '{}');
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Partial<T> : {};
  } catch { return {}; }
}
