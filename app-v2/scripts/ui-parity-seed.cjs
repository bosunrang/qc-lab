'use strict';
// Bộ seed dùng CHUNG cho gate UI parity: cùng một tập dữ liệu logic được đổ
// vào app cũ (qua `buildSeedState()` của scripts/lib/seed-browser-session.js)
// và vào app-v2 (qua `localStorage['qclab-v2-browser-preview']`).
//
// NGUYÊN TẮC BẮT BUỘC (D0 mục 3): mọi field của bản v2 phải SUY RA TỪ `old`,
// không được bịa thêm giá trị mà app cũ không có. Bản đầu (2026-09-01) gán
// cho app-v2 những giá trị "cho đẹp" — `manufacturer:'Demo'`,
// `serial:'DEMO-01'`, `section:'Hóa sinh'`, `tea:5`, `tea_source:'Demo'`,
// `supplier:'Demo'`, `description`, `opened`, `cusum_on:1` — trong khi app cũ
// không có field nào tương ứng. Kết quả: gate báo lệch những dòng chữ mà
// nguyên nhân là DỮ LIỆU, không phải code (phát hiện 2026-09-02 khi soi trang
// Cấu hình chung: "— — 1 Đang hoạt động" và "Chưa phân khoa" hiện ở app cũ
// nhưng không có ở app-v2 chỉ vì app-v2 được cho thêm hãng/số sê-ri/khoa).
// Thêm field mới ở đây = phải thêm cả 2 phía, hoặc không thêm.
const { buildSeedState } = require('../../scripts/lib/seed-browser-session');

function isoDay(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function buildParitySeeds() {
  const old = buildSeedState();
  const test = old.tests[0];
  const points = old.data[test.id];

  points.forEach((point, index) => {
    point.date = isoDay(index - points.length + 1);
    if (index === points.length - 1) point.val = point.level === 2 ? 109.5 : 150.5;
  });
  old.qcLots[0].exp = isoDay(18);
  old.qcLots[1].exp = isoDay(-2);
  old.actions = [{
    id: 'NCE-SEED-1', nceId: 'NCE-DEMO-001', date: isoDay(-8), createdAt: new Date().toISOString(),
    testId: test.id, level: 2, lot: old.qcLots[1].lotNo, rule: '1-3s', errorType: 'Sai số ngẫu nhiên',
    action: 'Kiểm tra lại vật liệu QC và chạy lại mẫu kiểm soát.', by: 'Kỹ thuật viên', dueDate: isoDay(-1),
    approvalStatus: 'pending', effectivenessStatus: 'pending', recordStatus: 'active', protocolVersion: 3,
  }];

  // ── Six Sigma (D3.6) ────────────────────────────────────────────────
  // Khai MỘT LẦN, ánh xạ sang 2 hình dạng bên dưới. 2 mức để bảng kỳ có
  // header 2 hàng thật (mỗi mức 1 nhóm 3 cột), CV/Bias khác nhau giữa 2 mức
  // để thấy Sigma khác nhau, và TEa dương để có Sigma tính được.
  const SIGMA_SEED = {
    id: 'SG-SEED-1',
    period: new Date().toISOString().slice(0, 7),
    tea: 10,
    teaSource: 'clia',
    levels: [
      { level: 1, cv: 3, biasEqa: 2 },
      { level: 2, cv: 4.5, biasEqa: -1.5 },
    ],
  };
  test.sgTracked = true;
  old.sigmaData = {
    [test.id]: [{
      id: SIGMA_SEED.id, period: SIGMA_SEED.period, tea: SIGMA_SEED.tea, teaSource: SIGMA_SEED.teaSource,
      teaLabel: 'CLIA', teaReference: '', teaCapturedAt: new Date().toISOString(),
      lv: Object.fromEntries(SIGMA_SEED.levels.map(l => [l.level, { cv: l.cv, biasEqa: l.biasEqa }])),
    }],
  };

  // ── So sánh hoá chất (D3.7) ──────────────────────────────────────────
  // 24 cặp lệch đúng 1% để bảng kết quả có N/%Bias/Pearson thật và 2 biểu đồ
  // vẽ được; `coverageConfirmed: true` để đi qua nhánh kết luận đầy đủ.
  const REAGENT_SEED = {
    id: 'RC-SEED-1',
    test: {
      reagent: 'Sodium (Na)', lotOld: 'L-OLD-1', lotNew: 'L-NEW-2', date: isoDay(-3),
      operator: 'NV1', sampleType: 'Mẫu bệnh nhân', unit: 'mmol/L',
      biasTarget: 6, alpha: 0.05, coverageConfirmed: true,
    },
    rows: Array.from({ length: 24 }, (_, i) => {
      const x = 130 + i * 0.8;
      return [x.toFixed(2), (x * 1.01).toFixed(2)];
    }),
  };
  old.reagentTests = [REAGENT_SEED];

  // ── Nhật ký hoạt động (D3.10) ────────────────────────────────────────
  // Khai MỘT LẦN cho cả 2 bản: app cũ đọc `state.activity`, app-v2 đọc bảng
  // `activity` (bản giả lập là mảng cùng tên field camelCase). Trước đây 2
  // dòng này chỉ có ở bản v2 nên trang Nhật ký của app cũ trống trơn.
  const ACTIVITY_SEED = [
    { id: 'A1', seq: 1, ts: new Date().toISOString(), user: 'Quản trị viên', username: 'admin', userId: 'U1', role: 'admin', type: 'Đăng nhập', detail: 'Đăng nhập thành công', target: 'admin', clientId: 'ui-parity', prevHash: '', hash: '' },
    { id: 'A2', seq: 2, ts: new Date().toISOString(), user: 'Quản trị viên', username: 'admin', userId: 'U1', role: 'admin', type: 'Nhập QC', detail: 'Seed kiểm tra giao diện', target: test.name, clientId: 'ui-parity', prevHash: '', hash: '' }
  ];
  old.activity = ACTIVITY_SEED.map(row => ({ ...row }));

  const levelByNumber = new Map(test.levels.map(level => [level.level, level]));
  const oldInstrument = old.instruments[0];
  const oldPanel = old.qcPanels[0];
  const oldGroup = old.lotGroups[0];

  // Mọi field dưới đây: hoặc lấy thẳng từ `old`, hoặc để RỖNG/mặc định trung
  // tính. Không có giá trị nào được bịa ra chỉ cho bản v2.
  const v2 = {
    lab: { id: 1, name: old.lab.name, dept: old.lab.dept, address: old.lab.address || '', brand_title: 'QC Lab', brand_sub: 'Nội kiểm xét nghiệm', logo_text: 'QC', logo_data: '' },
    instruments: old.instruments.map(row => ({
      id: row.id, name: row.name,
      // app cũ chỉ có id/name/active — 3 field còn lại phải rỗng, nếu không
      // bảng "Máy xét nghiệm" của 2 bản hiện khác nhau vì dữ liệu.
      manufacturer: '', serial: '', section: '',
      active: row.active === false ? 0 : 1,
    })),
    tests: old.tests.map(row => ({
      id: row.id, instrument_id: oldInstrument.id, name: row.name, unit: row.unit,
      // `decimal_places: 2` khớp QC_DECIMALS_DEFAULT mà app cũ dùng khi test
      // không khai số thập phân — cùng KẾT QUẢ HIỂN THỊ, không phải bịa thêm.
      decimal_places: 2,
      // app cũ: test seed KHÔNG có tea/section/teaSource/cusum → để trống.
      tea: null, section: '', tea_source: '', tea_ref_key: '', method: '', reagent: row.reagent || '',
      cusum_on: 0, cusum_k: 0.5, cusum_h: 4,
      active: 1, rule_actions_json: '{}', rule_scopes_json: '{}',
    })),
    testLevels: test.levels.map(level => ({
      id: `${test.id}:${level.level}`, test_id: test.id, level: level.level, mean: level.mean, sd: level.sd,
      qc_lot_id: level.qcLotId, low: null, high: null, mfg_mean: null, mfg_sd: null, applied: 'mfg',
      mean_sd_history_json: JSON.stringify(level.meanSdHistory || []),
    })),
    qcLots: old.qcLots.map(row => ({
      id: row.id, group_id: oldGroup.lotIds.includes(row.id) ? oldGroup.id : null,
      lot_no: row.lotNo, level: row.level,
      // app cũ: lô seed chỉ có id/lotNo/level/exp → mọi field mô tả để rỗng.
      description: '', supplier: '', program: '', exp: row.exp || '', opened: '',
      active: 1, depleted: 0, note: '',
    })),
    lotGroups: [{
      id: oldGroup.id, name: oldGroup.name, manufacturer: '', material: '', catalog: '', note: '',
      active: oldGroup.active === false ? 0 : 1, status: oldGroup.status || 'active', stopped_at: '',
      lotIds: [...oldGroup.lotIds],
    }],
    qcPanels: [{
      id: oldPanel.id, name: oldPanel.name, instrument_id: oldPanel.instrumentId, note: '',
      active: oldPanel.active === false ? 0 : 1, testIds: [...oldPanel.testIds],
    }],
    lotTransitions: [], teaRefs: [], periodLocks: [],
    reagentComparisons: [{
      id: REAGENT_SEED.id, reagent: REAGENT_SEED.test.reagent,
      lot_old: REAGENT_SEED.test.lotOld, lot_new: REAGENT_SEED.test.lotNew, date: REAGENT_SEED.test.date,
      operator: REAGENT_SEED.test.operator, sample_type: REAGENT_SEED.test.sampleType, unit: REAGENT_SEED.test.unit,
      bias_target: REAGENT_SEED.test.biasTarget, alpha: REAGENT_SEED.test.alpha,
      coverage_confirmed: REAGENT_SEED.test.coverageConfirmed ? 1 : 0,
      extra_json: '{}', rows_json: JSON.stringify(REAGENT_SEED.rows),
    }],
    sigmaPeriods: [{
      id: SIGMA_SEED.id, testId: test.id, period: SIGMA_SEED.period,
      tea: SIGMA_SEED.tea, teaSource: SIGMA_SEED.teaSource,
      levels: SIGMA_SEED.levels.map(l => ({
        level: l.level, cv: l.cv, biasEqa: l.biasEqa, eqaRounds: [], uCal: null, muBiasMode: 'include',
      })),
    }],
    qcPoints: points.map(point => {
      const level = levelByNumber.get(point.level);
      return {
        id: point.id, test_id: test.id, level: point.level, date: point.date, run_id: point.runId,
        lot: point.lot, val: point.val, value_decimals: 2, qc_mean: level.mean, qc_sd: level.sd, note: '',
        // app cũ lưu đúng 1 field nhân sự cho mỗi điểm (`staff`) — dùng lại
        // nguyên giá trị đó cho cả tên và mã để 2 bản hiện cùng chuỗi.
        operator_id: '', operator_username: point.operatorName || point.staff || '',
        operator_name: point.operatorName || point.staff || '', operator_code: point.operatorCode || '',
        voided: 0, void_reason: '', void_kind: '', void_requires_rerun: 0, voided_at: '', voided_by: '',
      };
    }),
    nceRecords: [{
      id: 'NCE-SEED-1', date: isoDay(-8), created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      test_id: test.id, level: 2, lot: old.qcLots[1].lotNo, point_id: null, rule: '1-3s',
      error_type: 'Sai số ngẫu nhiên', nce_id: 'NCE-DEMO-001', parent_nce_id: '', follow_up_nce_id: '',
      protocol_version: 3, approval_status: 'pending', effectiveness_status: 'pending', record_status: 'active',
      due_date: old.actions[0].dueDate, action_completed_date: '',
      // Suy TỪ `old.actions[0]`: nội dung khắc phục + người phụ trách app cũ
      // lưu ở `action`/`by`; app-v2 giữ trong `detail_json`.
      detail_json: JSON.stringify({ correction: old.actions[0].action, owner: old.actions[0].by }),
    }],
    users: old.users.map(row => ({ id: row.id, username: row.username, name: row.name, role: row.role, active: true, mustChangePassword: false })),
    passwordsByUserId: { U1: 'Demo1234!', U2: 'Demo1234!' }, currentUserId: 'U1',
    activity: ACTIVITY_SEED.map(row => ({ ...row })),
    lisSettings: { enabled: false, url: 'http://127.0.0.1:8787', token: '' }
  };

  return { old, v2 };
}

module.exports = { buildParitySeeds };
