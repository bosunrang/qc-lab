// Giai đoạn C4: kiểm chứng hàm THUẦN ánh xạ backup app CŨ ('qclab-backup')
// sang hình dạng cột SQLite app-v2 — không cần DB, dùng 1 state tổng hợp đủ
// mọi nhánh (instrument/test/level+history/lot/nhóm lô/panel/chuyển tiếp
// lô/điểm QC/user/activity đã hash chain/NCE/reagent/khoá kỳ/TEa/sigma).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { parseLegacyBackupEnvelope, mapLegacyStateToTables, summarizeMappedTables } = require('../../app-v2-dist/main/domain/migrate-legacy.js');
const { auditEntryHash, verifyAuditChain } = require('../../app-v2-dist/main/domain/audit-chain.js');

const legacyActivity = [];
function pushActivity(a) {
  const prevHash = legacyActivity.length ? legacyActivity[legacyActivity.length - 1].hash : '';
  const entry = { ...a, prevHash, hash: '' };
  entry.hash = auditEntryHash(entry);
  legacyActivity.push(entry);
}
// clientId luon la 1 key that trong export backup THAT cua app cu (kể cả
// rong) vi sanitizeBackup() luon gan `clientId:cleanText(a.clientId,80)` —
// phai co mat trong fixture o day de dung dinh dang canonical JSON that,
// khong thi so sanh hash sau khi anh xa se lech (key bi thieu vs key='').
pushActivity({ id: 'act1', seq: 1, ts: '2026-01-01T00:00:00.000Z', user: 'Quan tri vien', username: 'admin', userId: 'u1', role: 'admin', type: 'Dang nhap', detail: '', target: 'admin', clientId: '' });
pushActivity({ id: 'act2', seq: 2, ts: '2026-01-02T00:00:00.000Z', user: 'Quan tri vien', username: 'admin', userId: 'u1', role: 'admin', type: 'Them may', detail: 'May A', target: '', clientId: '' });

const legacyState = {
  schemaVersion: 6,
  lab: { name: 'PXN Test', dept: 'Khoa XN', address: '123 Test', brandTitle: 'QC Lab Cu', brandSub: 'Noi kiem' },
  instruments: [{ id: 'ins1', name: 'May A', manufacturer: 'ABC', model: 'X1', serial: 'SN1', section: 'Sinh hoa', active: true }],
  lotGroups: [{ id: 'grp1', name: 'Nhom lo 1', manufacturer: 'BioRad', material: 'Serum', catalog: 'C1', note: '', active: true }],
  qcLots: [
    { id: 'lot1', groupId: 'grp1', lotNo: 'L001', level: 1, description: '', supplier: 'BioRad', program: '', exp: '2027-01-01', opened: '2026-01-01', active: true },
    { id: 'lot2', groupId: 'grp1', lotNo: 'L002', level: 2, description: '', supplier: 'BioRad', program: '', exp: '2027-01-01', opened: '2026-01-01', active: true },
    { id: 'lot3', groupId: 'grp2', lotNo: 'L003', level: 1, description: '', supplier: 'BioRad', program: '', exp: '2027-06-01', opened: '', active: true },
  ],
  qcPanels: [{ id: 'pan1', name: 'Panel 1', instrumentId: 'ins1', testIds: ['t1'], note: '', active: true }],
  lotTransitions: [{ id: 'tr1', panelId: 'pan1', fromLotId: 'lot1', toLotId: 'lot2', startDate: '2026-02-01', status: 'planned', criteria: 'Song song 20 ngay', conclusion: '', approvedAt: '', approvedBy: '', note: '' }],
  tests: [{
    id: 't1', analyteId: 'glu', name: 'Glucose', instrumentId: 'ins1', unit: 'mg/dL', decimalPlaces: 1,
    tea: 10, teaSource: 'clia', active: true,
    ruleActions: { '1-3s': 'reject' }, ruleScopes: { '1-3s': 'within' },
    cusum: { on: true, k: 0.5, h: 4 },
    levels: [
      { level: 1, qcLotId: 'lot1', mean: 100, sd: 2, low: 96, high: 104, rangeK: 2, mfgMean: 100, mfgSd: 2, applied: 'mfg', meanSdHistory: [
        { id: 'h1', qcLotId: 'lot1', lot: 'L001', mean: 100, sd: 2, effectiveFrom: '2026-01-01', source: 'mfg', note: '' },
        // Mốc "dự kiến" app cũ: số nhập sẵn cho lô chưa dùng, KHÔNG phải một
        // giai đoạn đã có hiệu lực.
        { id: 'h2', qcLotId: 'lot3', lot: 'L003', mean: 105, sd: 2.5, effectiveFrom: '', effectiveTo: '', source: 'mfg', planned: true, note: 'Du kien' },
      ] },
    ],
  }],
  data: {
    t1: [
      { id: 'p1', date: '2026-01-05', runId: 'r1', lot: 'L001', level: 1, val: 101, operatorId: 'u1', operatorUsername: 'admin', operatorName: 'Quan tri vien', voided: false },
      { id: 'p2', date: '2026-01-06', runId: 'r1', lot: 'L001', level: 1, val: 200, operatorId: 'u1', operatorUsername: 'admin', operatorName: 'Quan tri vien', voided: true, voidReason: 'Sai mau', voidKind: 'analytical' },
    ],
  },
  sigmaData: { t1: [{ id: 'sg1', period: '2026-01', tea: 10, teaSource: 'clia', lv: { 1: { cv: 2, biasEqa: 1 } } }] },
  users: [{ id: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', passHash: 'pbkdf2$600000$aaaa$bbbb', active: true, avatar: 'data:image/png;base64,zz==' }],
  activity: legacyActivity,
  activityAnchor: '',
  actions: [{
    id: 'a1', date: '2026-01-06', createdAt: '2026-01-06T01:00:00.000Z', createdByUserId: 'u1', createdByUsername: 'admin',
    testId: 't1', level: 1, lot: 'L001', pointId: 'p2', rule: '1-3s', errorType: 'RE', qcVerdict: 'rej',
    nceId: 'NCE-20260106-01', protocolVersion: 3, approvalStatus: 'pending', effectivenessStatus: 'pending', recordStatus: 'active',
    dueDate: '2026-01-13', action: 'Da hieu chuan lai may', cause: 'Loi hieu chuan', causeCategory: 'SE',
  }],
  reagentTests: [{ id: 'rt1', test: { reagent: 'Glucose', lotOld: 'L001', lotNew: 'L002', date: '2026-01-10', operator: 'admin', sampleType: 'Mau benh nhan', unit: 'mg/dL', biasTarget: 6, alpha: 0.05 }, rows: [[100, 102], [200, 205]] }],
  periodLocks: [{ id: 'lock1', ym: '2026-01', lockedAt: '2026-02-01T00:00:00.000Z', lockedBy: 'admin', note: 'Chot ky' }],
  teaRefs: [{ id: 'tref1', analyteId: 'glu', name: 'Glucose', unit: 'mg/dL', clia: 10, ricos: 8, labSource: 'regulation' }],
};

// 1) Envelope hợp lệ: format đúng + checksum đúng
const dataJson = JSON.stringify(legacyState);
const checksum = createHash('sha256').update(dataJson, 'utf8').digest('hex');
const envelope = { format: 'qclab-backup', formatVersion: 1, type: 'full', createdAt: '2026-02-01T00:00:00.000Z', appVersion: '1.0.0', schemaVersion: 6, checksum, data: legacyState };
const parsed = parseLegacyBackupEnvelope(envelope);
assert.equal(parsed.ok, true, JSON.stringify(parsed));

// 2) format sai (vd backup app-v2 'qclab-v2-backup') phải bị chặn rõ ràng
const wrongFormat = parseLegacyBackupEnvelope({ format: 'qclab-v2-backup', data: {} });
assert.equal(wrongFormat.ok, false);
assert.equal(wrongFormat.code, 'wrong-format');

// 3) checksum sai phải bị chặn
const tampered = { ...envelope, data: { ...legacyState, lab: { ...legacyState.lab, name: 'Bi sua' } } };
const tamperedResult = parseLegacyBackupEnvelope(tampered);
assert.equal(tamperedResult.ok, false);
assert.equal(tamperedResult.code, 'checksum-mismatch');

// 4) Ánh xạ đúng hình dạng cột app-v2 cho từng bảng
const mapped = mapLegacyStateToTables(legacyState);
assert.equal(mapped.lab[0].name, 'PXN Test');
assert.equal(mapped.instruments[0].id, 'ins1');
assert.equal(mapped.instruments[0].active, 1);
assert.equal(mapped.lot_groups[0].id, 'grp1');
assert.equal(mapped.qc_lots.length, 3); // lot1, lot2 va lot3 (lo cua moc Mean/SD du kien)
assert.equal(mapped.qc_panels[0].instrument_id, 'ins1');
assert.deepEqual(mapped.qc_panel_tests, [{ panel_id: 'pan1', test_id: 't1', position: 0 }]);
// Thứ tự xét nghiệm trong panel là DỮ LIỆU, không phải trình bày: người dùng
// tick Na/K/Cl đúng thứ tự trả kết quả. Di trú phải chép nguyên thứ tự
// `testIds` của app cũ sang cột `position`, không sắp lại theo tên hay id.
assert.deepEqual(
  mapLegacyStateToTables({ qcPanels: [{ id: 'pan9', name: 'Điện giải', instrumentId: 'ins1', testIds: ['na', 'k', 'cl'] }] }).qc_panel_tests,
  [
    { panel_id: 'pan9', test_id: 'na', position: 0 },
    { panel_id: 'pan9', test_id: 'k', position: 1 },
    { panel_id: 'pan9', test_id: 'cl', position: 2 },
  ],
  'di tru phai giu nguyen thu tu testIds cua app cu',
);
assert.equal(mapped.lot_transitions[0].from_lot_id, 'lot1');
assert.ok(JSON.parse(mapped.lot_transitions[0].criteria_json).legacyCriteria.includes('Song song'));
assert.equal(mapped.tests[0].section, 'Sinh hoa', 'section suy tu instrument vi test cu khong co truong nay');
assert.equal(mapped.tests[0].cusum_on, 1);
const level1 = mapped.test_levels.find(l => l.id === 't1:1');
assert.equal(level1.mean, 100);
// Mốc "dự kiến" phải TÁCH khỏi lịch sử: lịch sử chỉ giữ giai đoạn đã có hiệu
// lực, còn số dự kiến sang bảng riêng `planned_targets` — để lẫn thì
// `lotTargetSnapshot()` sẽ áp một giá trị chưa từng được duyệt.
assert.equal(JSON.parse(level1.mean_sd_history_json).length, 1, 'moc du kien khong duoc nam trong lich su');
assert.equal(mapped.planned_targets.length, 1);
assert.deepEqual(
  { ...mapped.planned_targets[0], saved_at: '', saved_by: '' },
  { id: 't1:1:lot3', test_id: 't1', level: 1, qc_lot_id: 'lot3', mean: 105, sd: 2.5, low: null, high: null, saved_at: '', saved_by: '' },
);
assert.equal(mapped.qc_points.length, 2);
const voidedPoint = mapped.qc_points.find(p => p.id === 'p2');
assert.equal(voidedPoint.voided, 1);
assert.equal(voidedPoint.void_kind, 'analytical');
assert.equal(mapped.sigma_data[0].test_id, 't1');
assert.deepEqual(JSON.parse(mapped.sigma_data[0].lv_json), { 1: { cv: 2, biasEqa: 1 } });
assert.equal(mapped.users[0].pass_hash, 'pbkdf2$600000$aaaa$bbbb', 'giu nguyen passHash, khong doi dinh dang');
assert.equal(mapped.users[0].avatar, 'data:image/png;base64,zz==', 'anh dai dien phai duoc anh xa, khong roi ve rong (cot NOT NULL, khong duoc dua vao DEFAULT khi ban do thieu field)');
assert.equal(mapped.activity.length, 2);
assert.equal(mapped.activity[0].hash, legacyActivity[0].hash, 'khong tinh lai hash, giu nguyen chuoi cu');

// 5) Chuoi hash cua activity da anh xa van xac minh dung (chi doi ten cot,
// khong doi thuat toan/payload)
const chainCheck = verifyAuditChain(mapped.activity.map(a => ({
  id: a.id, seq: a.seq, ts: a.ts, user: a.user, username: a.username, userId: a.user_id,
  role: a.role, type: a.type, detail: a.detail, target: a.target, clientId: a.client_id,
  prevHash: a.prev_hash, hash: a.hash,
})), '');
assert.equal(chainCheck.ok, true, JSON.stringify(chainCheck));

// 6) NCE: giu du lieu goc duoi detail_json.legacy, dong thoi map duoc 4
// truong app-v2 UI doc duoc
const action = mapped.actions[0];
assert.equal(action.approval_status, 'pending');
assert.equal(action.protocol_version, 3);
const detail = JSON.parse(action.detail_json);
assert.equal(detail.correction, 'Da hieu chuan lai may');
assert.equal(detail.causeCategory, 'SE');
assert.equal(detail.causeDescription, 'Loi hieu chuan');
assert.equal(detail.legacy.id, 'a1', 'giu nguyen ban ghi goc, khong mat du lieu');

// 7) Reagent/khoa ky/TEa map dung
assert.equal(mapped.reagent_tests[0].lot_old, 'L001');
assert.deepEqual(JSON.parse(mapped.reagent_tests[0].rows_json), [[100, 102], [200, 205]]);
assert.equal(mapped.period_locks[0].ym, '2026-01');
assert.equal(mapped.tea_refs[0].clia, 10);

// 8) Tom tat dem dung so luong cho UI hien truoc khi xac nhan
const summary = summarizeMappedTables(mapped);
assert.equal(summary.tests, 1);
assert.equal(summary.qcPoints, 2);
assert.equal(summary.actions, 1);
assert.equal(summary.users, 1);

console.log('app-v2 migrate-legacy oracle tests passed');
