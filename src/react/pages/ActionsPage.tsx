import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '../components/PageHeader';
import {
  actionsModel, actionFormViewModel, dateBoxHtml, actionCausePhrases, actionActionPhrases,
  editAction, beginActionFromIssue, viewActionDetail, escalateAction, approveAction, returnAction, reopenAction,
  cancelAction, exportActionsCSV, actionInsertSuggestion, actionSectionToggled, actionInvestigationSync,
  actionInvestigationChoose, beginActionManual, actionUpdateBiasHint, actionFillBias, closeActionForm, addAction,
  openActionGuide, syncActLevels, syncActionRiskScore, syncActionResidualRiskScore, actionFormChanged,
  type ActionsModel, type ActionIssueItem, type ActionIssueGroup, type ActionOpenItem, type ActionOpenGroup,
  type ActionLogRow, type ActionSideChip, type ActionFormModel, type ActionFormOpenModel, type ActionFormSelectOption,
  type ActionFormInvestigationItem, type ActionFormChip,
} from '../bridge/actionsBridge';

function Head() {
  return <PageHeader title="Khắc phục sự cố" subtitle="Điều tra nguyên nhân, ghi nhận, chạy lại QC và phê duyệt khép vòng" />;
}

function SideChips({ chips }: { chips: ActionSideChip[] }) {
  return <>{chips.map((c, i) => <span className={`action-chip ${c.cls}`} key={i}>{c.label}</span>)}</>;
}

/* ---------------- Mục "Sự cố cần xử lý" ---------------- */

function IssueRow({ item }: { item: ActionIssueItem }) {
  const continueIndex = item.action && item.action.kind === 'continue' ? item.action.index : null;
  const createArgs = item.action && item.action.kind === 'create' ? item.action : null;
  return (
    <div className={`issue-row ${item.severity}`}>
      <div className="issue-row-main">
        <b>{item.level} · {item.state}</b>
        <div className="meta">{item.value} {item.unit} · {item.rules || '—'} · {item.error}</div>
        <div className="action-chipline"><span className={`action-chip ${item.workflowClass}`}>{item.workflowLabel}</span><SideChips chips={item.sideChips} /></div>
        <div className="hint">{item.footer}</div>
      </div>
      {continueIndex != null ? (
        <button type="button" className="btn ghost sm" onClick={() => editAction(continueIndex)}>Tiếp tục hồ sơ</button>
      ) : createArgs ? (
        <button type="button" className="btn ghost sm" onClick={() => beginActionFromIssue(createArgs.testId, createArgs.level, createArgs.rules, createArgs.error, createArgs.hint, createArgs.pointId, createArgs.date)}>Lập hồ sơ</button>
      ) : null}
    </div>
  );
}

function OpenActionRow({ item }: { item: ActionOpenItem }) {
  return (
    <div className={`issue-row ${item.severity}`}>
      <div className="issue-row-main">
        <b>{item.title} · {item.context}</b>
        <div className="meta">{item.date}{item.verdict ? ` · ${item.verdict}` : ''} · {item.rule} · {item.errorType}</div>
        <div className="action-chipline"><span className={`action-chip ${item.workflowClass}`}>{item.workflowLabel}</span><SideChips chips={item.sideChips} /></div>
        <div className="hint">{item.primary} · Phụ trách: {item.owner || '—'}{item.dueDate ? ` · hạn ${item.dueDate}` : ''}</div>
      </div>
      {item.editable ? <button type="button" className="btn ghost sm" onClick={() => editAction(item.index)}>Tiếp tục hồ sơ</button> : null}
    </div>
  );
}

function IssueGroupBlock({ group }: { group: ActionIssueGroup }) {
  return (
    <div className={`issue-group ${group.severity}`}>
      <div className="issue-group-h"><div><b>{group.title}</b><span className="issue-group-date">{group.date}</span></div><span className="issue-group-count">{group.count} {group.countLabel}</span></div>
      <div className="issue-group-body">{group.items.map((item, i) => <IssueRow item={item} key={i} />)}</div>
    </div>
  );
}

function OpenActionGroupBlock({ group }: { group: ActionOpenGroup }) {
  return (
    <div className={`issue-group ${group.severity}`}>
      <div className="issue-group-h"><div><b>{group.title}</b><span className="issue-group-date">{group.date}</span></div><span className="issue-group-count">{group.count} {group.countLabel}</span></div>
      <div className="issue-group-body">{group.items.map((item, i) => <OpenActionRow item={item} key={i} />)}</div>
    </div>
  );
}

function IssuesPanel({ model }: { model: ActionsModel }) {
  const hasAny = model.violationGroups.length > 0 || model.openActionGroup;
  return (
    <div className="panel action-issues-panel">
      <h2 className="panel-title">Sự cố cần xử lý</h2>
      <div className="dash-list">
        {hasAny ? (
          <>
            {model.violationGroups.map((g, i) => <IssueGroupBlock group={g} key={i} />)}
            {model.openActionGroup ? <OpenActionGroupBlock group={model.openActionGroup} /> : null}
          </>
        ) : <div className="alert ok">Không có vi phạm/cảnh báo hoặc hồ sơ NCE đang mở.</div>}
      </div>
    </div>
  );
}

/* ---------------- Mục "Nhật ký khắc phục" ---------------- */

function LogRowView({ row }: { row: ActionLogRow }) {
  const b = row.buttons;
  return (
    <tr>
      <td><div className="action-date">{row.date}</div>{row.openedAt ? <div className="action-time">Mở: {row.openedAt}</div> : null}</td>
      <td><div className="action-test">{row.identity}</div><div className="action-sub">{row.sub}</div><div className="action-rule">{row.rule}</div></td>
      <td><div className="action-text">{row.primary}</div><div className="action-sub">Phụ trách: {row.owner || '—'}{row.dueDate ? ` · hạn ${row.dueDate}` : ''}</div></td>
      <td><div className="action-status-stack">
        <span className={`action-chip ${row.workflowClass}`}>{row.workflowLabel}</span>
        <SideChips chips={row.sideChips} />
        {row.approvalTag ? <span className={`tag ${row.approvalTag.cls}`}>{row.approvalTag.label}</span> : null}
        {row.approvalMeta ? <div className="action-note">{row.approvalMeta.by} {row.approvalMeta.at}{row.approvalMeta.note ? ` · ${row.approvalMeta.note}` : ''}</div> : null}
      </div></td>
      <td><div className="action-row-actions">
        <button type="button" className="btn ghost sm" onClick={() => viewActionDetail(row.index)}>Chi tiết</button>
        {b.edit ? <button type="button" className="btn ghost sm" onClick={() => editAction(row.index)}>Tiếp tục</button> : null}
        {b.escalate ? <button type="button" className="btn teal sm" title="Hành động chưa hiệu lực — mở vòng điều tra mới" onClick={() => escalateAction(row.index)}>Lập hồ sơ tiếp theo</button> : null}
        {b.approve ? <button type="button" className="btn teal sm" onClick={() => approveAction(row.index)}>Duyệt</button> : null}
        {b.returnForRevision ? <button type="button" className="btn ghost sm" onClick={() => returnAction(row.index)}>Trả lại</button> : null}
        {b.reopen ? <button type="button" className="btn danger sm" title="Hồ sơ đã duyệt nhưng không còn đủ điều kiện khép vòng" onClick={() => reopenAction(row.index)}>Mở lại</button> : null}
        {b.cancel ? <button type="button" className="btn danger sm" title="Hủy có lưu vết — không xóa dữ liệu" onClick={() => cancelAction(row.index)}>Hủy hồ sơ</button> : null}
      </div></td>
    </tr>
  );
}

function LogPanel({ rows }: { rows: ActionLogRow[] }) {
  return (
    <div className="panel action-log-panel">
      <h2 className="panel-title">Nhật ký khắc phục</h2>
      {rows.length ? (
        <>
          <div className="action-log-tools"><button type="button" className="btn teal sm" onClick={exportActionsCSV}>Xuất CSV nhật ký</button></div>
          <div className="action-log-wrap"><table className="action-log-table">
            <thead><tr><th>Thời điểm</th><th>Sự cố</th><th>Hành động</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>{rows.map(row => <LogRowView row={row} key={row.index} />)}</tbody>
          </table></div>
        </>
      ) : <div className="empty"><div className="empty-title">Chưa có nhật ký</div><div>Các hành động khắc phục sẽ xuất hiện ở đây sau khi được lưu.</div></div>}
    </div>
  );
}

/* ---------------- Form NCE (mục form) ---------------- */

function Select({ id, label, options, defaultValue, disabled, onChange }: {
  id: string; label: string; options: ActionFormSelectOption[]; defaultValue: unknown;
  disabled?: boolean; onChange?: (v: string) => void;
}) {
  const current = defaultValue == null ? '' : String(defaultValue);
  const opts = options.some(o => o.value === current) || !current ? options : [...options, { value: current, label: current }];
  return (
    <select id={id} aria-label={label} defaultValue={current} disabled={disabled} onChange={onChange ? e => onChange(e.target.value) : undefined}>
      {opts.map(o => <option value={o.value} key={o.value}>{o.label}</option>)}
    </select>
  );
}

function DateField({ id, value, attrs = '' }: { id: string; value: string; attrs?: string }) {
  // dangerouslySetInnerHTML tạo DOM ngoài fiber tree của React, nên onChange bắt sự kiện
  // theo kiểu ủy quyền đặt trên .action-form-body (FormOpenBody) không bao giờ thấy sự
  // kiện nổi bọt từ bên trong span này — xác nhận bằng cách gõ tay: sự kiện 'input' gốc
  // nổi bọt tới đúng phần tử cha (browser DOM thật), nhưng actionFormChanged qua onChange
  // của React không hề chạy. Phải tự gắn listener gốc ở đây để chip mục 4-6 (nguyên nhân)
  // cập nhật đúng khi gõ ngày hoàn thành/ngày cho phép/ngày đánh giá hiệu lực.
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => actionFormChanged();
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
    return () => { el.removeEventListener('input', handler); el.removeEventListener('change', handler); };
  }, []);
  return <span ref={ref} style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: dateBoxHtml(id, value, '', attrs) }} />;
}

function SuggestBox({ targetId, phrases, label = 'Gợi ý nhập nhanh' }: { targetId: string; phrases: string[]; label?: string }) {
  if (!phrases || !phrases.length) return null;
  return (
    <details className="action-suggestions">
      <summary>+ {label}</summary>
      <div className="sugg-row" id={`sugg-${targetId}`}>
        {phrases.map(p => <button type="button" className="sugg-chip" key={p} onClick={() => actionInsertSuggestion(targetId, p)}>{p}</button>)}
      </div>
    </details>
  );
}

function SectionChip({ chip }: { chip: ActionFormChip }) {
  return <span className={`action-chip ${chip.cls}`} aria-label={chip.title || chip.label} title={chip.title || undefined}>{chip.label}</span>;
}

function FormSection({ sectionKey, open, badge, title, hint, chip, children }: {
  sectionKey: string; open: boolean; badge: string; title: string; hint: string; chip: ActionFormChip; children: React.ReactNode;
}) {
  return (
    <details className="action-form-section" data-action-section={sectionKey} open={open} onToggle={e => actionSectionToggled(sectionKey, (e.target as HTMLDetailsElement).open)}>
      <summary className="action-form-section-title"><span>{badge}</span><div><b>{title}</b><small>{hint}</small></div><SectionChip chip={chip} /></summary>
      {children}
    </details>
  );
}

function InvestigationItemView({ item }: { item: ActionFormInvestigationItem }) {
  return (
    <div className={`action-investigation-item ${item.stateClass}`} id={`check-${item.statusId}`}>
      <div className="action-investigation-head"><div><b>{item.title}</b><small>{item.hint}</small></div><span className="action-investigation-state">{item.stateLabel}</span></div>
      <select id={item.statusId} className="action-investigation-select" aria-hidden="true" tabIndex={-1} defaultValue={item.value} onChange={() => actionInvestigationSync(item.statusId)}>
        {item.options.map(o => <option value={o.value} key={o.value}>{o.label}</option>)}
      </select>
      <div className="action-investigation-choices" role="group" aria-label={`Kết quả ${item.title}`}>
        {item.choices.map(c => (
          <button type="button" className={`action-choice ${c.active ? 'active' : ''}`} data-value={c.value} aria-pressed={c.active ? 'true' : 'false'} onClick={() => actionInvestigationChoose(item.statusId, c.value)} key={c.value}>{c.label}</button>
        ))}
      </div>
      <div className="action-investigation-note">
        <input id={item.noteId} aria-label={`Ghi chú ${item.title}`} placeholder="Ghi chú / bằng chứng" defaultValue={item.noteValue} />
        <SuggestBox targetId={item.noteId} phrases={item.suggestPhrases} label="Gợi ý bằng chứng" />
      </div>
    </div>
  );
}

function IdentitySection({ model }: { model: ActionFormOpenModel }) {
  return (
    <div className="action-form-section">
      <div className="action-form-section-title"><span>Hồ sơ</span><div><b>Nhận diện sự cố</b><small>Có thể lưu ngay sau khi kiểm soát tức thời; không cần chờ điều tra xong</small></div></div>
      <input id="aPointId" type="hidden" defaultValue={model.pointId} />
      {model.qcBound ? <input id="aLevel" type="hidden" defaultValue={String(model.level)} /> : null}
      <div className="action-ident-groups">
        <div className="action-ident-group">
          <div className="action-ident-group-title"><b>Đối tượng QC</b><small>{model.editing ? 'Khóa theo hồ sơ đã mở — sai đối tượng thì hủy có lưu vết và mở hồ sơ mới' : 'Hồ sơ và cấu hình QC đang xảy ra sự cố'}</small></div>
          <div className="action-form-main">
            <div><label>Mã hồ sơ</label><input id="aNceId" aria-label="Mã hồ sơ NCE" readOnly defaultValue={model.nceId} /></div>
            <div><label>Xét nghiệm{model.qcBound ? null : <span className="hint"> (nếu có)</span>}</label>
              <select id="aTest" aria-label="Xét nghiệm" defaultValue={model.selectedTestId} disabled={model.testDisabled} onChange={model.testDisabled ? undefined : syncActLevels}>
                {model.testOptions.map(t => <option value={t.id} key={t.id}>{t.label}</option>)}
              </select>
            </div>
            {model.qcBound ? <div><label>Ngữ cảnh QC</label><input id="aLevelLabel" aria-label="Ngữ cảnh QC" readOnly defaultValue={model.levelLabel || ''} /></div> : null}
          </div>
        </div>
        <div className="action-ident-group">
          <div className="action-ident-group-title"><b>Phân loại sự cố</b><small>Thời điểm, dấu hiệu phát hiện và loại sai số</small></div>
          <div className="action-form-meta">
            <div><label>Ngày ghi nhận</label><DateField id="aDate" value={model.date} attrs="action-date" /></div>
            <div><label>Luật vi phạm</label><Select id="aRule" label="Luật vi phạm" options={model.ruleOptions} defaultValue={model.selectedRule} /></div>
            <div><label>Nguồn phát hiện</label><Select id="aEventSource" label="Nguồn phát hiện" options={model.sourceOptions} defaultValue={model.selectedSource} /></div>
            <div><label>Giai đoạn</label><Select id="aProcessPhase" label="Giai đoạn quá trình" options={model.phaseOptions} defaultValue={model.selectedPhase} /></div>
            <div><label>Loại sai số</label><ErrTypeSelect model={model} /></div>
          </div>
        </div>
        <div className="action-ident-group">
          <div className="action-ident-group-title"><b>Phân công xử lý</b><small>Người chịu trách nhiệm và thời hạn dự kiến</small></div>
          <div className="action-form-owner">
            <div><label>Người phụ trách</label><input id="aBy" aria-label="Người phụ trách" list="aByList" autoComplete="off" placeholder="Chọn hoặc gõ tên" defaultValue={model.by} /><datalist id="aByList">{model.staffNames.map(n => <option value={n} key={n} />)}</datalist></div>
            <div><label>Hạn hoàn thành</label><DateField id="aDueDate" value={model.dueDate} attrs="action-date" /></div>
          </div>
        </div>
      </div>
      {model.evidenceTimelineHtml ? <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: model.evidenceTimelineHtml }} /> : null}
    </div>
  );
}

/* aErr điều khiển cả select "Loại sai số" lẫn gợi ý hành động khắc phục ở mục 4-6 —
   dùng state cục bộ thay vì syncActionSuggestions() (vốn thay outerHTML của node do
   React sở hữu, xung đột với reconciliation nếu một rerender() không-liên-quan xảy ra
   trong lúc form vẫn mở); actionFormChanged() (bắt draft) vẫn chạy bình thường qua
   data-notify-changed của .action-form-body, không phụ thuộc onChange này. */
function ErrTypeSelect({ model }: { model: ActionFormOpenModel }) {
  const [errType, setErrType] = useState(model.selectedErr);
  return <Select id="aErr" label="Loại sai số" options={model.errOptions} defaultValue={model.selectedErr} onChange={setErrType} />;
}

function ImmediateSection({ s }: { s: ActionFormOpenModel['sections']['immediate'] }) {
  return (
    <div className="action-immediate-grid">
      <div><label>Phạm vi kiểm soát tức thời</label><Select id="aContainment" label="Phạm vi kiểm soát tức thời" options={s.containmentOptions} defaultValue={s.containmentStatus} /></div>
      <div><label>Ghi chú phạm vi</label><input id="aContainmentNote" placeholder="VD: Giữ kết quả từ 08:00 đến khi QC đạt" defaultValue={s.containmentNote} /><SuggestBox targetId="aContainmentNote" phrases={s.containmentNoteSuggest} /></div>
      <div><label>Xử lý tức thời đã thực hiện</label><textarea id="aCorrection" rows={1} placeholder="VD: Dừng trả kết quả, cô lập lô QC và thông báo phụ trách..." defaultValue={s.correction} /><SuggestBox targetId="aCorrection" phrases={s.correctionSuggest} /></div>
    </div>
  );
}

function RiskSection({ s }: { s: ActionFormOpenModel['sections']['risk'] }) {
  return (
    <div className="action-risk-grid">
      <div><label>Mức độ ảnh hưởng (S)</label><Select id="aRiskSeverity" label="Mức độ ảnh hưởng" options={s.severityOptions} defaultValue={s.severity} onChange={syncActionRiskScore} /></div>
      <div><label>Khả năng xảy ra (O)</label><Select id="aRiskOccurrence" label="Khả năng xảy ra" options={s.occurrenceOptions} defaultValue={s.occurrence} onChange={syncActionRiskScore} /></div>
      <div><label>Khả năng không phát hiện (D)</label><Select id="aRiskDetectability" label="Khả năng không phát hiện" options={s.detectOptions} defaultValue={s.detectability} onChange={syncActionRiskScore} /></div>
      <div className="action-risk-level"><label>Phân loại theo SOP</label><Select id="aRiskLevel" label="Phân loại nguy cơ" options={s.levelOptions} defaultValue={s.level} onChange={syncActionRiskScore} /></div>
      <div className="action-risk-result"><label>RPN</label><div id="aRiskScoreCard" className={`action-risk-score risk-${s.scoreClass}`} aria-live="polite"><b id="aRiskScore">{s.score}</b></div></div>
      <div className="action-risk-basis"><label>Căn cứ phân loại theo SOP</label><input id="aRiskBasis" placeholder="VD: SOP-QC-07, ma trận nguy cơ bảng 3" defaultValue={s.basis} /><SuggestBox targetId="aRiskBasis" phrases={s.basisSuggest} /></div>
    </div>
  );
}

function CheckSection({ items }: { items: ActionFormInvestigationItem[] }) {
  return <div className="action-investigation-grid">{items.map(item => <InvestigationItemView item={item} key={item.statusId} />)}</div>;
}

function CauseSection({ s, model }: { s: ActionFormOpenModel['sections']['cause']; model: ActionFormOpenModel }) {
  const [causeCategory, setCauseCategory] = useState(s.causeCategory);
  const causeSuggest = actionCausePhrases(causeCategory);
  const releaseHint = s.containmentHeld ? 'Bắt buộc sau khi QC được chấp nhận và hành động đã hoàn thành' : 'Không bắt buộc vì mục 1 không ghi nhận kết quả liên quan bị giữ';
  return (
    <>
      <div className="action-cause-grid">
        <div><label>Nhóm nguyên nhân</label><Select id="aCauseCategory" label="Nhóm nguyên nhân" options={s.causeCategoryOptions} defaultValue={causeCategory} onChange={setCauseCategory} /></div>
        <div><label>Nguyên nhân gốc hoặc nghi ngờ</label><textarea id="aCause" rows={1} placeholder="Mô tả bằng chứng và nguyên nhân..." defaultValue={s.cause} /><SuggestBox targetId="aCause" phrases={causeSuggest} /></div>
        <div><label>Hành động khắc phục để ngăn tái diễn</label><textarea id="aAct" rows={1} placeholder="VD: Thay lọ QC mới, vệ sinh kim hút, cập nhật lịch bảo trì..." defaultValue={s.action} /><ActSuggestBox model={model} /></div>
      </div>
      <div className="action-cause-second-row">
        <div><label>Ngày hoàn thành hành động</label><DateField id="aActionCompletedDate" value={s.completedDate} attrs="action-date" /></div>
        <div><label>Bias trước khắc phục (%) <small className="hint">tham khảo</small></label>
          <input id="aBiasBefore" type="text" inputMode="decimal" placeholder="VD: 8.5" defaultValue={s.biasBefore} onChange={actionUpdateBiasHint} />
          {s.sigmaBiasChip ? <div className="sugg-row"><button type="button" className="sugg-chip" onClick={() => actionFillBias('aBiasBefore', s.sigmaBiasChip!.value)} title={`Lấy từ Bias EQA/EQC kỳ ${s.sigmaBiasChip.period} ở trang Six Sigma`}>Dùng Bias EQA gần nhất (kỳ {s.sigmaBiasChip.period}): {s.sigmaBiasChip.valueText}%</button></div> : null}
        </div>
        <div><label>Bias sau khắc phục (%) <small className="hint">tham khảo</small></label><input id="aBiasAfter" type="text" inputMode="decimal" placeholder="VD: 1.2" defaultValue={s.biasAfter} onChange={actionUpdateBiasHint} /></div>
      </div>
      <div id="aBiasThresholdHint" className="hint flow-note" dangerouslySetInnerHTML={{ __html: s.thresholdHtml }} />
      {s.rerunEvidenceHtml ? <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: s.rerunEvidenceHtml }} /> : null}
      <div className="action-release-block">
        <div className="action-release-title"><b>Cho phép hoạt động/trả kết quả trở lại</b><small>{releaseHint}</small></div>
        <div className="action-release-grid">
          <div><label>Quyết định</label><Select id="aReleaseStatus" label="Quyết định cho phép trở lại" options={s.releaseOptions} defaultValue={s.releaseStatus} /></div>
          <div><label>Ngày cho phép</label><DateField id="aReleaseDate" value={s.releaseDate} attrs="action-date" /></div>
          <div><label>Người cho phép</label><input id="aReleaseBy" list="aByList" autoComplete="off" placeholder="Chọn hoặc gõ tên" defaultValue={s.releaseBy} /></div>
          <div><label>Căn cứ cho phép</label><input id="aReleaseNote" placeholder="VD: QC chạy lại đã được chấp nhận" defaultValue={s.releaseNote} /><SuggestBox targetId="aReleaseNote" phrases={s.releaseSuggest} /></div>
        </div>
      </div>
    </>
  );
}

function ActSuggestBox({ model }: { model: ActionFormOpenModel }) {
  const [errType, setErrType] = useState(model.selectedErr);
  const actionSuggest = actionActionPhrases(errType);
  return <SuggestBox targetId="aAct" phrases={actionSuggest} />;
}

function PatientSection({ s }: { s: ActionFormOpenModel['sections']['patient'] }) {
  return (
    <>
      <div id="aPatientRiskRef" className="hint space-after-control" dangerouslySetInnerHTML={{ __html: s.referenceHtml }} />
      <div className="action-patient-grid">
        <div><label>Kết luận ảnh hưởng</label><Select id="aPatientImpact" label="Kết luận ảnh hưởng" options={s.impactOptions} defaultValue={s.impact} /></div>
        <div><label>Xử lý mẫu/kết quả liên quan</label><textarea id="aPatientAction" rows={1} placeholder="VD: Rà soát các mẫu từ 08:00–10:00; chạy lại 3 mẫu..." defaultValue={s.action} /><SuggestBox targetId="aPatientAction" phrases={s.actionSuggest} /></div>
      </div>
    </>
  );
}

function EffSection({ s }: { s: ActionFormOpenModel['sections']['eff'] }) {
  return (
    <>
      <div className="action-effectiveness-grid">
        <div><label>Kết luận hiệu lực</label><Select id="aEffectivenessStatus" label="Kết luận hiệu lực" options={s.statusOptions} defaultValue={s.status} /></div>
        <div className="action-effectiveness-date"><label>Ngày đánh giá</label><DateField id="aEffectivenessDate" value={s.date} attrs="action-date" /></div>
        <div><label>Bằng chứng/nhận xét hiệu lực</label><textarea id="aEffectivenessNote" rows={1} placeholder="VD: Theo dõi 20 lần chạy tiếp theo không tái diễn..." defaultValue={s.note} /><SuggestBox targetId="aEffectivenessNote" phrases={s.noteSuggest} /></div>
      </div>
      <div className="action-residual-block">
        <div className="action-release-title"><b>Nguy cơ còn lại sau khắc phục</b><small>Chỉ bắt buộc khi kết luận có hiệu lực; dùng cùng thang điểm và SOP với đánh giá ban đầu</small></div>
        <div className="action-residual-grid">
          <div><label>Mức độ (S)</label><Select id="aResidualSeverity" label="Mức độ còn lại" options={s.severityOptions} defaultValue={s.severity} onChange={syncActionResidualRiskScore} /></div>
          <div><label>Khả năng xảy ra (O)</label><Select id="aResidualOccurrence" label="Khả năng xảy ra còn lại" options={s.occurrenceOptions} defaultValue={s.occurrence} onChange={syncActionResidualRiskScore} /></div>
          <div><label>Khả năng không phát hiện (D)</label><Select id="aResidualDetectability" label="Khả năng không phát hiện còn lại" options={s.detectOptions} defaultValue={s.detectability} onChange={syncActionResidualRiskScore} /></div>
          <div><label>Phân loại theo SOP</label><Select id="aResidualRiskLevel" label="Phân loại nguy cơ còn lại" options={s.levelOptions} defaultValue={s.level} onChange={syncActionResidualRiskScore} /></div>
          <div className="action-risk-result"><label>RPN còn lại</label><div id="aResidualRiskScoreCard" className={`action-risk-score risk-${s.scoreClass}`} aria-live="polite"><b id="aResidualRiskScore">{s.score}</b></div></div>
          <div className="action-residual-basis"><label>Căn cứ đánh giá lại</label><input id="aResidualRiskBasis" placeholder="VD: SOP-QC-07; dữ liệu theo dõi sau khắc phục" defaultValue={s.basis} /><SuggestBox targetId="aResidualRiskBasis" phrases={s.basisSuggest} /></div>
        </div>
      </div>
    </>
  );
}

function FormClosed({ model }: { model: Extract<ActionFormModel, { open: false }> }) {
  return (
    <div className="empty">
      <b>{model.closed.title}</b>
      <p>{model.closed.message}</p>
      {model.canWrite ? <button type="button" className="btn ghost" onClick={beginActionManual}>Lập hồ sơ từ nguồn khác</button> : null}
    </div>
  );
}

function FormOpenBody({ model }: { model: ActionFormOpenModel }) {
  const openSet = new Set(model.openSections);
  const s = model.sections;
  return (
    <div className="action-form-body" onChange={actionFormChanged} key={model.formKey}>
      {model.incidentBanner ? <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: model.incidentBanner }} /> : null}
      <IdentitySection model={model} />
      <FormSection sectionKey="immediate" open={openSet.has('immediate')} badge="1" title="Kiểm soát và xử lý tức thời" hint="Phần tối thiểu bắt buộc để mở hồ sơ NCE; kết luận ảnh hưởng bệnh nhân ghi ở mục 7" chip={s.immediate.chip}>
        <ImmediateSection s={s.immediate} />
      </FormSection>
      <FormSection sectionKey="risk" open={openSet.has('risk')} badge="2" title="Đánh giá nguy cơ" hint="RPN được tính tự động; mức phân loại phải truy xuất được về SOP của đơn vị" chip={s.risk.chip}>
        <RiskSection s={s.risk} />
      </FormSection>
      <FormSection sectionKey="check" open={openSet.has('check')} badge="3" title="Checklist điều tra" hint="Ghi rõ khi bất thường hoặc không áp dụng" chip={s.check.chip}>
        <CheckSection items={s.check.items} />
      </FormSection>
      <FormSection sectionKey="cause" open={openSet.has('cause')} badge="4–6" title="Nguyên nhân gốc và hành động khắc phục" hint="Tách khỏi xử lý tức thời; QC chạy lại được tự liên kết" chip={s.cause.chip}>
        <CauseSection s={s.cause} model={model} />
      </FormSection>
      <FormSection sectionKey="patient" open={openSet.has('patient')} badge="7" title="Đánh giá ảnh hưởng bệnh nhân" hint="Ghi rõ phạm vi và cách xử lý nếu có liên quan" chip={s.patient.chip}>
        <PatientSection s={s.patient} />
      </FormSection>
      <FormSection sectionKey="eff" open={openSet.has('eff')} badge="8" title="Đánh giá hiệu lực" hint='Làm sau thời gian theo dõi; kết luận "có hiệu lực" cần đánh giá nguy cơ còn lại' chip={s.eff.chip}>
        <EffSection s={s.eff} />
      </FormSection>
      <div className="action-form-submit">
        <div><b>{model.editing ? 'Cập nhật tiến độ hồ sơ' : 'Lưu ngay ở trạng thái đang điều tra'}</b><span>Chỉ cần hoàn tất phần nhận diện và kiểm soát tức thời để lưu; phê duyệt chỉ xuất hiện khi hồ sơ đủ điều kiện khép vòng.</span></div>
        <div className="action-submit-buttons">
          <button type="button" className="btn ghost" onClick={closeActionForm}>{model.editing ? 'Hủy chỉnh sửa' : 'Đóng'}</button>
          <button type="button" className="btn teal" onClick={addAction}>{model.editing ? 'Lưu thay đổi' : 'Lập hồ sơ NCE'}</button>
        </div>
      </div>
    </div>
  );
}

function FormPanel({ model }: { model: ActionFormModel }) {
  return (
    <div className="panel action-form-panel">
      <div className="action-form-panel-head">
        <h2 className="panel-title">{model.open ? model.title : 'Lập hồ sơ sự không phù hợp (NCE)'}</h2>
        <button type="button" className="btn ghost sm" onClick={openActionGuide}>Quy trình 8 bước</button>
      </div>
      {model.open ? <FormOpenBody model={model} /> : <FormClosed model={model} />}
    </div>
  );
}

export function ActionsPage() {
  const model = actionsModel();
  const formModel = actionFormViewModel(model.issueCount);
  return (
    <>
      <Head />
      <IssuesPanel model={model} />
      <FormPanel model={formModel} />
      <LogPanel rows={model.logRows} />
    </>
  );
}
