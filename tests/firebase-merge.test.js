/**
 * Tests for the Firebase 3-way merge (assets/modules/firebase-sync.js).
 *
 * fbMerge() compares each top-level key against the last-synced baseline
 * (fb.synced, now a raw state snapshot rather than just a stringified one) and
 * takes "whichever side changed" per branch. Since the upgrade below, data/{testId}
 * and sigmaData/{testId} are no longer merged as a whole array: each point (keyed
 * by its `id`) is compared individually against the baseline via mergePointArray(),
 * so two machines editing DIFFERENT points of the SAME test while offline both
 * survive the merge. Only a genuine same-point conflict (both sides changed the
 * exact same point id to different values) still picks one side wholesale — the
 * local side wins, consistent with how the higher-level branches resolve ties.
 * See docs/firebase-sync-notes.md for the operational write-up.
 */
const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js', 'modules/audit.js']);
assert.equal(run(ctx,"FB_TOP.includes('archiveRegistry')&&FB_LIST_KEYS.includes('archiveRegistry')"),true,'archiveRegistry phải đồng bộ và merge theo id');
run(ctx, 'function __getState(){return state;} function __setState(s){state=s;} function __getUpdateCalls(){return __updateCalls||0;}');

function baseState(overrides = {}) {
  return Object.assign({
    lab: { name: 'Lab' }, machines: [], instruments: [], assayGroups: [], qcPanels: [],
    lotTransitions: [], lotGroups: [], qcLots: [], tests: [], actions: [], activity: [],
    users: [], reagentTests: [], reagentOperators: [], reagentSampleTypes: [],
    periodLocks: [], westgardRules: {}, configMigrationVersion: 1,
    data: {}, sigmaData: {},
  }, overrides);
}
// fbMerge runs inside the vm sandbox realm; round-trip the result through JSON
// (in this file's realm) before doing structural asserts, otherwise deepEqual
// fails on cross-realm Array/Object prototypes.
const plain = (v) => JSON.parse(JSON.stringify(v));

// --- Scenario 1: two machines edit different top-level branches concurrently -> both survive ---
{
  const base = baseState({ data: { T1: [{ id: 'p1', val: 1 }] } });
  const local = baseState({ lab: { name: 'Lab Local' }, data: { T1: [{ id: 'p1', val: 1 }] } }); // admin edited lab info offline
  const remote = baseState({ data: { T1: [{ id: 'p1', val: 1 }, { id: 'p2', val: 2 }] } }); // another machine pushed a new QC point

  const merged = plain(ctx.fbMerge(local, remote, base));
  assert.equal(merged.lab.name, 'Lab Local', 'local-only branch (lab) should survive the merge');
  assert.deepEqual(merged.data.T1, [{ id: 'p1', val: 1 }, { id: 'p2', val: 2 }], 'remote-only branch (data/T1) should survive the merge');
}

// --- Scenario 2 (upgraded): concurrent edits to DIFFERENT points of the SAME test both survive ---
{
  const base = baseState({ data: { T1: [{ id: 'p0', val: 1 }] } });
  const local = baseState({ data: { T1: [{ id: 'p0', val: 1 }, { id: 'pLocal', val: 2 }] } }); // machine A added a point offline
  const remote = baseState({ data: { T1: [{ id: 'p0', val: 1 }, { id: 'pRemote', val: 3 }] } }); // machine B added a different point offline

  const merged = plain(ctx.fbMerge(local, remote, base));
  const ids = merged.data.T1.map(p => p.id).sort();
  assert.deepEqual(ids, ['p0', 'pLocal', 'pRemote'], 'per-point merge: both machines\' new points on the same test survive');
}

// --- Scenario 3: deleting a test's data locally removes just that branch ---
{
  const base = baseState({ data: { T1: [{ id: 'p1', val: 1 }], T2: [{ id: 'p2', val: 9 }] } });
  const local = baseState({ data: { T2: [{ id: 'p2', val: 9 }] } }); // T1 deleted locally
  const remote = baseState({ data: { T1: [{ id: 'p1', val: 1 }], T2: [{ id: 'p2', val: 9 }, { id: 'p3', val: 10 }] } }); // T2 got a new remote point

  const merged = plain(ctx.fbMerge(local, remote, base));
  assert.ok(!('T1' in merged.data), 'local deletion of a test data branch should be honoured');
  assert.deepEqual(merged.data.T2.map(p => p.id).sort(), ['p2', 'p3'], 'unrelated branch keeps the remote update');
}

// --- Scenario 3b: a stale whole-array push for one test must not delete points added elsewhere ---
{
  // Machine B already pushed pB and advanced its baseline. Machine A then pushes
  // an older data/T1 array that contains pA but does not know about pB.
  const base = baseState({ data: { T1: [{ id: 'p0', val: 0 }, { id: 'pB', val: 2 }] } });
  const local = baseState({ data: { T1: [{ id: 'p0', val: 0 }, { id: 'pB', val: 2 }] } });
  const remote = baseState({ data: { T1: [{ id: 'p0', val: 0 }, { id: 'pA', val: 1 }] } });

  const merged = plain(ctx.fbMerge(local, remote, base));
  assert.deepEqual(merged.data.T1.map(p => p.id).sort(), ['p0', 'pA', 'pB'], 'stale remote arrays should merge in new remote points without dropping local/base points');
}

// --- Scenario 4: voiding one point locally does not clobber a note edit on a sibling point remotely ---
{
  const base = baseState({ data: { T1: [
    { id: 'p1', date: '2026-07-01', val: 1, note: '' },
    { id: 'p2', date: '2026-07-01', val: 2, note: '' },
  ] } });
  const local = baseState({ data: { T1: [
    { id: 'p1', date: '2026-07-01', val: 1, note: '', voided: true, voidReason: 'nhầm mẫu' },
    { id: 'p2', date: '2026-07-01', val: 2, note: '' },
  ] } }); // machine A voided p1
  const remote = baseState({ data: { T1: [
    { id: 'p1', date: '2026-07-01', val: 1, note: '' },
    { id: 'p2', date: '2026-07-01', val: 2, note: 'ghi chú buổi chiều' },
  ] } }); // machine B added a note to p2 (bulk note-save touches all points of that day)

  const merged = plain(ctx.fbMerge(local, remote, base));
  const p1 = merged.data.T1.find(p => p.id === 'p1'), p2 = merged.data.T1.find(p => p.id === 'p2');
  assert.equal(p1.voided, true, 'the void on p1 (local) should survive');
  assert.equal(p2.note, 'ghi chú buổi chiều', 'the note edit on p2 (remote) should survive even though p1 and p2 share a test/day');
}

// --- Scenario 5 (documents a known, narrow limitation): both sides edit the SAME point differently ---
{
  const base = baseState({ data: { T1: [{ id: 'p1', val: 1, voided: false }] } });
  const local = baseState({ data: { T1: [{ id: 'p1', val: 1, voided: true, voidReason: 'lý do A' }] } });
  const remote = baseState({ data: { T1: [{ id: 'p1', val: 1, voided: true, voidReason: 'lý do B' }] } });

  const merged = plain(ctx.fbMerge(local, remote, base));
  assert.equal(merged.data.T1[0].voidReason, 'lý do A', 'true same-point conflicts still pick one side wholesale (local wins), same tie-break convention as the higher-level branches');
}

// --- Scenario 6: merge can produce duplicate runId within a date/level/lot group; only that conflict is normalized ---
{
  const fixture = {
    lab: {}, tests: [{ id: 'T1', name: 'Glucose', instrumentId: 'i1', machine: 'Máy A', levels: [{ level: 1, lot: 'L1', mean: 10, sd: 1 }] }],
    instruments: [{ id: 'i1', name: 'Máy A' }], assayGroups: [], qcPanels: [], lotTransitions: [], lotGroups: [], qcLots: [],
    actions: [], activity: [], users: [], reagentTests: [], reagentOperators: [], reagentSampleTypes: [], periodLocks: [], westgardRules: {},
    data: { T1: [
      // Both machines independently computed runId "2026-07-01-2" for their new point (base only had -1).
      { id: 'pBase', date: '2026-07-01', level: 1, lot: 'L1', val: 1, runId: '2026-07-01-1' },
      { id: 'pLocal', date: '2026-07-01', level: 1, lot: 'L1', val: 2, runId: '2026-07-01-2' },
      { id: 'pRemote', date: '2026-07-01', level: 1, lot: 'L1', val: 3, runId: '2026-07-01-2' },
    ] },
    sigmaData: {},
  };
  ctx.__setState(fixture);
  ctx.normalizePointLots(); // same call ensureShape() makes after every fbMerge in production
  const state = JSON.parse(JSON.stringify(ctx.__getState()));
  const runIds = state.data.T1.map(p => p.runId).sort();
  assert.deepEqual(runIds, ['2026-07-01-1', '2026-07-01-2', '2026-07-01-3'], 'duplicate runId introduced by per-point merge should be renumbered to stay unique');
}

// --- Scenario 7: hasLocalQcContent() — the first-connect data-loss guard only fires when there's real content to lose ---
{
  assert.equal(ctx.hasLocalQcContent(baseState()), false, 'a fresh/empty state has nothing to protect');
  assert.equal(ctx.hasLocalQcContent(baseState({ tests: [{ id: 'T1' }] })), true, 'any test counts as local content');
  assert.equal(ctx.hasLocalQcContent(baseState({ data: { T1: [{ id: 'p1' }] } })), true, 'any QC point counts as local content');
  assert.equal(ctx.hasLocalQcContent(baseState({ actions: [{ id: 'a1' }] })), true, 'any corrective action counts as local content');
}

// --- Scenario 8: statesLikelyEqual() — a normal page reload (local already matches cloud) should not trip the guard ---
{
  const a = baseState({ tests: [{ id: 'T1', name: 'Glucose' }], _ts: 111, _client: 'c_aaa' });
  const bSameContentDifferentSession = baseState({ tests: [{ id: 'T1', name: 'Glucose' }], _ts: 222, _client: 'c_bbb' });
  const bDifferentContent = baseState({ tests: [{ id: 'T1', name: 'Glucose khac' }], _ts: 111, _client: 'c_aaa' });
  assert.equal(ctx.statesLikelyEqual(a, bSameContentDifferentSession), true, 'only _ts/_client differ -> should compare equal (no prompt on a plain reload)');
  assert.equal(ctx.statesLikelyEqual(a, bDifferentContent), false, 'real content differs -> should compare unequal (prompt before letting cloud overwrite)');
}

// --- Scenario 8b: statesLikelyEqual() chỉ được so các nhánh THỰC SỰ được đồng bộ.
// Bug thật (2026-07-27): hàm cũ so JSON.stringify toàn bộ state, nên luôn lệch ít nhất
// ở schemaVersion/teaRegistryVersion — state cục bộ có, cloud không bao giờ có vì
// FB_TOP không đẩy chúng lên. Hậu quả: hộp thoại "Dữ liệu cục bộ khác dữ liệu trung
// tâm" bật lên MỖI lần đăng nhập dù hai bên đã đồng bộ y hệt. Fixture của Scenario 8
// đối xứng nhân tạo (cùng thứ tự khóa, không có field cục bộ) nên không bắt được. ---
{
  const cloudPoints = { T1: [{ id: 'p1', val: 5 }] };
  const local = Object.assign(baseState({ tests: [{ id: 'T1', name: 'Glucose' }], data: { T1: [{ id: 'p1', val: 5 }] } }), {
    schemaVersion: 4, teaRegistryVersion: 3, _ts: 999, _client: 'c_local',
  });

  const cloud = baseState({ tests: [{ id: 'T1', name: 'Glucose' }], data: cloudPoints });
  assert.equal(ctx.statesLikelyEqual(local, cloud), true, 'field chỉ tồn tại cục bộ (schemaVersion/teaRegistryVersion/_ts/_client) không được tính là khác biệt');

  // RTDB không lưu mảng/đối tượng rỗng: nhánh rỗng trên máy biến mất hẳn khi tải về.
  const cloudMissingEmpties = baseState({ tests: [{ id: 'T1', name: 'Glucose' }], data: cloudPoints });
  delete cloudMissingEmpties.machines; delete cloudMissingEmpties.periodLocks; delete cloudMissingEmpties.sigmaData;
  assert.equal(ctx.statesLikelyEqual(local, cloudMissingEmpties), true, 'nhánh rỗng trên máy vs thiếu hẳn trên cloud phải coi là giống nhau');

  // RTDB không giữ thứ tự khóa — trả về theo thứ tự của nó, không theo thứ tự đã ghi.
  const reordered = { data: { T1: [{ val: 5, id: 'p1' }] }, tests: [{ name: 'Glucose', id: 'T1' }] };
  Object.keys(cloud).forEach(k => { if (!(k in reordered)) reordered[k] = cloud[k]; });
  assert.equal(ctx.statesLikelyEqual(local, reordered), true, 'khác thứ tự khóa không phải là khác dữ liệu');

  // Nhưng khác biệt THẬT vẫn phải bị bắt, kể cả nằm sâu trong data/{testId}.
  assert.equal(ctx.statesLikelyEqual(local, baseState({ tests: [{ id: 'T1', name: 'Glucose' }], data: { T1: [{ id: 'p1', val: 9 }] } })), false, 'điểm QC khác giá trị vẫn phải hỏi trước khi ghi đè');
  assert.equal(ctx.statesLikelyEqual(local, baseState({ tests: [{ id: 'T1', name: 'Glucose' }], data: { T1: [{ id: 'p1', val: 5 }, { id: 'p2', val: 6 }] } })), false, 'cloud có thêm điểm QC vẫn phải hỏi trước khi ghi đè');
  assert.equal(ctx.statesLikelyEqual(local, baseState({ tests: [{ id: 'T1', name: 'Glucose' }], data: cloudPoints, qcLots: [{ id: 'l1', lotNo: 'L1' }] })), false, 'danh mục cấu hình khác nhau vẫn phải hỏi');
}

// --- Scenario 9: autosave must not push before the first Firebase snapshot is loaded ---
{
  run(ctx, `
    var __updateCalls = 0;
    state = ${JSON.stringify(baseState({ tests: [{ id: 'T1', name: 'Glucose', levels: [{ level: 1 }] }] }))};
    fb.ready = true;
    fb.initialized = false;
    fb.ref = { update: function(){ __updateCalls++; return Promise.resolve(); } };
    fbFlushPush();
  `);
  assert.equal(ctx.__getUpdateCalls(), 0, 'push is blocked until initFirebase processes the initial snapshot');
}

// --- Scenario 10: an invalid initial cloud snapshot must not permanently block this client from pushing ---
{
  // fbDataPath()/markSaved() touch `window`/`document` at runtime (unlike the sandbox-safe
  // top-level code) — stub bare-minimum globals just for this scenario.
  const initializedAfterInvalidSnapshot = run(ctx, `
    window = { QCLAB_CLOUD: null };
    document = { getElementById: function(){ return null; }, addEventListener: function(){} };
    state = ${JSON.stringify(baseState({ tests: [{ id: 'T1', name: 'Glucose', levels: [{ level: 1 }] }] }))};
    fb.ready = false;
    fb.initialized = false;
    fbHandleValue({ schemaVersion: 999 }); // fails QCCore.validateBackup: schemaVersion cao hơn app hỗ trợ
    fb.ready && fb.initialized;
  `);
  assert.equal(initializedAfterInvalidSnapshot, true, 'an invalid cloud snapshot must still mark this client as initialized, so later local edits keep syncing instead of deadlocking forever');

  const pushAttempted = run(ctx, `
    var __updateCalls = 0;
    fb.ref = { update: function(){ __updateCalls++; return Promise.resolve(); } };
    fbFlushPush();
    __updateCalls;
  `);
  assert.equal(pushAttempted, 1, 'once fb.ready/fb.initialized are set despite the invalid snapshot, a later local edit is still pushed instead of silently dropped');
}

// --- Scenario 11: two machines each add a DIFFERENT instrument offline -> both survive the merge ---
// (regression test for the reported bug: FB_TOP config lists like `instruments` used to
// merge as a whole block, so two machines independently configuring different instruments
// before ever syncing would have one side silently wipe out the other's.)
{
  const base = baseState({ instruments: [] });
  const local = baseState({ instruments: [{ id: 'iA', name: 'Máy B' }] });
  const remote = baseState({ instruments: [{ id: 'iB', name: 'EasyLyte Expand' }] });

  const merged = plain(ctx.fbMerge(local, remote, base));
  assert.deepEqual(merged.instruments.map(x => x.id).sort(), ['iA', 'iB'], 'both machines\' independently-added instruments should survive, not clobber each other');
}

// --- Scenario 12: same instrument edited differently on both sides -> local wins (same convention as data/{testId}) ---
{
  const base = baseState({ instruments: [{ id: 'iA', name: 'Máy B', section: '' }] });
  const local = baseState({ instruments: [{ id: 'iA', name: 'Máy B', section: 'Khoa Sinh hóa' }] });
  const remote = baseState({ instruments: [{ id: 'iA', name: 'Máy B', section: 'Khoa Huyết học' }] });

  const merged = plain(ctx.fbMerge(local, remote, base));
  assert.equal(merged.instruments[0].section, 'Khoa Sinh hóa', 'a genuine same-item conflict still picks local, consistent with the data/{testId} tie-break');
}

// --- Scenario 13: two machines each log a DIFFERENT corrective action offline -> both survive ---
// (actions now get a stable `id` at creation time, so they can merge per-item like everything else.)
{
  const base = baseState({ actions: [] });
  const local = baseState({ actions: [{ id: 'a1', action: 'Hiệu chuẩn lại máy', by: 'KTV A' }] });
  const remote = baseState({ actions: [{ id: 'a2', action: 'Thay thuốc thử mới', by: 'KTV B' }] });

  const merged = plain(ctx.fbMerge(local, remote, base));
  assert.deepEqual(merged.actions.map(x => x.id).sort(), ['a1', 'a2'], 'corrective actions logged offline on different machines should both survive the merge');
}

// --- Scenario 14: hasLocalQcContent() now also protects config-only local data (no tests/data/actions yet) ---
{
  assert.equal(ctx.hasLocalQcContent(baseState({ instruments: [{ id: 'iA', name: 'Máy B' }] })), true, 'a freshly-configured instrument (before any test/QC point/action exists) must still count as local content worth protecting');
  assert.equal(ctx.hasLocalQcContent(baseState({ qcPanels: [{ id: 'p1', name: 'Panel 1' }] })), true, 'qcPanels likewise count');
  assert.equal(ctx.hasLocalQcContent(baseState({ lotGroups: [{ id: 'g1', name: 'Group 1' }] })), true, 'lotGroups likewise count');
  assert.equal(ctx.hasLocalQcContent(baseState({ qcLots: [{ id: 'l1', lotNo: 'L1' }] })), true, 'qcLots likewise count');
  assert.equal(ctx.hasLocalQcContent(baseState({ assayGroups: [{ id: 'ag1', name: 'Group A' }] })), true, 'assayGroups likewise count');
}

// --- Scenario 15: explicit first-connect merge still unions both sides when there are pending local edits ---
// (regression test for the reported bug: laptop and phone each had their own local data;
// on connect/page-reload the cloud used to replace local wholesale, so whichever machine
// pushed last "won" and the two never converged.)
{
  const local = baseState({
    lab: { name: 'Lab cục bộ' },
    instruments: [{ id: 'iA', name: 'Máy B' }],
    tests: [{ id: 'T1', name: 'Glucose', levels: [{ level: 1 }] }],
    data: { T1: [{ id: 'p1', val: 1 }] },
    users: [{ id: 'uLocal', username: 'admin' }],
  });
  const remote = baseState({
    lab: { name: 'Lab đám mây' },
    instruments: [{ id: 'iB', name: 'EasyLyte Expand' }],
    tests: [{ id: 'T2', name: 'Kali', levels: [{ level: 1 }] }],
    data: { T2: [{ id: 'p2', val: 2 }] },
    users: [{ id: 'uCloud', username: 'admin' }],
  });
  const merged = plain(ctx.fbFirstConnectMerge(local, remote));
  assert.deepEqual(merged.instruments.map(x => x.id).sort(), ['iA', 'iB'], 'first connect: both sides\' instruments survive');
  assert.deepEqual(merged.tests.map(x => x.id).sort(), ['T1', 'T2'], 'first connect: both sides\' tests survive');
  assert.deepEqual(Object.keys(merged.data).sort(), ['T1', 'T2'], 'first connect: both sides\' QC data survive');
  assert.equal(merged.lab.name, 'Lab đám mây', 'non-list branches (lab) take the cloud side on first connect');
  assert.deepEqual(merged.users.map(u => u.id), ['uCloud'], 'duplicate usernames after the union keep the cloud account');
}

// --- Scenario 16: deleting a catalog item propagates (no resurrection by idle machines) ---
{
  const both = [{ id: 'iA', name: 'Máy B' }, { id: 'iB', name: 'EasyLyte' }];
  const base = baseState({ instruments: both });
  const local = baseState({ instruments: both });                        // máy này không đụng gì
  const remote = baseState({ instruments: [{ id: 'iB', name: 'EasyLyte' }] }); // máy kia đã Xóa iA
  const merged = plain(ctx.fbMerge(local, remote, base));
  assert.deepEqual(merged.instruments.map(x => x.id), ['iB'], 'a delete on one machine propagates to machines that did not touch the item');
}

// --- Scenario 17: edit-vs-delete on the same catalog item -> the edit wins; a local delete wins locally ---
{
  const base = baseState({ instruments: [{ id: 'iA', name: 'Máy B' }] });
  const localEdited = baseState({ instruments: [{ id: 'iA', name: 'Máy B - Khoa SH' }] });
  const remoteDeleted = baseState({ instruments: [] });
  const merged = plain(ctx.fbMerge(localEdited, remoteDeleted, base));
  assert.deepEqual(merged.instruments.map(x => x.name), ['Máy B - Khoa SH'], 'a concurrent edit beats a delete (real changes are never silently lost)');

  const localDeleted = baseState({ instruments: [] });
  const remoteKept = baseState({ instruments: [{ id: 'iA', name: 'Máy B' }] });
  const merged2 = plain(ctx.fbMerge(localDeleted, remoteKept, base));
  assert.deepEqual(merged2.instruments, [], 'a local delete sticks even while the cloud still holds the old copy');
}

// --- Scenario 17b: QC points keep the OLD semantics — absence is NOT a delete (deletes:true is list-only) ---
// (scenario 3b already covers the stale-array case; this pins the base-has-it/remote-lacks-it case directly.)
{
  const base = baseState({ data: { T1: [{ id: 'p1', val: 1 }] } });
  const local = baseState({ data: { T1: [{ id: 'p1', val: 1 }] } });
  const remote = baseState({ data: { T1: [] } });
  const merged = plain(ctx.fbMerge(local, remote, base));
  assert.deepEqual((merged.data.T1 || []).map(p => p.id), ['p1'], 'a QC point missing from a remote array must not be treated as deleted (voided is the delete signal)');
}

// --- Scenario 18: first connect to an EMPTY room with local content -> push is scheduled immediately ---
// (previously local data sat idle until the next manual edit set fb.dirty, so the other
// machine connected to a still-empty room and saw nothing.)
{
  const scheduled = run(ctx, `
    window = { QCLAB_CLOUD: null };
    document = { getElementById: function(){ return null; }, addEventListener: function(){} };
    var __pushScheduled = 0;
    setTimeout = function(){ __pushScheduled++; return 0; };
    clearTimeout = function(){};
    state = ${JSON.stringify(baseState({ instruments: [{ id: 'iA', name: 'Máy B' }] }))};
    fb.ready = false; fb.initialized = false; fb.dirty = false; fb.synced = null; fb.seenSig = null;
    fb.ref = { update: function(){ return Promise.resolve(); } };
    fbHandleValue(null);
    __pushScheduled;
  `);
  assert.ok(scheduled >= 1, 'connecting to an empty room with local content must schedule a full push instead of waiting for the next edit');
}

// --- Scenario 19: snapshot de-dupe must use content, not only _ts/_client ---
{
  const applied = run(ctx, `
    window = { QCLAB_CLOUD: null };
    document = { getElementById: function(){ return null; }, addEventListener: function(){} };
    localStorage = { setItem: function(){} };
    currentUser = null;
    ensureLabBrandShape = function(){};
    ensureAdmin = function(){};
    state = ${JSON.stringify(baseState())};
    fb.ready = false; fb.initialized = false; fb.synced = null; fb.seenSig = null;
    const r1 = ${JSON.stringify(baseState({ _ts: 123, _client: 'same-client', tests: [{ id: 'T1', name: 'Glucose', levels: [{ level: 1 }] }] }))};
    const r2 = ${JSON.stringify(baseState({ _ts: 123, _client: 'same-client', tests: [{ id: 'T2', name: 'Kali', levels: [{ level: 1 }] }] }))};
    fbHandleValue(r1, { silent: true });
    fb.dirty = true;
    fbHandleValue(r2, { silent: true });
    state.tests.map(t => t.id).sort().join(',');
  `);
  assert.equal(applied, 'T1,T2', 'a changed snapshot with the same _ts/_client must still be applied');
}

// --- Scenario 20: login/logout local audit saves must not mark Firebase dirty ---
{
  const dirtyAfterLocalOnlySave = run(ctx, `
    state = ${JSON.stringify(baseState({ tests: [{ id: 'T1', name: 'Glucose', levels: [{ level: 1 }] }] }))};
    fb.dirty = false;
    fb.ready = false;
    fb.initialized = false;
    lsDirty = false;
    clearTimeout = function(){};
    setTimeout = function(){ return 0; };
    save({ cloud: false });
    fb.dirty;
  `);
  assert.equal(dirtyAfterLocalOnlySave, false, 'login/logout audit saves are local-only and must not make the next Firebase snapshot push this device over the cloud');
}

// --- Scenario 20b: two machines each log DIFFERENT audit entries offline from the same base,
// then sync -> mergePointArray() (activity is a FB_LIST_KEYS branch) orders the merged array as
// "all of remote's entries, then any local-only entries appended after" — NOT by timestamp. That
// breaks the strict prevHash linkage each machine built independently from the shared base, so
// auditVerifyChain() used to report a false "tampered" chain after a perfectly legitimate merge.
// The fix: fbHandleValue() now calls auditRelinkChain() on the merged activity array right after
// fbMerge()/fbFirstConnectMerge(), re-stamping prevHash/hash to match the array's FINAL order.
{
  const emptyBase = baseState({ activity: [] });
  const built = run(ctx, `
    currentUser = { id: 'u1', username: 'admin', name: 'Admin' };
    role = function(){ return 'admin'; };

    fb.clientId = 'machineA';
    state = ${JSON.stringify(emptyBase)};
    logAct('Đăng nhập', 'Máy A đăng nhập lúc 08:00', 'Tài khoản');
    var base = JSON.parse(JSON.stringify(state));

    state = JSON.parse(JSON.stringify(base));
    logAct('Nhập QC', 'Máy A nhập điểm QC lúc 09:00', 'Glucose');
    logAct('Nhập QC', 'Máy A nhập điểm QC lúc 09:05', 'Glucose');
    var localA = JSON.parse(JSON.stringify(state));

    fb.clientId = 'machineB';
    state = JSON.parse(JSON.stringify(base));
    logAct('Nhập QC', 'Máy B nhập điểm QC lúc 09:02', 'ALT');
    var remoteB = JSON.parse(JSON.stringify(state));

    var mergedRaw = fbMerge(localA, remoteB, base);
    var chainBeforeFix = (function(){
      var prev = '', ok = true;
      for (var i = 0; i < mergedRaw.activity.length; i++) {
        var a = mergedRaw.activity[i];
        if (!a.hash && !a.prevHash) continue;
        if (a.prevHash !== prev) { ok = false; break; }
        prev = a.hash;
      }
      return ok;
    })();

    var relinked = auditRelinkChain(mergedRaw.activity);
    state = Object.assign({}, mergedRaw, { activity: relinked });
    var chainAfterFix = auditVerifyChain();

    // Tamper detection must still work on the relinked chain — the fix must not
    // paper over genuine tampering, only the merge-reordering false positive.
    state.activity[1].detail = 'HACKED';
    var chainAfterTamper = auditVerifyChain();

    ({ chainBeforeFix: chainBeforeFix, chainAfterFixOk: chainAfterFix.ok, chainAfterFixChecked: chainAfterFix.checked, chainAfterTamperOk: chainAfterTamper.ok, brokenIndex: chainAfterTamper.brokenIndex });
  `);
  const result = plain(built);
  assert.equal(result.chainBeforeFix, false, 'sanity check: the raw merged activity order really does break strict prevHash linkage (reproduces the bug)');
  assert.equal(result.chainAfterFixOk, true, 'auditRelinkChain() must restore a valid chain after a genuine multi-device merge with no real tampering');
  assert.equal(result.chainAfterFixChecked, 4, 'all 4 merged entries participate in the relinked chain');
  assert.equal(result.chainAfterTamperOk, false, 'relinking must not weaken real tamper detection');
  assert.equal(result.brokenIndex, 1, 'tampering the entry actually modified is still located precisely');
}

// fbHandleValue() awaits confirmDialog() (a custom modal, see modals.js) instead of
// calling the browser's confirm() synchronously now — stub confirmDialog() directly
// rather than loading the DOM-dependent modal module, and await the vm script's
// completion value (a Promise chained onto fbHandleValue's own).
(async () => {

// --- Scenario 21: first-connect with local content different from central data prompts once,
// then REPLACES local wholesale with the central data (single-source-of-truth model: a
// secondary machine's stray local content must not leak into the shared room on confirm). ---
{
  const afterFirstCloudSnapshot = await run(ctx, `
    window = { QCLAB_CLOUD: null };
    document = { getElementById: function(){ return null; }, addEventListener: function(){} };
    localStorage = { setItem: function(){} };
    currentUser = null;
    ensureLabBrandShape = function(){};
    ensureAdmin = function(){};
    renderBrand = function(){};
    applyRemoteRender = function(){};
    setTimeout = function(){ return 0; };
    clearTimeout = function(){};
    var __confirmCalls = 0;
    confirmDialog = function(){ __confirmCalls++; return Promise.resolve(true); };
    state = ${JSON.stringify(baseState({ tests: [{ id: 'OLD_LOCAL', name: 'Stale local', levels: [{ level: 1 }] }] }))};
    fb.ready = false; fb.initialized = false; fb.dirty = false; fb.synced = null; fb.seenSig = null;
    fb.ref = { update: function(){ return Promise.resolve(); } };
    var remote21 = ${JSON.stringify(baseState({ tests: [{ id: 'CLOUD', name: 'Cloud source', levels: [{ level: 1 }] }] }))};
    fbHandleValue(remote21, { silent: true }).then(function(){ return __confirmCalls + '|' + state.tests.map(t => t.id).sort().join(','); });
  `);
  assert.equal(afterFirstCloudSnapshot, '1|CLOUD', 'confirming the first-connect prompt replaces local content with the central data wholesale, not a union');
}

// --- Scenario 22: first-connect prompt cancel keeps local data and disconnects cloud ---
{
  const afterCancel = await run(ctx, `
    window = { QCLAB_CLOUD: null };
    document = { getElementById: function(){ return null; }, addEventListener: function(){} };
    localStorage = { setItem: function(){} };
    currentUser = null;
    ensureLabBrandShape = function(){};
    ensureAdmin = function(){};
    renderBrand = function(){};
    applyRemoteRender = function(){};
    confirmDialog = function(){ return Promise.resolve(false); };
    state = ${JSON.stringify(baseState({ tests: [{ id: 'LOCAL_ONLY', name: 'Local source', levels: [{ level: 1 }] }] }))};
    fb.ready = true; fb.initialized = false; fb.dirty = false; fb.synced = null; fb.seenSig = null;
    fb.ref = { off: function(){}, update: function(){ return Promise.resolve(); } };
    var remote22 = ${JSON.stringify(baseState({ tests: [{ id: 'CLOUD', name: 'Cloud source', levels: [{ level: 1 }] }] }))};
    fbHandleValue(remote22, { silent: true }).then(function(){ return state.tests.map(t => t.id).join(',') + '|' + fb.ready + '|' + fb.initialized + '|' + (fb.ref === null); });
  `);
  assert.equal(afterCancel, 'LOCAL_ONLY|false|false|true', 'canceling the first-connect prompt must keep local state and fully disconnect Firebase');
}

// --- Scenario 23: a recovered Sigma draft is a known pending edit, not stale local data ---
// It must merge into the first cloud snapshot without asking the user to discard it.
{
  const pendingSigma = await run(ctx, `
    window = { QCLAB_CLOUD: null };
    document = { getElementById: function(){ return null; }, addEventListener: function(){} };
    localStorage = { setItem: function(){}, getItem: function(){return null;}, removeItem:function(){} };
    currentUser = null;
    ensureLabBrandShape = function(){};
    ensureAdmin = function(){};
    renderBrand = function(){};
    applyRemoteRender = function(){};
    setTimeout = function(fn){ fn(); return 0; };
    clearTimeout = function(){};
    var __pendingConfirmCalls = 0, __pendingUpdates = [];
    confirmDialog = function(){ __pendingConfirmCalls++; return Promise.resolve(true); };
    state = ${JSON.stringify(baseState({
      tests: [{ id: 'T1', name: 'Sodium', levels: [{ level: 1 }] }],
      sigmaData: { T1: [{ id: 'P1', period: '2026-07', lv: { 1: { cv: 1.25, biasEqa: 2.5 } } }] },
    }))};
    fb.ready = true; fb.initialized = false; fb.dirty = true; fb.synced = null; fb.seenSig = null;
    fb.ref = { update: function(payload){ __pendingUpdates.push(payload); return Promise.resolve(); } };
    var remote23 = ${JSON.stringify(baseState({
      tests: [{ id: 'T1', name: 'Sodium', levels: [{ level: 1 }] }],
      sigmaData: { T1: [{ id: 'P1', period: '2026-07', lv: {} }] },
    }))};
    fbHandleValue(remote23, { silent: true }).then(function(){
      return Promise.resolve().then(function(){return{confirmCalls:__pendingConfirmCalls,level:state.sigmaData.T1[0].lv[1],updates:__pendingUpdates.length};});
    });
  `);
  const pending = plain(pendingSigma);
  assert.equal(pending.confirmCalls, 0, 'known pending Sigma edits bypass the destructive first-connect prompt');
  assert.equal(pending.level.cv, 1.25);
  assert.equal(pending.level.biasEqa, 2.5);
  assert.ok(pending.updates >= 1, 'the recovered edit is pushed back to Firebase');
}

/* Luu tru nhat ky khi DANG BAT dong bo: may A cat bot dong cu va day len cloud, may B
   chua cat. Rui ro nghi ngo: mergePointArray() co ngoai le "ban sua thang lenh xoa", ma
   auditRelinkChain() chay sau moi merge va co the ghi lai hash cac dong cu -> lenh xoa
   cua A bi bo qua va dong da luu tru "hoi sinh" tren B. Test nay chot lai rang khong
   xay ra: order cua mergePointArray() xep phan tu chi-co-o-local vao CUOI nen cac dong
   cu giu nguyen vi tri, relink thanh no-op va lS===bS. Neu ai doi thu tu merge sau nay,
   test do se do. */
{
  ctx.__setState(baseState({ activity: [], activityAnchor: '' }));
  run(ctx, `for(let i=1;i<=4;i++) logAct('Thao tác '+i,'chi tiết '+i,'mục '+i);`);
  const cloudOld = JSON.parse(JSON.stringify(ctx.__getState().activity));

  // May B ghi them 1 dong cuc bo chua push, roi nhan mot ban dong bo tu cloud.
  run(ctx, `logAct('Thao tác B','chi tiết B','mục B');`);
  const remote1 = baseState({ activity: cloudOld, activityAnchor: '' });
  run(ctx, `__r1=${JSON.stringify(remote1)};state=fbMerge(state,__r1,null)||state;state.activity=auditRelinkChain(state.activity,state.activityAnchor||'');`);
  const oldRowsUntouched = ctx.__getState().activity.slice(0, 4).every((a, i) => a.hash === cloudOld[i].hash);
  assert.equal(oldRowsUntouched, true, 'merge không được ghi lại hash các dòng cũ, nếu không lệnh xóa sẽ bị vô hiệu');

  // May A luu tru: cat 3 dong cu nhat, dat neo, day len cloud.
  const anchor = cloudOld[2].hash;
  const remote2 = baseState({ activity: [cloudOld[3]], activityAnchor: anchor });
  run(ctx, `fb.synced=${JSON.stringify(remote1)};__r2=${JSON.stringify(remote2)};state=fbMerge(state,__r2,fb.synced)||state;`);
  const merged = ctx.__getState().activity;
  const resurrected = merged.filter(a => /chi tiết [123]$/.test(a.detail || ''));
  assert.equal(resurrected.length, 0, 'dòng đã lưu trữ trên máy A không được sống lại trên máy B');
  assert.equal(merged.some(a => a.detail === 'chi tiết B'), true, 'thao tác cục bộ chưa push vẫn phải giữ');
  assert.equal(ctx.__getState().activityAnchor, anchor, 'neo phải theo bản đồng bộ về, nếu không B sẽ báo "audit bị sửa" giả');
}

console.log('Firebase merge tests passed');

})().catch(err => { console.error(err); process.exitCode = 1; });
