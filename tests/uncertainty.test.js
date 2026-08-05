/**
 * Độ không đảm bảo đo (MU) — ISO 15189:2022 §7.3.4.
 *
 * Ngân sách MU là con số phòng xét nghiệm CÔNG BỐ ra ngoài, nên hai thứ phải
 * được khoá bằng test chứ không bằng thiện chí:
 *   1. Thành phần CHƯA ĐÁNH GIÁ không bao giờ được ngầm hiểu là 0. Một u(cal)
 *      còn thiếu mà bị coi là 0 sẽ in ra U nhỏ hơn sự thật và không có gì trên
 *      báo cáo cho thấy thành phần đó chưa từng được xét.
 *   2. Màn hình, báo cáo in và Excel phải cùng MỘT phép tính — sgComp() gắn sẵn
 *      r.mu, mọi nơi khác đọc lại đúng object đó thay vì tự nhân chia lại.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSandbox, run } = require('./helpers/sandbox');

const QCCore = require('../assets/core.js');
const near = (actual, expected, tol, msg) => assert.ok(Math.abs(actual - expected) < tol, `${msg} (nhận ${actual}, mong đợi ≈${expected})`);

/* ===== 1. Toán thuần ===== */

assert.equal(QCCore.uncertaintyBudget(), null, 'không có đầu vào thì không có ngân sách');
assert.equal(QCCore.uncertaintyBudget({cv: ''}), null, 'thiếu CV IQC (u(Rw)) thì không tính được MU');
assert.equal(QCCore.uncertaintyBudget({cv: 0}), null, 'CV = 0 không phải một ước lượng độ chụm hợp lệ');
assert.equal(QCCore.uncertaintyBudget({cv: -2}), null, 'CV âm bị loại');

{
  // cv=2, bias=3, u(Cref)=0.5, u(cal)=1.5
  // u(bias) = √(3² + 0.5²) = √9.25 = 3.0413813
  // u_c     = √(2² + 9.25 + 1.5²) = √15.5 = 3.9370039 ; U = 2·u_c = 7.8740079
  const mu = QCCore.uncertaintyBudget({cv: 2, bias: 3, biasRefU: .5, uCal: 1.5});
  assert.equal(mu.k, 2, 'k mặc định là 2 (~95%)');
  assert.equal(mu.uRw, 2);
  near(mu.uBias, 3.0413813, 1e-6, 'u(bias) gộp cả sai số chuẩn của chính ước lượng bias');
  assert.equal(mu.uCal, 1.5);
  near(mu.uc, 3.9370039, 1e-6, 'u_c là căn bậc hai của tổng bình phương');
  near(mu.U, 7.8740079, 1e-6, 'U = k·u_c');
  assert.equal(mu.complete, true);
  assert.deepEqual(mu.missing, []);
  near(mu.shares.uRw + mu.shares.uBias + mu.shares.uCal, 1, 1e-12, 'tỉ trọng phương sai phải cộng đủ 100%');
  near(mu.shares.uBias, 9.25 / 15.5, 1e-12, 'u(bias) chiếm đúng phần phương sai của nó');
}

{
  // Dấu của bias không đổi độ lớn ngân sách: chỉ |bias| mới vào tổng bình phương.
  const plus = QCCore.uncertaintyBudget({cv: 2, bias: 3, uCal: 1});
  const minus = QCCore.uncertaintyBudget({cv: 2, bias: -3, uCal: 1});
  assert.equal(plus.uBias, minus.uBias, 'bias âm và bias dương cho cùng một u(bias)');
  assert.equal(plus.U, minus.U);
}

{
  // Thiếu thành phần: KHÔNG được coi là 0 rồi báo "đủ".
  const noCal = QCCore.uncertaintyBudget({cv: 2, bias: 3});
  assert.equal(noCal.uCal, null, 'chưa nhập CoA thì u(cal) vắng mặt, không phải 0');
  assert.equal(noCal.complete, false);
  assert.deepEqual(noCal.missing, ['u(cal)'], 'ngân sách phải nói rõ thành phần nào còn thiếu');
  near(noCal.uc, Math.sqrt(4 + 9), 1e-12, 'u_c chỉ gộp các thành phần thực sự có');

  const noBias = QCCore.uncertaintyBudget({cv: 2, uCal: 1});
  assert.equal(noBias.uBias, null, 'bật cộng bias nhưng chưa có số liệu EQA thì u(bias) vắng mặt');
  assert.deepEqual(noBias.missing, ['u(bias)'], 'chỉ u(bias) thiếu khi u(cal) đã có');

  const negCal = QCCore.uncertaintyBudget({cv: 2, bias: 3, uCal: -1});
  assert.equal(negCal.uCal, null, 'u(cal) âm là dữ liệu hỏng — bị loại chứ không lấy trị tuyệt đối');
  assert.deepEqual(negCal.missing, ['u(cal)']);
}

{
  // u(cal) = 0 là một KẾT LUẬN hợp lệ (CoA công bố không đáng kể), khác hẳn "chưa nhập":
  // nó không góp phương sai nhưng ngân sách vẫn được coi là đủ thành phần.
  const zeroCal = QCCore.uncertaintyBudget({cv: 2, bias: 3, uCal: 0});
  assert.equal(zeroCal.uCal, 0);
  assert.equal(zeroCal.complete, true, 'u(cal)=0 đã là một đánh giá, không phải một chỗ trống');
  assert.equal(zeroCal.shares.uCal, undefined, 'thành phần bằng 0 không xuất hiện trong tỉ trọng phương sai');
  near(zeroCal.uc, Math.sqrt(4 + 9), 1e-12);
}

{
  // Tắt nhánh bias (ISO/TS 20914: độ chệch đã điều tra và hiệu chỉnh).
  const excluded = QCCore.uncertaintyBudget({cv: 2, bias: 3, uCal: 1.5, includeBias: false});
  assert.equal(excluded.includeBias, false);
  assert.equal(excluded.uBias, null);
  assert.equal(excluded.bias, null, 'đã loại thì không giữ lại bias trong ngân sách công bố');
  assert.equal(excluded.complete, true, 'loại bias có chủ đích không phải là thiếu dữ liệu');
  near(excluded.uc, Math.sqrt(4 + 2.25), 1e-12);
}

{
  const k3 = QCCore.uncertaintyBudget({cv: 2, bias: 0, uCal: 0, k: 3});
  near(k3.U, 3 * k3.uc, 1e-12, 'k do người gọi chọn được');
  assert.equal(QCCore.uncertaintyBudget({cv: 2, k: 0}).k, 2, 'k không hợp lệ rơi về mặc định 2');
  assert.equal(QCCore.uncertaintyBudget({cv: 2, k: 'x'}).k, 2);
}

{
  // Quy đổi sang đơn vị đo tại Mean của mức, và so với TEa.
  const mu = QCCore.uncertaintyBudget({cv: 2, bias: 0, uCal: 0, target: 140, tea: 5});
  near(mu.absoluteUc, 140 * 2 / 100, 1e-12, 'u_c tuyệt đối = u_c% × Mean / 100');
  near(mu.absoluteU, 140 * 4 / 100, 1e-12, 'U tuyệt đối theo cùng Mean');
  near(mu.teaRatio, 4 / 5, 1e-12);
  assert.equal(mu.withinTea, true);

  const wide = QCCore.uncertaintyBudget({cv: 4, bias: 0, uCal: 0, tea: 5});
  assert.equal(wide.withinTea, false, 'U = 8% vượt TEa 5% phải được đánh dấu');

  const noTarget = QCCore.uncertaintyBudget({cv: 2, bias: 0, uCal: 0});
  assert.equal(noTarget.absoluteU, null, 'không có Mean thì không bịa ra giá trị tuyệt đối');
  assert.equal(noTarget.teaRatio, null);
  assert.equal(noTarget.withinTea, null, 'không có TEa thì không kết luận trong/ngoài giới hạn');
  assert.equal(QCCore.uncertaintyBudget({cv: 2, target: 0}).target, null, 'Mean = 0 không quy đổi tương đối được');
}

/* ===== 2. Sanitize / backup round-trip ===== */

{
  const dirty = {
    tests: [{id: 'T1', name: 'Glucose', levels: [{level: 1}]}],
    sigmaData: {T1: [{id: 'P1', period: '2026-07', lv: {1: {
      cv: 2, biasEqa: 3,
      uCal: 1.5, uCalBasis: 'CoA calibrator lô 1234 <script>', muBiasMode: 'exclude',
      muReviewedBy: 'KTV A', muReviewedDate: '2026-07-30'
    }}}]}
  };
  const L = QCCore.sanitizeBackup(dirty).sigmaData.T1[0].lv['1'];
  assert.equal(L.uCal, 1.5, 'u(cal) sống sót qua sanitize');
  assert.equal(L.uCalBasis, 'CoA calibrator lô 1234 ‹script›', 'nguồn CoA giữ nội dung nhưng bị vô hiệu hóa dấu đóng/mở thẻ như mọi trường text khác');
  assert.equal(QCCore.sanitizeBackup({
    tests: [{id: 'T1', name: 'G', levels: [{level: 1}]}],
    sigmaData: {T1: [{id: 'P1', period: '2026-07', lv: {1: {cv: 2, uCalBasis: 'x'.repeat(900)}}}]}
  }).sigmaData.T1[0].lv['1'].uCalBasis.length, 500, 'nguồn CoA bị cắt ở 500 ký tự');
  assert.equal(L.muBiasMode, 'exclude');
  assert.equal(L.muReviewedBy, 'KTV A');
  assert.equal(L.muReviewedDate, '2026-07-30');
}

{
  const bad = {
    tests: [{id: 'T1', name: 'Glucose', levels: [{level: 1}]}],
    sigmaData: {T1: [{id: 'P1', period: '2026-07', lv: {1: {
      cv: 2, uCal: -3, muBiasMode: 'whatever', muReviewedDate: '2026-02-30'
    }}}]}
  };
  const L = QCCore.sanitizeBackup(bad).sigmaData.T1[0].lv['1'];
  assert.ok(!('uCal' in L), 'u(cal) âm bị bỏ hẳn, không kẹp về 0 (0 mang nghĩa "đã đánh giá, không đáng kể")');
  assert.ok(!('muBiasMode' in L), 'chế độ bias lạ bị loại, để sgMuBiasMode() rơi về mặc định an toàn "include"');
  assert.ok(!('muReviewedDate' in L), 'ngày rà soát không tồn tại bị loại');
}

{
  const zero = {
    tests: [{id: 'T1', name: 'Glucose', levels: [{level: 1}]}],
    sigmaData: {T1: [{id: 'P1', period: '2026-07', lv: {1: {cv: 2, uCal: 0}}}]}
  };
  assert.equal(QCCore.sanitizeBackup(zero).sigmaData.T1[0].lv['1'].uCal, 0, 'u(cal)=0 phải qua được sanitize — nếu rơi mất thì một CoA "không đáng kể" biến thành "chưa đánh giá"');
}

/* ===== 3. Nối vào trang Sigma ===== */

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/sigma-cohort-service.js', 'modules/sigma-ui-state.js', 'modules/sigma.js']);

assert.equal(ctx.sgMuDominant({shares: {uRw: .1, uBias: .8, uCal: .1}}), 'u(bias) chiếm 80%', 'thành phần trội được nêu tên để biết đi sửa cái gì trước');
assert.equal(ctx.sgMuDominant({shares: {uRw: .4, uBias: .35, uCal: .25}}), '', 'ba thành phần xấp xỉ nhau thì không gợi ý sai một "thủ phạm"');
assert.equal(ctx.sgMuDominant({shares: {uRw: 1}}), '', 'ngân sách chỉ có một thành phần thì "chiếm 100%" là thông tin rỗng');
assert.equal(ctx.sgMuDominant(null), '');

assert.equal(ctx.sgMuBiasMode({}), 'include', 'mặc định là CỘNG u(bias) — bỏ bias phải là lựa chọn có ý thức');
assert.equal(ctx.sgMuBiasMode({muBiasMode: 'exclude'}), 'exclude');
assert.equal(ctx.sgMuBiasMode({muBiasMode: 'rubbish'}), 'include');
assert.equal(ctx.sgMuBiasMode(null), 'include');

{
  // 3 vòng EQA quanh target 100 → bias 2%, 4%, -1%.
  // SD (n-1) = 2.5166115 → u(Cref) = SD/√3 = 1.4529663
  const rounds = [{lab: 102, target: 100}, {lab: 104, target: 100}, {lab: 99, target: 100}];
  near(ctx.sgBiasRefU(rounds), 1.4529663, 1e-6, 'u(Cref) là sai số chuẩn của trung bình các vòng EQA');
  assert.equal(ctx.sgBiasRefU([{lab: 102, target: 100}]), null, 'một vòng duy nhất không có độ phân tán để ước lượng u(Cref)');
  assert.equal(ctx.sgBiasRefU([]), null);
  assert.equal(ctx.sgBiasRefU(undefined), null);
  assert.equal(ctx.sgBiasRefU([{lab: 'x', target: 100}, {lab: 102, target: 0}]), null, 'vòng không hợp lệ bị loại trước khi ước lượng độ phân tán');
}

{
  const out = run(ctx, `(function(){
    state.tests=[{id:'T1',name:'Sodium',unit:'mmol/L',levels:[{level:1,mean:140,sd:2.8}]}];
    state.sigmaData={T1:[{id:'P1',period:'2026-07',teaSource:'ricos',lv:{1:{
      cv:2,biasEqa:2.6457513,biasEqaMethod:'rms',
      eqaRounds:[{lab:102,target:100},{lab:104,target:100},{lab:99,target:100}],
      uCal:1.5,tea:5,sourceTargetMean:140,cvSource:'iqc-cohort',n:40,sourceLot:'L1'
    }}}]};
    const t=state.tests[0],e=state.sigmaData.T1[0];
    const mu=sgMU(t,e,1),r=sgComp(t,e,1);
    return{mu,fromComp:r&&r.mu,muBiasMode:r&&r.muBiasMode};
  })()`);
  // Bias RMS 2.6457513 (=√7), u(Cref) 1.4529663 → u(bias)=√(7+2.1111111)=√9.1111111=3.0184617
  // u_c = √(2² + 9.1111111 + 1.5²) = √15.3611111 = 3.9193253 ; U = 7.8386506
  near(out.mu.uRw, 2, 1e-9, 'u(Rw) lấy thẳng CV IQC của mức');
  near(out.mu.uBias, 3.0184617, 1e-6, 'u(bias) gộp Bias RMS đã lưu với u(Cref) tính lại từ chính các vòng EQA');
  near(out.mu.uCal, 1.5, 1e-9);
  near(out.mu.uc, 3.9193253, 1e-6);
  near(out.mu.U, 7.8386506, 1e-6);
  near(out.mu.absoluteU, 140 * 7.8386506 / 100, 1e-4, 'U quy về đơn vị đo tại Mean của mức');
  near(out.mu.teaRatio, 7.8386506 / 5, 1e-6, 'TEa lấy từ snapshot đã chốt của mức');
  assert.equal(out.mu.complete, true);
  assert.equal(out.muBiasMode, 'include');
  assert.deepEqual(out.fromComp, out.mu, 'sgComp() phải trả về ĐÚNG ngân sách mà sgMU() tính — báo cáo in và màn hình không được rẽ hai nhánh tính toán');
}

{
  // Mức có CV nhưng chưa có Bias: sgComp() trả null (không ra Sigma) mà MU vẫn phải
  // lập được, kèm cờ thiếu — đây chính là trạng thái đánh giá viên cần nhìn thấy.
  const out = run(ctx, `(function(){
    state.tests=[{id:'T2',name:'Urea',levels:[{level:1,mean:5,sd:.2}]}];
    state.sigmaData={T2:[{id:'P2',period:'2026-07',teaSource:'ricos',lv:{1:{cv:3,tea:15,sourceTargetMean:5}}}]};
    const t=state.tests[0],e=state.sigmaData.T2[0];
    return{comp:sgComp(t,e,1),mu:sgMU(t,e,1)};
  })()`);
  assert.equal(out.comp, null, 'thiếu Bias thì không có Sigma');
  assert.ok(out.mu, 'nhưng vẫn phải có ngân sách MU');
  assert.equal(out.mu.complete, false);
  assert.equal(out.mu.missing.join(', '), 'u(bias), u(cal)');
  near(out.mu.uc, 3, 1e-12, 'ngân sách hở chỉ gồm u(Rw)');
}

{
  // Loại bias ở mức dữ liệu phải thực sự đổi ngân sách, không chỉ đổi nhãn.
  const out = run(ctx, `(function(){
    state.tests=[{id:'T3',name:'Kali',levels:[{level:1,mean:4,sd:.1}]}];
    state.sigmaData={T3:[{id:'P3',period:'2026-07',teaSource:'ricos',lv:{1:{cv:2,biasEqa:3,uCal:1.5,tea:8,sourceTargetMean:4,muBiasMode:'exclude'}}}]};
    const t=state.tests[0],e=state.sigmaData.T3[0];
    return sgMU(t,e,1);
  })()`);
  assert.equal(out.includeBias, false);
  near(out.uc, Math.sqrt(4 + 2.25), 1e-12, 'chọn "đã hiệu chỉnh" thì u(bias) không còn trong tổng bình phương');
}

/* ===== 4. Quy ước giao diện và báo cáo ===== */

const sigmaSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'sigma.js'), 'utf8');
const reportsSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'reports.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'core.js'), 'utf8');

assert.match(sigmaSrc, /<details class="panel sg-collapse-panel sg-mu-panel"><summary class="sg-collapse-summary"><span>Độ không đảm bảo đo \(MU\)<\/span><div id="sgMUAction" class="sg-data-head-actions"[^>]*><\/div><\/summary><div id="sgMU">/, 'trang Sigma phải có panel MU riêng (thu gọn được), nút nhập CoA nằm trong header');
assert.match(sigmaSrc, /muBox\.innerHTML=sgMuHTML\(t,selectedRow,levels\)/, 'panel MU phải bám theo ĐÚNG kỳ đang chọn như bảng OPSpecs, không phải kỳ mới nhất');
assert.match(sigmaSrc, /function sgMuApply\(\)[\s\S]{0,80}requireWrite\(\)/, 'ghi ngân sách MU phải qua cổng quyền ghi');
assert.match(sigmaSrc, /logAct\('Cập nhật ngân sách MU'/, 'sửa ngân sách MU phải để lại vết trong nhật ký');
assert.match(sigmaSrc, /function sgMuPreview\([\s\S]{0,400}QCCore\.uncertaintyBudget\(/, 'xem trước trong modal phải gọi lại đúng hàm ngân sách, không tự nhân chia lại');
assert.doesNotMatch(sigmaSrc, /uCal:\s*[^,)]*\|\|\s*0/, 'u(cal) chưa nhập không được ngầm hoá thành 0 trước khi vào ngân sách');
assert.doesNotMatch(coreSrc, /pct\(o\.uCal\)\s*\|\|\s*0/, 'core cũng không được thay u(cal) thiếu bằng 0');

assert.match(reportsSrc, /body\+=sigmaMuPrintCard\(t,row,levels\)/, 'báo cáo Sigma theo kỳ phải kèm bảng công bố MU');
assert.match(reportsSrc, /sigmaMuPeriodsPrintRows\(t,rows,levels\)/, 'báo cáo tổng hợp nhiều kỳ cũng phải có MU');
assert.match(reportsSrc, /\(r&&r\.mu\)\|\|sgMU\(/, 'bản in đọc lại r.mu của sgComp() và chỉ rơi về sgMU() khi mức đó chưa ra Sigma');
assert.match(reportsSrc, /Thiếu '\+esc\(mu\.missing\.join/, 'bản in phải nói rõ thành phần còn thiếu thay vì im lặng in ra một U đẹp');
assert.match(reportsSrc, /MAU\) do SOP của đơn vị ấn định/, 'báo cáo không được tự kết luận đạt/không đạt MU');

console.log('Measurement uncertainty (MU) tests passed');
