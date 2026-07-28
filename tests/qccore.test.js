const assert = require('node:assert/strict');
const QCCore = require('../assets/core.js');
assert.ok(QCCore.WG_DEFAULT_ON.has('6x'), '6x phải được bật trong bộ Westgard mặc định');

function close(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

{
  const s = QCCore.stats([1, 2, 3]);
  assert.equal(s.n, 3);
  close(s.m, 2);
  close(s.sd, 1);
  close(s.cv, 50);
}

{
  const s = QCCore.stats([-4, -5, -6]);
  close(s.m, -5);
  close(s.sd, 1);
  close(s.cv, 20);
}

{
  const target = QCCore.targetFromLimits(8, 12, 2);
  assert.deepEqual(target, { low: 8, high: 12, mean: 10, sd: 1, k: 2 });
  const limits = QCCore.limitsFromTarget(10, 1, 2);
  assert.deepEqual(limits, { mean: 10, sd: 1, low: 8, high: 12, k: 2 });
}

{
  const wg = QCCore.westgard([{ val: 10 }, { val: 13.1 }], 10, 1, () => true);
  assert.equal(wg.F[1].level, 'rej');
  assert.ok(wg.F[1].rules.includes('1-3s'));
}

{
  const wg = QCCore.westgard([{ val: 12.1 }, { val: 12.2 }], 10, 1, () => true);
  assert.equal(wg.F[0].level, 'warn');
  assert.equal(wg.F[1].level, 'rej');
  assert.ok(wg.F[0].supportRules.includes('2-2s'));
  assert.ok(wg.F[1].rules.includes('2-2s'));
}

{ // 3-1s: 3 điểm liên tiếp cùng >1SD (không chạm 2s nên chỉ 3-1s)
  const wg = QCCore.westgard([{ val: 11.5 }, { val: 11.2 }, { val: 11.8 }], 10, 1, r => r === '3-1s');
  assert.ok([0, 1].every(i => wg.F[i].supportRules.includes('3-1s')));
  assert.ok(wg.F[2].rules.includes('3-1s'));
  assert.equal(wg.F[2].level,'rej');
}

{ // 4-1s: 4 điểm liên tiếp cùng >1SD
  const wg = QCCore.westgard([{ val: 11.2 }, { val: 11.3 }, { val: 11.4 }, { val: 11.5 }], 10, 1, r => r === '4-1s');
  assert.ok([0, 1, 2].every(i => wg.F[i].supportRules.includes('4-1s')));
  assert.ok(wg.F[3].rules.includes('4-1s'));
}

{ // 10x: 10 điểm cùng phía trung bình
  const pts = Array.from({ length: 10 }, () => ({ val: 10.3 }));
  const wg = QCCore.westgard(pts, 10, 1, r => r === '10x');
  assert.ok(wg.F.slice(0,-1).every(f => f.supportRules.includes('10x')));
  assert.ok(wg.F[9].rules.includes('10x'));
}

{ // Chuỗi dài hơn cửa sổ: các điểm nối dài vẫn phải được gắn luật.
  const pts = Array.from({ length: 15 }, () => ({ val: 10.3 }));
  const wg = QCCore.westgard(pts, 10, 1, r => r === '10x');
  assert.ok(wg.F.slice(0,9).every(f => f.supportRules.includes('10x')));
  assert.ok(wg.F.slice(9).every(f => f.rules.includes('10x')));
}

{ // westgardMulti 3-1s: 3 run liên tiếp cùng >1SD (mỗi run 1 level)
  const pts = [
    { val: 11.5, runId: 'r1', date: '2026-07-01' },
    { val: 11.4, runId: 'r2', date: '2026-07-02' },
    { val: 11.6, runId: 'r3', date: '2026-07-03' }
  ];
  const flags = QCCore.westgardMulti([{ level: 1, mean: 10, sd: 1, pts }], r => r === '3-1s');
  assert.equal(pts.filter(p => (flags.get(p) || []).includes('3-1s')).length, 1);
  assert.equal(pts.filter(p => (flags.support.get(p) || []).includes('3-1s')).length, 2);
}

{ // westgardMulti 2-2s: 2 level cùng >2SD trong CÙNG run → 2-2s
  const p1 = { val: 12.5, runId: 'r1', date: '2026-07-01' };
  const p2 = { val: 12.6, runId: 'r1', date: '2026-07-01' };
  const flags = QCCore.westgardMulti(
    [{ level: 1, mean: 10, sd: 1, pts: [p1] }, { level: 2, mean: 10, sd: 1, pts: [p2] }],
    r => r === '2-2s'
  );
  assert.ok((flags.get(p1) || []).includes('2-2s'));
  assert.ok((flags.get(p2) || []).includes('2-2s'));
}

{ // westgardMulti R4s: 1 level cao 1 level thấp trong cùng run, khoảng >4SD
  const p1 = { val: 13, runId: 'r1', date: '2026-07-01' };
  const p2 = { val: 7, runId: 'r1', date: '2026-07-01' };
  const flags = QCCore.westgardMulti(
    [{ level: 1, mean: 10, sd: 1, pts: [p1] }, { level: 2, mean: 10, sd: 1, pts: [p2] }],
    r => r === 'R4s'
  );
  assert.ok((flags.get(p1) || []).includes('R4s'));
  assert.ok((flags.get(p2) || []).includes('R4s'));
}

{ // NEGATIVE: 2 điểm >2SD ở 2 run khác nhau (mỗi run 1 level) KHÔNG phải 2-2s —
  // multi chỉ xét 2-2s chéo level trong cùng run, không xét liên tiếp qua run
  const p1 = { val: 12.5, runId: 'r1', date: '2026-07-01' };
  const p2 = { val: 12.6, runId: 'r2', date: '2026-07-02' };
  const flags = QCCore.westgardMulti([{ level: 1, mean: 10, sd: 1, pts: [p1, p2] }], r => r === '2-2s');
  assert.ok(!(flags.get(p1) || []).includes('2-2s'));
  assert.ok(!(flags.get(p2) || []).includes('2-2s'));
}

{ // 6x và 12x (đầu và cuối họ Nx): N điểm cùng phía
  const wg6 = QCCore.westgard(Array.from({ length: 6 }, () => ({ val: 10.3 })), 10, 1, r => r === '6x');
  assert.ok(wg6.F.slice(0,-1).every(f => f.supportRules.includes('6x')));
  assert.ok(wg6.F[5].rules.includes('6x'));
  const wg12 = QCCore.westgard(Array.from({ length: 12 }, () => ({ val: 9.7 })), 10, 1, r => r === '12x');
  assert.ok(wg12.F.slice(0,-1).every(f => f.supportRules.includes('12x')));
  assert.ok(wg12.F[11].rules.includes('12x'));
}

{ // Nx: một điểm rơi đúng Mean (z=0) cắt đứt chuỗi cùng phía → không có 6x
  const vals = [10.3, 10.3, 10.0, 10.3, 10.3, 10.3];
  const wg = QCCore.westgard(vals.map(v => ({ val: v })), 10, 1, r => r === '6x');
  assert.ok(wg.F.every(f => !f.rules.includes('6x')));
}

{ // 7T: 7 bước tăng dần cần 8 điểm; 7 điểm hoặc plateau → KHÔNG phải trend
  const seven = [9.3, 9.4, 9.6, 9.8, 10.0, 10.2, 10.4].map(v => ({ val: v }));
  assert.ok(QCCore.westgard(seven,10,1,r=>r==='7T').F.every(f=>!f.rules.includes('7T')));
  const up = [...seven, { val: 10.6 }];
  const trend=QCCore.westgard(up,10,1,r=>r==='7T');
  assert.ok(trend.F.slice(0,-1).every(f=>f.supportRules.includes('7T')));
  assert.ok(trend.F[7].rules.includes('7T'));
  const flat = [9.2, 9.4, 9.6, 9.8, 9.8, 10.0, 10.2, 10.4].map(v => ({ val: v }));
  assert.ok(QCCore.westgard(flat, 10, 1, r => r === '7T').F.every(f => !f.rules.includes('7T')));
}

{ // 7T quét trên z nhưng reset TƯỜNG MINH khi target snapshot đổi. Ca này cố ý
  // làm z vẫn tăng nghiêm ngặt qua ranh giới target để chứng minh không thể dựa
  // vào việc z "tự reset"; engine đầy đủ và fast path phải cùng không báo 7T.
  const pts = [
    { val: 100, qcMean: 100, qcSd: 2 }, // z: 0, 0.5, 1
    { val: 101, qcMean: 100, qcSd: 2 },
    { val: 102, qcMean: 100, qcSd: 2 },
    { val: 203, qcMean: 200, qcSd: 2 }, // z tiếp tục: 1.5, 2, 2.5, 3, 3.5
    { val: 204, qcMean: 200, qcSd: 2 },
    { val: 205, qcMean: 200, qcSd: 2 },
    { val: 206, qcMean: 200, qcSd: 2 },
    { val: 207, qcMean: 200, qcSd: 2 },
  ];
  const wg = QCCore.westgardByPoint(pts, 100, 2, r => r === '7T');
  assert.ok(wg.F.every(f => !f.rules.includes('7T')), 'đổi target giữa cửa sổ phải cắt đứt 7T');
  assert.deepEqual(QCCore.westgardLatestRules(pts, 100, 2, r => r === '7T'), [], 'fast path phải khớp engine chính');
  // Cùng chuỗi đó nhưng target thống nhất → z tăng đều → 7T vẫn bắt đúng.
  const steady = pts.map(p => ({ val: p.val, qcMean: 100, qcSd: 2 }));
  assert.ok(QCCore.westgardByPoint(steady, 100, 2, r => r === '7T').F[7].rules.includes('7T'), 'target thống nhất vẫn bắt 7T bình thường');

  const sdChanged = Array.from({ length: 8 }, (_, i) => ({ val: i, qcMean: 0, qcSd: i < 4 ? 1 : 2 }));
  assert.ok(QCCore.westgardByPoint(sdChanged, 0, 1, r => r === '7T').F.every(f => !f.rules.includes('7T')), 'đổi SD cũng phải cắt đứt 7T');
  assert.deepEqual(QCCore.westgardLatestRules(sdChanged, 0, 1, r => r === '7T'), [], 'fast path phải reset khi SD đổi');

  const missing = Array.from({ length: 8 }, (_, i) => ({ val: i }));
  assert.ok(QCCore.westgardByPoint(missing, NaN, NaN, r => r === '7T').F.every(f => !f.rules.includes('7T')), 'thiếu Mean/SD không được tạo 7T');
}

{ // 2of3-2s single-track: 2 trong 3 điểm cùng phía >2SD → đánh dấu đúng 2 điểm đó
  const wg = QCCore.westgard([{ val: 12.5 }, { val: 10 }, { val: 12.6 }], 10, 1, r => r === '2of3-2s');
  assert.ok(wg.F[0].supportRules.includes('2of3-2s'));
  assert.ok(!wg.F[1].rules.includes('2of3-2s'));
  assert.ok(wg.F[2].rules.includes('2of3-2s'));
}

{ // 2of3-2s KHÔNG được reject "dội" theo cửa sổ trôi: sau 2 điểm vi phạm cũ, điểm
  // hoàn toàn bình thường (trong ±2SD) trôi vào cùng cửa sổ 3 điểm không được tự
  // động bị loại — điểm mới nhất phải TỰ vượt ±2SD mới được tính vào rule này.
  const wg = QCCore.westgard([{ val: 10 }, { val: 12.5 }, { val: 12.5 }, { val: 10.3 }, { val: 10.2 }], 10, 1, r => r === '2of3-2s');
  assert.equal(wg.F[2].level, 'rej');
  assert.ok(wg.F[2].rules.includes('2of3-2s'));
  assert.equal(wg.F[3].level, 'ok', 'điểm bình thường không được reject chỉ vì 2 vi phạm cũ còn trong cửa sổ');
  assert.ok(!wg.F[3].rules.includes('2of3-2s'));
  const latest = QCCore.westgardLatestRulesFromZ([0, 2.5, 2.5, 0.3], r => r === '2of3-2s');
  assert.ok(!latest.includes('2of3-2s'), 'westgardLatestRulesFromZ phải khớp hành vi với westgard()');
}

{ // BIÊN: z đúng bằng 2.0 KHÔNG kích 1-2s; z đúng bằng 3.0 KHÔNG kích 1-3s (so sánh ngặt)
  assert.equal(QCCore.westgard([{ val: 12 }], 10, 1, r => r === '1-2s').F[0].level, 'ok');
  assert.equal(QCCore.westgard([{ val: 13 }], 10, 1, r => r === '1-3s').F[0].level, 'ok');
}

{ // NEGATIVE: 2 điểm >2SD nhưng ngược phía → KHÔNG phải 2-2s (single-track)
  const wg = QCCore.westgard([{ val: 12.5 }, { val: 7.5 }], 10, 1, r => r === '2-2s');
  assert.ok(!wg.F[0].rules.includes('2-2s'));
  assert.ok(!wg.F[1].rules.includes('2-2s'));
}

{ // NEGATIVE: R4s chỉ trong CÙNG run — 1 cao 1 thấp ở 2 run khác nhau không kích R4s
  const p1 = { val: 13, runId: 'r1', date: '2026-07-01' };
  const p2 = { val: 7, runId: 'r2', date: '2026-07-02' };
  const flags = QCCore.westgardMulti([{ level: 1, mean: 10, sd: 1, pts: [p1, p2] }], r => r === 'R4s');
  assert.ok(!(flags.get(p1) || []).includes('R4s'));
  assert.ok(!(flags.get(p2) || []).includes('R4s'));
}

{
  const points = [{ val: 12, qcMean: 10, qcSd: 1 }];
  const wg = QCCore.westgardByPoint(points, 100, 10, rule => rule === '1-2s');
  close(wg.zs[0], 2);
  assert.equal(wg.F[0].level, 'ok');
}

{ // Kiểm tra lịch Gregorian không tạo Date object cho từng điểm khi sanitize.
  const cleaned = QCCore.sanitizeBackup({
    lab: {}, tests: [{ id: 'T1', name: 'Date check', levels: [{ level: 1 }] }],
    data: { T1: [
      { id: 'P1', date: '2024-02-29', runId: '2024-02-29-1', level: 1, val: 1 },
      { id: 'P2', date: '2000-02-29', runId: '2000-02-29-1', level: 1, val: 2 },
      { id: 'P3', date: '1900-02-29', runId: '1900-02-29-1', level: 1, val: 3 },
      { id: 'P4', date: '2023-04-31', runId: '2023-04-31-1', level: 1, val: 4 },
    ] }, actions: [], activity: [], users: []
  });
  assert.deepEqual(cleaned.data.T1.map(point => point.id), ['P1', 'P2']);
}

{ // Fast path của điểm cuối phải tương đương tuyệt đối với engine đầy đủ.
  let seed = 0x5eed1234;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
  for (let sample = 0; sample < 300; sample++) {
    const length = 1 + Math.floor(random() * 20);
    const points = Array.from({ length }, (_, i) => {
      const mean = random() < 0.2 ? 98 + random() * 4 : 100;
      const sd = random() < 0.2 ? 1.5 + random() : 2;
      return { val: mean + sd * (random() * 8 - 4), qcMean: mean, qcSd: sd, id: `p${i}` };
    });
    const enabled = new Set(QCCore.WG_RULES.filter(() => random() > 0.35));
    const isOn = rule => enabled.has(rule);
    const full = QCCore.westgardByPoint(points, 100, 2, isOn);
    const expected = full.F[full.F.length - 1].rules;
    assert.deepEqual(QCCore.westgardLatestRules(points, 100, 2, isOn), expected);
  }
}

{
  const metric = QCCore.sigmaMetric(10, 2, 2);
  assert.equal(metric.sigma, 4);
  assert.ok(metric.dpmo > 0);
}

{
  const backup = QCCore.sanitizeBackup({
    lab: { name: 'Lab <A>' },
    tests: [{
      id: 'T1',
      name: 'Glucose',
      ruleScopes: { '6x': 'across', '10x': 'invalid' },
      levels: [{ level: 1, mean: 10, sd: 1, qcLotId: 'LOT1', lot: 'L1' }]
    }],
    data: {
      T1: [
        { id: 'P1', date: '2026-07-01', level: 1, val: '10.5', runId: '2026-07-01-1' },
        { id: 'P2', date: 'bad-date', level: 1, val: '10.6' },
        { id: 'P3', date: '2026-07-02', level: 1, val: 'not-number' }
      ]
    },
    actions: [],
    activity: [],
    users: []
  });
  assert.equal(backup.lab.name, 'Lab ‹A›');
  assert.equal(backup.data.T1.length, 1);
  assert.equal(backup.data.T1[0].val, 10.5);
  assert.equal(backup.tests[0].ruleScopes['6x'], 'across');
  assert.equal(backup.tests[0].ruleScopes['10x'], '');
}

{ // sanitizeBackup: giữ snapshot TEa và metadata nguồn CV của kỳ Sigma
  const b = QCCore.sanitizeBackup({
    lab: {}, tests: [{ id: 'T1', name: 'Glucose', levels: [{ level: 1 }] }], data: {}, actions: [], activity: [], users: [],
    sigmaData: { T1: [{ id: 'S1', period: '2026-07', tea: 6.96, teaSource: 'ricos', teaLabel: 'Ricos', teaReference: 'ref', teaCapturedAt: '2026-07-14T00:00:00.000Z', lv: { 1: { cv: 2.1, cvSource: 'iqc-cohort', n: 24, sourceStart: '2026-07-01', sourceEnd: '2026-07-14', sourceLot: 'L1', cohortStatus: 'provisional', cohortIssues: ['mixed-target-sd','invalid'], sourceExcludedVoided: 2, sourceExcludedInvalid: 1, sourceTargetMean: 100, sourceTargetSd: 2, bias: -1.5, biasSource: 'peer', biasEqaMethod: 'rms', eqaBatchId: 'batch_202607', eqaRounds: [{ lab: 98, target: 100 }, { lab: '', target: 100 }, { lab: 1, target: 0 }], biasIqc: 2.5, biasIqcTargetSource: 'lab' } } }] }
  });
  const e = b.sigmaData.T1[0], L = e.lv['1'];
  assert.equal(e.tea, 6.96);
  assert.equal(e.teaSource, 'ricos');
  assert.equal(e.teaReference, 'ref');
  assert.equal(L.cvSource, 'iqc-cohort');
  assert.equal(L.n, 24);
  assert.equal(L.sourceStart, '2026-07-01');
  assert.equal(L.sourceLot, 'L1');
  assert.equal(L.cohortStatus, 'provisional');
  assert.deepEqual(L.cohortIssues, ['mixed-target-sd']);
  assert.equal(L.sourceExcludedVoided, 2);
  assert.equal(L.sourceExcludedInvalid, 1);
  assert.equal(L.sourceTargetMean, 100);
  assert.equal(L.sourceTargetSd, 2);
  assert.equal(L.biasEqa, -1.5, 'migrate Bias cũ sang Bias EQA/EQC');
  assert.equal(L.bias, undefined, 'không giữ trường Bias cũ');
  assert.equal(L.biasSource, undefined, 'không giữ nguồn Bias Peer/IQC cũ');
  assert.equal(L.biasEqaMethod, 'rms');
  assert.equal(L.eqaBatchId, 'batch_202607');
  assert.deepEqual(L.eqaRounds, [{ lab: 98, target: 100 }], 'chỉ giữ vòng EQA hoàn chỉnh, target khác 0');
  assert.equal(L.biasIqc, undefined);
  assert.equal(L.biasIqcTargetSource, undefined);
}

{ // Firebase RTDB đổi lv có khóa số 1/2 thành mảng thưa; phải giữ nguyên CV/Bias
  const firebaseLevels = [];
  firebaseLevels[1] = { cv: 1.38, cvSource: 'manual', biasEqa: 0.72, biasEqaMethod: 'rms', eqaRounds: [{ lab: 140.2, target: 139.2 }] };
  firebaseLevels[2] = { cv: 0.62, biasEqa: 2.5, biasEqaMethod: 'manual' };
  const b = QCCore.sanitizeBackup({
    lab: {}, tests: [{ id: 'T1', name: 'Sodium', levels: [{ level: 1 }, { level: 2 }] }], data: {}, actions: [], activity: [], users: [],
    sigmaData: { T1: [{ id: 'S1', period: '2026-07', lv: firebaseLevels }] }
  });
  assert.deepEqual(b.sigmaData.T1[0].lv['1'], { cv: 1.38, biasEqa: 0.72, biasEqaMethod: 'rms', cvSource: 'manual', eqaRounds: [{ lab: 140.2, target: 139.2 }] });
  assert.deepEqual(b.sigmaData.T1[0].lv['2'], { cv: 0.62, biasEqa: 2.5, biasEqaMethod: 'manual' });
  assert.equal(Array.isArray(b.sigmaData.T1[0].lv), false, 'sau khi đọc Firebase, lv trở lại object khóa mức');
}

{ // sanitizeBackup: nhánh teaRefs (bảng TEa sửa được)
  const b = QCCore.sanitizeBackup({
    lab: {}, tests: [], data: {}, actions: [], activity: [], users: [],
    teaRefs: [
      { analyteId: 'qclab-ck-mb', name: 'CK-MB', displayName: 'CK-MB', standardName: 'Creatine kinase MB', abbreviation: 'CK-MB', aliases: ['CKMB', '', 123], matrix: 'Huyết thanh/Huyết tương', unit: 'U/L', clia: '25', ricos: 30.06, section: 'Hóa sinh', sources: { clia: { id: 'clia-2024', version: 'CMS-3355-F', document: '42 CFR §493.931', url: 'https://www.ecfr.gov/', effectiveDate: '2024-07-11', reviewedDate: '2026-07-16', reviewedBy: 'Admin', status: 'reviewed' }, ricos: { url: 'javascript:alert(1)', status: 'invalid' } } }, // thiếu id
      { name: 'Bỏ', clia: 0, ricos: -5 },   // clia 0 / ricos âm → null
      { name: '', clia: 5 }                  // thiếu tên → loại
    ]
  });
  assert.equal(b.teaRefs.length, 2, 'mục thiếu tên bị loại');
  assert.ok(b.teaRefs[0].id, 'tự gán id khi thiếu');
  assert.equal(b.teaRefs[0].clia, 25, 'chuỗi số được ép kiểu');
  assert.equal(b.teaRefs[0].ricos, 30.06);
  assert.equal(b.teaRefs[0].analyteId, 'qclab-ck-mb', 'giữ định danh xét nghiệm độc lập với tên');
  assert.equal(b.teaRefs[0].standardName, 'Creatine kinase MB', 'giữ tên chuẩn tách khỏi khóa dữ liệu');
  assert.equal(b.teaRefs[0].matrix, 'Huyết thanh/Huyết tương');
  assert.deepEqual(b.teaRefs[0].aliases, ['CKMB', '123'], 'làm sạch bí danh tìm kiếm');
  assert.equal(b.teaRefs[0].sources.clia.version, 'CMS-3355-F', 'giữ phiên bản nguồn TEa');
  assert.equal(b.teaRefs[0].sources.clia.effectiveDate, '2024-07-11');
  assert.equal(b.teaRefs[0].sources.clia.status, 'reviewed');
  assert.equal(b.teaRefs[0].sources.ricos.url, '', 'chỉ giữ URL nguồn https');
  assert.equal(b.teaRegistryVersion, 1, 'backup cũ được nâng lên registry TEa v1');
  assert.equal(b.teaRefs[1].clia, null, '0 → null');
  assert.equal(b.teaRefs[1].ricos, null, 'số âm → null');
}

{
  const cleaned=QCCore.sanitizeBackup({lotTransitions:[{id:'tr1',panelId:'p1',fromLotId:'old',toLotId:'new',status:'completed'}]});
  assert.equal(cleaned.lotTransitions[0].status,'active','trạng thái Hoàn tất theo dõi cũ được chuyển về Đang chạy song song');
}

{
  const valid = QCCore.sanitizeBackup({
    lab: {},
    tests: [{ id: 'T1', name: 'Glucose', levels: [{ level: 1, mean: 10, sd: 1 }] }],
    data: { T1: [{ id: 'P1', date: '2026-07-01', level: 1, val: 10, runId: '2026-07-01-1' }] },
    actions: [], activity: [], users: [], periodLocks: []
  });
  assert.deepEqual(QCCore.validateStateInvariants(valid), []);
  valid.data.T1.push({ id: 'P1', date: '2026-07-01', level: 1, val: 11, runId: '2026-07-01-2' });
  assert.match(QCCore.validateStateInvariants(valid).join('\n'), /trùng id điểm QC/);
}

{
  const future = {
    schemaVersion: QCCore.STATE_SCHEMA_VERSION + 1,
    lab: {},
    tests: [{ id: 'T1', name: 'Glucose', levels: [{ level: 1 }] }],
    data: {}, actions: [], activity: [], users: []
  };
  assert.match(QCCore.validateBackup(future).join('\n'), /schemaVersion/);
}

{
  // Firebase RTDB lược bỏ mảng/đối tượng rỗng → nhánh vắng mặt phải được coi là rỗng hợp lệ,
  // không được chặn đồng bộ (regression: 'actions phải là mảng.' khi nhật ký cloud trống).
  assert.deepEqual(QCCore.validateBackup({ tests: [], users: [] }), [], 'nhánh vắng mặt = rỗng hợp lệ');
  assert.deepEqual(QCCore.validateBackup({}), [], 'object rỗng (phòng mới/đã xóa hết nhánh) hợp lệ');
  assert.deepEqual(QCCore.validateBackup({ tests: [{ id: 'T1', name: 'Glucose', levels: [{ level: 1 }] }] }), [], 'thiếu actions/data/lab do Firebase lược không phải lỗi');
  // nhưng CÓ mặt mà sai kiểu vẫn phải báo lỗi
  assert.match(QCCore.validateBackup({ actions: 'x' }).join('\n'), /actions phải là mảng/);
  assert.match(QCCore.validateBackup({ lab: [] }).join('\n'), /lab phải là object/);
  assert.match(QCCore.validateBackup({ data: [] }).join('\n'), /data phải là object/);
  assert.deepEqual(QCCore.validateBackup(null), ['Dữ liệu gốc phải là object.']);
  assert.deepEqual(QCCore.validateBackup([]), ['Dữ liệu gốc phải là object.']);
}

{
  const cleaned = QCCore.sanitizeBackup({
    lab: {},
    tests: [{ id: 'T1', name: 'Glucose', levels: [{ level: 1 }] }],
    data: {},
    actions: [{ id: 'AUTO1', testId: 'T1', pointId: 'P1', action: 'Chờ ghi nhận', autoCreated: true }],
    activity: [],
    users: []
  });
  assert.equal(cleaned.actions.length, 0, 'placeholder autoCreated không được tồn tại trong nhật ký khắc phục');
}

{
  const cleaned = QCCore.sanitizeBackup({
    lab: {},tests: [],data: {},activity: [],users: [],
    actions: [{id:'A1',protocolVersion:1,containmentStatus:'held',containmentNote:'Giữ kết quả',qcMaterialStatus:'ok',instrumentStatus:'abnormal',instrumentNote:'Cờ lỗi kim hút',reagentStatus:'ok',calibrationStatus:'na',calibrationNote:'Không có chỉ định',lotToLotStatus:'not-needed',causeCategory:'instrument',cause:'Kim hút bẩn',patientImpact:'none',patientAction:'',unsafe:{html:'<script>'}}]
  });
  const action=cleaned.actions[0];
  assert.equal(action.protocolVersion,1);
  assert.equal(action.instrumentStatus,'abnormal');
  assert.equal(action.causeCategory,'instrument');
  assert.equal(action.patientImpact,'none');
}

{
  const cleaned=QCCore.sanitizeBackup({lab:{},tests:[],data:{},activity:[],users:[],actions:[{id:'NCE1',protocolVersion:2,nceId:'NCE-20260727-A001',eventSource:'iqc',processPhase:'exam',correction:'Dừng trả kết quả',dueDate:'2026-07-30',qcVerdict:'rej',riskSeverity:7,riskOccurrence:2,riskDetectability:1,riskLevel:'high',effectivenessStatus:'effective',effectivenessDate:'2026-07-31',effectivenessNote:'Không tái diễn',effectivenessBy:'QO'}]});
  const action=cleaned.actions[0];
  assert.equal(action.protocolVersion,2);
  assert.equal(action.nceId,'NCE-20260727-A001');
  assert.equal(action.qcVerdict,'rej');
  assert.equal(action.riskSeverity,5,'risk score components are clamped to the 1–5 scale');
  assert.equal(action.effectivenessStatus,'effective');
}

{
  // Chuỗi escalate và lý do trả lại phải sống sót qua backup/đồng bộ, nếu không
  // actionEffectivenessStatus() sẽ khoá lại hồ sơ đã chuyển và lý do trả lại biến mất.
  const cleaned=QCCore.sanitizeBackup({lab:{},tests:[],data:{},activity:[],users:[],actions:[{id:'N1',protocolVersion:2,nceId:'NCE-B',parentNceId:'NCE-A',followUpNceId:'NCE-C',returnNote:'Thiếu bằng chứng hiệu chuẩn',returnBy:'Quản trị',returnAt:'2026-07-27T02:00:00.000Z'}]});
  const action=cleaned.actions[0];
  assert.equal(action.parentNceId,'NCE-A');
  assert.equal(action.followUpNceId,'NCE-C');
  assert.equal(action.returnNote,'Thiếu bằng chứng hiệu chuẩn');
  assert.equal(action.returnBy,'Quản trị');
  assert.equal(action.returnAt,'2026-07-27T02:00:00.000Z');
}

{
  const cleaned=QCCore.sanitizeBackup({lab:{},tests:[{id:'T1',name:'Glucose',levels:[{level:1}]}],data:{T1:[{id:'p1',date:'2026-07-01',level:1,val:10,voided:true,voidKind:'data-entry',voidRequiresRerun:false}]},activity:[],users:[],actions:[]});
  const point=cleaned.data.T1[0];
  assert.equal(point.voidKind,'data-entry');
  assert.equal(point.voidRequiresRerun,false);
}

{
  const cleaned = QCCore.sanitizeBackup({
    lab: {},
    tests: [{ id: 'T1', name: 'Glucose', levels: [{ level: 1 }] }],
    data: {},
    actions: [{ id: 'MEAN1', lot: 'LOT1', rule: 'Cập nhật Mean/SD', action: 'Điện giải · LOT1 · 4 dòng' }],
    activity: [],
    users: []
  });
  assert.equal(cleaned.actions.length, 0, 'thay đổi Mean/SD không được tồn tại trong nhật ký khắc phục');
}

{
  // Westgard Sigma Rules (OPSpecs) — thiết kế QC theo Sigma
  assert.equal(QCCore.westgardSigmaRules(NaN), null);
  assert.equal(QCCore.westgardSigmaRules(undefined), null);
  const s6 = QCCore.westgardSigmaRules(6.2);
  assert.deepEqual(s6.rules, ['1-3s'], '≥6σ chỉ cần 1-3s');
  assert.equal(s6.n, 2); assert.equal(s6.single, true); assert.equal(s6.capable, true);
  const s5 = QCCore.westgardSigmaRules(5);
  assert.deepEqual(s5.rules, ['1-3s','2-2s','R4s','4-1s']); assert.equal(s5.n, 4); assert.equal(s5.single, false);
  const s4 = QCCore.westgardSigmaRules(4);
  assert.ok(s4.rules.includes('8x')); assert.equal(s4.n, 8); assert.equal(s4.capable, true);
  const s3 = QCCore.westgardSigmaRules(3.5);
  assert.ok(s3.rules.includes('6x')); assert.equal(s3.marginal, true); assert.equal(s3.capable, true);
  const sLow = QCCore.westgardSigmaRules(2.4);
  assert.equal(sLow.capable, false, '<3σ: phương pháp không đủ năng lực');
  // biên: đúng bậc σ nguyên
  assert.equal(QCCore.westgardSigmaRules(6).tier, '≥6');
  assert.equal(QCCore.westgardSigmaRules(5.999).rules.length, 4);
  assert.equal(QCCore.westgardSigmaRules(3).capable, true);
  assert.equal(QCCore.westgardSigmaRules(2.999).capable, false);
  // mọi quy tắc gợi ý phải nằm trong bộ WG_RULES của app
  [s6,s5,s4,s3,sLow].forEach(spec => spec.rules.forEach(r => assert.ok(QCCore.WG_RULES.includes(r), r + ' phải là quy tắc hợp lệ')));
}

console.log('QCCore tests passed');
