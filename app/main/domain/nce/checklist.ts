// Checklist điều tra theo NGUỒN sự cố (D-06, NCE-PLAN bước 4): không ép
// checklist IQC cho sự cố EQA hay thiết bị. Danh mục mặc định dựa trên các
// nhóm nguyên nhân thường rà soát khi QC hỏng (vật liệu QC, hoá chất, hiệu
// chuẩn, thiết bị, thao tác); phòng xét nghiệm đổi theo SOP thì sửa tại đây.
import type { NceChecklistItem, NceMissing, NceSource } from './types';
import { isOneOf, NCE_CHECK_STATUSES } from './types';
import { textLength } from './format';

export const NCE_CHECK_LABELS: Readonly<Record<string, string>> = {
  qcMaterial: 'Vật liệu QC (hạn dùng, bảo quản, hoàn nguyên)',
  reagent: 'Hoá chất (lô, hạn dùng, bảo quản)',
  calibration: 'Hiệu chuẩn (lần gần nhất, calibrator)',
  instrument: 'Máy phân tích (bảo trì, cảnh báo, kim hút)',
  operator: 'Thao tác của người thực hiện',
  lotChange: 'Thay lô hoá chất / vật liệu QC gần đây',
  sampleHandling: 'Xử lý mẫu ngoại kiểm',
  transcription: 'Chép và gửi kết quả, đơn vị',
  method: 'Phương pháp / nhóm so sánh',
  iqcHistory: 'Dữ liệu nội kiểm cùng thời gian',
  maintenance: 'Nhật ký bảo trì, sửa chữa',
  storage: 'Điều kiện bảo quản',
  calibrator: 'Calibrator (lô, hạn dùng, giá trị gán)',
  environment: 'Môi trường (nhiệt độ phòng, điện, nước cấp)',
};

const BY_SOURCE: Readonly<Record<NceSource, readonly string[]>> = {
  iqc: ['qcMaterial', 'reagent', 'calibration', 'instrument', 'environment', 'operator', 'lotChange'],
  eqa: ['sampleHandling', 'transcription', 'method', 'iqcHistory', 'calibration'],
  instrument: ['maintenance', 'instrument', 'iqcHistory'],
  reagent: ['storage', 'lotChange', 'iqcHistory'],
  calibration: ['calibrator', 'calibration', 'iqcHistory'],
  other: [],
};

export function checklistKeys(source: NceSource): readonly string[] { return BY_SOURCE[source] ?? []; }

/** Chỉ giữ các mục thuộc nguồn và giá trị hợp lệ; mục lạ bị bỏ. */
export function prepareChecklist(source: NceSource, raw: unknown): Record<string, NceChecklistItem> {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const out: Record<string, NceChecklistItem> = {};
  for (const key of checklistKeys(source)) {
    const item = input[key] && typeof input[key] === 'object' ? input[key] as Record<string, unknown> : {};
    out[key] = {
      status: isOneOf(NCE_CHECK_STATUSES, item.status) ? item.status : '',
      note: String(item.note ?? '').trim().slice(0, 2000),
    };
  }
  return out;
}

/** Mọi mục phải được đánh giá; "bất thường" hoặc "không áp dụng" phải ghi
 * bằng chứng/lý do. */
export function checklistMissing(source: NceSource, checklist: Readonly<Record<string, NceChecklistItem>>): NceMissing[] {
  const missing: NceMissing[] = [];
  for (const key of checklistKeys(source)) {
    const item = checklist[key], label = NCE_CHECK_LABELS[key] ?? key;
    if (!item?.status) missing.push({ code: `check-${key}`, message: `Chưa đánh giá mục checklist "${label}".` });
    else if (item.status !== 'ok' && textLength(item.note) < 3) missing.push({ code: `check-note-${key}`, message: `Mục "${label}" bất thường hoặc không áp dụng phải ghi bằng chứng/lý do.` });
  }
  return missing;
}
