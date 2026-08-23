'use strict';
// Mọi test khác cho engine Westgard/Sigma/backup (qccore.test.js, cusum.test.js,
// uncertainty.test.js, audit-hash.test.js, ...) chỉ require('../assets/core.js') —
// tệp BUILD ra từ src/domain/core/qc-core.ts qua `npm run build:core`. Nếu ai đó
// sửa qc-core.ts mà quên rebuild, toàn bộ các test đó vẫn xanh vì chúng kiểm tra
// bản build CŨ, không phải nguồn thật — đúng loại lỗi mà cảnh báo gốc ở
// WG_RULE_REGISTRY trong chính file lo ngại ("một dòng lỡ tay đổi kết luận
// Westgard mà không có test nào bắt được"). Test này import THẲNG qc-core.ts
// (Node tự strip type, không cần ts-node — cùng cách westgard-row-window.test.js
// đã dùng) và đối chiếu kết quả với bản build cho một lát cắt đại diện của toàn
// bộ export: lệch nhau nghĩa là build đã cũ, không phải sai riêng một hành vi.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const tsSource = pathToFileURL(path.join(__dirname, '..', 'src', 'domain', 'core', 'qc-core.ts')).href;
const builtCorePath = path.join(__dirname, '..', 'assets', 'core.js');

const program = `
import * as ts from ${JSON.stringify(tsSource)};
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const built = require(${JSON.stringify(builtCorePath)});

const mismatches = [];
let checked = 0;
function norm(v) {
  return JSON.stringify(v, (k, x) => (x instanceof Set ? [...x].sort() : x instanceof Map ? Object.fromEntries(x) : x));
}
function eq(name, a, b) {
  checked++;
  const as = norm(a), bs = norm(b);
  if (as !== bs) mismatches.push({ name, ts: as, built: bs });
}
function multiSnapshot(map, points) {
  return points.map(p => ({
    rules: (map.get(p) || []).slice().sort(),
    support: ((map.support && map.support.get(p)) || []).slice().sort(),
  }));
}

// ----- Bảng dữ liệu tĩnh (nguồn duy nhất cho Westgard) -----
eq('WG_RULE_REGISTRY', ts.WG_RULE_REGISTRY, built.WG_RULE_REGISTRY);
eq('WG_RULES', ts.WG_RULES, built.WG_RULES);
eq('WG_DEFAULT_ON', ts.WG_DEFAULT_ON, built.WG_DEFAULT_ON);
eq('WG_RULE_DESCRIPTIONS', ts.WG_RULE_DESCRIPTIONS, built.WG_RULE_DESCRIPTIONS);
eq('RULE_ACTIONS', ts.RULE_ACTIONS, built.RULE_ACTIONS);
eq('RULE_SCOPES', ts.RULE_SCOPES, built.RULE_SCOPES);
eq('WG_ALERT_RULES', ts.WG_ALERT_RULES, built.WG_ALERT_RULES);
eq('WG_SE_RULES', ts.WG_SE_RULES, built.WG_SE_RULES);
eq('WG_RE_RULES', ts.WG_RE_RULES, built.WG_RE_RULES);
eq('STATE_SCHEMA_VERSION', ts.STATE_SCHEMA_VERSION, built.STATE_SCHEMA_VERSION);
eq('ROLE_SET', ts.ROLE_SET, built.ROLE_SET);
eq('PAGE_SET', ts.PAGE_SET, built.PAGE_SET);

// ----- Hàm làm sạch thuần -----
eq('cleanText', ts.cleanText('  <script>a\\u0000b</script>  ', 500), built.cleanText('  <script>a\\u0000b</script>  ', 500));
eq('cleanId-ok', ts.cleanId('abc-123_XY'), built.cleanId('abc-123_XY'));
eq('cleanId-bad', ts.cleanId('bad id!'), built.cleanId('bad id!'));
eq('finiteNumber', ts.finiteNumber('12.5', 0), built.finiteNumber('12.5', 0));
eq('finiteNumber-nan', ts.finiteNumber('abc', 7), built.finiteNumber('abc', 7));
eq('stats', ts.stats([1, 2, 3, 4, 5]), built.stats([1, 2, 3, 4, 5]));

// ----- Engine Westgard (đơn mức + đa mức) -----
const isOnAll = () => true;
const pts1 = [{ val: 10 }, { val: 13.1 }, { val: 11.5 }, { val: 11.2 }, { val: 11.8 }];
eq('westgard-basic', ts.westgard(pts1, 10, 1, isOnAll), built.westgard(pts1, 10, 1, isOnAll));
const pts2 = Array.from({ length: 12 }, () => ({ val: 10.3 }));
eq('westgard-10x', ts.westgard(pts2, 10, 1, r => r === '10x'), built.westgard(pts2, 10, 1, r => r === '10x'));
const trend = [9.3, 9.4, 9.6, 9.8, 10.0, 10.2, 10.4, 10.6].map(v => ({ val: v }));
eq('westgard-7T', ts.westgard(trend, 10, 1, r => r === '7T'), built.westgard(trend, 10, 1, r => r === '7T'));

const level1Pts = [
  { val: 11.5, runId: 'r1', date: '2026-07-01' },
  { val: 11.4, runId: 'r2', date: '2026-07-02' },
  { val: 11.6, runId: 'r3', date: '2026-07-03' },
];
const level2Pts = [{ val: 12.6, runId: 'r1', date: '2026-07-01' }];
const levelSets = [
  { level: 1, mean: 10, sd: 1, pts: level1Pts },
  { level: 2, mean: 10, sd: 1, pts: level2Pts },
];
const allMultiPts = [...level1Pts, ...level2Pts];
const tsMulti = ts.westgardMulti(levelSets, isOnAll), builtMulti = built.westgardMulti(levelSets, isOnAll);
eq('westgardMulti', multiSnapshot(tsMulti, allMultiPts), multiSnapshot(builtMulti, allMultiPts));

const byPointPts = [{ val: 100, qcMean: 100, qcSd: 2 }, { val: 101, qcMean: 100, qcSd: 2 }, { val: 102, qcMean: 100, qcSd: 2 }];
eq('westgardByPoint', ts.westgardByPoint(byPointPts, 100, 2, isOnAll), built.westgardByPoint(byPointPts, 100, 2, isOnAll));
eq('westgardLatestRules', ts.westgardLatestRules(byPointPts, 100, 2, isOnAll), built.westgardLatestRules(byPointPts, 100, 2, isOnAll));
eq('westgardLatestRulesFromZ', ts.westgardLatestRulesFromZ([0, 1, 2, 3.5], isOnAll), built.westgardLatestRulesFromZ([0, 1, 2, 3.5], isOnAll));

const mbpLevel1 = [{ val: 11.5, runId: 'r1', date: '2026-07-01' }];
const mbpLevel2 = [{ val: 8, runId: 'r1', date: '2026-07-01' }];
const multiByPointSets = [{ level: 1, mean: 10, sd: 1, pts: mbpLevel1 }, { level: 2, mean: 10, sd: 1, pts: mbpLevel2 }];
const allMbpPts = [...mbpLevel1, ...mbpLevel2];
const tsMbp = ts.westgardMultiByPoint(multiByPointSets, isOnAll), builtMbp = built.westgardMultiByPoint(multiByPointSets, isOnAll);
eq('westgardMultiByPoint', multiSnapshot(tsMbp, allMbpPts), multiSnapshot(builtMbp, allMbpPts));

// ----- CUSUM / xu hướng -----
const cusumPts = [{ val: 10.2 }, { val: 10.4 }, { val: 10.6 }, { val: 10.8 }, { val: 11.0 }];
eq('cusum', ts.cusum(cusumPts, 10, 1), built.cusum(cusumPts, 10, 1));
eq('cusumMovingAverage', ts.cusumMovingAverage(cusumPts, 10, 1, 0.5, 4, 3), built.cusumMovingAverage(cusumPts, 10, 1, 0.5, 4, 3));
eq('movingAverage', ts.movingAverage(cusumPts, 10, 1, 3), built.movingAverage(cusumPts, 10, 1, 3));
eq('pointTarget', ts.pointTarget({ val: 12, qcMean: 10, qcSd: 1 }, 100, 10), built.pointTarget({ val: 12, qcMean: 10, qcSd: 1 }, 100, 10));
eq('pointZ', ts.pointZ({ val: 12 }, 10, 1), built.pointZ({ val: 12 }, 10, 1));

// ----- Sigma / MU -----
eq('erf', ts.erf(1.2), built.erf(1.2));
eq('normalCdf', ts.normalCdf(1.5), built.normalCdf(1.5));
eq('dpmoFromSigma', ts.dpmoFromSigma(4), built.dpmoFromSigma(4));
eq('sigmaMetric', ts.sigmaMetric(10, 2, 2), built.sigmaMetric(10, 2, 2));
eq('systematicShiftCritical', ts.systematicShiftCritical(10, 2, 2), built.systematicShiftCritical(10, 2, 2));
eq('westgardSigmaRules', ts.westgardSigmaRules(4.2), built.westgardSigmaRules(4.2));
eq('targetFromLimits', ts.targetFromLimits(8, 12, 2), built.targetFromLimits(8, 12, 2));
eq('limitsFromTarget', ts.limitsFromTarget(10, 1, 2), built.limitsFromTarget(10, 1, 2));
eq('uncertaintyBudget-full', ts.uncertaintyBudget({ cv: 2.1, bias: 1.2, biasRefU: 0.3, uCal: 0.5, tea: 6, target: 100 }), built.uncertaintyBudget({ cv: 2.1, bias: 1.2, biasRefU: 0.3, uCal: 0.5, tea: 6, target: 100 }));
eq('uncertaintyBudget-missing', ts.uncertaintyBudget({ cv: 2.1 }), built.uncertaintyBudget({ cv: 2.1 }));

// ----- Ngữ nghĩa luật (hành động + phạm vi) -----
eq('ruleEnabled', ts.ruleEnabled({ '6x': false }, '6x'), built.ruleEnabled({ '6x': false }, '6x'));
eq('defaultRuleAction', ts.defaultRuleAction('6x', true), built.defaultRuleAction('6x', true));
eq('resolveRuleAction', ts.resolveRuleAction('6x', true, 'reject'), built.resolveRuleAction('6x', true, 'reject'));
eq('defaultRuleScope-2level', ts.defaultRuleScope('4-1s', 2), built.defaultRuleScope('4-1s', 2));
eq('defaultRuleScope-1level', ts.defaultRuleScope('4-1s', 1), built.defaultRuleScope('4-1s', 1));
eq('resolveRuleScope', ts.resolveRuleScope('4-1s', 2, 'across'), built.resolveRuleScope('4-1s', 2, 'across'));
eq('ruleOnInScope', ts.ruleOnInScope('4-1s', 2, null, 'reject', 'within'), built.ruleOnInScope('4-1s', 2, null, 'reject', 'within'));
eq('ruleVerdictLevel', ts.ruleVerdictLevel(['6x', '1-3s'], r => (r === '1-3s' ? 'reject' : 'alert')), built.ruleVerdictLevel(['6x', '1-3s'], r => (r === '1-3s' ? 'reject' : 'alert')));

// ----- Phân loại sai số -----
eq('primaryErrorRule', ts.primaryErrorRule(['6x', '1-3s']), built.primaryErrorRule(['6x', '1-3s']));
eq('errorType', ts.errorType(['6x']), built.errorType(['6x']));
eq('fixHint', ts.fixHint(['1-3s']), built.fixHint(['1-3s']));

// ----- Nhật ký kiểm toán (hash chain) -----
eq('auditCanonical', ts.auditCanonical({ b: 1, a: [1, 2, { c: 3 }] }), built.auditCanonical({ b: 1, a: [1, 2, { c: 3 }] }));
eq('auditSha256', ts.auditSha256('hello world'), built.auditSha256('hello world'));
const auditEntry = { type: 'login', user: 'admin', prevHash: 'abc' };
const tsHash = ts.auditEntryHash(auditEntry), builtHash = built.auditEntryHash(auditEntry);
eq('auditEntryHash', tsHash, builtHash);
const chain = [{ ...auditEntry, hash: tsHash }];
eq('verifyAuditChain', ts.verifyAuditChain(chain, 'abc'), built.verifyAuditChain(chain, 'abc'));

// ----- Backup: validate + sanitize -----
const sampleState = {
  lab: { name: 'Lab <A>' },
  tests: [{ id: 'T1', name: 'Glucose', levels: [{ level: 1, mean: 10, sd: 1, qcLotId: 'LOT1', lot: 'L1' }] }],
  data: { T1: [{ id: 'P1', date: '2026-07-01', level: 1, val: '10.5', runId: 'r1' }] },
  actions: [], activity: [], users: [{ id: 'U1', username: 'admin', role: 'admin', passHash: 'x' }],
};
const tsSanitized = ts.sanitizeBackup(sampleState), builtSanitized = built.sanitizeBackup(sampleState);
eq('sanitizeBackup', tsSanitized, builtSanitized);
eq('validateBackup', ts.validateBackup(sampleState), built.validateBackup(sampleState));
eq('validateStateInvariants', ts.validateStateInvariants(tsSanitized, { sanitized: true }), built.validateStateInvariants(builtSanitized, { sanitized: true }));

console.log(JSON.stringify({ checked, mismatches }));
`;

const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'không thể chạy đối chiếu qc-core.ts với assets/core.js đã build');
const output = JSON.parse(result.stdout.trim().split('\n').pop());
assert.ok(output.checked > 40, `phải đối chiếu đủ số hàm đại diện, chỉ chạy ${output.checked}`);
assert.deepEqual(output.mismatches, [], 'src/domain/core/qc-core.ts lệch với assets/core.js đã build — chạy `npm run build:core` (hoặc build:pilot) rồi thử lại');

console.log('QC core TypeScript↔build parity tests passed (' + output.checked + ' checks)');
