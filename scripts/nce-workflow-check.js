// Kiểm chứng vòng đời hồ sơ NCE (trang "Khắc phục sự cố") trong Chromium thật.
//
// Vì sao cần script riêng thay vì thêm test vào `npm test`: cả bốn lỗi script này
// canh đều chỉ lộ ra khi form thật sự được render và render LẠI trong trình duyệt —
// tests/*.test.js chạy trong vm không có DOM nên không thể thấy chúng:
//   1. Form hồ sơ bị xoá trắng sau mỗi rerender() (đổi trang rồi quay lại, hoặc một
//      bản đồng bộ Firebase dội về giữa lúc đang nhập), rồi lần lưu kế tiếp ghi rỗng
//      đè lên checklist/nguyên nhân/hành động đã có.
//   2. Đổi ô "Xét nghiệm" của hồ sơ đang sửa làm actionPoint() trả null, khiến yêu
//      cầu QC chạy lại biến mất và hồ sơ duyệt được mà không có bằng chứng chạy lại.
//   3. Số lô của sự cố bị ghi đè theo lô hiện hành sau mỗi lần chuyển lô.
//   4. Chip "QC đạt lại" chỉ hiện ở mục "Hồ sơ NCE đang mở" chứ không hiện ở mục
//      "Sự cố cần xử lý" — đúng chỗ người dùng nhìn sau khi vừa chạy lại QC.
//   5. Hồ sơ NCE quá hạn không nổi lên dashboard, nên hạn xử lý là trường bắt buộc
//      nhập mà không có hệ quả nào.
//   6. Form bung hết 7 mục ngay từ đầu (2350px) và bắt gõ tay 13 ô — mục 2–8 phải thu
//      gọn sẵn, chip gợi ý phải chèn được và vẫn sửa được sau khi chèn.
//
// Chạy: npm run nce-check   (cần `npm install` + `npx playwright install chromium`)
'use strict';
const { openSeededSession } = require('./lib/seed-browser-session');

const fails = [];
const passes = [];
function check(name, ok, detail = '') {
  if (ok) passes.push(name);
  else fails.push(name + (detail ? ' — ' + detail : ''));
}

// Hồ sơ NCE đầy đủ, gắn với một điểm QC bị loại, dùng làm nền cho phần lớn kiểm tra.
const NCE = {
  id: 'A1', nceId: 'NCE-20260705-T001', protocolVersion: 2, testId: 'T1', level: 1, lot: '1101', pointId: 'T1-L1-3',
  date: '2026-07-05', createdAt: '2026-07-05T01:00:00.000Z', createdByUserId: 'U2', createdByUsername: 'ktv1',
  rule: '1-3s', errorType: 'SE — Sai số hệ thống', eventSource: 'iqc', processPhase: 'exam',
  containmentStatus: 'held', containmentNote: 'Giữ kết quả từ 08:00', correction: 'Dừng trả kết quả liên quan',
  by: 'Kỹ thuật viên', dueDate: '2026-07-12',
  riskSeverity: 4, riskOccurrence: 2, riskDetectability: 3, riskLevel: 'high',
  qcMaterialStatus: 'ok', instrumentStatus: 'abnormal', instrumentNote: 'Kim hút có cặn',
  reagentStatus: 'ok', calibrationStatus: 'ok', lotToLotStatus: 'not-needed',
  causeCategory: 'instrument', cause: 'Kim hút bẩn làm sai thể tích hút', action: 'Vệ sinh kim hút và cập nhật lịch bảo trì',
  patientImpact: 'none', effectivenessStatus: 'pending', approvalStatus: 'pending',
};

const FORM_SNAPSHOT = () => ({
  correction: document.getElementById('aCorrection').value,
  cause: document.getElementById('aCause').value,
  action: document.getElementById('aAct').value,
  containment: document.getElementById('aContainment').value,
  instrument: document.getElementById('aInstrument').value,
  instrumentNote: document.getElementById('aInstrumentNote').value,
  patientAction: document.getElementById('aPatientAction').value,
  rpn: document.getElementById('aRiskScore').textContent,
});

async function checkEditedFormSurvivesRerender(page) {
  await page.evaluate((nce) => { state.actions = [JSON.parse(JSON.stringify(nce))]; go('actions'); }, NCE);
  await page.waitForSelector('.action-form-panel');
  await page.evaluate(() => editAction(0));

  const loaded = await page.evaluate(FORM_SNAPSHOT);
  check('Bấm "Tiếp tục" đổ đủ nội dung hồ sơ vào form',
    loaded.cause === NCE.cause && loaded.action === NCE.action && loaded.instrumentNote === NCE.instrumentNote,
    JSON.stringify(loaded));
  check('RPN được tính sẵn lúc render', loaded.rpn === '24', loaded.rpn);
  check('Ô "Xét nghiệm" bị khoá khi sửa hồ sơ',
    await page.evaluate(() => document.getElementById('aTest').disabled === true));
  check('Ngữ cảnh QC dùng lô đã ghi trong hồ sơ',
    await page.evaluate(() => /1101/.test(document.getElementById('aLevelLabel').value) && /đã ghi nhận/.test(document.getElementById('aLevelLabel').value)));

  await page.evaluate(() => rerender());
  const survived = await page.evaluate(FORM_SNAPSHOT);
  check('Hồ sơ ĐANG SỬA giữ nguyên nội dung qua rerender()',
    JSON.stringify(loaded) === JSON.stringify(survived), JSON.stringify(survived));
}

async function checkIdentityIsImmutable(page) {
  // Dựng hẳn một xét nghiệm thứ hai và thêm option vào select trước khi đổi giá trị —
  // nếu không, gán .value cho một option không tồn tại sẽ bị trình duyệt bỏ qua và
  // phép thử "đổi xét nghiệm" trở thành vô nghĩa (luôn pass dù code có lỗi).
  const setup = await page.evaluate(() => {
    state.tests.push({ id: 'T2', name: 'Potassium (K)', unit: 'mmol/L', machine: 'EasyLyte Expand', levels: [{ level: 2, lot: '9999', mean: 5.7, sd: 0.1 }] });
    const select = document.getElementById('aTest');
    select.disabled = false;
    const opt = document.createElement('option');
    opt.value = 'T2'; opt.textContent = 'Potassium (K)';
    select.appendChild(opt);
    select.value = 'T2';
    document.getElementById('aLevel').value = '2';
    state.tests[0].levels[0].lot = 'LOT-MOI';
    return { selectValue: select.value, lotNow: lvlCfg(state.tests.find(t => t.id === 'T2'), 2).lot };
  });
  check('Phép thử đổi xét nghiệm thực sự đổi được giá trị select',
    setup.selectValue === 'T2' && setup.lotNow === '9999', JSON.stringify(setup));

  const saved = await page.evaluate(async () => {
    await addAction();
    const a = state.actions[0];
    return { testId: a.testId, level: a.level, lot: a.lot, pointId: a.pointId, cause: a.cause, action: a.action };
  });
  check('Đổi dropdown xét nghiệm không đổi được testId của hồ sơ', saved.testId === 'T1', saved.testId);
  check('Liên kết điểm QC (pointId) được giữ nguyên', saved.pointId === NCE.pointId, saved.pointId);
  check('Số lô giữ ảnh chụp lúc xảy ra sự cố', saved.lot === '1101', saved.lot);
  check('Mức QC không bị nhảy', saved.level === 1, String(saved.level));
  check('Nội dung điều tra không bị ghi rỗng khi lưu', saved.cause === NCE.cause && saved.action === NCE.action);
}

// Mục 2–8 mặc định thu gọn; mở bằng cách bấm đúng dải tiêu đề như người dùng thật.
async function openAllSections(page) {
  const closed = await page.$$('details.action-form-section:not([open]) > summary');
  for (const summary of closed) await summary.click();
}

async function checkSectionsStartCollapsed(page) {
  await page.evaluate(() => { state.actions = []; state.tests = state.tests.filter(t => t.id !== 'T2'); state.tests[0].levels[0].lot = '1101'; clearDerived(); cancelActionEdit(); });
  await page.waitForSelector('#aCorrection');
  const shape = await page.evaluate(() => {
    const body = document.querySelector('.action-form-body');
    return {
      collapsed: [...body.querySelectorAll('details.action-form-section')].filter(d => !d.open).length,
      total: body.querySelectorAll('details.action-form-section').length,
      correctionVisible: !!document.getElementById('aCorrection').offsetParent,
      causeVisible: document.getElementById('aCause').checkVisibility(),
      height: Math.round(body.getBoundingClientRect().height),
      summaries: [...body.querySelectorAll('summary .action-chip')].map(c => c.textContent),
    };
  });
  check('Hồ sơ mới: mục 2–8 thu gọn sẵn', shape.collapsed === shape.total && shape.total === 5, JSON.stringify(shape));
  check('Phần tối thiểu (mục 1) vẫn mở sẵn', shape.correctionVisible === true);
  check('Mục điều tra được giấu cho tới khi cần', shape.causeVisible === false);
  // Ngưỡng tương đối, tự hiệu chỉnh: so chính form này lúc thu gọn với lúc bung hết,
  // để check không mục ruỗng khi nội dung form đổi sau này.
  const openHeight = await page.evaluate(() => {
    const body = document.querySelector('.action-form-body');
    body.querySelectorAll('details.action-form-section').forEach(d => { d.open = true; });
    const h = Math.round(body.getBoundingClientRect().height);
    body.querySelectorAll('details.action-form-section').forEach(d => { d.open = false; });
    return h;
  });
  check('Thu gọn cắt được ít nhất 1/3 chiều cao form',
    shape.height < openHeight * 0.67, `thu gọn ${shape.height}px / bung hết ${openHeight}px`);
  check('Dải tóm tắt nêu số mục còn thiếu', shape.summaries.some(t => /Còn thiếu \d+ mục/.test(t)), JSON.stringify(shape.summaries));

  await openAllSections(page);
  const opened = await page.evaluate(() => document.getElementById('aCause').checkVisibility());
  check('Bấm dải tiêu đề mở được mục', opened === true);
  await page.evaluate(() => rerender());
  check('Trạng thái mở/đóng sống sót qua rerender()',
    await page.evaluate(() => document.getElementById('aCause').checkVisibility()));
}

async function checkSuggestionChips(page) {
  await page.selectOption('#aCauseCategory', 'instrument');
  const chips = await page.evaluate(() => [...document.querySelectorAll('#sugg-aCause .sugg-chip')].map(c => c.textContent));
  check('Chip nguyên nhân đổi theo nhóm đã chọn',
    chips.length > 0 && chips.some(c => /kim hút|điện cực|buồng ủ/i.test(c)), JSON.stringify(chips));

  await page.click('#sugg-aCause .sugg-chip');
  const first = await page.evaluate(() => document.getElementById('aCause').value);
  check('Bấm chip là chèn câu vào ô', first.length > 5, first);

  await page.click('#sugg-aCause .sugg-chip:nth-child(2)');
  const second = await page.evaluate(() => document.getElementById('aCause').value);
  check('Chèn tiếp thì nối thêm chứ không đè', second.startsWith(first) && second.length > first.length, second);

  await page.fill('#aCause', first + ' — ghi thêm chi tiết cụ thể');
  check('Chèn xong vẫn sửa tự do được',
    await page.evaluate(() => /ghi thêm chi tiết cụ thể/.test(document.getElementById('aCause').value)));

  await page.selectOption('#aErr', 'RE — Sai số ngẫu nhiên');
  const actChips = await page.evaluate(() => [...document.querySelectorAll('#sugg-aAct .sugg-chip')].map(c => c.textContent));
  check('Chip hành động khắc phục đổi theo loại sai số',
    actChips.some(c => /bọt khí|trộn đều|thao tác/i.test(c)), JSON.stringify(actChips));
}

async function checkPickersReplaceTyping(page) {
  const out = await page.evaluate(() => {
    const rule = document.getElementById('aRule'), by = document.getElementById('aBy');
    return {
      ruleIsSelect: rule.tagName === 'SELECT',
      ruleOptions: [...rule.options].map(o => o.value),
      byHasList: by.getAttribute('list') === 'aByList',
      staffNames: [...document.querySelectorAll('#aByList option')].map(o => o.value),
    };
  });
  check('Luật vi phạm thành dropdown', out.ruleIsSelect === true);
  check('Dropdown liệt kê đủ bộ luật Westgard',
    ['1-2s', '1-3s', '2-2s', 'R4s', '10x'].every(r => out.ruleOptions.includes(r)), JSON.stringify(out.ruleOptions));
  check('Người phụ trách có danh sách nhân viên',
    out.byHasList === true && out.staffNames.length > 0, JSON.stringify(out.staffNames));
}

async function checkNewRecordDraftSurvivesRerender(page) {
  await page.evaluate(() => { state.actions = []; cancelActionEdit(); });
  await page.waitForSelector('#aCorrection');
  await openAllSections(page);
  await page.fill('#aCorrection', 'Dừng trả kết quả và cô lập lô QC');
  await page.selectOption('#aContainment', 'held');
  await page.fill('#aCause', 'Kim hút bẩn làm sai thể tích hút');
  await page.fill('#aAct', 'Vệ sinh kim hút, cập nhật lịch bảo trì');
  await page.selectOption('#aInstrument', 'abnormal');
  await page.fill('#aInstrumentNote', 'Cặn ở kim hút');
  await page.selectOption('#aRiskSeverity', '4');
  await page.selectOption('#aRiskOccurrence', '2');
  await page.selectOption('#aRiskDetectability', '3');
  await page.selectOption('#aRiskLevel', 'high');
  await page.selectOption('#aCauseCategory', 'instrument');
  await page.selectOption('#aPatientImpact', 'none');

  const before = await page.evaluate(FORM_SNAPSHOT);
  await page.evaluate(() => rerender());
  const after = await page.evaluate(FORM_SNAPSHOT);
  check('Hồ sơ MỚI (chưa lưu) giữ nguyên nội dung đang gõ qua rerender()',
    JSON.stringify(before) === JSON.stringify(after) && after.correction.startsWith('Dừng trả'), JSON.stringify(after));

  const saved = await page.evaluate(async () => {
    await addAction();
    const a = (state.actions || [])[0];
    return a ? { n: state.actions.length, correction: a.correction, cause: a.cause, rpn: actionRiskScore(a), instrument: a.instrumentStatus } : null;
  });
  check('Lưu được hồ sơ mới khi đã điền đủ phần tối thiểu',
    saved && saved.n === 1 && saved.correction.startsWith('Dừng trả'), JSON.stringify(saved));
  check('Checklist và đánh giá nguy cơ vào đúng bản ghi',
    saved && saved.rpn === 24 && saved.instrument === 'abnormal', JSON.stringify(saved));
  check('Nháp được dọn sau khi lưu', await page.evaluate(() => document.getElementById('aCorrection').value === ''));
}

async function checkMissingFieldIsPinpointed(page) {
  // Cố tình chỉ để THIẾU "xử lý tức thời": đây là ô hay bị nhầm với "hành động khắc
  // phục" ở mục 4–6, nên phải chắc là thông báo và con trỏ trỏ đúng vào nó.
  await page.selectOption('#aContainment', 'held');
  await page.fill('#aCorrection', '');
  const flagged = await page.evaluate(() => {
    const protocol = readActionProtocolForm();
    const draft = actionDraftStatus({ ...protocol, action: actionFieldValue('aAct'), by: actionFieldValue('aBy') });
    focusActionField((draft.missingKeys || [])[0]);
    return {
      message: draft.missing.join('; '),
      firstKey: (draft.missingKeys || [])[0],
      focused: document.activeElement.id,
      marked: document.getElementById('aCorrection').classList.contains('field-invalid'),
    };
  });
  check('Thông báo thiếu gọi tên đúng ô ở mục 1',
    /mục 1/.test(flagged.message) && flagged.firstKey === 'correction', JSON.stringify(flagged));
  check('Con trỏ nhảy tới ô còn thiếu', flagged.focused === 'aCorrection', flagged.focused);
  check('Ô còn thiếu được tô đỏ', flagged.marked === true);
  await page.fill('#aCorrection', 'Dừng trả kết quả và cô lập lô QC');
  check('Tô đỏ tự gỡ khi bắt đầu sửa',
    await page.evaluate(() => !document.getElementById('aCorrection').classList.contains('field-invalid')));
}

async function checkRerunChipOnBothSurfaces(page) {
  const out = await page.evaluate(() => {
    const t = state.tests[0], lvl = t.levels.find(l => l.level === 2);
    lvl.mean = 5.70; lvl.sd = 0.10;
    state.data[t.id] = (state.data[t.id] || []).filter(p => p.level !== 2).concat([
      { id: 'k1', date: '2026-07-14', runId: '2026-07-14-1', level: 2, lot: lvl.lot, val: 6.10, qcMean: 5.70, qcSd: 0.10 },
      { id: 'k2', date: '2026-07-14', runId: '2026-07-14-2', level: 2, lot: lvl.lot, val: 5.72, qcMean: 5.70, qcSd: 0.10 },
      { id: 'k3', date: '2026-07-14', runId: '2026-07-14-3', level: 2, lot: lvl.lot, val: 5.70, qcMean: 5.70, qcSd: 0.10 },
    ]);
    state.actions = [{
      id: 'R1', nceId: 'NCE-20260714-K001', protocolVersion: 2, testId: t.id, level: 2, lot: lvl.lot, pointId: 'k1',
      date: '2026-07-14', rule: '1-3s', errorType: 'RE — Sai số ngẫu nhiên', qcVerdict: 'rej',
      eventSource: 'iqc', processPhase: 'exam', containmentStatus: 'held', correction: 'Dừng trả kết quả liên quan',
      by: 'Quản trị viên', dueDate: '2099-01-01', effectivenessStatus: 'pending', approvalStatus: 'pending',
    }];
    clearDerived(); go('actions');
    const a = state.actions[0], rr = actionRerunStatus(a), issue = currentIssues().find(o => o.p.id === 'k1');
    const chips = html => [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('.action-chip')].map(c => c.textContent);
    return {
      rerunOk: rr.needed && rr.ok,
      rerunLabel: rr.label,
      issueChips: issue ? chips(issueRowHtml(issue)) : [],
      nceChips: chips(openActionIssueHtml(a, 0)),
    };
  });
  check('Lần QC chạy lại cùng ngày được nhận diện', out.rerunOk && /5\.72/.test(out.rerunLabel), out.rerunLabel);
  check('Chip "QC đạt lại" hiện trên dòng "Sự cố cần xử lý"',
    out.issueChips.some(c => /QC đạt lại/.test(c)), JSON.stringify(out.issueChips));
  check('Chip trên dòng vi phạm và dòng hồ sơ NCE khớp nhau',
    JSON.stringify(out.issueChips) === JSON.stringify(out.nceChips),
    JSON.stringify({ issue: out.issueChips, nce: out.nceChips }));
}

async function checkOverdueAndEscalation(page) {
  const out = await page.evaluate(() => {
    const a = state.actions[0];
    a.dueDate = '2020-01-01';
    rerender();
    const overdue = actionOverdue(a);
    const chips = [...new DOMParser().parseFromString(openActionIssueHtml(a, 0), 'text/html').querySelectorAll('.action-chip')].map(c => c.textContent);
    a.dueDate = '2099-01-01';
    a.effectivenessStatus = 'ineffective';
    const blocked = actionEffectivenessStatus(a);
    const canEscalate = actionCanEscalate(a);
    a.followUpNceId = 'NCE-TIEP-THEO';
    const escalated = actionEffectivenessStatus(a);
    return {
      overdue: overdue.overdue, overdueChip: chips.some(c => /Quá hạn/.test(c)),
      blocked: blocked.complete, canEscalate,
      escalatedComplete: escalated.complete, escalatedLabel: escalated.label,
      stillEscalatable: actionCanEscalate(a),
    };
  });
  check('Hồ sơ quá hạn được nhận diện', out.overdue === true);
  check('Chip "Quá hạn" hiện trên hồ sơ đang mở', out.overdueChip === true);
  check('"Chưa hiệu lực" chặn khép vòng khi chưa chuyển hồ sơ', out.blocked === false);
  check('Có đường mở hồ sơ tiếp theo', out.canEscalate === true);
  check('Đã chuyển hồ sơ thì không còn kẹt', out.escalatedComplete === true && /NCE-TIEP-THEO/.test(out.escalatedLabel), out.escalatedLabel);
  check('Không escalate hai lần cùng một hồ sơ', out.stillEscalatable === false);
}

async function checkOverdueReachesDashboard(page) {
  const out = await page.evaluate(() => {
    const t = state.tests[0];
    state.actions = [
      { id: 'D1', nceId: 'NCE-QUA-HAN', protocolVersion: 2, testId: t.id, level: 1, lot: t.levels[0].lot, pointId: '',
        date: '2026-07-01', rule: '1-3s', errorType: 'SE — Sai số hệ thống', eventSource: 'iqc', processPhase: 'exam',
        containmentStatus: 'held', correction: 'Dừng trả kết quả liên quan', by: 'Kỹ thuật viên', dueDate: '2020-01-01',
        effectivenessStatus: 'pending', approvalStatus: 'pending' },
      { id: 'D2', nceId: 'NCE-CON-HAN', protocolVersion: 2, testId: t.id, level: 1, lot: t.levels[0].lot, pointId: '',
        date: '2026-07-01', rule: '1-2s', errorType: 'SE — Sai số hệ thống', eventSource: 'iqc', processPhase: 'exam',
        containmentStatus: 'held', correction: 'Dừng trả kết quả liên quan', by: 'Kỹ thuật viên', dueDate: '2099-01-01',
        effectivenessStatus: 'pending', approvalStatus: 'pending' },
    ];
    go('dash');
    const main = document.getElementById('main');
    return {
      text: main.innerText,
      hasOverdueRow: /NCE-QUA-HAN/.test(main.innerHTML),
      hasInTimeRow: /NCE-CON-HAN/.test(main.innerHTML),
      opensRecord: /go\('actions'\);editAction\(0\)/.test(main.innerHTML),
    };
  });
  check('Dashboard nêu hồ sơ NCE quá hạn', out.hasOverdueRow === true, out.text.slice(0, 200));
  check('Hồ sơ còn trong hạn không bị báo nhầm', out.hasInTimeRow === false);
  check('Nhãn "Quá hạn N ngày" hiện trên dashboard', /Quá hạn \d+ ngày/.test(out.text));
  check('Câu trạng thái trực ca phản ánh hồ sơ quá hạn', /hồ sơ NCE quá hạn/i.test(out.text), out.text.slice(0, 200));
  check('Nút mở thẳng đúng hồ sơ', out.opensRecord === true);

  const cleared = await page.evaluate(() => { state.actions = []; go('dash'); return document.getElementById('main').innerText; });
  check('Hết hồ sơ quá hạn thì dashboard không còn cảnh báo', !/Quá hạn \d+ ngày/.test(cleared));
}

(async () => {
  const session = await openSeededSession();
  const pageErrors = [];
  session.page.on('pageerror', e => pageErrors.push('pageerror: ' + e.message));
  session.page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });

  try {
    await checkEditedFormSurvivesRerender(session.page);
    await checkIdentityIsImmutable(session.page);
    await checkSectionsStartCollapsed(session.page);
    await checkSuggestionChips(session.page);
    await checkPickersReplaceTyping(session.page);
    await checkNewRecordDraftSurvivesRerender(session.page);
    await checkMissingFieldIsPinpointed(session.page);
    await checkRerunChipOnBothSurfaces(session.page);
    await checkOverdueAndEscalation(session.page);
    await checkOverdueReachesDashboard(session.page);
    check('Không có lỗi console/page', pageErrors.length === 0, pageErrors.join(' | '));
  } catch (err) {
    fails.push('NGOẠI LỆ: ' + err.message);
  }

  try { await session.close(); } catch { /* trình duyệt có thể đã đóng */ }

  passes.forEach(name => console.log('OK   ' + name));
  fails.forEach(name => console.log('FAIL ' + name));
  console.log(`\nnce-workflow-check: ${passes.length} đạt, ${fails.length} lỗi.`);
  process.exit(fails.length ? 1 : 0);
})();
