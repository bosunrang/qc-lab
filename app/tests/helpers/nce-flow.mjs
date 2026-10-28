// Luồng NCE protocol 4 dùng chung cho các test tích hợp (handler + SQLite).
// Người phụ trách hồ sơ phải là tài khoản có thật trong bảng `users`, nên các
// test dựng actor bằng tay phải gọi `ensureUser()` trước.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { checklistKeys } = createRequire(import.meta.url)('../../../app-dist/main/domain/nce/checklist.js');

export function must(result, step) {
  assert.equal(result?.ok, true, `${step}: ${JSON.stringify(result?.error)}`);
  return result.data;
}

/** Chèn tài khoản cho actor nếu chưa có. `username` lấy theo id để các actor
 * test trùng username (ví dụ người duyệt là bản sao của quản trị) không đụng
 * ràng buộc UNIQUE. */
export function ensureUser(db, actor, capabilities = []) {
  db.prepare("INSERT OR IGNORE INTO users(id,username,name,role,active,capabilities_json) VALUES (?,?,?,?,1,?)")
    .run(actor.userId, `u-${actor.userId}`, actor.name || actor.username || actor.userId, actor.role, JSON.stringify(capabilities));
}

/** Hồ sơ IQC từ một lần chạy bị loại. */
export function createIqcNce(nce, actor, testId, run, over = {}) {
  return must(nce.createNce({ data: {
    source: 'iqc', testId, trigger: run, description: 'QC bị loại, cần lập hồ sơ', correction: 'Dừng trả kết quả, kiểm tra máy',
    holdResults: true, detectedAt: run.date, ownerUserId: actor.userId, ...over,
  } }, actor), 'tạo NCE IQC');
}

export const validTechnicalAssessment = {
  errorNature: 'random', verificationMethod: 'Đối chiếu vật liệu, máy và nhật ký thao tác',
  correctiveEvidence: 'Đã vệ sinh kim hút và chạy lại đủ các mức QC',
  technicalConclusion: 'QC sau xử lý ổn định, chưa ghi nhận lệch hệ thống',
  metricMode: 'not_applicable', metricReason: 'Sai số ngẫu nhiên, không đủ nhóm dữ liệu để ước lượng Bias tin cậy',
  unit: '', tea: null, teaSource: '', stableBias: null, incidentBias: null, postCorrectionBias: null,
  sd: null, sdSource: '', observedDispersion: null, sampleCount: null,
  meanResetDecision: 'not_applicable', meanResetReason: '', meanResetEvidence: '',
};

export function recordTechnicalAssessment(nce, actor, dossier, assessment = validTechnicalAssessment) {
  return must(nce.recordNceTechnicalAssessment({ data: {
    id: dossier.record.id, expectedVersion: dossier.record.row_version, assessment,
  } }, actor), 'xác minh kỹ thuật IQC');
}

/** Ghi quyết định ảnh hưởng bệnh nhân rồi cho chạy lại bằng `rerun`. Trả hồ sơ sau cùng. */
export function releaseWith(nce, actor, dossier, rerun, extra = {}) {
  dossier = must(nce.updateNce({ data: { id: dossier.record.id, expectedVersion: dossier.record.row_version, patch: {
    checklist: Object.fromEntries(checklistKeys(dossier.record.source).map((key) => [key, { status: 'ok', note: '' }])),
    ...(dossier.record.source === 'iqc' ? {
      containmentNote: 'Đã giữ kết quả trong khoảng nghi ngờ và thông báo phụ trách ca',
      occurredNote: '08:00 phát hiện, 08:15 dừng trả kết quả, 09:00 hoàn tất xử lý',
    } : {}),
  } } }, actor), 'kiểm tra nhanh trước release');
  if (dossier.record.source === 'iqc') dossier = recordTechnicalAssessment(nce, actor, dossier);
  const impact = must(nce.recordNcePatientImpact({ data: { id: dossier.record.id, expectedVersion: dossier.record.row_version, impact: {
    outcome: 'not_reported', description: 'Đã giữ kết quả trong khoảng nghi ngờ', resultCount: 12,
  } } }, actor), 'ảnh hưởng bệnh nhân');
  return must(nce.releaseNce({ data: { id: impact.record.id, expectedVersion: impact.record.row_version, release: {
    reason: 'QC chạy lại đạt, cho hoạt động trở lại', rerun, ...extra,
  } } }, actor), 'cho chạy lại');
}

/** Hồ sơ nguồn "hiệu chuẩn" cho chạy lại bằng một lần chạy QC xác minh (đặt mốc cắt). */
export function releaseByVerificationRun(nce, actor, testId, run) {
  const created = must(nce.createNce({ data: {
    source: 'calibration', testId, description: 'Lệch hiệu chuẩn, đã hiệu chuẩn lại', correction: 'Hiệu chuẩn lại',
    holdResults: true, detectedAt: run.date, ownerUserId: actor.userId,
  } }, actor), 'tạo NCE hiệu chuẩn');
  return releaseWith(nce, actor, created, run);
}
