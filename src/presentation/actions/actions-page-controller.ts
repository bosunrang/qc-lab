type AnyRec = any;

/**
 * Trang "Khắc phục sự cố" trừ phần form: danh sách sự cố cần xử lý, vòng đời hồ sơ
 * NCE (duyệt/trả lại/hủy có lưu vết/escalate/mở lại) cùng token khóa phiên bản,
 * phiếu chi tiết và các khối dựng bằng chứng. Phần DỰNG form 8 mục nằm ở
 * action-form-controller.ts. actionsModel() (dữ liệu thuần cho
 * src/react/pages/ActionsPage.tsx) gọi thẳng action-form-controller.ts's
 * actionFormViewModel() từ phía React, không qua đường cắt của controller này —
 * đường cắt CÒN LẠI ở đây chỉ một chiều: form gọi ngược
 * actionEvidenceTimelineHtml/actionRerunEvidenceHtml/actionLevelShort của trang này
 * (dựng modular-pilot.global.ts qua một biến tham chiếu, xem ghi chú ở đó).
 *
 * `document` là getter LAZY, cùng lý do với entry/manage: một số test đổi `document`
 * giữa các bước.
 */
export function createActionsPageController(deps: {
  getState: () => AnyRec;
  document: () => AnyRec;
  entryUi: () => AnyRec;
  currentPage: () => string;
  currentUser: () => AnyRec;
  rerender: () => void;
  role: () => string;
  userName: () => string;
  canWrite: () => boolean;
  requireWrite: () => boolean;
  requireAdmin: (message?: string) => boolean;
  reauthenticateCurrentUser: (opts: AnyRec) => Promise<boolean>;
  openModal: (html: string) => void;
  closeModal: () => void;
  confirmDialog: (opts: AnyRec) => Promise<boolean>;
  infoDialog: (message: string, opts?: AnyRec) => Promise<unknown>;
  esc: (value: unknown) => string;
  btn: (label: string, action: string | { action: string; args?: unknown[] } | null, cls?: string, title?: string, options?: AnyRec) => string;
  headOnly: (title: string, subtitle: string, actions?: string) => string;
  vnDate: (value: unknown) => string;
  formatDateTimeVN: (value: unknown) => string;
  fmtPointValue: (point: AnyRec, test: AnyRec) => string;
  testDisplayName: (test: AnyRec) => string;
  stateName: (value: unknown) => string;
  errorType: (rules: string[]) => string;
  fixHint: (rules: string[]) => string;
  lvlCfg: (test: AnyRec, level: unknown) => AnyRec;
  pointWorkflowSummary: (pointId: unknown) => AnyRec;
  pointRealActions: (pointId: unknown) => AnyRec[];
  go: (page: string) => void;
  ACTION_LABELS: () => AnyRec;
  actionApprovalStatus: (a: AnyRec) => string;
  actionApprovalLabel: (a: AnyRec) => string;
  actionCancelled: (a: AnyRec) => boolean;
  actionRecorded: (a: AnyRec) => boolean;
  actionWorkflowStatus: (a: AnyRec) => AnyRec;
  actionOverdue: (a: AnyRec) => AnyRec;
  actionEffectivenessStatus: (a: AnyRec) => AnyRec;
  actionResidualRiskScore: (a: AnyRec) => number;
  actionRiskScore: (a: AnyRec) => number;
  actionRerunStatus: (a: AnyRec) => AnyRec;
  actionEventDate: (a: AnyRec) => string;
  ActionReviewService: AnyRec;
  ActionReviewMessages: AnyRec;
  ActionEscalationService: AnyRec;
  ActionListPresentation: AnyRec;
  ActionStatusPresentation: AnyRec;
  ActionReviewPresentation: AnyRec;
  ActionDetailPresentation: AnyRec;
  ActionEvidencePresentation: AnyRec;
  ActionRerunEvidencePresentation: AnyRec;
  ActionViolationService: AnyRec;
  ActionCurrentIssues: () => AnyRec[];
  NceLifecycleWorkflowCommand: AnyRec;
  actionFormUiState: AnyRec;
  modalTemplate: (opts: AnyRec) => string;
  QCCore: { cleanText: (value: unknown, maxLength?: number) => string };
  captureFormDraft: () => void;
  /* Vài hàm dựng HTML thuần (TypeScript) còn dùng cho phiếu chi tiết/modal cổ điển,
     gom một chỗ thay vì khai kiểu từng cái. */
  pres: AnyRec;
}) {
  const state = () => deps.getState();
  const doc = () => deps.document();

  const actionLevelShort = (t: AnyRec, level: unknown, lotSnap: unknown) => deps.ActionListPresentation.levelShort(t, level, lotSnap);
  const currentIssues = () => deps.ActionCurrentIssues();
  const nceCommandUser = () => {
    const user = deps.currentUser();
    return { id: (user && user.id) || '', username: (user && user.username) || '', name: deps.userName() };
  };

  const cancelAction = async (i: number) => {
    if (!deps.requireAdmin()) return;
    const a = state().actions && state().actions[i];
    if (!a) return;
    const readiness = deps.ActionReviewService.cancelReadiness(a);
    if (!readiness.ok) { await deps.infoDialog(actionReviewReadinessMessage('cancel', { ...readiness, action: a }, false)); return; }
    const id = a.id, token = actionApprovalToken(a);
    if (!await deps.reauthenticateCurrentUser({ title: 'Xác thực hủy hồ sơ NCE', message: 'Nhập lại mật khẩu trước khi hủy hồ sơ. Toàn bộ nội dung vẫn được giữ lại trong nhật ký.' })) return;
    const current = (state().actions || []).find((x: AnyRec) => x.id === id);
    if (!current || actionApprovalToken(current) !== token) { await deps.infoDialog('Hồ sơ đã thay đổi trong lúc xác thực. Vui lòng kiểm tra lại trước khi hủy.'); return; }
    deps.openModal(deps.pres.actionCancelModalHtml({ closeButtonHtml: deps.btn('Đóng', { action: 'closeModal' }, 'ghost'), cancelButtonHtml: deps.btn('Hủy hồ sơ', { action: 'confirmCancelAction', args: [current.id, token] }, 'danger') }));
    setTimeout(() => { const e = doc().getElementById('actionCancelReason'); if (e) e.focus(); }, 50);
  };
  const confirmCancelAction = (id: unknown, token: unknown) => {
    const a = (state().actions || []).find((x: AnyRec) => x.id === id);
    if (!a) { deps.closeModal(); return; }
    if (deps.role() !== 'admin') { deps.closeModal(); deps.infoDialog('Chỉ quản trị viên mới được hủy hồ sơ NCE.'); return; }
    if (actionApprovalToken(a) !== token) { deps.closeModal(); deps.infoDialog('Hồ sơ đã thay đổi. Vui lòng mở lại và kiểm tra trước khi hủy.'); return; }
    const readiness = deps.ActionReviewService.cancelReadiness(a);
    if (!readiness.ok) {
      deps.closeModal();
      if (readiness.reason === 'cancelled') { deps.rerender(); return; }
      deps.infoDialog(actionReviewReadinessMessage('cancel', { ...readiness, action: a }, true));
      return;
    }
    const input = doc().getElementById('actionCancelReason'), reason = (deps.QCCore.cleanText(input ? input.value : '', 1000)).trim();
    if (reason.length < 5) { const err = doc().getElementById('actionCancelErr'); if (err) err.style.display = ''; return; }
    deps.closeModal();
    if (!deps.NceLifecycleWorkflowCommand.execute({
      kind: 'cancel', id: a.id, token, note: reason, user: nceCommandUser(),
      audit: () => ({ action: 'Hủy hồ sơ NCE', detail: `${a.nceId || a.id || 'NCE'} · ${reason}`, target: a.testId ? ((state().tests.find((t: AnyRec) => t.id === a.testId)) || {}).name || 'Khắc phục' : 'Khắc phục' }),
    }).ok) { deps.closeModal(); deps.rerender(); return; }
    if (deps.actionFormUiState.editId === a.id) deps.actionFormUiState.reset();
    deps.rerender();
  };
  const actionApprovalToken = (a: AnyRec) => deps.ActionReviewService.reviewToken(a);
  const actionApprovalReadinessMessage = (r: AnyRec, afterAuth: boolean) => deps.ActionReviewMessages.approval(r, afterAuth);
  const actionReviewReadinessMessage = (kind: string, r: AnyRec, afterAuth: boolean) => deps.ActionReviewMessages.review(kind, r, afterAuth);

  const approveAction = async (i: number) => {
    if (!deps.requireAdmin()) return;
    const a = state().actions && state().actions[i];
    if (!a) return;
    const approvalId = a.id, preAuthToken = actionApprovalToken(a), readiness = deps.ActionReviewService.approvalReadiness(a, deps.currentUser());
    if (!readiness.ok) { await deps.infoDialog(actionApprovalReadinessMessage(readiness, false)); return; }
    if (!await deps.reauthenticateCurrentUser({ title: 'Xác thực người duyệt', message: 'Nhập lại mật khẩu trước khi duyệt hành động khắc phục.' })) return;
    const current = (state().actions || []).find((x: AnyRec) => x.id === approvalId);
    if (!current || actionApprovalToken(current) !== preAuthToken) { await deps.infoDialog('Hồ sơ đã thay đổi trong lúc xác thực. Vui lòng kiểm tra lại trước khi duyệt.'); return; }
    const token = actionApprovalToken(current);
    deps.openModal(deps.pres.actionReviewNoteModalHtml({ title: 'Duyệt hành động khắc phục', label: 'Ý kiến duyệt (tối thiểu 3 ký tự)', placeholder: 'Nhận xét về hành động khắc phục...', errorText: 'Cần nhập ý kiến duyệt tối thiểu 3 ký tự.', closeButtonHtml: deps.btn('Đóng', { action: 'closeModal' }, 'ghost'), submitButtonHtml: deps.btn('Duyệt', { action: 'confirmApproveAction', args: [current.id, token] }, 'teal') }));
    setTimeout(() => { const e = doc().getElementById('actionNoteInput'); if (e) e.focus(); }, 50);
  };
  const confirmApproveAction = (id: unknown, token: unknown) => {
    const a = (state().actions || []).find((x: AnyRec) => x.id === id);
    if (!a) { deps.closeModal(); return; }
    if (deps.role() !== 'admin') { deps.closeModal(); deps.infoDialog('Chỉ quản trị viên mới được duyệt hồ sơ.'); return; }
    if (actionApprovalToken(a) !== token) { deps.closeModal(); deps.infoDialog('Hồ sơ hoặc bằng chứng QC đã thay đổi. Vui lòng mở lại và kiểm tra trước khi duyệt.'); return; }
    const readiness = deps.ActionReviewService.approvalReadiness(a, deps.currentUser());
    if (!readiness.ok) { deps.closeModal(); deps.infoDialog(actionApprovalReadinessMessage(readiness, true)); return; }
    const input = doc().getElementById('actionNoteInput');
    const note = (deps.QCCore.cleanText(input ? input.value : '', 1000)).trim();
    if (note.length < 3) { const err = doc().getElementById('actionNoteErr'); if (err) err.style.display = ''; return; }
    deps.closeModal();
    if (!deps.NceLifecycleWorkflowCommand.execute({
      kind: 'approve', id: a.id, token, note, user: nceCommandUser(),
      audit: () => ({ action: 'Duyệt khắc phục', detail: `${a.rule || '—'} · ${note}`, target: a.testId ? ((state().tests.find((t: AnyRec) => t.id === a.testId)) || {}).name || 'Khắc phục' : 'Khắc phục' }),
    }).ok) { deps.closeModal(); deps.rerender(); return; }
  };

  const returnAction = async (i: number) => {
    if (!deps.requireAdmin()) return;
    const a = state().actions && state().actions[i];
    if (!a) return;
    const readiness = deps.ActionReviewService.returnReadiness(a);
    if (!readiness.ok) { await deps.infoDialog(actionReviewReadinessMessage('return', readiness, false)); return; }
    const returnId = a.id, preAuthToken = actionApprovalToken(a);
    if (!await deps.reauthenticateCurrentUser({ title: 'Xác thực người trả lại', message: 'Nhập lại mật khẩu trước khi trả lại hành động khắc phục.' })) return;
    const current = (state().actions || []).find((x: AnyRec) => x.id === returnId);
    if (!current || actionApprovalToken(current) !== preAuthToken || !deps.ActionReviewService.returnReadiness(current).ok) { await deps.infoDialog('Hồ sơ đã thay đổi trong lúc xác thực. Vui lòng kiểm tra lại trước khi trả lại.'); return; }
    const token = actionApprovalToken(current);
    deps.openModal(deps.pres.actionReviewNoteModalHtml({ title: 'Trả lại hành động khắc phục', label: 'Lý do trả lại (tối thiểu 3 ký tự)', placeholder: 'Vì sao trả lại hành động khắc phục này...', errorText: 'Cần nhập lý do tối thiểu 3 ký tự.', closeButtonHtml: deps.btn('Đóng', { action: 'closeModal' }, 'ghost'), submitButtonHtml: deps.btn('Trả lại', { action: 'confirmReturnAction', args: [current.id, token] }, 'danger') }));
    setTimeout(() => { const e = doc().getElementById('actionNoteInput'); if (e) e.focus(); }, 50);
  };
  const confirmReturnAction = (id: unknown, token: unknown) => {
    const a = (state().actions || []).find((x: AnyRec) => x.id === id);
    if (!a) { deps.closeModal(); return; }
    if (deps.role() !== 'admin') { deps.closeModal(); deps.infoDialog('Chỉ quản trị viên mới được trả lại hồ sơ.'); return; }
    if (actionApprovalToken(a) !== token) { deps.closeModal(); deps.infoDialog('Hồ sơ hoặc bằng chứng QC đã thay đổi. Vui lòng mở lại và kiểm tra trước khi trả lại.'); return; }
    const readiness = deps.ActionReviewService.returnReadiness(a);
    if (!readiness.ok) { deps.closeModal(); deps.infoDialog(actionReviewReadinessMessage('return', readiness, true)); return; }
    const input = doc().getElementById('actionNoteInput');
    const note = (deps.QCCore.cleanText(input ? input.value : '', 1000)).trim();
    if (note.length < 3) { const err = doc().getElementById('actionNoteErr'); if (err) err.style.display = ''; return; }
    deps.closeModal();
    if (!deps.NceLifecycleWorkflowCommand.execute({
      kind: 'return', id: a.id, token, note, user: nceCommandUser(),
      audit: () => ({ action: 'Trả lại khắc phục', detail: `${a.rule || '—'} · ${note}`, target: a.testId ? ((state().tests.find((t: AnyRec) => t.id === a.testId)) || {}).name || 'Khắc phục' : 'Khắc phục' }),
    }).ok) { deps.closeModal(); deps.rerender(); return; }
  };

  /* Hành động khắc phục không hiệu lực thì phải mở vòng điều tra mới chứ không treo hồ sơ
     cũ mãi. Hồ sơ mới thừa hưởng danh tính sự cố (xét nghiệm/mức/lô/điểm QC) và trỏ ngược
     về hồ sơ cũ qua parentNceId; hồ sơ cũ ghi followUpNceId để actionEffectivenessStatus()
     cho phép khép lại với kết luận "chưa hiệu lực — đã chuyển". */
  const actionCanEscalate = (a: AnyRec) => deps.ActionEscalationService.canEscalate(state().actions || [], a);
  const escalateAction = async (i: number) => {
    if (!deps.requireWrite()) return;
    const a = state().actions && state().actions[i];
    if (!a) return;
    if (!actionCanEscalate(a)) { await deps.infoDialog('Chỉ mở hồ sơ tiếp theo cho hồ sơ đã kết luận "chưa hiệu lực" và chưa từng chuyển.'); return; }
    const t = state().tests.find((x: AnyRec) => x.id === a.testId), parent = a.nceId || 'hồ sơ trước';
    if (!await deps.confirmDialog({ kicker: 'Vòng điều tra mới', title: 'Lập hồ sơ NCE tiếp theo?', message: `Hành động của ${parent} được kết luận chưa hiệu lực. Mở một hồ sơ mới để điều tra lại cùng sự cố này?`, detail: 'Hồ sơ cũ sẽ được khép lại với kết luận "chưa hiệu lực — đã chuyển", giữ nguyên toàn bộ nội dung điều tra.', confirmLabel: 'Lập hồ sơ tiếp theo', cancelLabel: 'Hủy' })) return;
    const result = deps.NceLifecycleWorkflowCommand.execute({ kind: 'escalate', id: a.id, user: nceCommandUser(), audit: (record: AnyRec) => ({ action: 'Lập hồ sơ NCE tiếp theo', detail: `${record.nceId} · nối tiếp ${parent} (hành động chưa hiệu lực)`, target: t ? t.name : 'Khắc phục' }) }), record = result.ok && result.record;
    if (!record) { await deps.infoDialog('Hồ sơ đã thay đổi và không còn đủ điều kiện mở vòng tiếp theo.'); return; }
    deps.actionFormUiState.edit(record.id);
    deps.rerender();
    const panel = doc().querySelector('.action-form-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* Lối thoát cho hồ sơ kẹt: actionRerunStatus() tính động, nên một hồ sơ ĐÃ DUYỆT có thể
     tụt lại khỏi trạng thái khép vòng (ví dụ chính điểm QC dùng làm bằng chứng chạy lại
     sau đó bị hủy). Lúc đó sửa bị chặn vì đã duyệt, xóa bị chặn vì đã duyệt, nút Duyệt
     không hiện vì stage!=='approval' — không còn đường nào. Chỉ mở lại đúng trường hợp
     này, hồ sơ khép vòng hợp lệ vẫn bất biến theo quy ước cũ. */
  const actionCanReopen = (a: AnyRec) => deps.ActionReviewService.canReopen(a);
  const reopenAction = async (i: number) => {
    if (!deps.requireAdmin()) return;
    const a = state().actions && state().actions[i];
    if (!a) return;
    if (!actionCanReopen(a)) { await deps.infoDialog('Chỉ mở lại được hồ sơ đã duyệt nhưng không còn đủ điều kiện khép vòng. Hồ sơ đã khép vòng hợp lệ thì mở hồ sơ NCE mới.'); return; }
    if (!await deps.reauthenticateCurrentUser({ title: 'Xác thực mở lại hồ sơ', message: 'Nhập lại mật khẩu trước khi mở lại hồ sơ đã duyệt.' })) return;
    deps.openModal(deps.pres.actionReopenModalHtml({ workflowLabelHtml: deps.esc(deps.actionWorkflowStatus(a).label), closeButtonHtml: deps.btn('Đóng', { action: 'closeModal' }, 'ghost'), reopenButtonHtml: deps.btn('Mở lại hồ sơ', { action: 'confirmReopenAction', args: [i] }, 'danger') }));
    setTimeout(() => { const e = doc().getElementById('actionNoteInput'); if (e) e.focus(); }, 50);
  };
  const confirmReopenAction = (i: number) => {
    const a = state().actions && state().actions[i];
    if (!a) { deps.closeModal(); return; }
    if (!actionCanReopen(a)) { deps.closeModal(); deps.rerender(); return; }
    const input = doc().getElementById('actionNoteInput');
    const note = (deps.QCCore.cleanText(input ? input.value : '', 1000)).trim();
    if (note.length < 5) { const err = doc().getElementById('actionNoteErr'); if (err) err.style.display = ''; return; }
    deps.closeModal();
    if (!deps.NceLifecycleWorkflowCommand.execute({
      kind: 'reopen', id: a.id, note, user: nceCommandUser(),
      audit: () => ({ action: 'Mở lại hồ sơ NCE', detail: `${a.nceId || a.rule || '—'} · ${note}`, target: a.testId ? ((state().tests.find((t: AnyRec) => t.id === a.testId)) || {}).name || 'Khắc phục' : 'Khắc phục' }),
    }).ok) { deps.closeModal(); deps.rerender(); return; }
  };

  const actionDetailCheck = (label: string, status: unknown, note: unknown) => {
    const view = deps.ActionStatusPresentation.detailCheck(status);
    return deps.pres.actionDetailCheckHtml(label, view, note);
  };
  const actionEvidenceTimelineHtml = (a: AnyRec, rr: AnyRec) => {
    const items = deps.ActionEvidencePresentation.timeline(a, rr);
    return deps.pres.actionEvidenceTimelinePresentation(items);
  };
  const actionRerunEvidenceHtml = (a: AnyRec, rr: AnyRec, t: AnyRec) => {
    const evidence = deps.ActionRerunEvidencePresentation.model(a, rr, t);
    return deps.pres.actionRerunEvidencePresentation(evidence, a.testId, t);
  };
  const openActionQcEvidence = (tid: unknown, level: unknown, pointId: unknown, date: unknown, lot: unknown) => {
    if (deps.currentPage() === 'actions') deps.captureFormDraft();
    deps.closeModal();
    const entryUi = deps.entryUi();
    entryUi.entrySel = { testId: tid, level: +(level as string) };
    entryUi.entryStart = date || null;
    entryUi.entryEnd = date || null;
    entryUi.entryLastMsg = `<div class="alert ok">Đang hiển thị điểm QC được dùng làm bằng chứng ngày ${deps.esc(deps.vnDate(date))}.</div>`;
    entryUi.entryDetailOpen.add('points');
    const t = state().tests.find((x: AnyRec) => x.id === tid), l = t && deps.lvlCfg(t, +(level as string));
    if (l && lot && String(lot) !== String(l.lot || '')) entryUi.entryPrevOpen.set(tid + '|' + level, lot);
    deps.go('entry');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const row = [...doc().querySelectorAll('[data-qc-point-id]')].find((x: AnyRec) => x.dataset.qcPointId === String(pointId));
      if (!row) return;
      row.classList.add('qc-point-evidence-focus');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.focus({ preventScroll: true });
    }));
  };
  const viewActionDetailModel = (i: number) => {
    const a = state().actions && state().actions[i], t = a && state().tests.find((x: AnyRec) => x.id === a.testId);
    if (!a) return null;
    const LABELS = deps.ACTION_LABELS();
    const legacy = !a.protocolVersion, modern = a.protocolVersion >= 2, rr = deps.actionRerunStatus(a), wf = deps.actionWorkflowStatus(a), eff = deps.actionEffectivenessStatus(a), residual = deps.actionResidualRiskScore(a), overdue = deps.actionOverdue(a);
    const verdict = actionQcVerdictLabel(a), violation = actionViolationInfo(a), metaRows = deps.ActionDetailPresentation.meta(a, { testName: t ? deps.testDisplayName(t) : '—', levelShort: actionLevelShort(t, a.level, a.lot), verdict, violation, riskScore: deps.actionRiskScore(a), dueDate: a.dueDate ? deps.vnDate(a.dueDate) : '—', overdueLabel: overdue.overdue ? overdue.label : '', workflowLabel: wf.label }), meta = deps.pres.actionDetailMetaHtml(metaRows);
    const cancelledAlert = deps.pres.actionCancelledAlertHtml(deps.actionCancelled(a) ? { reason: a.cancelReason, by: a.cancelledBy, at: a.cancelledAt ? deps.formatDateTimeVN(a.cancelledAt) : '' } : undefined);
    const legacyDetail = deps.pres.actionLegacyDetailHtml({ action: a.action || '', owner: a.by || '', rerunLabel: rr.label || '', approvalLabel: deps.actionApprovalLabel(a) });
    const body = legacy ? `${cancelledAlert}<div class="alert warn">Bản ghi được tạo trước khi có phiếu điều tra 8 bước. Dữ liệu hành động cũ vẫn được giữ nguyên.</div>${meta}${legacyDetail}` : `
    ${cancelledAlert}${meta}${actionEvidenceTimelineHtml(a, rr)}${actionRerunEvidenceHtml(a, rr, t)}
    <ol class="action-detail-steps">
      ${deps.pres.actionContainmentDetailHtml({ status: LABELS.containment[a.containmentStatus] || '', correction: a.correction || '', note: a.containmentNote || '', modern })}
      ${deps.pres.actionInspectionDetailsHtml([{ title: 'Kiểm tra vật liệu QC', checksHtml: actionDetailCheck('Hạn dùng, bảo quản, hoàn nguyên và chuẩn bị', a.qcMaterialStatus, a.qcMaterialNote) }, { title: 'Kiểm tra máy phân tích', checksHtml: actionDetailCheck('Điện, nước, nhiệt độ, cảnh báo và bảo trì', a.instrumentStatus, a.instrumentNote) }, { title: 'Kiểm tra hóa chất / calibrator', checksHtml: actionDetailCheck('Hạn dùng, số lô, bảo quản và lot-to-lot', a.reagentStatus, a.reagentNote) + actionDetailCheck('So sánh lot-to-lot', a.lotToLotStatus, a.lotToLotNote) }, { title: 'Kiểm tra hiệu chuẩn', checksHtml: actionDetailCheck('Tình trạng hiệu chuẩn', a.calibrationStatus, a.calibrationNote) }])}
      ${deps.pres.actionCauseDetailHtml({ cause: a.cause || '', action: a.action || '', completedDate: a.actionCompletedDate ? deps.vnDate(a.actionCompletedDate) : '', release: a.protocolVersion >= 3 && a.containmentStatus === 'held' ? { status: LABELS.release[a.releaseStatus] || '', details: a.releaseDate || a.releaseBy || a.releaseNote ? `${a.releaseDate ? deps.vnDate(a.releaseDate) + ' · ' : ''}${a.releaseBy || 'Chưa ghi người cho phép'}${a.releaseNote ? ' · ' + a.releaseNote : ''}` : '' } : undefined })}
      ${deps.pres.actionPatientImpactHtml(LABELS.patient[a.patientImpact] || '', a.patientAction || '')}
      ${deps.pres.actionEffectivenessDetailHtml({ effectiveness: modern ? eff.label : a.cause || '—', note: modern && a.effectivenessNote ? `${a.effectivenessDate ? deps.vnDate(a.effectivenessDate) + ' · ' : ''}${a.effectivenessNote}${a.effectivenessBy ? ' · ' + a.effectivenessBy : ''}` : '', residual: +a.protocolVersion >= 3 && residual ? { risk: LABELS.risk[a.residualRiskLevel] || '', score: residual, basis: a.residualRiskBasis || '' } : undefined, returned: a.returnNote ? `${a.returnNote}${a.returnBy ? ' — ' + a.returnBy : ''}${a.returnAt ? ' · ' + deps.formatDateTimeVN(a.returnAt) : ''}` : '', followUpNceId: a.followUpNceId || '', parentNceId: a.parentNceId || '', approval: `${deps.actionApprovalLabel(a)}${a.approvedBy ? ' · ' + a.approvedBy : ''}`, workflow: wf.label })}
    </ol>`;
    return { bodyHtml: body };
  };
  const groupIssuesByTestDate = (issues: AnyRec[]) => deps.ActionListPresentation.groupIssuesByTestDate(issues);
  /* Hồ sơ cũ tự sinh lúc hủy điểm chỉ lưu rule='Hủy điểm QC' — không phải luật Westgard.
     Suy |Z| của chính điểm đó ra ngữ cảnh đọc được, nhưng LUÔN gắn nhãn "suy từ Z" và
     không bao giờ ghi ngược vào bản ghi: luật thật có thể là 2-2s/R4s/4-1s chứ không chỉ
     luật đơn điểm, và khi thiếu snapshot Mean/SD thì phép suy này dùng Mean/SD hiện hành.
     addAction() vì vậy chỉ lưu giá trị người dùng gõ, còn CSV/Excel/bản in vẫn xuất
     a.rule gốc. */
  const actionViolationInfo = (a: AnyRec) => deps.ActionViolationService.info(a);
  const actionQcVerdictLabel = (a: AnyRec) => deps.ActionViolationService.verdictLabel(a);

  /* actionsModel(): dữ liệu thuần cho trang React (src/react/pages/ActionsPage.tsx), song
     song với pageActionsV4() bên dưới — cùng logic đọc state nhưng trả mảng/đối tượng
     thay vì chuỗi HTML. sideChips trả thẳng mảng {cls,label} (bỏ qua actionSideChipsHtml),
     nút duyệt/trả lại/hủy/escalate/mở lại trả thẳng cờ boolean từ
     ActionReviewPresentation.buttons() (bỏ qua actionReviewButtonsHtml) — JSX tự dựng nút
     bằng btn() qua bridge, không tái dựng chuỗi HTML rồi dán lại. */
  const actionsModel = () => {
    const issues = currentIssues(), activePointIds = new Set(issues.map((o: AnyRec) => o.p.id));
    const issueGroups = groupIssuesByTestDate(issues);
    const chipsData = (a: AnyRec, stage: string) => deps.actionCancelled(a) ? [] : deps.ActionStatusPresentation.sideChips(a, stage, deps.actionRerunStatus(a), deps.actionOverdue(a), deps.actionEffectivenessStatus(a));
    const issueItem = (o: AnyRec) => {
      const rules = o.rules.join(', '), err = deps.errorType(o.rules), hint = deps.fixHint(o.rules), wf = deps.pointWorkflowSummary(o.p.id), acts = deps.pointRealActions(o.p.id) || [], latest = acts[acts.length - 1], idx = latest ? (state().actions || []).indexOf(latest) : -1;
      const sideChips = latest ? chipsData(latest, deps.actionWorkflowStatus(latest).stage) : [];
      const footer = latest ? `${latest.nceId ? latest.nceId + ' · ' : ''}Phụ trách: ${latest.by || '—'}${latest.dueDate ? ' · hạn ' + deps.vnDate(latest.dueDate) : ''}` : hint;
      return { severity: o.f.level, level: actionLevelShort(o.t, o.l.level, o.l.lot), state: deps.stateName(o.f.level), value: deps.fmtPointValue(o.p, o.t), unit: o.t.unit || '', rules, error: err, workflowClass: wf.cls, workflowLabel: wf.label, sideChips, footer, action: deps.canWrite() ? (idx >= 0 ? { kind: 'continue', index: idx } : { kind: 'create', testId: o.t.id, level: o.l.level, rules, error: err, hint, pointId: o.p.id || '', date: o.p.date || '' }) : null };
    };
    const violationGroups = issueGroups.map((g: AnyRec) => ({ severity: g.worst, title: deps.testDisplayName(g.t), date: deps.vnDate(g.date), count: g.items.length, countLabel: 'vi phạm', items: g.items.map(issueItem) }));
    const openActions = (state().actions || []).map((a: AnyRec, idx: number) => ({ a, idx })).filter(({ a }: AnyRec) => !deps.actionCancelled(a) && deps.actionRecorded(a) && !deps.actionWorkflowStatus(a).complete && (!a.pointId || !activePointIds.has(a.pointId)));
    const openActionItem = (a: AnyRec, idx: number) => {
      const t = state().tests.find((x: AnyRec) => x.id === a.testId), wf = deps.actionWorkflowStatus(a), violation = actionViolationInfo(a), title = a.nceId || 'Hồ sơ khắc phục', context = t ? `${deps.testDisplayName(t)} · ${actionLevelShort(t, a.level, a.lot)}` : (violation.rule || 'Sự cố'), primary = a.correction || a.action || 'Đang điều tra', verdict = actionQcVerdictLabel(a);
      return { severity: wf.cls === 'rej' ? 'rej' : 'warn', title, context, date: deps.vnDate(deps.actionEventDate(a)), verdict, rule: violation.rule, errorType: violation.errorType, workflowClass: wf.cls, workflowLabel: wf.label, sideChips: chipsData(a, wf.stage), primary, owner: a.by || '', dueDate: a.dueDate ? deps.vnDate(a.dueDate) : '', editable: deps.canWrite(), index: idx };
    };
    const openActionGroup = openActions.length ? { severity: 'warn', title: 'Hồ sơ NCE đang mở', date: 'Cần tiếp tục xử lý', count: openActions.length, countLabel: 'hồ sơ', items: openActions.map(({ a, idx }: AnyRec) => openActionItem(a, idx)) } : null;
    const logRows = (state().actions || []).slice().reverse().map((a: AnyRec, idx: number) => {
      const realIdx = state().actions.length - 1 - idx, t = state().tests.find((x: AnyRec) => x.id === a.testId), wf = deps.actionWorkflowStatus(a), approval = deps.actionApprovalStatus(a), openedAt = a.createdAt ? deps.formatDateTimeVN(a.createdAt) : '', primary = a.action || a.correction || 'Đang điều tra';
      const approvalMeta = approval === 'pending' ? null : { by: a.approvedBy || '', at: a.approvedAt ? deps.formatDateTimeVN(a.approvedAt) : '', note: a.approvalNote || '' };
      const identity = `${a.nceId ? a.nceId + ' · ' : ''}${t ? deps.testDisplayName(t) : (a.rule || 'Cập nhật')}`, sub = t ? actionLevelShort(t, a.level, a.lot) : (a.lot ? 'Nhóm lô ' + a.lot : '—'), rule = t ? (actionQcVerdictLabel(a) ? actionQcVerdictLabel(a) + ' · ' : '') + actionViolationInfo(a).rule + ' · ' + actionViolationInfo(a).errorType : (a.errorType || '—');
      const approvalTag = !deps.actionCancelled(a) && approval !== 'pending' ? { cls: deps.ActionReviewPresentation.approvalTag(approval, deps.actionCancelled(a)).cls, label: deps.actionApprovalLabel(a) } : null;
      const buttons = deps.ActionReviewPresentation.buttons(a, { approval, workflowStage: wf.stage, cancelled: deps.actionCancelled(a), isAdmin: deps.role() === 'admin', canWrite: deps.canWrite(), canEscalate: actionCanEscalate(a), canReopen: actionCanReopen(a) });
      return { index: realIdx, date: deps.vnDate(deps.actionEventDate(a)), openedAt, identity, sub, rule, primary, owner: a.by || '', dueDate: a.dueDate ? deps.vnDate(a.dueDate) : '', workflowClass: wf.cls, workflowLabel: wf.label, sideChips: chipsData(a, wf.stage), approvalTag, approvalMeta, buttons };
    });
    return { violationGroups, openActionGroup, logRows, issueCount: issues.length };
  };

  return {
    actionLevelShort, currentIssues, cancelAction, confirmCancelAction, actionApprovalToken,
    approveAction, confirmApproveAction, returnAction, confirmReturnAction, actionCanEscalate, escalateAction,
    actionCanReopen, reopenAction, confirmReopenAction, actionDetailCheck,
    actionEvidenceTimelineHtml, actionRerunEvidenceHtml, openActionQcEvidence, viewActionDetailModel,
    groupIssuesByTestDate, actionViolationInfo, actionQcVerdictLabel,
    actionsModel,
  };
}
