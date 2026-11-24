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
  providerReport: 'Báo cáo nhà cung cấp (giải thích, đánh giá và trao đổi với nhà cung cấp)',
  eqaAdministrative: 'Lỗi hành chính (máy/LIS so với kết quả gửi, đơn vị, dấu thập phân, nhầm mẫu/đợt, khai báo nhóm so sánh, hệ số pha loãng)',
  eqaMeasurement: 'Dữ liệu và nội kiểm (nội kiểm quanh ngày chạy, xu hướng qua các đợt, hiệu năng chung của nhóm: N, %CV, số kết quả bị loại)',
  eqaProgram: 'Chương trình và mẫu ngoại kiểm (nhóm so sánh phù hợp, độ chắc chắn giá trị ấn định, tính tương đương, vận chuyển và bảo quản)',
  fiveWhys: '5 Whys (ghi chuỗi Vì sao từ sự kiện tới nguyên nhân gốc và bằng chứng)',
};

const BY_SOURCE: Readonly<Record<NceSource, readonly string[]>> = {
  iqc: ['qcMaterial', 'reagent', 'calibration', 'instrument', 'environment', 'operator', 'lotChange'],
  eqa: ['sampleHandling', 'transcription', 'method', 'iqcHistory', 'calibration'],
  instrument: ['maintenance', 'instrument', 'iqcHistory'],
  reagent: ['storage', 'lotChange', 'iqcHistory'],
  calibration: ['calibrator', 'calibration', 'iqcHistory'],
  other: [],
};

/** Rà soát nguyên nhân ngoại kiểm theo trình tự Eurachem 2022 (N-10): báo cáo
 * → lỗi hành chính → dữ liệu và nội kiểm → sáu nhóm kỹ thuật → chương trình/mẫu
 * → 5 Whys. Giữ khoá cũ (`operator`, `method`, `sampleHandling`) để hồ sơ đã
 * đánh giá không mất dữ liệu; mục mới (`reagent`) hiện ở trạng thái chưa đánh giá. */
const EQA_LINKED_KEYS = ['providerReport', 'eqaAdministrative', 'eqaMeasurement', 'operator', 'method', 'instrument', 'reagent',
  'sampleHandling', 'environment', 'eqaProgram', 'fiveWhys'] as const;

/** Nhãn riêng của hồ sơ ngoại kiểm có liên kết, khác nghĩa với checklist nội kiểm
 * dùng chung khoá. */
const EQA_LINKED_LABELS: Readonly<Record<string, string>> = {
  operator: 'Người thực hiện (đào tạo, năng lực, thao tác theo SOP khi chạy mẫu)',
  method: 'Phương pháp (nhiễu, khoảng tuyến tính, hiệu ứng nền mẫu, giới hạn đã biết của phương pháp)',
  reagent: 'Hoá chất và calibrator (lô, hạn dùng, bảo quản, đổi lô gần ngày chạy, hiệu chuẩn gần nhất)',
  sampleHandling: 'Xử lý mẫu ngoại kiểm (hoàn nguyên, bảo quản, thời gian từ khi nhận tới khi chạy, chạy lại mẫu lưu nếu còn ổn định)',
};

export function checklistKeys(source: NceSource, eqaLinked = false): readonly string[] {
  return source === 'eqa' && eqaLinked ? EQA_LINKED_KEYS : BY_SOURCE[source] ?? [];
}

/** Nhãn một mục theo nguồn hồ sơ; dùng chung cho giao diện và thông báo cổng. */
export function checklistLabel(key: string, source: NceSource, eqaLinked = false): string {
  return (source === 'eqa' && eqaLinked ? EQA_LINKED_LABELS[key] : undefined) ?? NCE_CHECK_LABELS[key] ?? key;
}

/** Chỉ giữ các mục thuộc nguồn và giá trị hợp lệ; mục lạ bị bỏ. */
export function prepareChecklist(source: NceSource, raw: unknown, eqaLinked = false): Record<string, NceChecklistItem> {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const out: Record<string, NceChecklistItem> = {};
  for (const key of checklistKeys(source, eqaLinked)) {
    const item = input[key] && typeof input[key] === 'object' ? input[key] as Record<string, unknown> : {};
    out[key] = {
      status: isOneOf(NCE_CHECK_STATUSES, item.status) && (item.status !== 'root' || eqaLinked) ? item.status : '',
      note: String(item.note ?? '').trim().slice(0, 2000),
    };
  }
  return out;
}

/** Mọi mục phải được đánh giá; "bất thường" hoặc "không áp dụng" phải ghi
 * bằng chứng/lý do. */
export function checklistMissing(source: NceSource, checklist: Readonly<Record<string, NceChecklistItem>>, eqaLinked = false): NceMissing[] {
  const missing: NceMissing[] = [];
  for (const key of checklistKeys(source, eqaLinked)) {
    const item = checklist[key], label = checklistLabel(key, source, eqaLinked);
    if (!item?.status) missing.push({ code: `check-${key}`, message: `Chưa đánh giá mục checklist "${label}".` });
    else if ((item.status !== 'ok' || eqaLinked) && textLength(item.note) < 3) missing.push({ code: `check-note-${key}`, message: `Mục "${label}" phải ghi bằng chứng/lý do.` });
  }
  return missing;
}
