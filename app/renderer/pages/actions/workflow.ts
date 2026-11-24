// Điều hướng giao diện theo bước do main trả về; không tự tính điều kiện
// cho chạy lại, nộp duyệt hay đóng hồ sơ.
import type { NceMissingItem, NceRecordRow } from '../../../shared/qc-api';

export type NceStage = 'identity' | 'check' | 'technical' | 'impact' | 'release' | 'capa' | 'review';

export const NCE_STAGES: readonly { id: NceStage; label: string; description: string }[] = [
  { id: 'identity', label: 'Ghi nhận sự cố', description: 'Thông tin sự cố' },
  { id: 'check', label: 'Kiểm tra nhanh', description: 'Vật liệu, máy & thao tác' },
  { id: 'technical', label: 'Xác minh kỹ thuật', description: 'Sai số, Bias & ngưỡng' },
  { id: 'impact', label: 'Ảnh hưởng bệnh nhân', description: 'Phạm vi & quyết định' },
  { id: 'release', label: 'Cho hoạt động trở lại', description: 'QC xác minh & thẩm quyền' },
  { id: 'capa', label: 'Điều tra & CAPA', description: 'Nguy cơ & hành động' },
  { id: 'review', label: 'Phê duyệt & lịch sử', description: 'Bằng chứng & duyệt' },
];

type NceStageInfo = { id: NceStage; label: string; description: string };
/** Hồ sơ ngoại kiểm có liên kết (N-10..N-13): bỏ bước xác minh kỹ thuật IQC;
 * rà soát và phân loại nguyên nhân đứng trước ảnh hưởng bệnh nhân vì phạm vi
 * rà soát phụ thuộc nhóm nguyên nhân (N-12). */
const EQA_STAGE_TEXT: Partial<Record<NceStage, Omit<NceStageInfo, 'id'>>> = {
  check: { label: 'Rà soát & phân loại nguyên nhân', description: 'Báo cáo, hành chính, kỹ thuật, chương trình' },
  impact: { label: 'Ảnh hưởng bệnh nhân', description: 'Phạm vi theo nhóm nguyên nhân' },
  release: { label: 'Cho hoạt động trở lại', description: 'Nội kiểm hiện tại & thẩm quyền' },
  capa: { label: 'Hành động khắc phục', description: 'Nguy cơ, hành động & hiệu lực' },
};
const EQA_STAGES: readonly NceStageInfo[] = NCE_STAGES.filter((stage) => stage.id !== 'technical')
  .map((stage) => ({ ...stage, ...EQA_STAGE_TEXT[stage.id] }));

export function nceStages(eqaLinked: boolean): readonly NceStageInfo[] {
  return eqaLinked ? EQA_STAGES : NCE_STAGES;
}

export const NEXT_STEP_TEXT: Readonly<Record<string, string>> = {
  release: 'Hoàn tất điều kiện cho hoạt động trở lại',
  submit: 'Hoàn thiện hồ sơ để nộp duyệt',
  approve: 'Rà soát bằng chứng và duyệt đóng hồ sơ',
};

export function stageForMissing(item: NceMissingItem, eqaLinked = false): NceStage {
  if (eqaLinked && item.code.startsWith('cause')) return 'check';
  if (['hold', 'hold-iqc', 'containment', 'containment-blank', 'owner', 'due-date'].includes(item.code)) return 'identity';
  if (item.code.startsWith('check-')) return 'check';
  if (item.code.startsWith('technical-')) return 'technical';
  if (item.code.startsWith('patient-')) return 'impact';
  if (item.code.includes('rerun') || ['release', 'no-trigger'].includes(item.code)) return 'release';
  return 'capa';
}

export function nextStage(record: NceRecordRow, missing: readonly NceMissingItem[]): NceStage {
  const eqaLinked = !!record.eqa_result_id;
  if (record.next_step === 'approve' || !record.next_step) return 'review';
  // Danh sách cổng từ main không có thứ tự thao tác; ưu tiên bước còn thiếu
  // sớm nhất trên thanh điều hướng để không bỏ qua ảnh hưởng bệnh nhân.
  if (missing.length) {
    const stages = new Set(missing.map((item) => stageForMissing(item, eqaLinked)));
    return nceStages(eqaLinked).find((stage) => stages.has(stage.id))!.id;
  }
  return record.next_step === 'release' ? 'release' : 'review';
}

/** Tìm theo tiếng Việt không dấu, mã hồ sơ và người phụ trách. */
export function nceSearchText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi').trim();
}
