// Dựng dữ liệu mẫu cho test các hàm thuần NCE (`app/main/domain/nce/`).
// Mặc định là một hồ sơ IQC tầng CAPA đã đủ mọi điều kiện nộp duyệt, để từng
// ca chỉ cần sửa đúng trường đang kiểm.

export function point(level, over = {}) {
  // `pointId` để `run()` tự đặt theo lần chạy, trừ khi ca test chỉ định.
  return { level, lot: `L${level}`, voided: false, verdict: 'ok', rules: [], val: 5, mean: 5, sd: 0.2, z: 0, ...over };
}

export function run(date, runId, points, testId = 'T1') {
  return { testId, date, runId, points: points.map((p) => ({ ...p, pointId: p.pointId ?? `p-${p.level}-${runId}-${date}` })) };
}

/** Lần chạy khởi đầu: mức 1 đạt, mức 2 bị loại 1-3s. */
export function triggerRun() {
  return run('2026-10-01', '1', [
    { ...point(1), pointId: 'trig-1' },
    { ...point(2, { verdict: 'rej', rules: ['1-3s'], z: 3.4 }), pointId: 'trig-2' },
  ]);
}

export function goodRerun(date = '2026-10-01', runId = '2') {
  return run(date, runId, [{ ...point(1), pointId: `re-1-${runId}` }, { ...point(2), pointId: `re-2-${runId}` }]);
}

export function dossier(over = {}) {
  return {
    status: 'released', source: 'iqc', testId: 'T1',
    reportedByUserId: 'u-reporter', ownerUserId: 'u-owner', detectedAt: '2026-10-01', dueDate: '2026-10-31',
    description: 'QC mức 2 vượt +3SD', correction: 'Dừng trả kết quả, hiệu chuẩn lại', holdResults: true,
    tier: 'capa', tierReason: '',
    riskSeverity: 3, riskProbability: 2, riskLevel: 'medium', riskBasis: 'SOP-QC-07 bảng 3',
    checklist: {
      qcMaterial: { status: 'ok', note: '' }, reagent: { status: 'ok', note: '' }, calibration: { status: 'abnormal', note: 'Hiệu chuẩn quá hạn 2 ngày' },
      instrument: { status: 'ok', note: '' }, operator: { status: 'ok', note: '' }, lotChange: { status: 'na', note: 'Không đổi lô' },
    },
    causeStatus: 'identified', causeCategory: 'calibration', causeText: 'Hiệu chuẩn quá hạn làm lệch kết quả', causeCheckPlan: '',
    effectivenessCriteria: 'Không có lần chạy bị loại trong 20 lần chạy tiếp theo',
    effectivenessReviewDue: '2026-10-25',
    runs: [{ role: 'trigger', snapshot: triggerRun() }, { role: 'rerun', snapshot: goodRerun() }],
    actions: [{ id: 'a1', kind: 'corrective', description: 'Đưa lịch hiệu chuẩn vào nhắc việc', ownerUserId: 'u-owner', dueDate: '2026-10-10', status: 'done', doneAt: '2026-10-05', doneByUserId: 'u-tech', evidence: 'Phiếu HC-12', cancelReason: '' }],
    patientImpacts: [{ outcome: 'not_reported', description: 'Đã giữ toàn bộ kết quả từ lần đạt trước', resultCount: 12, reference: '', notified: '', decidedAt: '2026-10-01T09:00:00Z', actorUserId: 'u-owner' }],
    release: { notApplicable: false, reason: 'Rerun đạt cả hai mức', rerun: { date: '2026-10-01', runId: '2' }, lotChangeNote: '', decidedAt: '2026-10-01T10:00:00Z', actorUserId: 'u-releaser' },
    effectivenessReviews: [{ result: 'effective', evidence: '20 lần chạy liên tiếp đạt', reviewedAt: '2026-10-25', reviewerUserId: 'u-reviewer', residualSeverity: 3, residualProbability: 1, residualLevel: 'low', residualBasis: 'SOP-QC-07' }],
    recurrence: false,
    ...over,
  };
}
