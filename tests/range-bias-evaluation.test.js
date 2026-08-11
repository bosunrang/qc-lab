'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'domain', 'qc', 'range-safety-gate.ts')).href;
const program = `
  import { rangeBiasEvaluation, rangeSafetyGate } from ${JSON.stringify(source)};
  let criticalCalls = 0;
  const critical = (tea, bias, sd) => { criticalCalls++; return { dSEcrit: tea + bias, dREcrit: sd }; };
  const missingTea = rangeBiasEvaluation(0, 1, 2, critical);
  const atThreshold = rangeBiasEvaluation(20, 5, 3, critical);
  const aboveThreshold = rangeBiasEvaluation(20, -5.1, 4, critical);
  const invalidBias = rangeBiasEvaluation(20, 'khong-hop-le', 4, critical);
  console.log(JSON.stringify({ missingTea, atThreshold, aboveThreshold, invalidBias, criticalCalls,
    noNce: rangeSafetyGate(null, 20, false, 99),
    accepted: rangeSafetyGate({ id: 'nce-1' }, 20, true, -5),
    rejected: rangeSafetyGate({ id: 'nce-1' }, 20, true, 5.01),
  }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'không thể chạy mô-đun TypeScript range-safety-gate');
const output = JSON.parse(result.stdout);

assert.deepEqual(output.missingTea, { threshold: null, valid: true, withinThreshold: false, critical: null },
  'không có TEa hợp lệ thì không được tạo ngưỡng hoặc số tham khảo');
assert.deepEqual(output.atThreshold, { threshold: 5, valid: true, withinThreshold: true, critical: { dSEcrit: 25, dREcrit: 3 } },
  'Bias bằng đúng TEa/4 vẫn đạt và phải giữ số tham khảo từ dependency');
assert.deepEqual(output.aboveThreshold, { threshold: 5, valid: true, withinThreshold: false, critical: { dSEcrit: 14.9, dREcrit: 4 } },
  'Bias vượt ngưỡng vẫn phải trả số tham khảo, nhưng không được đạt cổng');
assert.deepEqual(output.invalidBias, { threshold: 5, valid: false, withinThreshold: false, critical: null },
  'Bias không phải số không được gọi công thức dịch chuyển hệ thống');
assert.equal(output.criticalCalls, 2, 'chỉ Bias hữu hạn có TEa hợp lệ mới gọi công thức tham khảo');
assert.deepEqual(output.noNce, { needed: false, threshold: null, passes: true },
  'không có NCE hệ thống thì không áp thêm cổng mean-chasing');
assert.deepEqual(output.accepted, { needed: true, threshold: 5, passes: true });
assert.deepEqual(output.rejected, { needed: true, threshold: 5, passes: false });

console.log('Range Bias evaluation TypeScript tests passed');
