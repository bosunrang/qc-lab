// Kiểm chứng vòng đời hồ sơ NCE (trang "Khắc phục sự cố") trong Chromium thật.
//
// Vì sao cần script riêng thay vì thêm test vào `npm test`: mọi lỗi script này
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
//   7. Form luôn hiện dù không có sự cố nào, và tự bịa ra xét nghiệm/mức/lô cho hồ sơ
//      nguồn ngoài IQC — kể cả nguồn "Nội kiểm IQC" không gắn điểm QC, vốn là đường
//      vòng né mất rào QC chạy lại.
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

/* Mọi mốc ngày phải so với NGÀY CHẠY, không viết cứng: bản đầu ghi thẳng '29/07/2026'
   và '2026-05-01'/'2026-07-29' nên CI xanh đúng một ngày rồi đỏ mãi từ 30/07/2026 —
   ngày hoàn thành hành động rơi vào TRƯỚC ngày ghi nhận (bị actionMissing() tính là
   còn thiếu) và khoảng KPI 90 ngày trôi đi một ngày. `today` luôn lấy từ isoToday()
   của trang, không phải Date của Node, để khớp múi giờ app đang thấy. */
const shiftIso = (iso, days) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const vnOf = iso => iso.split('-').reverse().join('/');

/* Hồ sơ NCE đầy đủ, gắn với một điểm QC CÓ THẬT trong seed. Lấy id từ seed thay vì
   viết cứng 'T1'/'T1-L1-3': bản trước viết cứng nên bản ghi trỏ vào một xét nghiệm và
   một điểm không tồn tại, khiến mọi khẳng định về liên kết điểm QC đều rỗng ruột. */
function buildNce(seed) {
  const test = seed.tests[0], level = test.levels[0];
  return {
    id: 'A1', nceId: 'NCE-20260705-T001', protocolVersion: 2, testId: test.id, level: level.level, lot: level.lot,
    pointId: seed.data[test.id].filter(p => p.level === level.level)[3].id,
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
}
let NCE = null;

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
    await page.evaluate(lot => /đã ghi nhận/.test(document.getElementById('aLevelLabel').value) && document.getElementById('aLevelLabel').value.includes(lot), NCE.lot));

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
  check('Đổi dropdown xét nghiệm không đổi được testId của hồ sơ', saved.testId === NCE.testId, saved.testId);
  check('Liên kết điểm QC (pointId) được giữ nguyên', saved.pointId === NCE.pointId, saved.pointId);
  check('Số lô giữ ảnh chụp lúc xảy ra sự cố', saved.lot === NCE.lot, saved.lot);
  check('Mức QC không bị nhảy', saved.level === 1, String(saved.level));
  check('Nội dung điều tra không bị ghi rỗng khi lưu', saved.cause === NCE.cause && saved.action === NCE.action);
}

// Mục 2–8 mặc định thu gọn; mở bằng cách bấm đúng dải tiêu đề như người dùng thật.
async function openAllSections(page) {
  const closed = await page.$$('details.action-form-section:not([open]) > summary');
  for (const summary of closed) await summary.click();
}

async function checkSectionsStartCollapsed(page) {
  await page.evaluate(lot => { state.actions = []; state.tests = state.tests.filter(t => t.id !== 'T2'); state.tests[0].levels[0].lot = lot; clearDerived(); closeActionForm(); beginActionManual(); }, NCE.lot);
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
  check('Hồ sơ mới: mục 2–8 thu gọn sẵn', shape.collapsed === shape.total - 1 && shape.total === 6, JSON.stringify(shape));
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
  // Muc 8 khong nam trong checklist khep vong nen khong duoc lay so "con thieu" cua
  // no tu actionProtocolStatus — de nhu vay thi ho so con trang van bao "Da xong".
  check('Mục 8 không báo "Đã xong" khi chưa đánh giá hiệu lực',
    !/Đã xong/.test(shape.summaries[shape.summaries.length - 1] || '') && /Chưa đánh giá/.test(shape.summaries.join('|')),
    JSON.stringify(shape.summaries));

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

  check('Gợi ý nhập mặc định được thu gọn',
    await page.evaluate(() => !document.querySelector('#sugg-aCause').closest('details').open));
  await page.click('details.action-suggestions:has(#sugg-aCause) > summary');
  check('Bấm tiêu đề thì mở được gợi ý',
    await page.evaluate(() => document.querySelector('#sugg-aCause').closest('details').open));
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
  // "Mở hồ sơ" tung mang hai nghia nguoc nhau: nut luu form (tao moi) va nut o dong
  // qua han tren dashboard (xem ho so da co). Chi duoc con MOT dong tu cho moi viec.
  const verbs = await page.evaluate(() => {
    const text = document.querySelector('.action-form-panel').innerText;
    return { save: text.includes('Lập hồ sơ NCE'), noOpenVerb: !/Mở hồ sơ/.test(text) };
  });
  check('Nút lưu nói rõ là lập hồ sơ mới', verbs.save === true);
  check('Không còn chữ "Mở hồ sơ" mang nghĩa tạo mới', verbs.noOpenVerb === true);

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

async function checkSectionChipsRefreshWhileTyping(page) {
  await page.evaluate(() => { closeActionForm(); beginActionManual(); });
  await page.waitForSelector('#aCorrection');
  await openAllSections(page);
  const chip = key => page.locator(`details[data-action-section="${key}"] .action-chip`);

  check('Chip xử lý tức thời ban đầu báo đúng hai mục còn thiếu', /Còn thiếu 2 mục/.test(await chip('immediate').innerText()));
  await page.selectOption('#aContainment', 'held');
  check('Chọn giữ kết quả thì ghi chú phạm vi trở thành bắt buộc', /Còn thiếu 2 mục/.test(await chip('immediate').innerText()));
  await page.fill('#aCorrection', 'Dừng trả kết quả và cô lập lô QC');
  const immediateNeedsNote = { text: await chip('immediate').innerText(), title: await chip('immediate').getAttribute('title') };
  check('Chip xử lý tức thời còn thiếu đúng ghi chú phạm vi',
    /Còn thiếu 1 mục/.test(immediateNeedsNote.text) && /ghi chú phạm vi/i.test(immediateNeedsNote.title || ''), JSON.stringify(immediateNeedsNote));
  await page.fill('#aContainmentNote', 'Giữ kết quả từ 08:00 đến khi QC đạt');
  check('Chip xử lý tức thời đổi sang đã xong ngay khi nhập đủ ba ô', /Đã xong/.test(await chip('immediate').innerText()));

  check('Chip nguy cơ ban đầu báo đúng số mục còn thiếu', /Còn thiếu 1 mục/.test(await chip('risk').innerText()));
  await page.selectOption('#aRiskSeverity', '4');
  await page.selectOption('#aRiskOccurrence', '2');
  await page.selectOption('#aRiskDetectability', '3');
  await page.selectOption('#aRiskLevel', 'high');
  check('Phân loại nguy cơ còn thiếu căn cứ SOP', /Còn thiếu 1 mục/.test(await chip('risk').innerText()));
  await page.fill('#aRiskBasis', 'SOP-QC-07, ma trận nguy cơ bảng 3');
  check('Chip nguy cơ đổi ngay khi có đủ điểm và căn cứ SOP', /Đã xong/.test(await chip('risk').innerText()));

  check('Chip nguyên nhân ban đầu tính cả cổng cho phép trở lại', /Còn thiếu 3 mục/.test(await chip('cause').innerText()));
  await page.selectOption('#aCauseCategory', 'instrument');
  await page.fill('#aCause', 'Kim hút bẩn làm sai thể tích hút');
  await page.fill('#aAct', 'Vệ sinh kim hút và cập nhật lịch bảo trì');
  const causeNeedsDate = { text: await chip('cause').innerText(), title: await chip('cause').getAttribute('title') };
  check('Chip nguyên nhân còn ngày hoàn thành và quyết định cho phép trở lại',
    /Còn thiếu 2 mục/.test(causeNeedsDate.text) && /ngày hoàn thành/i.test(causeNeedsDate.title || '') && /quyết định cho phép/i.test(causeNeedsDate.title || ''), JSON.stringify(causeNeedsDate));
  // Lấy đúng ngày ghi nhận đang hiện trên form (mặc định hôm nay): ngày hoàn thành và
  // ngày cho phép trở lại không được nằm trước nó, xem action-workflow-service.js.
  const eventDateVn = await page.inputValue('#aDate');
  await page.fill('#aActionCompletedDate', eventDateVn);
  check('Sau ngày hoàn thành, cổng cho phép trở lại vẫn còn thiếu', /Còn thiếu 1 mục/.test(await chip('cause').innerText()));
  await page.selectOption('#aReleaseStatus', 'released');
  await page.fill('#aReleaseDate', eventDateVn);
  await page.fill('#aReleaseBy', 'Quản trị viên');
  await page.fill('#aReleaseNote', 'Đã xác nhận điều kiện hoạt động an toàn');
  check('Chip nguyên nhân đổi sang đã xong khi đủ quyết định cho phép trở lại', /Đã xong/.test(await chip('cause').innerText()));

  await page.selectOption('#aPatientImpact', 'none');
  check('Chip ảnh hưởng bệnh nhân đổi ngay khi chọn kết luận', /Đã xong/.test(await chip('patient').innerText()));
  await page.evaluate(() => closeActionForm());
}

async function checkNewRecordDraftSurvivesRerender(page) {
  await page.evaluate(() => { state.actions = []; closeActionForm(); beginActionManual(); });
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
  // Hồ sơ mở thủ công không còn lựa chọn 'iqc' (sự cố nội kiểm phải mở từ dòng vi
  // phạm), và nguồn cũng không còn mặc định — phải chọn thật như người dùng, nếu
  // không addAction() dừng ở hộp thoại "còn thiếu".
  await page.selectOption('#aEventSource', 'eqa');

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
  // Lưu xong thì form đóng lại — vừa là tín hiệu "đã xong", vừa đảm bảo không còn
  // nháp lơ lửng gắn nhầm vào hồ sơ tiếp theo.
  check('Lưu xong thì form đóng lại', await page.evaluate(() => !document.getElementById('aCorrection')));
}

async function checkMissingFieldIsPinpointed(page) {
  // Cố tình chỉ để THIẾU "xử lý tức thời": đây là ô hay bị nhầm với "hành động khắc
  // phục" ở mục 4–6, nên phải chắc là thông báo và con trỏ trỏ đúng vào nó.
  await page.evaluate(() => { closeActionForm(); beginActionManual(); });
  await page.waitForSelector('#aCorrection');
  await page.selectOption('#aEventSource', 'eqa');
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

async function checkEvidenceTimelineAndLink(page) {
  await page.evaluate(() => viewActionDetail(0));
  await page.waitForSelector('.action-evidence-timeline');
  const detail = await page.evaluate(() => ({
    timelineLabels: [...document.querySelectorAll('.action-evidence-timeline span')].map(x => x.textContent),
    evidence: (document.querySelector('.action-rerun-evidence') || {}).innerText || '',
    buttons: [...document.querySelectorAll('.action-rerun-evidence button')].map(x => x.textContent),
  }));
  check('Chi tiết NCE tách đủ bốn mốc thời gian',
    ['Ngày xảy ra','QC chạy lại','Hủy điểm','Mở hồ sơ'].every(x => detail.timelineLabels.includes(x)),
    JSON.stringify(detail.timelineLabels));
  check('Khung bằng chứng nêu đúng giá trị, ngày và lần chạy',
    /5\.72/.test(detail.evidence) && /14\/07\/2026/.test(detail.evidence) && /2026-07-14-2/.test(detail.evidence),
    detail.evidence);
  check('Khung bằng chứng có nút mở điểm QC', detail.buttons.includes('Xem điểm QC'), JSON.stringify(detail.buttons));

  await page.click('.action-rerun-evidence button');
  await page.waitForSelector('[data-qc-point-id="k2"].qc-point-evidence-focus');
  const linked = await page.evaluate(() => {
    const row=document.querySelector('[data-qc-point-id="k2"]');
    return{page,entryStart,entryEnd,highlighted:!!(row&&row.classList.contains('qc-point-evidence-focus')),text:row&&row.innerText||''};
  });
  check('Nút bằng chứng mở đúng trang và đúng ngày QC',
    linked.page==='entry'&&linked.entryStart==='2026-07-14'&&linked.entryEnd==='2026-07-14',
    JSON.stringify(linked));
  check('Dòng QC làm bằng chứng được cuộn tới và tô sáng',
    linked.highlighted&&/5\.72/.test(linked.text),JSON.stringify(linked));
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
    state.actions.push({ id: 'FOLLOW-UP', nceId: 'NCE-TIEP-THEO', parentNceId: a.nceId, recordStatus: 'active' });
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

/* Form phải gắn với MỘT hồ sơ cụ thể. Trước đây nó luôn bung sẵn kể cả khi không có sự
   cố nào, nên vừa chiếm chỗ vừa khiến người dùng mất dấu đang xử lý cái gì. */
async function checkFormIsBoundToAnIncident(page) {
  const closed = await page.evaluate(() => {
    state.actions = []; closeActionForm();
    const panel = document.querySelector('.action-form-panel');
    return { hasForm: !!document.getElementById('aCorrection'), text: panel.innerText, manualBtn: /Lập hồ sơ từ nguồn khác/.test(panel.innerText) };
  });
  check('Không có sự cố thì form không bung sẵn', closed.hasForm === false, closed.text.slice(0, 120));
  check('Vẫn còn đường lập hồ sơ cho nguồn ngoài IQC', closed.manualBtn === true, closed.text.slice(0, 200));

  // Mở từ một vi phạm -> dải nhận diện phải nói rõ đang xử lý điểm QC nào.
  const fromIssue = await page.evaluate(() => {
    const t = state.tests[0], lvl = t.levels[0];
    state.data[t.id] = [{ id: 'v1', date: '2026-07-20', runId: '2026-07-20-1', level: 1, lot: lvl.lot, val: lvl.mean + lvl.sd * 4, qcMean: lvl.mean, qcSd: lvl.sd }];
    clearDerived(); go('actions');
    const issue = currentIssues()[0];
    beginActionFromIssue(t.id, 1, '1-3s', 'RE — Sai số ngẫu nhiên', 'hint', issue.p.id, issue.p.date);
    const banner = document.querySelector('.action-incident-banner');
    return { hasForm: !!document.getElementById('aCorrection'), banner: banner ? banner.innerText : '' };
  });
  check('Bấm "Lập hồ sơ" trên dòng vi phạm thì form mở ra', fromIssue.hasForm === true);
  check('Dải nhận diện nói rõ đang lập cho vi phạm nào',
    /Đang lập hồ sơ cho vi phạm này/.test(fromIssue.banner) && /20\/07\/2026/.test(fromIssue.banner) && /1-3s/.test(fromIssue.banner),
    fromIssue.banner);

  /* Hồ sơ chưa gắn điểm QC thì KHÔNG được có dải nhận diện: bản trước hiện "không gắn
     với điểm QC nào" rồi lại liệt kê Mean/SD/lô của xét nghiệm đầu dropdown mà người
     dùng chưa chọn — vừa thừa vừa tự mâu thuẫn. */
  const manual = await page.evaluate(() => {
    closeActionForm(); beginActionManual();
    const banner = document.querySelector('.action-incident-banner');
    return { hasBanner: !!banner, banner: banner ? banner.innerText : '', hasForm: !!document.getElementById('aCorrection') };
  });
  check('Hồ sơ nguồn ngoài IQC vẫn mở form được', manual.hasForm === true);
  check('Nhưng không hiện dải nhận diện rỗng nghĩa', manual.hasBanner === false, manual.banner);

  /* Không có điểm QC thì không được bịa ra danh tính QC: bản trước lặng lẽ điền xét
     nghiệm đầu dropdown + Mức 1 của nó, và để "Nguồn phát hiện" mặc định là Nội kiểm
     IQC — ngay sau khi người dùng bấm nút nói rằng đây KHÔNG phải IQC. */
  const shape = await page.evaluate(() => ({
    hasQcContext: !!document.getElementById('aLevelLabel'),
    hasLevel: !!document.getElementById('aLevel'),
    testValue: document.getElementById('aTest').value,
    testHasBlank: [...document.getElementById('aTest').options].some(o => o.value === ''),
    source: document.getElementById('aEventSource').value,
  }));
  check('Không hiện "Ngữ cảnh QC" cho hồ sơ không gắn điểm QC', shape.hasQcContext === false);
  check('Không âm thầm gán mức QC', shape.hasLevel === false);
  check('Không âm thầm gán xét nghiệm', shape.testValue === '' && shape.testHasBlank === true, JSON.stringify(shape));
  check('Nguồn phát hiện để trống, buộc chọn thật', shape.source === '', shape.source);

  /* Sự cố nội kiểm phải mở từ dòng vi phạm. Nếu lập hồ sơ thủ công rồi chọn nguồn
     "Nội kiểm IQC" thì hồ sơ không có pointId -> actionNeedsRerun() false -> khép vòng
     được mà không cần bằng chứng QC chạy lại, tức là né đúng rào an toàn của quy trình. */
  const iqcGate = await page.evaluate(() => {
    const sel = document.getElementById('aEventSource');
    const before = [...sel.options].map(o => o.value);
    sel.value = 'iqc';
    const forced = actionDraftStatus({ ...readActionProtocolForm(), eventSource: 'iqc', by: 'KTV', pointId: '' });
    return { options: before, blocked: !forced.complete, why: forced.missing.join('; ') };
  });
  check('Bỏ hẳn lựa chọn "Nội kiểm IQC" khi hồ sơ không gắn điểm QC',
    !iqcGate.options.includes('iqc'), JSON.stringify(iqcGate.options));
  check('Và chặn ở tầng lưu nếu giá trị đó lọt vào bằng đường khác',
    iqcGate.blocked === true && /mở từ dòng vi phạm/.test(iqcGate.why), iqcGate.why);

  const boundKeepsIqc = await page.evaluate(() => {
    closeActionForm();
    const t = state.tests[0];
    const p = state.data[t.id].find(x => x.level === t.levels[0].level);
    beginActionFromIssue(t.id, t.levels[0].level, '1-3s', 'RE — Sai số ngẫu nhiên', 'hint', p.id, p.date);
    return [...document.getElementById('aEventSource').options].map(o => o.value);
  });
  check('Hồ sơ mở từ dòng vi phạm vẫn chọn được "Nội kiểm IQC"',
    boundKeepsIqc.includes('iqc'), JSON.stringify(boundKeepsIqc));
  await page.evaluate(() => { closeActionForm(); beginActionManual(); });
  await page.waitForSelector('#aCorrection');

  const blocked = await page.evaluate(() => {
    const protocol = readActionProtocolForm();
    const d = actionDraftStatus({ ...protocol, action: '', by: actionFieldValue('aBy') });
    return { missing: d.missing.join('; '), keys: d.missingKeys };
  });
  check('Chưa chọn nguồn thì bị chặn lưu', /nguồn phát hiện/.test(blocked.missing), blocked.missing);

  const savedManual = await page.evaluate(async () => {
    document.getElementById('aEventSource').value = 'eqa';
    document.getElementById('aProcessPhase').value = 'exam';
    document.getElementById('aContainment').value = 'none';
    document.getElementById('aCorrection').value = 'Giữ kết quả EQA để rà soát';
    await addAction();
    const a = (state.actions || [])[state.actions.length - 1];
    return a ? { testId: a.testId, level: a.level, lot: a.lot, source: a.eventSource, label: actionLevelShort(null, a.level, a.lot), rerun: actionRerunStatus(a).needed } : null;
  });
  check('Lưu được hồ sơ nguồn ngoài IQC', savedManual && savedManual.source === 'eqa', JSON.stringify(savedManual));
  check('Bản ghi không dính xét nghiệm/mức/lô giả', savedManual && !savedManual.testId && !savedManual.level && !savedManual.lot, JSON.stringify(savedManual));
  check('Nhật ký hiện "Không gắn mức QC" thay vì "M0 · Lô ?"', savedManual && savedManual.label === 'Không gắn mức QC', savedManual && savedManual.label);
  check('Và hồ sơ đó không bị đòi QC chạy lại', savedManual && savedManual.rerun === false);
  await page.evaluate(() => { state.actions = []; closeActionForm(); });

  const afterClose = await page.evaluate(() => { closeActionForm(); return !!document.getElementById('aCorrection'); });
  check('Đóng form được', afterClose === false);
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

async function checkDashboardKpiControls(page) {
  // Điểm bị loại phải nằm trong kỳ 30 ngày đang xét → tính lùi từ hôm nay.
  const today = await page.evaluate(() => isoToday()), rejDate = shiftIso(today, -2);
  const rendered = await page.evaluate((rejDate) => {
    const t=state.tests[0],l=t.levels[0];
    state.data[t.id].push({id:'KPI-REJ',date:rejDate,runId:rejDate+'-1',level:l.level,lot:l.lot,val:l.mean+l.sd*4,qcMean:l.mean,qcSd:l.sd});
    clearDerived();dashKpiPeriod='30';dashKpiInstrument='all';dashKpiTest='all';go('dash');
    return{
      cards:document.querySelectorAll('.dash-quality-kpi').length,
      filters:document.querySelectorAll('.dash-kpi-filters select').length,
      hasRejected:[...document.querySelectorAll('.dash-quality-kpi')].some(x=>/Tỷ lệ QC bị loại/.test(x.innerText)&&!/—/.test(x.innerText))
    };
  }, rejDate);
  check('Dashboard KPI có đủ bốn thẻ có thể mở chi tiết',rendered.cards===4,JSON.stringify(rendered));
  check('Dashboard KPI có bộ lọc kỳ, thiết bị và xét nghiệm',rendered.filters===3,JSON.stringify(rendered));
  check('KPI nhận đúng điểm Westgard bị loại trong kỳ',rendered.hasRejected===true,JSON.stringify(rendered));

  const filtered = await page.evaluate(() => {
    dashboardKpiSetPeriod('90');
    dashboardKpiSetScope('instrument','I1');
    return{period:dashKpiPeriod,instrument:dashKpiInstrument,start:dashKpiLast.insight.period.start,end:dashKpiLast.insight.period.end,scope:dashKpiLast.items.length};
  });
  check('Bộ lọc 90 ngày cập nhật đúng khoảng KPI',filtered.period==='90'&&filtered.start===shiftIso(today,-89)&&filtered.end===today,JSON.stringify({...filtered,expect:shiftIso(today,-89)+'..'+today}));
  check('Lọc thiết bị thu hẹp đúng phạm vi xét nghiệm',filtered.instrument==='I1'&&filtered.scope===1,JSON.stringify(filtered));

  await page.evaluate(() => {dashKpiPeriod='30';dashKpiInstrument='all';dashboardKpiSetScope('test','T-NA');dashboardKpiOpenDetail('rejected');});
  await page.waitForSelector('.dash-kpi-detail-wrap [data-qc-point-id], .dash-kpi-detail-wrap tbody tr');
  const detail = await page.evaluate(() => ({title:(document.querySelector('.dash-kpi-modal h3')||{}).innerText||'',rows:document.querySelectorAll('.dash-kpi-detail-wrap tbody tr').length,text:(document.querySelector('.dash-kpi-detail-wrap')||{}).innerText||''}));
  check('Bấm KPI mở danh sách điểm bị loại đúng phạm vi',detail.rows>=1&&detail.text.includes(vnOf(rejDate)),JSON.stringify(detail));
  await page.locator('.dash-kpi-detail-wrap tbody tr').filter({hasText:vnOf(rejDate)}).locator('.btn').click();
  await page.waitForSelector('[data-qc-point-id="KPI-REJ"].qc-point-evidence-focus');
  const linked=await page.evaluate(()=>({page,entryStart,entryEnd}));
  check('Drill-down KPI mở đúng điểm QC nguồn',linked.page==='entry'&&linked.entryStart===rejDate&&linked.entryEnd===rejDate,JSON.stringify(linked));

  await page.evaluate(()=>go('settings'));
  await page.fill('#kpiQcRejectMax','3.5');
  await page.fill('#kpiCapaEffectiveMin','88');
  await page.fill('#kpiCloseDaysMax','10');
  await page.fill('#kpiOnTimeMin','92');
  await page.click('#kpiTargets .btn.teal');
  await page.waitForSelector('#dialogRoot .modal');
  const targets=await page.evaluate(()=>({...state.lab.kpiTargets}));
  check('Quản trị lưu được mục tiêu KPI tùy chỉnh',JSON.stringify(targets)===JSON.stringify({qcRejectMax:3.5,capaEffectiveMin:88,closeDaysMax:10,onTimeMin:92}),JSON.stringify(targets));
  await page.evaluate(()=>closeDialogOverlay());
}

(async () => {
  const session = await openSeededSession();
  NCE = buildNce(session.seedState);
  const pageErrors = [];
  session.page.on('pageerror', e => pageErrors.push('pageerror: ' + e.message));
  session.page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });

  try {
    await checkEditedFormSurvivesRerender(session.page);
    await checkIdentityIsImmutable(session.page);
    await checkFormIsBoundToAnIncident(session.page);
    await checkSectionsStartCollapsed(session.page);
    await checkSuggestionChips(session.page);
    await checkPickersReplaceTyping(session.page);
    await checkSectionChipsRefreshWhileTyping(session.page);
    await checkNewRecordDraftSurvivesRerender(session.page);
    await checkMissingFieldIsPinpointed(session.page);
    await checkRerunChipOnBothSurfaces(session.page);
    await checkEvidenceTimelineAndLink(session.page);
    await checkOverdueAndEscalation(session.page);
    await checkOverdueReachesDashboard(session.page);
    await checkDashboardKpiControls(session.page);
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
