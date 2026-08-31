type AnyRec = any;

/**
 * Trang "Cấu hình chung" — mutation instrument/máy/panel/lô/nhóm lô/chuyển
 * tiếp lô/Mean-SD/xét nghiệm, kèm re-auth và audit trail. Đối tác của
 * manage-page-controller.ts (đọc/hiển thị); file này chỉ SỬA state.
 *
 * `document` là getter LAZY (`() => Document`), không phải giá trị capture một
 * lần — nhiều test đổi `document` giữa các lần gọi (mỗi test case seed lại một
 * bản `document.getElementById` khác nhau trả về giá trị form khác nhau), nên
 * đọc `deps.document()` mỗi lần thay vì giữ một tham chiếu cũ.
 */
export function createManageTestsActionsController(deps: {
  document: () => AnyRec;
  getState: () => AnyRec;
  ui: () => AnyRec;
  analysisUi: () => AnyRec;
  entryUi: () => AnyRec;
  rerender: () => void;
  resetMainScroll: () => void;
  role: () => string;
  userName: () => string;
  requireAdmin: (message?: string) => boolean;
  reauthenticateCurrentUser: (opts: AnyRec) => Promise<boolean>;
  esc: (value: unknown) => string;
  escapeAttr: (value: unknown) => string;
  btn: (label: string, action: string | { action: string; args?: unknown[] } | null, cls?: string, title?: string, options?: AnyRec) => string;
  emptyState: (title: string, body: string, actions?: string) => string;
  openModal: (html: string) => void;
  closeModal: () => void;
  openReactInstrumentModal: () => void;
  confirmDialog: (opts: AnyRec) => Promise<boolean>;
  infoDialog: (message: string, opts?: AnyRec) => Promise<unknown>;
  searchText: (value: unknown) => string;
  vnDate: (value: unknown) => string;
  fmt: (value: unknown, decimals?: number) => string;
  fmtTestValue: (test: AnyRec, value: unknown) => string;
  fmtPointValue: (point: AnyRec, test: AnyRec) => string;
  isoToday: () => string;
  parseVN: (value: unknown) => string;
  QCCore: { cleanText: (value: unknown, maximumLength?: number) => string };
  uid: () => string;
  effectiveTeaRefs: () => AnyRec[];
  teaAnalyteMeta: (name: unknown, record?: AnyRec) => AnyRec;
  teaAnalyteKey: (value: unknown) => string;
  testDisplayName: (test: AnyRec) => string;
  instrumentName: (id: unknown, fallback?: string) => string;
  lotTransitionToNo: (lotId: unknown) => unknown;
  targetGroupLots: (group: AnyRec) => AnyRec[];
  inspectAcceptedLotTransition: (input: AnyRec) => AnyRec;
  monthVN: (value: unknown) => string;
  upsertLotTargetHistory: (target: AnyRec, lot: AnyRec, values: AnyRec) => AnyRec;
  stats: (values: number[]) => AnyRec;
  pointsForLot: (testId: string, level: number, lotNo: string) => AnyRec[];
  pointStaff: (point: AnyRec) => AnyRec;
  testCusumConfig: (test: AnyRec) => AnyRec;
  wgRules: () => readonly string[];
  qcDecimalsDefault: () => number;
  refTests: () => AnyRec[][];
  ManageConfigService: AnyRec;
  PeriodService: AnyRec;
  LotTransitionPickerService: AnyRec;
  pres: AnyRec;
}) {
  const state = () => deps.getState();
  const ui = () => deps.ui();
  const doc = () => deps.document();

  const parseVN = (s: unknown) => deps.pres.parseVnDatePresentation(s);
  const setManageTab = (tab: unknown) => { ui().manageTab = ['lots', 'panels', 'targets', 'history', 'transitions', 'assays', 'instruments', 'tearefs'].includes(tab as string) ? tab : 'instruments'; ui().manageQ = ''; deps.rerender(); deps.resetMainScroll(); };
  const setTargetPanel = (id: unknown) => { ui().manageTargetPanel = id; deps.rerender(); };
  const setTargetGroup = (id: unknown) => { ui().manageTargetGroup = id; deps.rerender(); };
  const setTargetLevel = (level: unknown) => { ui().manageTargetLevel = String(level || ''); deps.rerender(); };
  const setHistoryTest = (id: unknown) => { ui().manageHistoryTest = id; deps.rerender(); };
  const openTargetMatrix = (panelId = '', groupId = '') => { if (panelId) ui().manageTargetPanel = panelId; if (groupId) ui().manageTargetGroup = groupId; setManageTab('targets'); };
  const targetNumberText = (value: unknown, test: AnyRec = null, kind = 'value') => deps.pres.targetNumberTextPresentation(value, test, kind);
  const targetConfigAssigned = (cfg: AnyRec) => deps.pres.targetConfigAssignedPresentation(cfg);
  const targetRangeDraft = (cfg: AnyRec = {}) => deps.pres.targetRangeDraftPresentation(cfg);
  /* Pha H2 nhóm (d): hai hàm dưới đây thay onclick="...(this,...)" — chuyển
     sang `function` trần (không phải arrow) để đọc `this` đúng phần tử, vì
     action-dispatcher.ts gọi qua `fn.apply(el,args)` (chỉ `function` mới
     nhận `this` từ apply(), arrow function bỏ qua). */
  const syncTargetRange = function (this: AnyRec, source: unknown) {
    const el = this;
    const row = el.closest('.target-row'); if (!row) return;
    const test = state().tests.find((x: AnyRec) => x.id === row.dataset.test) || null;
    const get = (selector: string) => { const value = row.querySelector(selector).value.trim(); return value === '' ? NaN : Number(value); };
    const result = deps.pres.targetRangeSyncPresentation(source, { mean: get('.tm-mean'), sd: get('.tm-sd'), low: get('.tm-low'), high: get('.tm-high') });
    if (!result) return;
    if (source === 'limits') { row.querySelector('.tm-mean').value = targetNumberText(result.mean, test); row.querySelector('.tm-sd').value = targetNumberText(result.sd, test, 'stat'); }
    else { row.querySelector('.tm-low').value = targetNumberText(result.low, test); row.querySelector('.tm-high').value = targetNumberText(result.high, test); }
  };
  const toggleTargetRow = function (this: AnyRec) { const el = this; const row = el.closest('.target-row'); row.querySelectorAll('.tm-mean,.tm-low,.tm-high,.tm-sd').forEach((x: AnyRec) => x.disabled = !el.checked); if (el.checked) { const mean = row.querySelector('.tm-mean'); if (!mean.value) mean.focus(); } };
  const targetCheckAll = (on: unknown) => { doc().querySelectorAll('.tm-use').forEach((box: AnyRec) => { box.checked = !!on; toggleTargetRow.call(box); }); };
  /* Áp 1 dòng Mean/SD (đã đọc/kiểm tra từ form) vào state cho đúng lô đang chọn.
     Nếu mức này trước đó đang gắn với MỘT LÔ KHÁC (một nhóm lô song song khác),
     chụp lại Mean/SD của lô cũ vào meanSdHistory trước khi ghi đè — nếu không, dữ
     liệu của lô cũ sẽ mất khi người dùng chuyển qua lại giữa các nhóm lô. Tách
     riêng khỏi saveTargetMatrix() (chỉ đọc DOM) để có thể kiểm thử độc lập. */
  const targetPickBackfillPoints = (t: AnyRec, lot: AnyRec, pick: AnyRec) => deps.ManageConfigService.targetPickBackfillPoints((state().data && state().data[t.id]) || [], t, lot, pick);
  const applyTargetPick = (t: AnyRec, lot: AnyRec, pick: AnyRec, effectiveFrom: unknown, note: unknown) => deps.ManageConfigService.applyTargetPick({ test: t, lot, pick, effectiveFrom, note, lots: state().qcLots || [], points: (state().data && state().data[t.id]) || [], upsertHistory: deps.upsertLotTargetHistory });
  /* Lưu Mean/SD của lô mới thành "Dự kiến": KHÔNG đổi qcLotId của mức (lô đang dùng
     vẫn giữ nguyên, vẫn nhập QC bình thường) — chỉ ghi 1 mốc meanSdHistory đánh dấu
     planned:true để lần sau mở lại nhóm lô này vẫn thấy đúng số đã nhập
     (lotTargetSnapshot() đọc lại từ đây). Khác voidQcPoint/applyTargetPick, không
     đụng tới cấu hình đang vận hành nên không cần requireUnlockedPeriod. */
  const applyPlannedTarget = (t: AnyRec, lot: AnyRec, pick: AnyRec, note: unknown) => deps.ManageConfigService.applyPlannedTarget({ test: t, lot, pick, note, upsertHistory: deps.upsertLotTargetHistory });
  const readTargetMatrixPicks = async (): Promise<AnyRec[] | null> => {
    const rows = [...doc().querySelectorAll('.target-row')], picked: AnyRec[] = [];
    for (const row of rows as AnyRec[]) {
      if (row.dataset.locked === '1') continue;
      const use = row.querySelector('.tm-use'), testId = row.dataset.test, lot = state().qcLots.find((x: AnyRec) => x.id === row.dataset.lot); if (!lot) continue; if (!use.checked) { picked.push({ testId, lot, use: false }); continue; }
      const meanRaw = row.querySelector('.tm-mean').value.trim(), lowRaw = row.querySelector('.tm-low').value.trim(), highRaw = row.querySelector('.tm-high').value.trim(), sdRaw = row.querySelector('.tm-sd').value.trim();
      const normalized = deps.ManageConfigService.normalizeTargetPick({ meanRaw, lowRaw, highRaw, sdRaw }); if (normalized.error) { await deps.infoDialog(normalized.message); return null; }
      picked.push({ testId, lot, ...normalized });
    }
    return picked;
  };
  const saveTargetMatrix = async () => {
    if (!deps.requireAdmin()) return;
    const panel = state().qcPanels.find((x: AnyRec) => x.id === ui().manageTargetPanel), group = state().lotGroups.find((x: AnyRec) => x.id === ui().manageTargetGroup), groupLots = deps.targetGroupLots(group); if (!panel) { await deps.infoDialog('Chọn Panel QC.'); return; } if (!group || !groupLots.length) { await deps.infoDialog('Chọn nhóm lô QC.'); return; }
    const picked = await readTargetMatrixPicks(); if (!picked) return;
    const overwrites = deps.pres.targetOverwritePicksPresentation(picked, state().tests);
    /* applyTargetPick() điền số lô/Mean-SD của lô ĐANG DÙNG (sắp bị thay) vào các điểm QC
       cũ ở cùng mức mà trước giờ chưa ghi lô riêng — vẫn là ghi đè hàng loạt lên
       state.data, cùng mối lo với renameLotAcrossPoints() ở saveConfigLot() nên phải hỏi
       trước nếu đụng kỳ đã khóa, không chỉ dừng ở bước xác thực mật khẩu như trước
       2026-08-09. */
    const backfilled = picked.filter(p => p.use).flatMap(pick => { const t = state().tests.find((x: AnyRec) => x.id === pick.testId); return t ? targetPickBackfillPoints(t, pick.lot, pick) : []; });
    const locked = deps.PeriodService.lockedPoints(state(), backfilled);
    if (!overwrites.length) {
      if (locked.count && !await deps.confirmDialog({ kicker: 'Cập nhật hàng loạt', title: 'Điền lô/Mean-SD cho điểm QC đã khóa kỳ', message: `Lưu Mean/SD này sẽ điền số lô/Mean-SD hiện hành vào ${locked.count} điểm QC trước đó chưa ghi lô, thuộc kỳ đã khóa (${locked.periods.map(deps.monthVN).join(', ')}).`, detail: 'Giá trị đo và ngày của từng điểm không đổi — chỉ điền thêm nhãn số lô/Mean-SD còn thiếu.', confirmLabel: 'Vẫn lưu', cancelLabel: 'Hủy', danger: false })) return;
      if (!await deps.reauthenticateCurrentUser({ title: 'Xác thực Mean/SD', message: 'Nhập lại mật khẩu trước khi lưu Mean/SD cho lô QC.' })) return;
      commitTargetMatrix(picked, group, 'switch', []); return;
    }
    ui().targetSwitchCtx = { group, picked, overwrites, locked };
    openTargetSwitchModal();
  };
  const openTargetSwitchModal = () => {
    const { group, overwrites, locked } = ui().targetSwitchCtx || {}; if (!group) return;
    const names = deps.pres.targetSwitchAssayNamesPresentation(overwrites.map((pick: AnyRec) => { const pt = state().tests.find((t: AnyRec) => t.id === pick.testId); return pt && deps.testDisplayName(pt); }));
    const lockNote = deps.pres.targetLockedBackfillNotePresentation({ count: (locked && locked.count) || 0, periods: (locked && locked.periods.map(deps.monthVN)) || [], emphasize: true });
    deps.openModal(deps.pres.targetSwitchModalHtml({ groupName: deps.esc(group.name), overwriteCount: overwrites.length, assayNames: deps.esc(names), lockNote, cancelButtonHtml: deps.btn('Hủy', { action: 'closeModal' }, 'ghost'), plannedButtonHtml: deps.btn('Dự kiến', { action: 'resolveTargetSwitch', args: ['planned'] }, 'ghost'), switchButtonHtml: deps.btn('Chuyển qua nhóm lô này', { action: 'resolveTargetSwitch', args: ['switch'] }, 'teal') }));
  };
  const resolveTargetSwitch = async (mode: unknown) => {
    const ctx = ui().targetSwitchCtx; deps.closeModal(); ui().targetSwitchCtx = null; if (!ctx) return;
    if (!await deps.reauthenticateCurrentUser({ title: 'Xác thực chuyển lô', message: 'Nhập lại mật khẩu trước khi lưu hoặc áp dụng Mean/SD cho nhóm lô mới.' })) return;
    commitTargetMatrix(ctx.picked, ctx.group, mode, ctx.overwrites);
  };
  const commitTargetMatrix = (picked: AnyRec, group: AnyRec, mode: unknown, overwrites: AnyRec) => {
    deps.pres.ManageTargetMatrixWorkflowCommand.commit({ picked, group, mode, overwrites, effectiveFrom: deps.isoToday(), panelId: ui().manageTargetPanel });
  };
  const openQcHistoryDetail = (tid: unknown, level: unknown, lotNo = '') => {
    const t = state().tests.find((x: AnyRec) => x.id === tid), l = t && t.levels.find((x: AnyRec) => +x.level === +(level as AnyRec)); if (!t || !l) return;
    const hist = (l.meanSdHistory || []).filter((h: AnyRec) => !lotNo || (h.lot || '') === lotNo || (!h.lot && (l.lot || '') === lotNo));
    const histRows = hist.length ? deps.pres.qcHistoryMeanSdRowsHtml(hist.map((h: AnyRec) => { const rowLot = h.lot || lotNo || '', cumSt = deps.stats(deps.pointsForLot(tid as string, level as number, rowLot).filter((p: AnyRec) => !h.effectiveTo || p.date <= h.effectiveTo).map((p: AnyRec) => p.val)); return { lot: deps.esc(rowLot || '—'), mean: deps.fmtTestValue(t, h.mean), sd: deps.fmtTestValue(t, h.sd), cumulativeMean: cumSt ? deps.fmtTestValue(t, cumSt.m) : '—', cumulativeSd: cumSt ? deps.fmtTestValue(t, cumSt.sd) : '—', cumulativeCv: cumSt ? deps.fmt(cumSt.cv) + '%' : '—', period: `${h.effectiveFrom ? deps.vnDate(h.effectiveFrom) : 'Không giới hạn'} → ${h.effectiveTo ? deps.vnDate(h.effectiveTo) : 'Không giới hạn'}`, source: h.source === 'lab' ? 'PXN' : 'NSX' }; })) : '';
    const pts = (state().data[tid as string] || []).filter((p: AnyRec) => +p.level === +(level as AnyRec) && (!lotNo || (p.lot || '') === lotNo)).sort((a: AnyRec, b: AnyRec) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.runId || '').localeCompare(String(b.runId || ''), 'vi', { numeric: true }));
    const ptRows = deps.pres.qcHistoryPointRowsHtml(pts.map((p: AnyRec) => { const mean = Number.isFinite(+p.qcMean) ? +p.qcMean : +l.mean, sd = Number.isFinite(+p.qcSd) && +p.qcSd > 0 ? +p.qcSd : +l.sd, z = sd ? (+p.val - mean) / sd : NaN, abs = Math.abs(z), verdict = abs > 3 ? 'Loại bỏ' : abs > 2 ? 'Cảnh báo' : 'Đạt', verdictClass = abs > 3 ? 'rej' : abs > 2 ? 'warn' : 'ok', staff = deps.pointStaff(p); return { date: deps.vnDate(p.date), run: deps.esc(p.runId || '—'), value: deps.fmtPointValue(p, t), z: Number.isFinite(z) ? (z >= 0 ? '+' : '') + deps.fmt(z) + 's' : '—', mean: deps.fmtTestValue(t, mean), sd: deps.fmtTestValue(t, sd), verdict, verdictClass, staffCode: deps.esc(staff.code || '—') }; }));
    deps.openModal(deps.pres.qcHistoryDetailModalHtml({ title: `${deps.esc(deps.testDisplayName(t))} · Mức ${level}${lotNo ? ' · Lô ' + deps.esc(lotNo) : ''}`, historyRowsHtml: histRows, historyEmptyHtml: deps.emptyState('Chưa có mốc Mean/SD', 'Không tìm thấy lịch sử Mean/SD cho lô này.'), pointCount: pts.length, pointRowsHtml: ptRows, pointsEmptyHtml: deps.emptyState('Chưa có điểm QC', 'Không có điểm QC nào khớp với lô/mức này.'), closeButtonHtml: deps.btn('Đóng', { action: 'closeModal' }, 'teal') }));
  };
  /* openConfigPanelModel(): dữ liệu thuần cho modal React (Giai đoạn 3,
     PanelModal.tsx) — thay openConfigPanel() tự dựng chuỗi HTML rồi mở
     modal. Trả Promise<Model|null> giống lisOpenQueueModal()/openUserPerms():
     hai gate kiểm tra ("chưa có xét nghiệm"/"chưa có máy") mỗi cái đều
     chuyển tab + báo lỗi rồi trả null — bridge chỉ mở modal React khi khác
     null. allTests trả CẢ danh sách (không lọc theo máy) vì component React
     tự lọc lại mỗi khi đổi máy — khác renderConfigPanelTests() cũ (dựng lại
     chuỗi HTML mỗi lần đổi máy). */
  const openConfigPanelModel = async (id = '') => {
    if (!state().tests.length) { await deps.infoDialog('Hãy tạo xét nghiệm trước khi tạo Panel QC.'); setManageTab('assays'); return null; }
    if (!state().instruments.length) { await deps.infoDialog('Hãy tạo máy xét nghiệm trước khi tạo Panel QC.'); setManageTab('instruments'); return null; }
    const p = state().qcPanels.find((x: AnyRec) => x.id === id) || { testIds: [], instrumentId: state().instruments[0] && state().instruments[0].id, active: true };
    return {
      id, name: p.name || '',
      instruments: state().instruments.map((i: AnyRec) => ({ id: i.id, label: i.name + (i.model ? ' · ' + i.model : '') })),
      instrumentId: p.instrumentId || '',
      allTests: state().tests.map((t: AnyRec) => ({ id: t.id, name: deps.testDisplayName(t), instrument: deps.instrumentName(t.instrumentId, t.machine), unit: t.unit || '', instrumentId: t.instrumentId })),
      testIds: p.testIds || [], note: p.note || '', active: p.active !== false,
    };
  };
  const saveConfigPanel = async (id: unknown) => {
    if (!deps.requireAdmin()) return;
    const data = { name: doc().getElementById('cfgPanelName').value, instrumentId: doc().getElementById('cfgPanelInstrument').value, testIds: [...doc().querySelectorAll('.cfg-panel-test:checked')].map((x: AnyRec) => x.value), note: doc().getElementById('cfgPanelNote').value, active: doc().getElementById('cfgPanelActive').checked }, result = deps.pres.ManagePanelWorkflowCommand.save({ id, newId: deps.uid(), data }); if (!result.ok) { await deps.infoDialog(result.message); return; }
  };
  const deleteConfigPanel = async (id: unknown) => { if (!deps.requireAdmin()) return; const checked = deps.ManageConfigService.panelRemoval(state(), { id }); if (checked.error) { if (checked.message) await deps.infoDialog(checked.message); return; } if (!await deps.confirmDialog({ kicker: 'Thao tác không thể hoàn tác', title: 'Xóa Panel QC', message: `Xóa Panel QC ${checked.record.name}?`, detail: 'Các xét nghiệm vẫn được giữ nguyên.', confirmLabel: 'Xóa Panel QC', cancelLabel: 'Hủy' })) return; const result = deps.pres.ManagePanelWorkflowCommand.remove({ id }); if (!result.ok) { await deps.infoDialog(result.message); return; } };
  const deleteLotTransition = async (id: unknown) => { if (!deps.requireAdmin()) return; const checked = deps.pres.ManageLotTransitionWorkflowCommand.checkRemoval({ id }); if (checked.error) { if (checked.message) await deps.infoDialog(checked.message); return; } if (!await deps.confirmDialog({ kicker: 'Thao tác không thể hoàn tác', title: 'Xóa dòng chuyển tiếp lô', message: 'Xóa dòng chuyển tiếp lô này?', confirmLabel: 'Xóa', cancelLabel: 'Hủy' })) return; deps.pres.ManageLotTransitionWorkflowCommand.remove({ id }); };
  const lotTransitionChoiceLabel = (lot: AnyRec) => deps.LotTransitionPickerService.label(lot);
  const lotTransitionChoiceLots = (selectedId = '') => deps.LotTransitionPickerService.availableLots(state().qcLots || [], selectedId);
  const lotTransitionChoiceMatch = (value: unknown, selectedId = '') => deps.LotTransitionPickerService.match(state().qcLots || [], value, selectedId);
  const lotTransitionSelectedId = (inputId: string) => { const el = doc().getElementById(inputId); if (!el) return ''; const lot = lotTransitionChoiceMatch(el.value, el.dataset.lotId || ''); if (lot) el.dataset.lotId = lot.id; return (lot && lot.id) || ''; };
  /* openLotTransitionModel(): dữ liệu thuần cho modal React (Giai đoạn 3,
     LotTransitionModal.tsx) — thay openLotTransitionV2() tự dựng chuỗi HTML
     rồi mở modal. Danh sách lô cho mỗi ô combobox (fromOptions/toOptions) chỉ
     tính MỘT LẦN lúc mở (giống bản classic — lotTransitionChoiceHtml() cũ cũng
     chỉ build optionsHtml một lần, không refresh theo từng phím gõ), nên
     component không cần tính lại khi đổi giá trị đang gõ dở. */
  const openLotTransitionModel = async (id = '') => {
    if (!state().qcPanels.length) { await deps.infoDialog('Hãy tạo Panel QC trước khi tạo chuyển tiếp lô.'); setManageTab('panels'); return null; }
    if (state().qcLots.length < 2) { await deps.infoDialog('Cần ít nhất 2 lô QC để tạo chuyển tiếp.'); setManageTab('lots'); return null; }
    const tr = state().lotTransitions.find((x: AnyRec) => x.id === id) || { panelId: state().qcPanels[0] && state().qcPanels[0].id, fromLotId: '', toLotId: '', startDate: deps.isoToday(), status: 'planned', approvedBy: '', approvedAt: '' };
    const fromLot = state().qcLots.find((l: AnyRec) => l.id === tr.fromLotId), toLot = state().qcLots.find((l: AnyRec) => l.id === tr.toLotId);
    return {
      id, panels: state().qcPanels.map((p: AnyRec) => ({ id: p.id, label: `${p.name} · ${deps.instrumentName(p.instrumentId)}` })), panelId: tr.panelId || '',
      fromLotId: tr.fromLotId || '', fromValue: lotTransitionChoiceLabel(fromLot), fromOptions: lotTransitionChoiceLots(tr.fromLotId).map((l: AnyRec) => lotTransitionChoiceLabel(l)),
      toLotId: tr.toLotId || '', toValue: lotTransitionChoiceLabel(toLot), toOptions: lotTransitionChoiceLots(tr.toLotId).map((l: AnyRec) => lotTransitionChoiceLabel(l)),
      startDate: tr.startDate || '', status: tr.status,
    };
  };
  /* lotTransitionTargetsModel(): bản dữ liệu thuần của lotTransitionTargetsHtml()
     cũ — component React gọi trực tiếp trong render mỗi khi Panel/Lô cũ/Lô mới
     đổi (qua useState), nên không cần hàm "refresh" nào vá lại DOM như bản
     classic (refreshLotTransitionTargets() đã xóa). */
  const lotTransitionTargetsModel = (panelId: unknown, fromLotId: unknown, toLotId: unknown): AnyRec => {
    if (!panelId || !fromLotId || !toLotId || fromLotId === toLotId) return { kind: 'hint', message: 'Chọn Panel QC, Lô cũ và Lô mới (khác nhau, cùng mức) để nhập Mean/SD cho lô mới.' };
    const check = deps.inspectAcceptedLotTransition({ panelId, fromLotId, toLotId, status: 'accepted' });
    if (!check.valid) return { kind: 'hint', message: 'Lô cũ và lô mới phải cùng mức QC.' };
    if (!check.rows.length) return { kind: 'hint', message: `Panel đã chọn không có xét nghiệm nào đang dùng lô cũ ${check.from.lotNo}.` };
    const rows = check.rows.map(({ t, nextHist }: AnyRec) => {
      const draft = targetRangeDraft(nextHist || {}), has = Number.isFinite(draft.mean) && ((Number.isFinite(draft.sd) && draft.sd > 0) || (Number.isFinite(draft.low) && Number.isFinite(draft.high)));
      return { testId: t.id, name: deps.testDisplayName(t), unit: t.unit || '', mean: targetNumberText(draft.mean, t), low: targetNumberText(draft.low, t), high: targetNumberText(draft.high, t), sd: targetNumberText(draft.sd, t, 'stat'), assigned: has };
    });
    return { kind: 'rows', lotNo: check.to.lotNo, rows };
  };
  /* Đọc bảng Mean/SD nhúng trong modal chuyển lô. Dòng để trống hoàn toàn (cả 4 ô)
     được bỏ qua, không báo lỗi — cho phép lưu hồ sơ ở trạng thái Dự kiến/Đang chạy
     song song mà chưa cần điền đủ; chỉ khi "Chấp nhận lô mới" mới bắt buộc đủ,
     thông qua inspectAcceptedLotTransition() chạy sau bước này. */
  const readLotTransitionTargetPicks = async (rows: AnyRec[]): Promise<AnyRec[] | null> => {
    const picks: AnyRec[] = [];
    for (const { t } of rows) {
      const row = doc().querySelector(`#cfgTransTargets .target-row[data-test="${t.id}"]`); if (!row) { picks.push({ t, use: false }); continue; }
      const meanRaw = row.querySelector('.tm-mean').value.trim(), lowRaw = row.querySelector('.tm-low').value.trim(), highRaw = row.querySelector('.tm-high').value.trim(), sdRaw = row.querySelector('.tm-sd').value.trim();
      if (!meanRaw && !lowRaw && !highRaw && !sdRaw) { picks.push({ t, use: false }); continue; }
      const normalized = deps.ManageConfigService.normalizeTargetPick({ meanRaw, lowRaw, highRaw, sdRaw, deriveLimits: false }); if (normalized.error) { const msgs: AnyRec = { 'invalid-mean': 'nhập trung bình mục tiêu hợp lệ cho lô mới.', 'invalid-limits': 'giới hạn dưới/trên phải là số hợp lệ.', 'invalid-range': 'nếu nhập giới hạn, cần nhập đủ giới hạn dưới và trên; giới hạn trên phải lớn hơn giới hạn dưới.', 'invalid-sd': 'độ lệch chuẩn phải là số lớn hơn 0.', 'missing-sd': 'cần độ lệch chuẩn, hoặc đủ giới hạn dưới/trên để ước tính SD.' }; await deps.infoDialog(`${deps.testDisplayName(t)}: ${msgs[normalized.error] || normalized.message}`); return null; }
      picks.push({ t, ...normalized });
    }
    return picks;
  };
  const saveLotTransitionV2 = async (id: unknown) => {
    if (!deps.requireAdmin()) return;
    const panelId = doc().getElementById('cfgTransPanel').value, fromLotId = lotTransitionSelectedId('cfgTransFrom'), toLotId = lotTransitionSelectedId('cfgTransTo'), status = doc().getElementById('cfgTransStatus').value, startRaw = doc().getElementById('cfgTransStart').value.trim(), startDate = parseVN(startRaw); if (startRaw && !startDate) { await deps.infoDialog('Ngày bắt đầu không hợp lệ. Dùng dạng dd/mm/yyyy.'); return; }
    const prep = deps.pres.ManageLotTransitionCommand.prepare({ state: state(), id, panelId, fromLotId, toLotId, status, startDate, today: deps.isoToday(), approvedBy: deps.userName(), approvedAt: new Date().toISOString() }); if (!prep.ok) { await deps.infoDialog(prep.message); return; }
    if (prep.needsReauth && !await deps.reauthenticateCurrentUser({ title: 'Xác thực kết luận chuyển lô', message: 'Nhập lại mật khẩu trước khi chấp nhận hoặc từ chối lô QC mới.' })) return;
    const targetCheck = deps.inspectAcceptedLotTransition({ panelId, fromLotId, toLotId, status: 'accepted' });
    if (targetCheck.valid && targetCheck.rows.length) {
      const picks = await readLotTransitionTargetPicks(targetCheck.rows); if (picks === null) return;
      picks.forEach(pick => { if (pick.use) applyPlannedTarget(pick.t, prep.toLot, pick, 'Nhập khi tạo hồ sơ chuyển lô'); });
    }
    const gate = deps.pres.ManageLotTransitionCommand.acceptanceGate({ state: state(), data: prep.data, finalChanged: prep.finalChanged }); if (!gate.ok) { await deps.infoDialog(gate.message); return; }
    const result = deps.pres.ManageLotTransitionWorkflowCommand.execute({ id, newId: deps.uid(), data: prep.data }); if (!result.ok) { await deps.infoDialog(result.message); return; }
  };
  /* openConfigGroupModel(): dữ liệu thuần cho modal React (Giai đoạn 3,
     LotGroupModal.tsx) — thay openConfigGroup() tự dựng chuỗi HTML rồi mở
     modal. Danh sách lô theo mức KHÔNG cần state React (không có logic lọc
     lại theo lựa chọn khác như Panel QC) nên dựng thẳng bằng JSX thay vì
     dangerouslySetInnerHTML; suggestConfigGroupName() (không đổi, vẫn đọc
     DOM .cfg-group-lot:checked trực tiếp) được gọi qua onChange bắt ở
     container cha (giống data-notify-changed cũ), không cần onChange riêng
     từng checkbox. */
  const openConfigGroupModel = async (id = '') => {
    if (!state().qcLots.length) { await deps.infoDialog('Hãy tạo lô QC trước khi tạo nhóm lô.'); setManageTab('lots'); return null; }
    const g = state().lotGroups.find((x: AnyRec) => x.id === id) || { lotIds: [] };
    const levels = [...new Set(state().qcLots.map((l: AnyRec) => +l.level).filter(Number.isFinite))].sort((a: AnyRec, b: AnyRec) => a - b);
    const levelLayout = levels.length >= 3 ? 'levels-3plus' : levels.length === 2 ? 'levels-2' : 'levels-1';
    const columns = levels.map((level: AnyRec) => ({ level, lots: state().qcLots.filter((l: AnyRec) => +l.level === level).map((l: AnyRec) => { const selected = (g.lotIds || []).includes(l.id), locked = l.depleted && !selected, to = l.depleted ? deps.lotTransitionToNo(l.id) : '', depletedLabel = l.depleted ? (to ? 'đã chuyển tiếp qua lô ' + to : 'đã hết QC') : ''; return { id: l.id, lotNo: l.lotNo, expiry: l.exp ? deps.vnDate(l.exp) : 'chưa có', selected, depleted: !!l.depleted, locked, depletedLabel }; }) }));
    return { id, levelLayout, columns, name: g.name || '', note: g.note || '' };
  };
  const suggestConfigGroupName = () => { const ids = [...doc().querySelectorAll('.cfg-group-lot:checked')].map((x: AnyRec) => x.value), name = ids.map((id: unknown) => (state().qcLots.find((l: AnyRec) => l.id === id) || {}).lotNo).filter(Boolean).join('/'), el = doc().getElementById('cfgGroupName'); if (el) el.value = name; };
  const saveConfigGroup = async (id: unknown) => {
    if (!deps.requireAdmin()) return;
    const data = { name: doc().getElementById('cfgGroupName').value, lotIds: [...doc().querySelectorAll('.cfg-group-lot:checked')].map((x: AnyRec) => x.value), note: doc().getElementById('cfgGroupNote').value };
    const result = deps.pres.ManageLotGroupWorkflowCommand.save({ id, newId: deps.uid(), data }); if (!result.ok) { await deps.infoDialog(result.message); return; }
  };
  const deleteConfigGroup = async (id: unknown) => { if (!deps.requireAdmin()) return; const checked = deps.ManageConfigService.lotGroupRemoval(state(), { id }); if (checked.error) { if (checked.message) await deps.infoDialog(checked.message); return; } if (!await deps.confirmDialog({ kicker: 'Thao tác không thể hoàn tác', title: 'Xóa nhóm lô', message: `Xóa nhóm lô ${checked.record.name}?`, detail: 'Các lô QC bên trong vẫn được giữ nguyên.', confirmLabel: 'Xóa nhóm lô', cancelLabel: 'Hủy' })) return; const result = deps.pres.ManageLotGroupWorkflowCommand.remove({ id }); if (!result.ok) { await deps.infoDialog(result.message); return; } };
  /* Dừng luồng vận hành của nhóm: giữ nguyên liên kết lô/Mean-SD để bảo toàn lịch sử và
     có thể kích hoạt lại, nhưng isOperationalLotGroup() sẽ loại nhóm khỏi Nhập QC cùng
     mọi luồng vận hành mới. Chiều ngược lại đi qua activateLotGroup(). */
  const toggleLotGroupStatus = (id: unknown) => {
    if (!deps.requireAdmin()) return;
    deps.pres.ManageLotGroupWorkflowCommand.stop({ id, stoppedAt: deps.isoToday() });
  };
  /* Kích hoạt một nhóm lô đang "Đã dừng"/"Dự kiến"/"Chưa dùng": với mỗi xét nghiệm có mức
     khớp lô trong nhóm và CHƯA đang gắn đúng lô đó, lấy Mean/SD đã biết của chính lô này —
     ưu tiên bản "Dự kiến" vừa lưu (lotTargetSnapshot đọc cả hai) — rồi áp làm cấu hình
     sống (applyTargetPick), y hệt bấm "Chuyển qua nhóm lô này" ở màn Mean/SD nhưng làm
     thẳng từ thẻ nhóm lô, không cần mở lại màn hình và tick từng dòng. Nhóm đang gắn
     trước đó (nếu khác) được đánh dấu "Đã dừng"; xét nghiệm không có Mean/SD nào cho lô
     này (chưa từng nhập) thì bỏ qua, không báo lỗi — chỉ áp được cho phần đã biết số liệu.
     Nếu nhóm thực ra đã đang được dùng thật rồi (chỉ còn dính nhãn "Đã dừng"/"Dự kiến" cũ,
     vd bấm nhầm hoặc dữ liệu cũ) thì không có gì để áp cả — chỉ gỡ nhãn cho khớp thực tế. */
  /* Transaction kích hoạt nhóm lô nằm ở ManageLotGroupActivationCommand (TypeScript):
     preview() tính trước ứng viên + điểm rơi vào kỳ đã khóa cho hộp xác nhận, execute()
     áp thật — hai pha dùng CHUNG một danh sách candidates nên hộp xác nhận không lệch
     với những gì được áp. Adapter này chỉ giữ confirm/dialog và render. */
  const activateLotGroup = async (id: unknown) => {
    if (!deps.requireAdmin()) return;
    const preview = deps.pres.ManageLotGroupWorkflowCommand.previewActivation({ id }); if (!preview.ok) return;
    const g = preview.group;
    const lockNote = deps.pres.targetLockedBackfillNotePresentation({ count: preview.locked.count, periods: preview.locked.periods.map(deps.monthVN) });
    if (!await deps.confirmDialog({ title: 'Kích hoạt nhóm lô', message: `Áp dụng Mean/SD của nhóm lô ${g.name} cho các xét nghiệm liên quan và chuyển sang dùng nhóm này?`, detail: lockNote, confirmLabel: 'Áp dụng', cancelLabel: 'Hủy', danger: false })) return;
    const result = deps.pres.ManageLotGroupWorkflowCommand.executeActivation({ group: g, candidates: preview.candidates, effectiveFrom: deps.isoToday(), note: 'Kích hoạt nhóm lô' });
    if (result.status === 'already-active') { await deps.infoDialog(`Nhóm lô ${g.name} đã đang được xét nghiệm dùng thật, chỉ gỡ nhãn cũ.`, { type: 'success' }); return; }
    if (result.status === 'unready') {
      await deps.infoDialog('Nhóm lô này chưa có Mean/SD (dự kiến hoặc lịch sử) cho xét nghiệm nào để áp dụng. Vào màn Mean/SD để nhập trước.'); return;
    }
    await deps.infoDialog(`Đã áp dụng Mean/SD cho ${result.count} dòng và chuyển sang nhóm lô ${g.name}.`, { type: 'success' });
  };
  /* openConfigLotModel(): dữ liệu thuần cho modal React (Giai đoạn 3,
     LotModal.tsx) — thay openConfigLot() tự dựng chuỗi HTML rồi mở modal.
     Không gate quyền ở đây (giống bản cũ) — requireAdmin() chỉ kiểm khi lưu. */
  const openConfigLotModel = (id = '') => {
    const l = state().qcLots.find((x: AnyRec) => x.id === id) || { level: 1, active: true };
    return { id, lotNo: l.lotNo || '', level: +l.level || 1, description: l.description || '', supplier: l.supplier || '', opened: l.opened || '', exp: l.exp || '', note: l.note || '' };
  };
  const saveConfigLot = async (id: unknown) => {
    if (!deps.requireAdmin()) return;
    const lotNo = deps.QCCore.cleanText(doc().getElementById('cfgLotNo').value).trim(); if (!lotNo) { await deps.infoDialog('Nhập số lot.'); return; }
    const level = +doc().getElementById('cfgLotLevel').value || 1, openedRaw = doc().getElementById('cfgLotOpened').value.trim(), expRaw = doc().getElementById('cfgLotExp').value.trim(), opened = parseVN(openedRaw), exp = parseVN(expRaw);
    if (openedRaw && !opened) { await deps.infoDialog('Ngày mở không hợp lệ. Dùng dạng dd/mm/yyyy.'); return; } if (expRaw && !exp) { await deps.infoDialog('Hạn sử dụng không hợp lệ. Dùng dạng dd/mm/yyyy.'); return; }
    const existing = state().qcLots.find((x: AnyRec) => x.id === id), data = { lotNo, level, description: deps.QCCore.cleanText(doc().getElementById('cfgLotDescription').value), supplier: deps.QCCore.cleanText(doc().getElementById('cfgLotSupplier').value), program: (existing && existing.program) || '', opened, exp, note: deps.QCCore.cleanText(doc().getElementById('cfgLotNote').value, 5000), active: true };
    const preview = deps.pres.ManageLotWorkflowCommand.preview({ id, data }); if (!preview.ok) { await deps.infoDialog(preview.message); return; }
    /* Đổi số lô là VIẾT LẠI HÀNG LOẠT bản ghi lịch sử, không phải sửa một ô cấu
       hình: p.lot là chuỗi tĩnh nên không đổi theo thì điểm cũ biến mất khỏi mọi
       bộ lọc lô (xem chú thích ở renameLotAcrossPoints). Người dùng phải thấy con
       số TRƯỚC khi làm, chứ không chỉ đọc được trong nhật ký SAU khi làm. Hỏi
       trước khi chạm vào state để bấm Hủy là không còn dấu vết gì — kế hoạch đổi
       (số điểm + kỳ đã khóa) do ManageLotCommand.preview() tính. */
    if (preview.rename) {
      const r = preview.rename, lockNote = r.locked.count ? ` Trong đó ${r.locked.count} điểm thuộc kỳ đã khóa (${r.locked.periods.map(deps.monthVN).join(', ')}).` : '';
      if (!await deps.confirmDialog({
        kicker: 'Cập nhật hàng loạt',
        title: 'Đổi số lô QC',
        message: `Đổi số lô "${r.oldLotNo}" thành "${r.newLotNo}" sẽ cập nhật ${r.affected} điểm QC đã ghi.`,
        detail: `Số lô là nhãn nhận dạng — giá trị, ngày và Mean/SD của từng điểm không đổi.${lockNote}`,
        confirmLabel: 'Đổi số lô', cancelLabel: 'Hủy', danger: false,
      })) return;
    }
    const result = deps.pres.ManageLotWorkflowCommand.execute({ id, newId: deps.uid(), data }); if (!result.ok) { await deps.infoDialog(result.message); return; }
  };
  /* Điểm QC lưu số lô dạng CHUỖI TĨNH chụp lúc nhập (p.lot), không tham chiếu qcLotId —
     mọi bộ lọc "điểm của lô này" (pointsForLot/operationalLotPoints/lotPointsByNo) so
     khớp đúng chuỗi đó với l.lot hiện hành. Đổi số lô (saveConfigLot) mà không cập nhật
     lại điểm cũ sẽ khiến chúng "biến mất" khỏi Nhập QC/Westgard/Sigma: không khớp lô
     hiện tại (chuỗi đã đổi) mà cũng không hiện ở "lô cũ" (không có hồ sơ chuyển tiếp nào
     giữa 2 tên gọi của CÙNG một lô — previousLotSeries chỉ đi theo lotTransitions). Chỉ
     cascade khi số lô THẬT SỰ đổi, quét toàn bộ state.data vì lô có thể dùng chung cho
     nhiều xét nghiệm (panel) và có thể còn nằm trong lịch sử của xét nghiệm không còn
     gắn lô này nữa. Tách hàm riêng (không đọc DOM) để test trực tiếp được qua sandbox. */
  /* Tách phần TÌM khỏi phần SỬA: saveConfigLot() cần đếm và soi kỳ đã khóa TRƯỚC
     khi động vào state, để hộp xác nhận nói đúng số điểm sắp bị viết lại. */
  const renameLotAcrossPoints = (oldLevel: unknown, oldLotNo: unknown, newLotNo: unknown) => deps.ManageConfigService.renameLotPoints(state(), oldLevel, oldLotNo, newLotNo);
  /* Lô đã "hết QC" qua chuyển tiếp ĐÃ CHẤP NHẬN không còn test nào trỏ qcLotId vào nó
     (đã chuyển hết sang lô mới) nên guard "đang gắn với xét nghiệm" bên dưới không chặn
     được — nhưng phần xóa vẫn lọc bỏ luôn hồ sơ lotTransitions tham chiếu lô này, tức âm
     thầm xóa mất chính hồ sơ chuyển tiếp mà deleteLotTransition() đã CHỦ Ý từ chối xóa
     trực tiếp (vì đã áp dụng vào cấu hình/Mean-SD, có giá trị lịch sử/audit). Chặn thêm
     ở đây cho nhất quán với bảo vệ đó — chỉ chặn hồ sơ đã chấp nhận, không chặn hồ sơ
     dự kiến/đang chạy song song/không chấp nhận (những hồ sơ đó vốn xóa trực tiếp được). */
  const deleteConfigLot = async (id: unknown) => { if (!deps.requireAdmin()) return; const check = deps.pres.ManageLotWorkflowCommand.checkRemoval({ id }); if (check.error) { if (check.error !== 'not-found') await deps.infoDialog(check.message); return; } if (!await deps.confirmDialog({ kicker: 'Thao tác không thể hoàn tác', title: 'Xóa lô QC', message: `Xóa lô QC ${check.record.lotNo}?`, confirmLabel: 'Xóa lô QC', cancelLabel: 'Hủy' })) return; const result = deps.pres.ManageLotWorkflowCommand.remove({ id }); if (!result.ok) { await deps.infoDialog(result.message); return; } };
  /* openConfigInstrumentModel(): dữ liệu thuần cho modal React (Giai đoạn 3,
     InstrumentModal.tsx) — thay openConfigInstrument() tự dựng chuỗi HTML rồi
     mở modal. Không có gate quyền ở đây (giống bản cũ) — requireAdmin() chỉ
     kiểm khi lưu (saveConfigInstrument), không kiểm lúc mở form. */
  const openConfigInstrumentModel = (id = '') => {
    const i = state().instruments.find((x: AnyRec) => x.id === id) || { active: true };
    return { id, name: i.name || '', section: i.section || '', manufacturer: i.manufacturer || '', serial: i.serial || '', active: i.active !== false };
  };
  const saveConfigInstrument = async (id: unknown) => {
    if (!deps.requireAdmin()) return;
    const data = { name: doc().getElementById('cfgInstName').value, section: doc().getElementById('cfgInstSection').value, manufacturer: doc().getElementById('cfgInstMfr').value, serial: doc().getElementById('cfgInstSerial').value, active: doc().getElementById('cfgInstActive').checked };
    const result = deps.pres.ManageInstrumentWorkflowCommand.save({ id, newId: id ? '' : deps.uid(), data }); if (!result.ok) { await deps.infoDialog(result.message); return; }
  };
  const deleteConfigInstrument = async (id: unknown) => { if (!deps.requireAdmin()) return; const check = deps.ManageConfigService.instrumentRemoval(state(), { id }); if (check.error) { if (check.error !== 'not-found') await deps.infoDialog(check.message); return; } if (!await deps.confirmDialog({ kicker: 'Thao tác không thể hoàn tác', title: 'Xóa máy xét nghiệm', message: `Xóa máy ${check.record.name}?`, confirmLabel: 'Xóa máy', cancelLabel: 'Hủy' })) return; const result = deps.pres.ManageInstrumentWorkflowCommand.remove({ id }); if (!result.ok) { await deps.infoDialog(result.message); return; } };
  /* Xét nghiệm mới luôn bắt đầu với đúng 1 mức (Mức 1) — KHÔNG suy theo các mức
     lô đang có ở NƠI KHÁC trong hệ thống (từng làm vậy trước đây, khiến xét
     nghiệm mới tự dính thêm mức rỗng không liên quan chỉ vì lab có lô ở mức đó
     cho xét nghiệm khác). Các mức khác tự thêm đúng lúc người dùng gán lô cho
     xét nghiệm này qua Mean/SD theo nhóm lô (applyTargetPick tự push level mới
     nếu chưa có). */
  const defaultAssayLevels = () => deps.ManageConfigService.defaultAssayLevels();
  const configAssayTeaRefs = (): AnyRec[] => typeof deps.effectiveTeaRefs === 'function' ? deps.effectiveTeaRefs() : deps.refTests().map(([name, unit, clia, ricos, section]) => [name, unit, clia, ricos, section, null, deps.teaAnalyteMeta(name).analyteId]);
  const configAssayRefRecord = (name: unknown, analyteId = ''): AnyRec => { const key = deps.teaAnalyteKey(name); return (state().teaRefs || []).find((r: AnyRec) => analyteId && r.analyteId === analyteId) || (state().teaRefs || []).find((r: AnyRec) => deps.teaAnalyteKey(r.name) === key) || null; };
  const configAssayNaming = (ref: AnyRec) => deps.teaAnalyteMeta(ref && ref[0], ref && configAssayRefRecord(ref[0], ref[6]));
  const configAssayFindRef = (value: unknown): AnyRec => { const key = typeof deps.searchText === 'function' ? deps.searchText(value) : deps.teaAnalyteKey(value); if (!key) return null; return configAssayTeaRefs().find(ref => { const naming = configAssayNaming(ref); return [ref[0], naming.displayName, naming.standardName, naming.abbreviation, ...naming.aliases].some((v: unknown) => (typeof deps.searchText === 'function' ? deps.searchText(v) : deps.teaAnalyteKey(v)) === key); }) || null; };
  const configAssaySuggestionInput = (value: unknown) => {
    const ref = configAssayFindRef(value), keyEl = doc().getElementById('cfgAssayTeaRefKey'), sourceEl = doc().getElementById('cfgAssayTeaSource');
    if (!ref) { if (keyEl) keyEl.value = ''; if (sourceEl) sourceEl.value = ''; return; }
    const naming = configAssayNaming(ref), tea = ref[2] != null ? ref[2] : ref[3], source = ref[2] != null ? 'clia' : ref[3] != null ? 'ricos' : '';
    doc().getElementById('cfgAssayName').value = naming.displayName || ref[0]; if (keyEl) keyEl.value = ref[6] || ref[0]; if (sourceEl) sourceEl.value = source;
    doc().getElementById('cfgAssayUnit').value = ref[1] || ''; doc().getElementById('cfgAssayTea').value = tea == null ? '' : tea;
  };
  /* Pha H2 nhóm (d): thay onchange="const o=this.selectedOptions[0];...".
     Hàm dùng `this` trần (không phải arrow) vì action-dispatcher.ts gọi qua
     `fn.apply(el,args)` — chỉ hàm khai báo bằng `function` mới nhận đúng
     `this`, arrow function bỏ qua thisArg của apply(). */
  const configAssayInstrumentChanged = function (this: AnyRec) {
    const o = this.selectedOptions[0], e = doc().getElementById('cfgAssaySection');
    if (e) e.value = o ? o.dataset.section || '' : '';
  };
  /* openConfigAssayModel(): dữ liệu thuần cho modal React (Giai đoạn 3,
     AssayModal.tsx) — thay openConfigAssay() tự dựng chuỗi HTML rồi mở
     modal. teaOptions/instruments/ruleRows trả mảng dữ liệu thay vì chuỗi
     HTML — component tự dựng JSX <option>/<div>. saveConfigAssay() và 2 hàm
     tự động điền (configAssaySuggestionInput/configAssayInstrumentChanged)
     GIỮ NGUYÊN không đổi — cả ba đều đọc/ghi DOM trực tiếp qua đúng id, nên
     component chỉ cần render đúng các id đó. */
  const openConfigAssayModel = (id = '') => {
    if (!state().instruments.length) { deps.openReactInstrumentModal(); return null; }
    const t = state().tests.find((x: AnyRec) => x.id === id) || { levels: defaultAssayLevels(), active: true };
    // Trình duyệt tự chọn option đầu tiên khi không có option nào đánh dấu "selected" (test mới,
    // chưa gán máy) — lấy đúng máy đó làm mặc định để Khoa/Khu vực điền sẵn ngay từ đầu, thay vì
    // chỉ điền khi onchange bắn ra (không bắn nếu máy đầu tiên người dùng chọn trùng máy mặc định).
    const defaultInst = state().instruments.find((i: AnyRec) => i.id === (t.instrumentId || '')) || state().instruments[0];
    const instruments = state().instruments.map((i: AnyRec) => ({ id: i.id, selected: i.id === (t.instrumentId || ''), section: i.section || '', label: i.name + (i.model ? ' · ' + i.model : '') }));
    /* Chỉ coi là "đã ghi đè" khi ruleActions[rule] có giá trị hợp lệ tường minh — nếu
       chưa (rỗng/thiếu), mặc định chọn "Theo cấu hình chung" thay vì âm thầm chốt cứng
       giá trị đang áp dụng lúc mở modal. Nếu không, MỌI lần lưu xét nghiệm (kể cả chỉ
       đổi tên/đơn vị, không đụng phần luật) sẽ ghi cứng cả 13 luật theo cấu hình chung
       tại đúng thời điểm đó — làm xét nghiệm hết đồng bộ với cấu hình chung mãi mãi mà
       không có cảnh báo nào, dù người dùng chưa từng chủ ý ghi đè. */
    const ruleRows = deps.wgRules().map(rule => ({ id: rule, action: t && t.ruleActions && ['inactive', 'alert', 'reject'].includes(t.ruleActions[rule]) ? t.ruleActions[rule] : '', scope: t && t.ruleScopes && ['within', 'across', 'both'].includes(t.ruleScopes[rule]) ? t.ruleScopes[rule] : '' }));
    const cusum = deps.testCusumConfig(t), decimalValue = t.decimalPlaces !== null && t.decimalPlaces !== '' && Number.isInteger(Number(t.decimalPlaces)) ? String(t.decimalPlaces) : String(deps.qcDecimalsDefault()), hasRuleOverrides = deps.wgRules().some(rule => (t.ruleActions && ['inactive', 'alert', 'reject'].includes(t.ruleActions[rule])) || (t.ruleScopes && ['within', 'across', 'both'].includes(t.ruleScopes[rule])));
    const initialRef = configAssayTeaRefs().find(r => t.analyteId && r[6] === t.analyteId) || configAssayFindRef(t.name || t.displayName || ''), initialNaming = initialRef ? configAssayNaming(initialRef) : null, initialName = (initialNaming && initialNaming.displayName) || t.displayName || t.name || '', currentTeaSource = ['lab', 'eflm', 'clia', 'ricos'].includes(t.teaSource) ? t.teaSource : '', initialSource = currentTeaSource || (initialRef ? (initialRef[2] != null ? 'clia' : initialRef[3] != null ? 'ricos' : '') : '');
    const teaOptions = configAssayTeaRefs().map(ref => ({ ref, naming: configAssayNaming(ref) })).sort((a, b) => String(a.ref[4] || '').localeCompare(String(b.ref[4] || ''), 'vi') || String(a.naming.displayName || '').localeCompare(String(b.naming.displayName || ''), 'vi')).map(({ ref, naming }) => ({ value: naming.displayName || ref[0], label: [naming.standardName !== naming.displayName ? naming.standardName : '', naming.abbreviation, ...naming.aliases.filter((x: unknown) => x !== ref[0] && x !== naming.displayName && x !== naming.standardName).slice(0, 3), ref[1], ref[4]].filter(Boolean).join(' · ') }));
    return {
      id, title: id ? 'Sửa xét nghiệm' : 'Thêm xét nghiệm', name: initialName, teaOptions, teaRefKey: (initialRef && (initialRef[6] || initialRef[0])) || '', teaSource: initialSource,
      unit: t.unit || '', instruments, section: t.section || (defaultInst && defaultInst.section) || '', method: t.method || '', decimalValue, reagent: t.reagent || '', tea: t.tea || '',
      ruleRows, hasRuleOverrides, cusumOn: cusum.on, cusumK: String(cusum.k), cusumH: String(cusum.h), closed: !!t.closed,
    };
  };
  const saveConfigAssay = async (id: unknown) => {
    if (!deps.requireAdmin()) return;
    const existing = state().tests.find((x: AnyRec) => x.id === id), enteredName = deps.QCCore.cleanText(doc().getElementById('cfgAssayName').value).trim(), refKey = doc().getElementById('cfgAssayTeaRefKey').value, ref = refKey ? configAssayTeaRefs().find(r => r[6] === refKey || deps.teaAnalyteKey(r[0]) === deps.teaAnalyteKey(refKey)) : null, naming = ref ? configAssayNaming(ref) : null, name = ref ? ref[0] : enteredName, analyteId = ref ? ref[6] : ((existing && existing.analyteId) || 'local-' + String((existing && existing.id) || deps.uid()).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 73)), instrumentId = doc().getElementById('cfgAssayInstrument').value, inst = state().instruments.find((x: AnyRec) => x.id === instrumentId), levels = existing ? [...(existing.levels || [])] : defaultAssayLevels();
    const tea = parseFloat(doc().getElementById('cfgAssayTea').value) || 0, decimalRaw = doc().getElementById('cfgAssayDecimals').value, decimalPlaces = Number(decimalRaw);
    const ruleActions = Object.fromEntries([...doc().querySelectorAll('.cfg-assay-rule')].map((el: AnyRec) => [el.dataset.rule, el.value]));
    const ruleScopes = Object.fromEntries([...doc().querySelectorAll('.cfg-assay-scope')].map((el: AnyRec) => [el.dataset.rule, el.value]));
    const cusumK = parseFloat(doc().getElementById('cfgAssayCusumK').value), cusumH = parseFloat(doc().getElementById('cfgAssayCusumH').value);
    const cusum = { on: doc().getElementById('cfgAssayCusumOn').checked, k: Number.isFinite(cusumK) && cusumK > 0 ? cusumK : 0.5, h: Number.isFinite(cusumH) && cusumH > 0 ? cusumH : 4 };
    const savedTeaSource = existing && ['lab', 'eflm', 'clia', 'ricos'].includes(existing.teaSource) ? existing.teaSource : '', data = { analyteId, name, displayName: naming ? naming.displayName : enteredName, standardName: naming ? naming.standardName : (existing && existing.standardName) || enteredName, abbreviation: naming ? naming.abbreviation : (existing && existing.abbreviation) || '', aliases: naming ? naming.aliases : (existing && existing.aliases) || [enteredName], matrix: naming ? naming.matrix : (existing && existing.matrix) || '', instrumentId, machine: (inst && inst.name) || '', section: deps.QCCore.cleanText(doc().getElementById('cfgAssaySection').value).trim() || (inst && inst.section) || '', unit: deps.QCCore.cleanText(doc().getElementById('cfgAssayUnit').value), decimalPlaces, method: deps.QCCore.cleanText(doc().getElementById('cfgAssayMethod').value), reagent: deps.QCCore.cleanText(doc().getElementById('cfgAssayReagent').value), reagentSupplier: (existing && existing.reagentSupplier) || '', temperature: (existing && existing.temperature) || 0, genNo: (existing && existing.genNo) || '', performanceLimit: (existing && existing.performanceLimit) || '', tea, teaSource: savedTeaSource || (ref ? (doc().getElementById('cfgAssayTeaSource').value || 'ricos') : 'ricos'), levels, ruleActions, ruleScopes, cusum, closed: doc().getElementById('cfgAssayClosed').checked, active: true, sgTracked: existing ? !!existing.sgTracked : false };
    const result = deps.pres.ManageAssayWorkflowCommand.save({ id, newId: id ? '' : deps.uid(), data }); if (!result.ok) { await deps.infoDialog(result.message); return; }
  };
  /* Panel "Khóa kỳ báo cáo" hứa với người dùng rằng khóa kỳ chặn sửa/hủy điểm QC của
     kỳ đó ở MỌI xét nghiệm. Xóa nguyên xét nghiệm mà không kiểm thì lời hứa đó sai —
     và mất luôn hồ sơ của kỳ đã chốt. Chặn ở đây KHÔNG phải ngõ cụt: mở khóa kỳ là
     thao tác có sẵn, bắt nhập lý do và tự ghi nhật ký, nên đường đúng vẫn đi được
     và để lại dấu vết đúng như ISO 15189 mong đợi. */
  const delTest = async (id: unknown) => {
    if (!deps.requireAdmin()) return;
    const context = deps.ManageConfigService.assayRemoval(state(), { id }); if (context.error) return; const t = context.record, points = context.points, locked = deps.PeriodService.lockedPoints(state(), points);
    /* Giai đoạn 7 (state immutable, nhóm state.data/điểm QC, 2026-08-31): chụp
       số đếm NGAY LÚC NÀY bằng một số nguyên thủy, không giữ tham chiếu mảng
       `points` xuyên qua confirmDialog/reauthenticateCurrentUser bên dưới —
       addPoint() giờ gán lại `state.data[tid]` bằng mảng MỚI mỗi lần thêm
       điểm, nên `points.length` đọc lại sau await có thể lệch (thiếu) nếu có
       điểm mới được thêm trong lúc chờ xác thực mật khẩu. */
    const pointsCount = points.length;
    if (locked.count) { await deps.infoDialog(`Không thể xóa "${deps.testDisplayName(t)}": còn ${locked.count} điểm QC thuộc kỳ đã khóa (${locked.periods.map(deps.monthVN).join(', ')}). Hãy mở khóa các kỳ này ở trang Báo cáo trước — thao tác mở khóa yêu cầu lý do và được ghi vào nhật ký.`); return; }
    if (!await deps.confirmDialog({ kicker: 'Thao tác không thể hoàn tác', title: 'Xóa xét nghiệm', message: `Xóa xét nghiệm ${t.name} và toàn bộ dữ liệu QC?`, detail: `${pointsCount} điểm QC cùng toàn bộ kết quả Westgard và Sigma của xét nghiệm này sẽ mất, không thể khôi phục.`, confirmLabel: 'Xóa xét nghiệm', cancelLabel: 'Hủy' })) return;
    if (!await deps.reauthenticateCurrentUser({ title: 'Xác thực xóa xét nghiệm', message: `Nhập lại mật khẩu trước khi xóa ${t.name} và ${pointsCount} điểm QC.` })) return;
    const result = deps.pres.ManageAssayWorkflowCommand.remove({ id }); if (!result.ok) { await deps.infoDialog(result.message); return; }
    if (deps.analysisUi().selTest === id) deps.analysisUi().selTest = (state().tests[0] && state().tests[0].id) || null;
    if (deps.entryUi().entrySel && deps.entryUi().entrySel.testId === id) deps.entryUi().entrySel = null;
  };

  return {
    parseVN, setManageTab, setTargetPanel, setTargetGroup, setTargetLevel, setHistoryTest, openTargetMatrix,
    targetNumberText, targetConfigAssigned, targetRangeDraft, syncTargetRange, toggleTargetRow, targetCheckAll,
    targetPickBackfillPoints, applyTargetPick, applyPlannedTarget, readTargetMatrixPicks, saveTargetMatrix,
    openTargetSwitchModal, resolveTargetSwitch, commitTargetMatrix, openQcHistoryDetail, openConfigPanelModel,
    saveConfigPanel, deleteConfigPanel, deleteLotTransition, lotTransitionChoiceLabel,
    lotTransitionChoiceLots, lotTransitionChoiceMatch, lotTransitionSelectedId,
    openLotTransitionModel, lotTransitionTargetsModel,
    readLotTransitionTargetPicks, saveLotTransitionV2, openConfigGroupModel,
    suggestConfigGroupName, saveConfigGroup, deleteConfigGroup, toggleLotGroupStatus, activateLotGroup,
    openConfigLotModel, saveConfigLot, renameLotAcrossPoints, deleteConfigLot, openConfigInstrumentModel,
    saveConfigInstrument, deleteConfigInstrument, defaultAssayLevels, configAssayTeaRefs, configAssayRefRecord,
    configAssayNaming, configAssayFindRef, configAssaySuggestionInput, configAssayInstrumentChanged, openConfigAssayModel, saveConfigAssay, delTest,
  };
}
