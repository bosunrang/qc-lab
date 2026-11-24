// Nhãn và màu thẻ trạng thái hồ sơ NCE cho renderer. Nhãn gốc nằm ở
// `main/domain/nce/labels.ts` (dùng chung với phụ lục báo cáo).
import type { NceRecordRow } from '../../shared/qc-api';
import { NCE_STATUS_LABEL } from '../../main/domain/nce/labels';

type Tone = 'ok' | 'warn' | 'rej' | 'none';

const TONE: Readonly<Record<NceRecordRow['status'], Tone>> = {
  open: 'warn', released: 'warn', pending_approval: 'warn', closed: 'ok', cancelled: 'none',
};

export function nceStatusBadge(record: Pick<NceRecordRow, 'status'>): { label: string; tone: Tone } {
  return { label: NCE_STATUS_LABEL[record.status] ?? record.status, tone: TONE[record.status] ?? 'none' };
}
