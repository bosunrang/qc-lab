// Chuyển một dòng `actions` (hồ sơ NCE protocol 3) sang mô hình mới — dùng
// trong migration schema 3 (kế hoạch mục 6.1). Hàm thuần: migration đọc dòng
// cũ và các dữ liệu tra cứu, gọi hàm này, rồi ghi kết quả.
//
// Nguyên tắc: không bịa dữ liệu để qua cổng mới. Chỉ chuyển trường có nghĩa
// tương đương; hồ sơ chưa duyệt thành `open`, không tự suy ra quyết định cho
// chạy lại. Toàn bộ dòng cũ được giữ nguyên trong `legacy_json`.
import { normalizeErrorClass } from '../westgard-rules';
import { prepareChecklist } from './checklist';
import type { NceSource } from './types';
import { isOneOf, NCE_PHASES, NCE_RISK_LEVELS } from './types';

export interface LegacyActionRow {
  id: string; date: string; created_at: string; updated_at: string;
  created_by_user_id: string; created_by_username: string;
  test_id: string | null; level: number | null; lot: string; point_id: string | null;
  rule: string; error_type: string; qc_verdict: string; nce_id: string;
  protocol_version: number; approval_status: string; effectiveness_status: string; record_status: string;
  due_date: string; action_completed_date: string; detail_json: string;
}

export interface LegacyNceMapping {
  record: Record<string, string | number | null>;
  /** Đổi dải QC không phải NCE (D-12): không chuyển. */
  skip: boolean;
  /** Mốc cắt theo ngày cho hồ sơ đã duyệt và hiệu quả. */
  cutDate: string | null;
}

const SOURCE_MAP: Readonly<Record<string, NceSource>> = { iqc: 'iqc', eqa: 'eqa', instrument: 'instrument', clinical: 'other', audit: 'other', other: 'other' };
const CAUSE_MAP: Readonly<Record<string, string>> = { qc: 'qc_material', operator: 'operator', instrument: 'instrument', reagent: 'reagent', calibration: 'calibration', environment: 'environment' };
const CHECK_MAP: Readonly<Record<string, string>> = { ok: 'ok', 'checked-ok': 'ok', abnormal: 'abnormal', 'checked-abnormal': 'abnormal', na: 'na', 'not-needed': 'na' };

function parse(json: string): Record<string, unknown> {
  try { const value = JSON.parse(json || '{}'); return value && typeof value === 'object' ? value as Record<string, unknown> : {}; } catch { return {}; }
}
const str = (value: unknown) => String(value ?? '').trim();
const int = (value: unknown) => { const n = Number(value); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 0; };

/** `ownerIdByName`: tra người phụ trách (hồ sơ cũ ghi tên tự do) sang tài khoản
 * khi tên khớp đúng một tài khoản; không khớp thì để trống. */
export function mapLegacyAction(row: LegacyActionRow, ownerIdByName: ReadonlyMap<string, string>): LegacyNceMapping {
  const detail = parse(row.detail_json);
  if (detail.rangeWorkflow === true) return { record: {}, skip: true, cutDate: null };
  const source: NceSource = SOURCE_MAP[str(detail.eventSource)] ?? (row.point_id ? 'iqc' : 'other');
  const approved = row.approval_status === 'approved';
  const status = row.record_status === 'cancelled' ? 'cancelled' : approved ? 'closed' : 'open';
  const effective = approved && row.effectiveness_status === 'effective' && row.record_status !== 'cancelled';

  const oldChecks: Record<string, unknown> = {};
  for (const [oldKey, newKey] of [['qcMaterial', 'qcMaterial'], ['instrument', 'instrument'], ['reagent', 'reagent'], ['calibration', 'calibration'], ['lotToLot', 'lotChange']]) {
    const statusValue = CHECK_MAP[str(detail[`${oldKey}Status`])];
    if (statusValue) oldChecks[newKey] = { status: statusValue, note: str(detail[`${oldKey}Note`]) };
  }
  const oldCause = str(detail.causeCategory);
  const causeText = str(detail.cause) || str(detail.causeDescription);
  const hold = str(detail.containmentStatus);
  const owner = str(detail.owner);
  const errorClass = normalizeErrorClass(row.error_type);
  const describe = [row.rule ? `luật ${row.rule}` : '', errorClass ? `sai số ${errorClass}` : '', row.level != null ? `mức ${row.level}` : '', row.lot ? `lô ${row.lot}` : '']
    .filter(Boolean).join(', ');

  return {
    skip: false,
    cutDate: effective && /^\d{4}-\d{2}-\d{2}$/.test(row.action_completed_date) && row.test_id ? row.action_completed_date : null,
    record: {
      id: row.id, nce_id: row.nce_id, source, phase: isOneOf(NCE_PHASES, detail.processPhase) ? detail.processPhase : 'exam',
      test_id: row.test_id || null, detected_at: row.date,
      description: `Hồ sơ phiên bản cũ${describe ? ` — ${describe}` : ''}.`,
      correction: str(detail.correction),
      hold_results: hold === 'held' ? 1 : hold === 'none' ? 0 : null,
      status, tier: '', tier_reason: '',
      risk_severity: int(detail.riskSeverity), risk_probability: int(detail.riskOccurrence),
      risk_level: isOneOf(NCE_RISK_LEVELS, detail.riskLevel) ? detail.riskLevel : '', risk_basis: str(detail.riskBasis),
      checklist_json: JSON.stringify(prepareChecklist(source, oldChecks)),
      cause_status: oldCause === 'unknown' ? 'undetermined' : causeText ? 'identified' : '',
      cause_category: CAUSE_MAP[oldCause] ?? '', cause_text: causeText, cause_check_plan: '',
      effectiveness_criteria: '', effectiveness_review_due: '',
      owner_user_id: ownerIdByName.get(owner) ?? '', due_date: row.due_date || '',
      reported_by_user_id: row.created_by_user_id || '', reported_by_name: row.created_by_username || '',
      error_class: errorClass, qc_resolved: effective ? 1 : 0,
      created_at: row.created_at || '', updated_at: row.updated_at || row.created_at || '', row_version: 1,
      protocol_version: Number(row.protocol_version) || 3, legacy_action_id: row.id,
      legacy_json: JSON.stringify(row),
    },
  };
}
