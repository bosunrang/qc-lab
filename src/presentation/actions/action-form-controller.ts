type AnyRec = any;

/**
 * Form hồ sơ NCE (trang "Khắc phục sự cố"): hằng số lựa chọn (ACT_*), chip gợi ý,
 * checklist điều tra, bản nháp giữ qua rerender(), actionFormViewModel() (dữ liệu thuần
 * cho src/react/pages/ActionsPage.tsx) và addAction(). actions-page-controller.ts giữ
 * phần còn lại của trang: danh sách sự cố, vòng đời hồ sơ (duyệt/trả lại/hủy/escalate/
 * mở lại) và phiếu chi tiết.
 *
 * Đường cắt CÒN LẠI ở đây chỉ một chiều: form gọi ngược vài hàm dựng bằng chứng của
 * trang (deps.evidenceTimelineHtml/deps.rerunEvidenceHtml/deps.levelShort) vì phiếu chi
 * tiết dùng chung đúng các khối đó — modular-pilot.global.ts dựng controller này TRƯỚC
 * (ba dep trên trỏ qua một biến tham chiếu được gán sau khi actions-page-controller.ts
 * dựng xong).
 *
 * Form hồ sơ NCE được render THẲNG TỪ STATE (bản ghi đang sửa qua actionUi().editId, hoặc
 * seed khi mở từ một vi phạm) chứ không đổ giá trị vào DOM sau render — mọi rerender() sau
 * đó (đổi trang rồi quay lại, hay một bản đồng bộ Firebase dội về) không được xoá trắng
 * form đang gõ dở. Ở trang React, mỗi lần mở một hồ sơ (startManual()/startIssue()/
 * edit()) tăng actionFormUiState.openSeq — actionFormViewModel() gộp nó vào formKey nên
 * ActionsPage.tsx remount đúng subtree form mỗi lần mở, kể cả khi mở lại form thủ công
 * hai lần liên tiếp (seed giống hệt nhau) — nếu không, nội dung đã gõ dở của lần mở
 * trước còn sót trên các ô uncontrolled dù model đã tính lại đúng là rỗng.
 */
export function createActionFormController(deps: {
  getState: () => AnyRec;
  document: () => AnyRec;
  actionUi: () => AnyRec;
  currentUser: () => AnyRec;
  rerender: () => void;
  requireWrite: () => boolean;
  canWrite: () => boolean;
  infoDialog: (message: string, opts?: AnyRec) => Promise<unknown>;
  esc: (value: unknown) => string;
  escapeAttr: (value: unknown) => string;
  vnDate: (value: unknown) => string;
  fmt: (value: unknown, decimals?: number) => string;
  fmtPointValue: (point: AnyRec, test: AnyRec) => string;
  fmtTestValue: (test: AnyRec, value: unknown) => string;
  fmtTestStat: (test: AnyRec, value: unknown) => string;
  testDisplayName: (test: AnyRec) => string;
  userName: () => string;
  parseVN: (value: unknown) => string;
  isoToday: () => string;
  operationalLevels: (test: AnyRec) => AnyRec[];
  operationalTests: () => AnyRec[];
  lvlCfg: (test: AnyRec, level: unknown) => AnyRec;
  nextNceId: (today: string) => string;
  QCCore: { cleanText: (value: unknown, maxLength?: number) => string; WG_RULES: readonly string[] };
  ACTION_LABELS: () => AnyRec;
  actionApprovalStatus: (a: AnyRec) => string;
  actionCancelled: (a: AnyRec) => boolean;
  actionWorkflowStatus: (a: AnyRec) => AnyRec;
  actionRerunStatus: (a: AnyRec) => AnyRec;
  actionRiskScore: (a: AnyRec) => number;
  actionResidualRiskScore: (a: AnyRec) => number;
  actionProtocolStatus: (form: AnyRec) => AnyRec;
  ActionProtocolService: AnyRec;
  ActionBiasService: AnyRec;
  ActionBiasPresentation: AnyRec;
  ActionChecklistPresentation: AnyRec;
  ActionInvestigationPresentation: AnyRec;
  ActionFormModel: AnyRec;
  NceFormWorkflowCommand: AnyRec;
  /* Cầu nối hai chiều sang actions-page-controller.ts — xem ghi chú đầu file. */
  levelShort: (t: AnyRec, level: unknown, lotSnap: unknown) => string;
  evidenceTimelineHtml: (a: AnyRec, rr: AnyRec) => string;
  rerunEvidenceHtml: (a: AnyRec, rr: AnyRec, t: AnyRec) => string;
  /* ~28 hàm dựng HTML thuần (TypeScript) đã bridge từ các đợt trước. */
  pres: AnyRec;
}) {
  const state = () => deps.getState();
  const doc = () => deps.document();
  const actionUi = () => deps.actionUi();

  const LABELS = deps.ACTION_LABELS();

  /* [id ô trong DOM, khóa trong bản ghi, kiểu] — một bảng dùng cho cả ba việc: dựng giá
     trị ban đầu của form, giữ nội dung ĐANG GÕ qua rerender(), và tìm ô ứng với trường
     còn thiếu khi validate. Chỉ 'num' cần đổi kiểu; 'date' và 'text' đi thẳng vào ô vì
     dateBox() nhận được cả chuỗi dd/mm/yyyy lẫn yyyy-mm-dd. */
  const ACT_FIELDS: [string, string, string][] = [
    ['aNceId', 'nceId', 'text'], ['aTest', 'testId', 'text'], ['aLevel', 'level', 'text'], ['aPointId', 'pointId', 'text'],
    ['aDate', 'date', 'date'], ['aRule', 'rule', 'text'], ['aEventSource', 'eventSource', 'text'], ['aProcessPhase', 'processPhase', 'text'],
    ['aErr', 'errorType', 'text'], ['aBy', 'by', 'text'], ['aDueDate', 'dueDate', 'date'],
    ['aContainment', 'containmentStatus', 'text'], ['aContainmentNote', 'containmentNote', 'text'], ['aCorrection', 'correction', 'text'],
    ['aRiskSeverity', 'riskSeverity', 'num'], ['aRiskOccurrence', 'riskOccurrence', 'num'], ['aRiskDetectability', 'riskDetectability', 'num'], ['aRiskLevel', 'riskLevel', 'text'], ['aRiskBasis', 'riskBasis', 'text'],
    ['aQcMaterial', 'qcMaterialStatus', 'text'], ['aQcMaterialNote', 'qcMaterialNote', 'text'],
    ['aInstrument', 'instrumentStatus', 'text'], ['aInstrumentNote', 'instrumentNote', 'text'],
    ['aReagent', 'reagentStatus', 'text'], ['aReagentNote', 'reagentNote', 'text'],
    ['aCalibration', 'calibrationStatus', 'text'], ['aCalibrationNote', 'calibrationNote', 'text'],
    ['aLotToLot', 'lotToLotStatus', 'text'], ['aLotToLotNote', 'lotToLotNote', 'text'],
    ['aCauseCategory', 'causeCategory', 'text'], ['aCause', 'cause', 'text'], ['aAct', 'action', 'text'], ['aActionCompletedDate', 'actionCompletedDate', 'date'],
    ['aBiasBefore', 'biasBefore', 'text'], ['aBiasAfter', 'biasAfter', 'text'],
    ['aReleaseStatus', 'releaseStatus', 'text'], ['aReleaseDate', 'releaseDate', 'date'], ['aReleaseBy', 'releaseBy', 'text'], ['aReleaseNote', 'releaseNote', 'text'],
    ['aPatientImpact', 'patientImpact', 'text'], ['aPatientAction', 'patientAction', 'text'],
    ['aEffectivenessStatus', 'effectivenessStatus', 'text'], ['aEffectivenessDate', 'effectivenessDate', 'date'], ['aEffectivenessNote', 'effectivenessNote', 'text'],
    ['aResidualSeverity', 'residualSeverity', 'num'], ['aResidualOccurrence', 'residualOccurrence', 'num'], ['aResidualDetectability', 'residualDetectability', 'num'], ['aResidualRiskLevel', 'residualRiskLevel', 'text'], ['aResidualRiskBasis', 'residualRiskBasis', 'text'],
  ];
  const ACT_CHECK_FIELDS: [string, string, string, string][] = [
    ['aQcMaterial', 'aQcMaterialNote', 'qcMaterialStatus', 'qcMaterialNote'],
    ['aInstrument', 'aInstrumentNote', 'instrumentStatus', 'instrumentNote'],
    ['aReagent', 'aReagentNote', 'reagentStatus', 'reagentNote'],
    ['aCalibration', 'aCalibrationNote', 'calibrationStatus', 'calibrationNote'],
    ['aLotToLot', 'aLotToLotNote', 'lotToLotStatus', 'lotToLotNote'],
  ];
  const labelEntries = (obj: AnyRec): [string, string][] => Object.entries(obj);
  const ACT_SOURCE_OPTS: [string, string][] = [['', '— Chọn nguồn —'], ...labelEntries(LABELS.source)];
  const ACT_PHASE_OPTS: [string, string][] = labelEntries(LABELS.phase);
  const ACT_ERR_OPTS: [string, string][] = [['', '— Chưa xác định —'], ['SE — Sai số hệ thống', 'SE — Sai số hệ thống'], ['RE — Sai số ngẫu nhiên', 'RE — Sai số ngẫu nhiên']];
  const ACT_CONTAIN_OPTS: [string, string][] = [['', '— Chọn —'], ...labelEntries(LABELS.containment)];
  const ACT_RISK_LEVEL_OPTS: [string, string][] = [['', '— Chọn —'], ...labelEntries(LABELS.risk)];
  const ACT_CAUSE_OPTS: [string, string][] = [['', '— Chọn —'], ...labelEntries(LABELS.cause)];
  const ACT_RELEASE_OPTS: [string, string][] = [['', 'Chưa cho phép trở lại'], ...labelEntries(LABELS.release)];
  const ACT_PATIENT_OPTS: [string, string][] = [['', '— Chọn —'], ...labelEntries(LABELS.patient)];
  const ACT_EFF_OPTS: [string, string][] = [['pending', 'Chưa đánh giá'], ['effective', 'Có hiệu lực'], ['ineffective', 'Chưa hiệu lực — cần xử lý tiếp']];
  /* Nhãn dài hơn ACTION_LABELS.check vì trong form cần giải thích khi nào chọn mục nào. */
  const ACT_CHECK_OPTS: [string, string][] = [['', '— Chọn —'], ['ok', 'Đạt'], ['abnormal', 'Bất thường'], ['na', 'Không áp dụng']];
  const ACT_LOT2LOT_OPTS: [string, string][] = [['', '— Chọn —'], ['not-needed', 'Không cần — không đổi lô gần đây'], ['checked-ok', 'Đã kiểm tra — đạt'], ['checked-abnormal', 'Đã kiểm tra — bất thường']];
  const ACT_SEVERITY_OPTS: [string, string][] = [['', '—'], ['1', '1 — Không đáng kể'], ['2', '2 — Nhẹ'], ['3', '3 — Trung bình'], ['4', '4 — Nặng'], ['5', '5 — Rất nghiêm trọng']];
  const ACT_OCCURRENCE_OPTS: [string, string][] = [['', '—'], ['1', '1 — Hiếm'], ['2', '2 — Ít gặp'], ['3', '3 — Có thể'], ['4', '4 — Thường gặp'], ['5', '5 — Rất thường gặp']];
  const ACT_DETECT_OPTS: [string, string][] = [['', '—'], ['1', '1 — Gần như chắc chắn phát hiện'], ['2', '2 — Dễ phát hiện'], ['3', '3 — Trung bình'], ['4', '4 — Khó phát hiện'], ['5', '5 — Rất khó phát hiện']];
  /* Câu gợi ý cho các ô văn tường thuật. CHÈN ĐƯỢC VÀ SỬA ĐƯỢC, cố ý không phải dropdown
     cứng: nếu "nguyên nhân gốc" chỉ chọn từ một danh sách đóng thì mọi hồ sơ NCE sẽ có
     cùng một câu và không chứng minh được là đã thực sự điều tra khi bị đánh giá ISO
     15189 — đúng điểm yếu của lý do hủy điểm QC dạng chuỗi mẫu. */
  const ACT_SUGGEST: Record<string, string[]> = {
    correction: ['Dừng trả kết quả liên quan', 'Cô lập lô QC đang dùng', 'Thông báo phụ trách khoa', 'Chạy lại QC với lọ mới', 'Tạm dừng máy chờ kiểm tra'],
    containmentNote: ['Giữ kết quả từ đầu ca', 'Chỉ ảnh hưởng mức QC này', 'Chưa trả kết quả nào ra ngoài'],
    riskBasis: ['Theo ma trận nguy cơ trong SOP quản lý sự không phù hợp', 'Theo SOP đánh giá nguy cơ của phòng xét nghiệm', 'Theo mức ảnh hưởng lâm sàng và khả năng phát hiện'],
    releaseNote: ['QC chạy lại đã được chấp nhận', 'Đã xác nhận máy và hóa chất hoạt động ổn định', 'Phụ trách khoa đã rà soát và cho phép vận hành'],
    patientAction: ['Không có kết quả nào đã trả ra', 'Rà soát kết quả từ lần QC đạt cuối', 'Chạy lại và trả kết quả đính chính', 'Đã thông báo lâm sàng'],
    effectivenessNote: ['Theo dõi 20 lần chạy sau không tái diễn', 'QC ổn định trong 2 tuần tiếp theo', 'Vấn đề tái diễn, cần xử lý tiếp'],
    residualRiskBasis: ['Đánh giá lại theo cùng ma trận nguy cơ ban đầu', 'Theo SOP-QC-07 sau thời gian theo dõi', 'Dựa trên dữ liệu QC sau khắc phục và khả năng phát hiện hiện tại'],
    qcMaterialNote: ['Còn hạn, bảo quản đúng 2–8°C', 'Lọ QC đã mở quá số ngày cho phép', 'Hoàn nguyên chưa đủ thời gian', 'Lọ QC bị đục hoặc kết tủa'],
    instrumentNote: ['Máy không có cảnh báo', 'Kim hút có cặn hoặc tắc', 'Nhiệt độ buồng ủ lệch', 'Đã tới hạn bảo trì định kỳ'],
    reagentNote: ['Hóa chất còn hạn, đúng điều kiện', 'Vừa đổi lô hóa chất', 'Hóa chất đã mở quá hạn ổn định', 'Có bọt khí trong đường hút'],
    calibrationNote: ['Hiệu chuẩn còn hiệu lực', 'Đã quá hạn hiệu chuẩn', 'Đã hiệu chuẩn lại sau sự cố'],
    lotToLotNote: ['Không đổi lô trong kỳ này', 'Đã so sánh, kết quả tương đương', 'Lệch giữa hai lô vượt giới hạn'],
  };
  /* Nguyên nhân gốc gợi theo đúng nhóm nguyên nhân đang chọn — đây mới là chỗ tiết kiệm
     thao tác thật, thay vì một danh sách chung chung cho mọi nhóm. */
  const ACT_SUGGEST_CAUSE: Record<string, string[]> = {
    qc: ['Lọ QC hỏng hoặc quá hạn ổn định', 'Hoàn nguyên hoặc pha chưa đúng', 'Bảo quản QC không đúng nhiệt độ'],
    operator: ['Thao tác hút mẫu chưa đúng', 'Nhầm mức hoặc nhầm lọ QC', 'Chưa trộn đều trước khi chạy'],
    instrument: ['Kim hút bẩn làm sai thể tích hút', 'Bộ phận quang/điện cực suy giảm', 'Nhiệt độ buồng ủ không ổn định'],
    reagent: ['Lô hóa chất mới lệch so với lô cũ', 'Hóa chất suy giảm do bảo quản', 'Calibrator hết hạn'],
    calibration: ['Hiệu chuẩn trôi theo thời gian', 'Chưa hiệu chuẩn sau khi thay lô', 'Hiệu chuẩn lỗi do calibrator'],
    environment: ['Nhiệt độ hoặc độ ẩm phòng vượt ngưỡng', 'Nguồn điện không ổn định'],
    unknown: ['Chưa xác định được nguyên nhân, tiếp tục theo dõi'],
  };
  /* Hành động khắc phục gợi theo loại sai số, bám đúng hướng SE/RE mà fixHint() trong
     core.js đã phân sẵn chứ không tự đặt ra một cách phân loại thứ hai. */
  const ACT_SUGGEST_ACTION: Record<string, string[]> = {
    SE: ['Hiệu chuẩn lại và xác nhận bằng QC', 'Thay lô hóa chất hoặc calibrator', 'Vệ sinh và bảo trì bộ phận liên quan', 'Cập nhật Mean/SD sau khi ổn định'],
    RE: ['Vệ sinh kim hút, loại bọt khí', 'Thay lọ QC mới, trộn đều đúng cách', 'Đào tạo lại thao tác cho nhân viên', 'Kiểm tra nguồn điện và độ ổn định máy'],
    '': ['Hiệu chuẩn lại và xác nhận bằng QC', 'Vệ sinh kim hút, loại bọt khí', 'Thay lọ QC mới, trộn đều đúng cách', 'Đào tạo lại thao tác cho nhân viên'],
  };

  const actionSectionToggled = (key: string, open: boolean) => { actionUi().toggleSection(key, open); };
  const actionDefaultOpenSections = (editing: AnyRec, protocol: AnyRec) => deps.ActionFormModel.defaultOpenSections(editing, protocol);
  /* Luật Westgard là bộ từ vựng đóng — không có lý do gì để gõ tay. actionRuleOptions()
     luôn kèm một option rỗng đầu tiên nên hồ sơ cũ (hoặc chuỗi nhiều luật "1-3s, 2-2s"
     sinh từ dòng vi phạm) vẫn hiện đúng thay vì rơi im lặng về option đầu. */
  const actionRuleOptions = () => deps.pres.actionRuleOptionsPresentation(deps.QCCore.WG_RULES);
  /* Bản nháp đang gõ được chụp lại sau mỗi lần thay đổi ô, và render lại từ đó. Nếu chỉ
     dựa vào bản ghi trong state thì hồ sơ MỚI (chưa lưu) vẫn mất sạch nội dung mỗi khi
     có rerender() — ví dụ Firebase dội một bản đồng bộ về giữa lúc đang nhập. */
  const captureActionDraft = () => {
    const values: Record<string, unknown> = {};
    let found = false;
    ACT_FIELDS.forEach(([id]) => { const e = doc().getElementById(id); if (e) { found = true; values[id] = e.value; } });
    if (found) actionUi().captureDraft(values);
  };
  const actionFormChanged = () => { captureActionDraft(); actionRefreshSectionChips(); };
  const actionDraftValues = () => actionUi().draftValues();
  const clearActionDraft = () => { actionUi().clearDraft(); };
  /* Hồ sơ không gắn điểm QC thì không được chọn "Nội kiểm IQC": sự cố IQC phải mở từ dòng
     vi phạm, nếu không hệ thống mất đường theo dõi QC chạy lại. Hồ sơ cũ lỡ mang giá trị
     đó vẫn giữ option để hiện đúng tên — phần chặn do actionDraftStatus() lo. */
  const actionSourceOptions = (qcBound: boolean, current: unknown) => deps.ActionFormModel.sourceOptions(ACT_SOURCE_OPTS, qcBound, current);
  const actionCausePhrases = (category: unknown) => deps.pres.actionCausePhrasesPresentation(category, ACT_SUGGEST_CAUSE);
  const actionActionPhrases = (errorType: unknown) => deps.pres.actionPhrasesPresentation(errorType, ACT_SUGGEST_ACTION);
  /* Chip gợi ý (JSX SuggestBox trong ActionsPage.tsx) chèn câu bằng cách gọi thẳng hàm
     này qua data-action — không còn dựng bằng HTML string ở đây. */
  const actionInsertSuggestion = (targetId: string, phrase: string) => {
    const e = doc().getElementById(targetId);
    if (!e) return;
    const cur = String(e.value || '').trim();
    e.value = cur ? (cur.endsWith('.') || cur.endsWith(';') ? cur + ' ' + phrase : cur + '; ' + phrase) : phrase;
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.focus();
    e.setSelectionRange(e.value.length, e.value.length);
  };
  const actionLevelLabel = (l: AnyRec, t: AnyRec = null) => deps.pres.actionLevelLabelPresentation(l, (value: unknown) => deps.fmtTestValue(t, value), (value: unknown) => deps.fmtTestStat(t, value));
  /* Chỉ chạy cho hồ sơ MỚI — khi sửa, ô "Xét nghiệm" bị disabled và addAction() lấy
     testId/level/lot thẳng từ bản ghi nên hàm này không đụng tới được. */
  const syncActLevels = () => {
    const testEl = doc().getElementById('aTest'), levelEl = doc().getElementById('aLevel'), labelEl = doc().getElementById('aLevelLabel');
    if (!testEl || !levelEl) return;
    const t = state().tests.find((x: AnyRec) => x.id === testEl.value);
    if (!t) return;
    const levels = deps.operationalLevels(t), l = levels.find((x: AnyRec) => String(x.level) === String(levelEl.value)) || levels[0];
    if (l) levelEl.value = l.level;
    if (labelEl) labelEl.value = l ? actionLevelLabel(l, t) : '';
  };
  /* Ngữ cảnh hiển thị khi sửa: ưu tiên số lô ĐÃ GHI trong hồ sơ, không lấy lô hiện hành
     của mức (lô có thể đã chuyển tiếp từ lúc xảy ra sự cố). */
  const actionLevelContext = (testId: unknown, level: unknown, lot: unknown) => deps.pres.actionLevelContextPresentation(testId, level, lot, state().tests, deps.lvlCfg, actionLevelLabel);
  /* Nguồn ngoài IQC (EQA, cảnh báo thiết bị, phản hồi lâm sàng, đánh giá/audit) không
     bao giờ xuất hiện ở "Sự cố cần xử lý" vì không phải vi phạm Westgard — nhưng vẫn là
     sự không phù hợp phải lập hồ sơ. Đây là đường vào có chủ đích cho chúng, tách khỏi
     đường chính đi từ một vi phạm cụ thể. */
  const beginActionManual = () => {
    if (!deps.requireWrite()) return;
    actionUi().startManual();
    deps.rerender();
    const e = doc().getElementById('aCorrection');
    if (e) e.focus();
  };
  const closeActionForm = () => { actionUi().reset(); deps.rerender(); };
  /* Dải nhận diện chỉ xuất hiện khi có ĐIỂM QC THẬT để nhận diện. Hồ sơ nguồn ngoài IQC
     chưa gắn điểm nào thì không có gì để nói: bản trước hiện "không gắn với điểm QC nào"
     rồi lại liệt kê Mean/SD/lô của xét nghiệm đầu dropdown mà người dùng chưa hề chọn —
     vừa thừa vừa tự mâu thuẫn. Việc hồ sơ đó không cần QC chạy lại vẫn đọc được ở phiếu
     chi tiết (bước 6 hiện "Không yêu cầu"). */
  const actionIncidentBanner = (form: AnyRec, editing: AnyRec) => {
    const p = form.pointId ? (((state().data && state().data[form.testId]) || []).find((x: AnyRec) => x.id === form.pointId)) : null;
    if (!p) return '';
    const t = state().tests.find((x: AnyRec) => x.id === form.testId);
    const title = editing ? `Đang tiếp tục hồ sơ ${editing.nceId || 'NCE'}` : 'Đang lập hồ sơ cho vi phạm này';
    const bits: string[] = [];
    if (t) bits.push(`${deps.testDisplayName(t)} · ${actionLevelContext(form.testId, form.level, form.lot)}`);
    bits.push(`${deps.vnDate(p.date)} · ${deps.fmtPointValue(p, t)} ${(t && t.unit) || ''} · ${form.rule || '—'}`);
    return deps.pres.actionIncidentBannerPresentation({ titleHtml: deps.esc(title), detailsHtml: bits.map(deps.esc).join(' · ') });
  };
  const beginActionFromIssue = (tid: unknown, level: unknown, rule: unknown, err: unknown, act: unknown, pointId = '', pointDate = '') => {
    actionUi().startIssue({ testId: tid, level, rule, errorType: err === '—' ? '' : err, pointId, date: pointDate || deps.isoToday() });
    deps.rerender();
    const e = doc().getElementById('aCorrection');
    if (e) e.focus();
  };
  const actionFieldValue = (id: string, max = 5000) => deps.QCCore.cleanText((doc().getElementById(id) || {}).value, max).trim();
  const readActionProtocolForm = (version = 3) => ({
    protocolVersion: version, eventSource: actionFieldValue('aEventSource', 40), processPhase: actionFieldValue('aProcessPhase', 40), correction: actionFieldValue('aCorrection'), dueDate: deps.parseVN(actionFieldValue('aDueDate', 40)) || '', riskSeverity: +actionFieldValue('aRiskSeverity', 4) || 0, riskOccurrence: +actionFieldValue('aRiskOccurrence', 4) || 0, riskDetectability: +actionFieldValue('aRiskDetectability', 4) || 0, riskLevel: actionFieldValue('aRiskLevel', 40), riskBasis: actionFieldValue('aRiskBasis'), containmentStatus: actionFieldValue('aContainment', 40), containmentNote: actionFieldValue('aContainmentNote'), qcMaterialStatus: actionFieldValue('aQcMaterial', 40), qcMaterialNote: actionFieldValue('aQcMaterialNote'), instrumentStatus: actionFieldValue('aInstrument', 40), instrumentNote: actionFieldValue('aInstrumentNote'), reagentStatus: actionFieldValue('aReagent', 40), reagentNote: actionFieldValue('aReagentNote'), calibrationStatus: actionFieldValue('aCalibration', 40), calibrationNote: actionFieldValue('aCalibrationNote'), lotToLotStatus: actionFieldValue('aLotToLot', 40), lotToLotNote: actionFieldValue('aLotToLotNote'), causeCategory: actionFieldValue('aCauseCategory', 40), cause: actionFieldValue('aCause'), actionCompletedDate: deps.parseVN(actionFieldValue('aActionCompletedDate', 40)) || '', biasBefore: actionFieldValue('aBiasBefore', 20), biasAfter: actionFieldValue('aBiasAfter', 20), releaseStatus: actionFieldValue('aReleaseStatus', 40), releaseDate: deps.parseVN(actionFieldValue('aReleaseDate', 40)) || '', releaseBy: actionFieldValue('aReleaseBy', 120), releaseNote: actionFieldValue('aReleaseNote'), patientImpact: actionFieldValue('aPatientImpact', 40), patientAction: actionFieldValue('aPatientAction'), effectivenessStatus: actionFieldValue('aEffectivenessStatus', 40) || 'pending', effectivenessDate: deps.parseVN(actionFieldValue('aEffectivenessDate', 40)) || '', effectivenessNote: actionFieldValue('aEffectivenessNote'), residualSeverity: +actionFieldValue('aResidualSeverity', 4) || 0, residualOccurrence: +actionFieldValue('aResidualOccurrence', 4) || 0, residualDetectability: +actionFieldValue('aResidualDetectability', 4) || 0, residualRiskLevel: actionFieldValue('aResidualRiskLevel', 40), residualRiskBasis: actionFieldValue('aResidualRiskBasis'),
  });
  const actionEffectivenessMissingKey = (a: AnyRec) => deps.ActionProtocolService.effectivenessMissingKey(a);
  const addAction = async () => {
    if (!deps.requireWrite()) return;
    const editing = actionUi().editId && (state().actions || []).find((a: AnyRec) => a.id === actionUi().editId);
    /* Danh tính sự cố (xét nghiệm / mức / lô / điểm QC) là ẢNH CHỤP lúc mở hồ sơ, không
       đọc lại từ form khi sửa: đổi ô "Xét nghiệm" từng làm actionPoint() trả null, khiến
       yêu cầu QC chạy lại biến mất và hồ sơ duyệt được mà không có bằng chứng chạy lại;
       còn lấy lại lot theo lvlCfg() hiện hành thì ghi đè số lô của sự cố sau mỗi lần
       chuyển lô. */
    const tid = editing ? editing.testId : doc().getElementById('aTest').value, t = state().tests.find((x: AnyRec) => x.id === tid);
    const levelEl = doc().getElementById('aLevel');
    const level = editing ? editing.level : (levelEl ? parseInt(levelEl.value) || 0 : 0), l = t && level ? deps.lvlCfg(t, level) : null;
    const lot = editing ? (editing.lot || '') : ((l && l.lot) || ''), pointId = editing ? (editing.pointId || '') : actionFieldValue('aPointId', 80);
    const rule = actionFieldValue('aRule'), action = actionFieldValue('aAct'), by = actionFieldValue('aBy'), errorType = actionFieldValue('aErr'), nceId = actionFieldValue('aNceId', 80) || deps.nextNceId(deps.isoToday()), date = deps.parseVN(doc().getElementById('aDate').value) || deps.isoToday(), protocol = readActionProtocolForm(editing ? Math.max(2, +editing.protocolVersion || 2) : 3);
    const user = deps.currentUser();
    const result = deps.NceFormWorkflowCommand.submit({
      editId: editing && editing.id, values: { ...(editing || {}), ...protocol, nceId: (editing && editing.nceId) || nceId, testId: tid, level, lot, pointId, date, rule, errorType, action, by },
      user: { id: (user && user.id) || '', username: (user && user.username) || '', name: deps.userName() },
      audit: (result: AnyRec) => result.mode === 'update' ? { action: 'Cập nhật hồ sơ NCE', detail: `${result.record.nceId || 'NCE'} · ${deps.actionWorkflowStatus(result.record).label}`, target: t ? t.name : '' } : { action: 'Lập hồ sơ NCE', detail: `${result.record.nceId} · ${deps.levelShort(t, level, lot)} · đang điều tra`, target: t ? t.name : '' },
    });
    if (!result.ok) { await deps.infoDialog(result.message); if (result.missingKey) focusActionField(result.missingKey); return; }
  };
  const syncActionRiskScore = () => {
    const a = { riskSeverity: +actionFieldValue('aRiskSeverity', 4) || 0, riskOccurrence: +actionFieldValue('aRiskOccurrence', 4) || 0, riskDetectability: +actionFieldValue('aRiskDetectability', 4) || 0 }, e = doc().getElementById('aRiskScore'), card = doc().getElementById('aRiskScoreCard'), score = deps.actionRiskScore(a), level = actionFieldValue('aRiskLevel', 40);
    if (e) e.textContent = score ? String(score) : '—';
    if (card) card.className = `action-risk-score risk-${['low', 'medium', 'high', 'critical'].includes(level) ? level : 'none'}`;
  };
  const syncActionResidualRiskScore = () => {
    const a = { residualSeverity: +actionFieldValue('aResidualSeverity', 4) || 0, residualOccurrence: +actionFieldValue('aResidualOccurrence', 4) || 0, residualDetectability: +actionFieldValue('aResidualDetectability', 4) || 0 }, e = doc().getElementById('aResidualRiskScore'), card = doc().getElementById('aResidualRiskScoreCard'), score = deps.actionResidualRiskScore(a), level = actionFieldValue('aResidualRiskLevel', 40);
    if (e) e.textContent = score ? String(score) : '—';
    if (card) card.className = `action-risk-score risk-${['low', 'medium', 'high', 'critical'].includes(level) ? level : 'none'}`;
  };
  const editAction = async (i: number) => {
    const a = state().actions && state().actions[i];
    if (!a) return;
    if (deps.actionCancelled(a)) { await deps.infoDialog('Hồ sơ đã hủy được giữ nguyên để bảo toàn dấu vết và không thể chỉnh sửa.'); return; }
    if (deps.actionApprovalStatus(a) === 'approved') { await deps.infoDialog('Hồ sơ đã khép vòng không được sửa. Nếu vấn đề tái diễn, hãy mở hồ sơ NCE mới.'); return; }
    actionUi().edit(a.id);
    deps.rerender();
    const panel = doc().querySelector('.action-form-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const actionInvestigationChoiceLabel = (value: unknown, label: unknown) => deps.ActionInvestigationPresentation.choiceLabel(value, label);
  const actionInvestigationStateClass = (value: unknown) => deps.ActionInvestigationPresentation.stateClass(value);
  const actionInvestigationChoose = (statusId: string, value: string) => {
    const select = doc().getElementById(statusId);
    if (!select) return;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    if (['abnormal', 'checked-abnormal', 'na'].includes(value)) {
      const card = select.closest('.action-investigation-item'), note = card && card.querySelector('.action-investigation-note input');
      if (note) note.focus();
    }
  };
  const actionInvestigationSync = (statusId: string) => {
    const select = doc().getElementById(statusId), card = select && select.closest('.action-investigation-item');
    if (!select || !card) return;
    card.classList.remove('is-empty', 'is-ok', 'is-abnormal', 'is-na');
    card.classList.add(actionInvestigationStateClass(select.value));
    card.querySelectorAll('.action-choice').forEach((button: AnyRec) => { const active = button.dataset.value === select.value; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active ? 'true' : 'false'); });
    const label = card.querySelector('.action-investigation-state');
    if (label) label.textContent = LABELS.check[select.value] || 'Chưa kết luận';
  };
  const actionChecklistRefresh = () => {
    const first = doc().getElementById(ACT_CHECK_FIELDS[0][0]), section = first && first.closest('details'), chip = section && section.querySelector(':scope > summary .action-chip');
    if (!chip) return;
    const rows = ACT_CHECK_FIELDS.map(([statusId, noteId]) => ({ status: (doc().getElementById(statusId) || {}).value, note: (doc().getElementById(noteId) || {}).value })), info = deps.ActionChecklistPresentation.checklistChip(rows);
    chip.textContent = info.label;
    chip.classList.toggle('ok', info.cls === 'ok');
    chip.classList.toggle('warn', info.cls === 'warn');
  };
  /* Bọc một mục thành <details> thu gọn được. Dùng thẻ gốc thay vì tự dựng bằng JS:
     bàn phím, ARIA và trạng thái mở/đóng do trình duyệt lo, không phát sinh vi phạm
     a11y nào. ontoggle ghi lại trạng thái để rerender() không bung/thu lung tung. */
  const actionSectionChip = (missing: unknown) => deps.ActionChecklistPresentation.sectionChip(missing);
  const actionChecklistChip = (form: AnyRec) => deps.ActionChecklistPresentation.checklistChip(ACT_CHECK_FIELDS.map(([, , statusKey, noteKey]) => ({ status: form[statusKey], note: form[noteKey] })));
  /* Mục 8 không nằm trong checklist khép vòng nên không có số "còn thiếu" — chip lấy
     thẳng từ cổng hiệu lực, nếu không sẽ luôn hiện "Đã xong" cho hồ sơ còn trắng. */
  const actionEffSectionChip = (form: AnyRec) => deps.ActionChecklistPresentation.effectivenessChip(form);
  const actionUpdateSectionChip = (key: string, info: AnyRec) => {
    const section = doc().querySelector(`details[data-action-section="${key}"]`), chip = section && section.querySelector(':scope > summary .action-chip');
    if (!chip) return;
    chip.className = `action-chip ${info.cls}`;
    chip.textContent = info.label;
    chip.title = info.title || '';
    chip.setAttribute('aria-label', info.title || info.label);
  };
  const actionRefreshSectionChips = () => {
    if (!doc().getElementById('aCorrection')) return;
    const editing = actionUi().editId && (state().actions || []).find((a: AnyRec) => a.id === actionUi().editId), version = editing ? Math.max(2, +editing.protocolVersion || 2) : 3;
    const form = { ...(editing || {}), ...readActionProtocolForm(version), protocolVersion: version, testId: editing ? editing.testId : actionFieldValue('aTest', 80), date: deps.parseVN(actionFieldValue('aDate', 40)) || '', action: actionFieldValue('aAct'), by: actionFieldValue('aBy'), pointId: actionFieldValue('aPointId', 80) };
    const miss = deps.actionProtocolStatus(form).missingBySection || {};
    (['immediate', 'risk', 'cause', 'patient'] as const).forEach(key => actionUpdateSectionChip(key, actionSectionChip((miss as AnyRec)[key])));
    actionUpdateSectionChip('eff', actionEffSectionChip(form));
    actionChecklistRefresh();
  };
  /* Giá trị khởi tạo của form: bản ghi đang sửa > seed từ vi phạm vừa bấm "Ghi nhận" >
     mặc định cho hồ sơ mới. Trả về object phẳng để mọi ô render được value/selected. */
  const actionFormModel = (editing: AnyRec, tests: AnyRec[]) => deps.ActionFormModel.build(editing, tests, actionUi().seed, deps.currentUser(), actionDraftValues());
  /* Hồ sơ mở từ nút "Lập hồ sơ từ nguồn khác" KHÔNG được bịa ra danh tính QC: không có
     điểm QC nào thì xét nghiệm/mức/lô đều chưa xác định, mà bản trước lại lặng lẽ điền
     xét nghiệm đầu dropdown và Mức 1 của nó. Nguồn phát hiện cũng để trống thay vì mặc
     định "Nội kiểm IQC" — người dùng vừa bấm đúng nút nói rằng đây KHÔNG phải IQC. */
  const actionFormDefaults = (tests: AnyRec[]) => deps.ActionFormModel.defaults(tests, actionUi().seed, deps.currentUser());
  /* Đưa con trỏ tới đúng ô còn thiếu thay vì chỉ hiện hộp thoại: nhãn "xử lý tức thời"
     nằm ở cuối mục 1, cách xa nút Lưu ở cuối trang. */
  const focusActionField = (key: string) => {
    const entry = ACT_FIELDS.find(f => f[1] === key), e = entry && doc().getElementById(entry[0]);
    if (!e) return;
    /* Ô có thể nằm trong một mục đang thu gọn — mở ra trước, không thì cuộn tới chỗ trống. */
    const box = e.closest('details');
    if (box && !box.open) box.open = true;
    const target = e.classList.contains('action-investigation-select') ? e.closest('.action-investigation-item') : e, focusTarget = e.classList.contains('action-investigation-select') && target ? target.querySelector('.action-choice') : e;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (focusTarget) focusTarget.focus({ preventScroll: true });
    target.classList.add('field-invalid');
    const drop = () => { target.classList.remove('field-invalid'); e.removeEventListener('input', drop); e.removeEventListener('change', drop); };
    e.addEventListener('input', drop);
    e.addEventListener('change', drop);
  };
  /* Bias trước/sau khắc phục (mục 4-6) và số tham khảo ΔSEcrit/ΔREcrit (mục 7) — thuần,
     không đụng DOM/state, nhận t/l đã tra sẵn để render lẫn refresh dùng chung một nguồn
     tính toán. Cố ý dùng HAI bias khác việc: "sau khắc phục" trả lời "đã sửa xong chưa"
     (mục 4-6, so với ngưỡng TEa/4); "trước khắc phục" trả lời "lúc sự cố xảy ra nặng cỡ
     nào" (mục 7, đưa vào ΔSEcrit/ΔREcrit) — dùng nhầm biasAfter cho mục 7 sẽ luôn ra
     "nguy cơ thấp" giả vì Bias sau khắc phục gần như luôn nhỏ theo định nghĩa.
     raw rỗng/không phải số KHÔNG được rơi về 0: 0% bias là một kết quả hợp lệ (đạt),
     khác hẳn "chưa đo lại" — cùng loại lỗi finiteNumber(v,0) đã sửa ở
     ReagentComparisonService.updateMetadata() trong phiên này (biasTarget/alpha). */
  const actionBiasInfo = (t: AnyRec, l: AnyRec, biasBeforeRaw: unknown, biasAfterRaw: unknown) => deps.ActionBiasService.info(t, l, biasBeforeRaw, biasAfterRaw);
  /* t/l cho actionBiasInfo(): hồ sơ đang sửa dùng đúng testId/level đã khóa (editing),
     hồ sơ mới đọc theo ô đang chọn trên form — giống cách syncActLevels() tra levels. */
  const actionBiasContext = (form: AnyRec, editing: AnyRec) => deps.pres.actionBiasContextPresentation(form, editing, state().tests, deps.lvlCfg);
  /* Gợi ý Bias trước khắc phục từ kỳ Sigma gần nhất — CHÈN ĐƯỢC, không auto-fill:
     Bias EQA của Sigma là hiệu năng NỀN của xét nghiệm (kỳ gần nhất, RMS nhiều vòng),
     khác với "Bias trước khắc phục" của riêng sự cố này — người dùng có thể đúng là
     muốn dùng lại số đó, nhưng app không được tự ý ghi đè, giống mọi chip gợi ý khác
     trong form này (ACT_SUGGEST). sgBiasVal (sigma.js) đã ưu tiên biasEqa rồi mới tới
     bias — lấy lại đúng logic đó, không tính RMS lần thứ hai ở đây. */
  const actionLatestSigmaBias = (t: AnyRec, level: unknown) => deps.ActionBiasService.latestSigmaBias(t, level, state().sigmaData);
  const actionFillBias = (targetId: string, value: unknown) => {
    const e = doc().getElementById(targetId);
    if (!e) return;
    e.value = deps.fmt(value);
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.focus();
  };
  const actionBiasThresholdHtml = (info: AnyRec) => deps.ActionBiasPresentation.thresholdHtml(info);
  const actionBiasReferenceHtml = (info: AnyRec) => deps.ActionBiasPresentation.referenceHtml(info);
  /* Gọi khi gõ Bias trước/sau: cập nhật cả hint ngưỡng ở mục 4-6 lẫn thẻ tham khảo ở
     mục 7 từ CÙNG một actionBiasInfo(), tránh hai nơi tính lệch nhau. */
  const actionUpdateBiasHint = () => {
    const editing = actionUi().editId && (state().actions || []).find((a: AnyRec) => a.id === actionUi().editId);
    const testId = editing ? editing.testId : actionFieldValue('aTest', 80), level = editing ? editing.level : (doc().getElementById('aLevel') || {}).value;
    const t = state().tests.find((x: AnyRec) => x.id === testId), l = t && level ? deps.lvlCfg(t, +level) : null;
    const info = actionBiasInfo(t, l, actionFieldValue('aBiasBefore', 20), actionFieldValue('aBiasAfter', 20));
    const thr = doc().getElementById('aBiasThresholdHint');
    if (thr) thr.innerHTML = actionBiasThresholdHtml(info);
    const ref = doc().getElementById('aPatientRiskRef');
    if (ref) ref.innerHTML = actionBiasReferenceHtml(info);
  };
  /* actionFormViewModel(): dữ liệu thuần cho trang React (src/react/pages/ActionsPage.tsx) —
     bản form 8 mục cổ điển (actionFormHtml(), từng dựng HTML string) đã bị xoá sau khi
     qua parity-check và xác minh trực tiếp trong trình duyệt (xem
     docs/REACT-ADOPTION-PLAN.md). actionEvidenceTimelineHtml/rerunEvidenceHtml/bias
     threshold-hint/reference-hint vẫn là chuỗi HTML tái dùng nguyên (không viết lại
     bằng JSX): đây đúng là nội dung được vá trực tiếp qua actionUpdateBiasHint() sau
     khi mount, y hệt cách sgRefresh()/rcCompute() vá DOM ở các trang trước — viết lại
     bằng JSX sẽ tạo ra hai nơi tính cùng một thứ, một nguồn dữ liệu duy nhất là điều
     phải giữ. */
  const actionFormViewModel = (issueCount: number): AnyRec => {
    const tests = deps.operationalTests();
    const renderState = deps.pres.actionFormRenderState({ actions: state().actions || [], tests, editId: actionUi().editId, seed: actionUi().seed, currentUser: deps.currentUser(), draft: actionDraftValues(), buildModel: actionFormModel, defaultModel: actionFormDefaults, protocol: (form: AnyRec) => deps.actionProtocolStatus({ ...form, protocolVersion: form.protocolVersion || 3 }), defaultOpen: actionDefaultOpenSections, openSections: actionUi().openSections, actionId: (a: AnyRec) => a.id });
    const editing = renderState.editing, form = renderState.form;
    const formAction = editing ? { ...editing, ...form, testId: editing.testId, level: editing.level, lot: editing.lot || '', pointId: editing.pointId || '' } : null, formRerun = formAction ? deps.actionRerunStatus(formAction) : null;
    const formOpen = renderState.formOpen;
    if (!formOpen) return { open: false, canWrite: deps.canWrite(), closed: { title: issueCount ? 'Chọn một sự cố để lập hồ sơ' : 'Không có vi phạm nào cần lập hồ sơ', message: issueCount ? `Có ${issueCount} sự cố ở trên — bấm "Lập hồ sơ" ngay trên dòng cần xử lý để hồ sơ được gắn đúng điểm QC và tự theo dõi QC chạy lại.` : 'Hồ sơ NCE thường bắt đầu từ một vi phạm ở trên. Nếu sự không phù hợp đến từ EQA, cảnh báo thiết bị, phản hồi lâm sàng hay đánh giá nội bộ thì mở hồ sơ thủ công.' } };
    const formProtocol = renderState.protocol, miss = formProtocol.missingBySection || {};
    const openSet = renderState.openSet;
    const qcBound = !!(form.pointId && (((state().data && state().data[form.testId]) || []).some((x: AnyRec) => x.id === form.pointId)));
    const knownTest = tests.some((t: AnyRec) => t.id === form.testId), missingTest = !knownTest && form.testId ? state().tests.find((t: AnyRec) => t.id === form.testId) : null;
    const testOptions: { id: string; label: string }[] = [];
    if (!qcBound) testOptions.push({ id: '', label: '— Không gắn xét nghiệm —' });
    if (missingTest || (!knownTest && form.testId)) testOptions.push({ id: form.testId, label: missingTest ? deps.testDisplayName(missingTest) : 'Xét nghiệm không còn vận hành' });
    tests.forEach((t: AnyRec) => testOptions.push({ id: t.id, label: deps.testDisplayName(t) }));
    const { t: biasT, l: biasL } = actionBiasContext(form, editing), biasInfo = actionBiasInfo(biasT, biasL, form.biasBefore, form.biasAfter);
    const sigmaBias = actionLatestSigmaBias(biasT, editing ? editing.level : form.level);
    const nceId = editing ? (editing.nceId || deps.nextNceId(deps.isoToday())) : deps.nextNceId(deps.isoToday());
    const investigationItem = (statusId: string, noteId: string, title: string, hint: string, statusKey: string, noteKey: string, lotToLot = false) => {
      const value = String((form as AnyRec)[statusKey] || ''), opts = lotToLot ? ACT_LOT2LOT_OPTS : ACT_CHECK_OPTS, choices = opts.filter(([v]) => v);
      return {
        statusId, noteId, title, hint, stateClass: actionInvestigationStateClass(value), stateLabel: LABELS.check[value] || 'Chưa kết luận', value,
        options: opts.map(([v, label]) => ({ value: v, label })),
        choices: choices.map(([v, label]) => ({ value: v, label: actionInvestigationChoiceLabel(v, label), active: v === value })),
        noteValue: (form as AnyRec)[noteKey] || '', suggestPhrases: ACT_SUGGEST[noteKey] || [],
      };
    };
    return {
      open: true, canWrite: deps.canWrite(), editing: !!editing,
      title: editing ? `Tiếp tục hồ sơ ${editing.nceId || 'NCE'}` : 'Lập hồ sơ sự không phù hợp (NCE)',
      incidentBanner: (() => { const html = actionIncidentBanner(form, editing); return html ? html : null; })(),
      formKey: (editing ? editing.id : (actionUi().seed ? 'seed:' + JSON.stringify(actionUi().seed) : 'new')) + ':' + actionUi().openSeq,
      nceId, qcBound, testOptions, selectedTestId: form.testId || '', testDisabled: !!editing,
      pointId: form.pointId || '', level: form.level == null ? '' : form.level,
      levelLabel: qcBound ? actionLevelContext(form.testId, form.level, form.lot) : null,
      date: form.date || deps.isoToday(),
      ruleOptions: actionRuleOptions().map((r: AnyRec) => (Array.isArray(r) ? { value: r[0], label: r[1] } : r)), selectedRule: form.rule || '',
      sourceOptions: actionSourceOptions(qcBound, form.eventSource || '').map(([v, l]: AnyRec) => ({ value: v, label: l })), selectedSource: form.eventSource || '',
      phaseOptions: ACT_PHASE_OPTS.map(([v, l]) => ({ value: v, label: l })), selectedPhase: form.processPhase || 'exam',
      errOptions: ACT_ERR_OPTS.map(([v, l]) => ({ value: v, label: l })), selectedErr: form.errorType || '',
      by: form.by || '', staffNames: [...new Set((state().users || []).filter((u: AnyRec) => u.active !== false).map((u: AnyRec) => String(u.name || u.username || '').trim()).filter(Boolean))],
      dueDate: form.dueDate || '',
      evidenceTimelineHtml: formAction ? deps.evidenceTimelineHtml(formAction, formRerun) : '',
      openSections: [...openSet],
      sections: {
        immediate: {
          chip: actionSectionChip(miss.immediate),
          containmentOptions: ACT_CONTAIN_OPTS.map(([v, l]) => ({ value: v, label: l })), containmentStatus: form.containmentStatus || '',
          containmentNote: form.containmentNote || '', containmentNoteSuggest: ACT_SUGGEST.containmentNote,
          correction: form.correction || '', correctionSuggest: ACT_SUGGEST.correction,
        },
        risk: {
          chip: actionSectionChip(miss.risk),
          severityOptions: ACT_SEVERITY_OPTS.map(([v, l]) => ({ value: v, label: l })), severity: form.riskSeverity ?? '',
          occurrenceOptions: ACT_OCCURRENCE_OPTS.map(([v, l]) => ({ value: v, label: l })), occurrence: form.riskOccurrence ?? '',
          detectOptions: ACT_DETECT_OPTS.map(([v, l]) => ({ value: v, label: l })), detectability: form.riskDetectability ?? '',
          levelOptions: ACT_RISK_LEVEL_OPTS.map(([v, l]) => ({ value: v, label: l })), level: form.riskLevel || '',
          scoreClass: ['low', 'medium', 'high', 'critical'].includes(form.riskLevel) ? form.riskLevel : 'none', score: deps.actionRiskScore(form) || '—',
          basis: form.riskBasis || '', basisSuggest: ACT_SUGGEST.riskBasis,
        },
        check: {
          chip: actionChecklistChip(form),
          items: [
            investigationItem('aQcMaterial', 'aQcMaterialNote', 'Vật liệu QC', 'Hạn dùng, bảo quản, hoàn nguyên', 'qcMaterialStatus', 'qcMaterialNote'),
            investigationItem('aInstrument', 'aInstrumentNote', 'Máy phân tích', 'Điện, nước, nhiệt độ, cảnh báo, bảo trì', 'instrumentStatus', 'instrumentNote'),
            investigationItem('aReagent', 'aReagentNote', 'Hóa chất / calibrator', 'Hạn dùng, số lô và điều kiện bảo quản', 'reagentStatus', 'reagentNote'),
            investigationItem('aCalibration', 'aCalibrationNote', 'Hiệu chuẩn', 'Tình trạng và chỉ định tái hiệu chuẩn', 'calibrationStatus', 'calibrationNote'),
            investigationItem('aLotToLot', 'aLotToLotNote', 'So sánh lot-to-lot', 'Dùng khi có thay đổi lô gần đây', 'lotToLotStatus', 'lotToLotNote', true),
          ],
        },
        cause: {
          chip: actionSectionChip(miss.cause),
          causeCategoryOptions: ACT_CAUSE_OPTS.map(([v, l]) => ({ value: v, label: l })), causeCategory: form.causeCategory || '',
          cause: form.cause || '', causeSuggest: actionCausePhrases(form.causeCategory),
          action: form.action || '', actionSuggest: actionActionPhrases(form.errorType),
          completedDate: form.actionCompletedDate || '',
          biasBefore: form.biasBefore || '', biasAfter: form.biasAfter || '',
          sigmaBiasChip: sigmaBias ? { period: sigmaBias.period, value: sigmaBias.value, valueText: deps.fmt(sigmaBias.value) } : null,
          thresholdHtml: actionBiasThresholdHtml(biasInfo),
          rerunEvidenceHtml: formAction ? deps.rerunEvidenceHtml(formAction, formRerun, state().tests.find((x: AnyRec) => x.id === formAction.testId)) : '',
          containmentHeld: form.containmentStatus === 'held',
          releaseOptions: ACT_RELEASE_OPTS.map(([v, l]) => ({ value: v, label: l })), releaseStatus: form.releaseStatus || '',
          releaseDate: form.releaseDate || '', releaseBy: form.releaseBy || '', releaseNote: form.releaseNote || '', releaseSuggest: ACT_SUGGEST.releaseNote,
        },
        patient: {
          chip: actionSectionChip(miss.patient),
          referenceHtml: actionBiasReferenceHtml(biasInfo),
          impactOptions: ACT_PATIENT_OPTS.map(([v, l]) => ({ value: v, label: l })), impact: form.patientImpact || '',
          action: form.patientAction || '', actionSuggest: ACT_SUGGEST.patientAction,
        },
        eff: {
          chip: actionEffSectionChip(form),
          statusOptions: ACT_EFF_OPTS.map(([v, l]) => ({ value: v, label: l })), status: form.effectivenessStatus || 'pending',
          date: form.effectivenessDate || '', note: form.effectivenessNote || '', noteSuggest: ACT_SUGGEST.effectivenessNote,
          severityOptions: ACT_SEVERITY_OPTS.map(([v, l]) => ({ value: v, label: l })), severity: form.residualSeverity ?? '',
          occurrenceOptions: ACT_OCCURRENCE_OPTS.map(([v, l]) => ({ value: v, label: l })), occurrence: form.residualOccurrence ?? '',
          detectOptions: ACT_DETECT_OPTS.map(([v, l]) => ({ value: v, label: l })), detectability: form.residualDetectability ?? '',
          levelOptions: ACT_RISK_LEVEL_OPTS.map(([v, l]) => ({ value: v, label: l })), level: form.residualRiskLevel || '',
          scoreClass: ['low', 'medium', 'high', 'critical'].includes(form.residualRiskLevel) ? form.residualRiskLevel : 'none', score: deps.actionResidualRiskScore(form) || '—',
          basis: form.residualRiskBasis || '', basisSuggest: ACT_SUGGEST.residualRiskBasis,
        },
      },
    };
  };

  return {
    actionUi, actionSectionToggled, actionDefaultOpenSections, actionRuleOptions,
    captureActionDraft, actionFormChanged, actionDraftValues, clearActionDraft, actionSourceOptions,
    actionCausePhrases, actionActionPhrases, actionInsertSuggestion,
    actionLevelLabel, syncActLevels, actionLevelContext, beginActionManual,
    closeActionForm, actionIncidentBanner, beginActionFromIssue, actionFieldValue,
    readActionProtocolForm, actionEffectivenessMissingKey, addAction, syncActionRiskScore,
    syncActionResidualRiskScore, editAction, actionInvestigationChoiceLabel,
    actionInvestigationStateClass, actionInvestigationChoose, actionInvestigationSync, actionChecklistRefresh,
    actionSectionChip, actionChecklistChip, actionEffSectionChip, actionUpdateSectionChip,
    actionRefreshSectionChips, actionFormModel, actionFormDefaults, focusActionField,
    actionBiasInfo, actionBiasContext, actionLatestSigmaBias, actionFillBias, actionBiasThresholdHtml,
    actionBiasReferenceHtml, actionUpdateBiasHint, actionFormViewModel,
  };
}
