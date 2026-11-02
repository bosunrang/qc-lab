import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Modal } from '../../components/Modal';
import { DateField } from '../../components/DateField';
import { RowActionButton } from '../../components/RowActionButton';
import { TEA_CATALOG, TEA_SOURCE_CARDS } from '../../../main/domain/tea-catalog';
import { useManageStore } from '../../store/manage-store';
import { confirmDialog, errorDialog } from '../../state/dialog-store';
import { useAuthStore } from '../../store/auth-store';
import type { TeaRef } from '../../../shared/qc-api';
import { EmptyState } from './shared';
import { useAsyncAction } from '../../components/AsyncButton';


const TEA_STATUS: Record<string, { cls: string; label: string }> = {
  default: { cls: 'none', label: 'Mặc định' },
  override: { cls: 'warn', label: 'Đã sửa' },
  lab: { cls: 'ok', label: 'TEa PXN' },
};


const TEA_LAB_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'regulation', label: 'Quy định pháp lý / CLIA / quốc gia' },
  { value: 'pt', label: 'Chương trình ngoại kiểm / PT' },
  { value: 'eflm', label: 'EFLM Biological Variation' },
  { value: 'ricos', label: 'Ricos / Westgard BV (nguồn cũ)' },
  { value: 'professional', label: 'Hiệp hội / ủy ban chuyên môn' },
  { value: 'other', label: 'Nguồn khác đã thẩm định' },
];

function normalizeTeaKey(value: string) { return value.trim().toLocaleLowerCase('vi'); }
function formatTeaValue(value: number | null | undefined) { return value == null ? '—' : `${value}%`; }

function parseSources(json: string | undefined) {
  try { return JSON.parse(json || '{}') as Record<string, string>; } catch { return {}; }
}

function hasLabProfile(ref: Pick<TeaRef, 'lab' | 'lab_level_defaults'> | null | undefined) {
  return ref?.lab != null || !!ref?.lab_level_defaults?.length;
}

export function TeaRefsTab() {
  const { teaRefs, saveTeaRef, removeTeaRef, removeTeaLabProfile, setTeaRefValue, restoreTeaRefDefaults, addTeaAnalyte } = useManageStore(useShallow((s) => ({ teaRefs: s.teaRefs, saveTeaRef: s.saveTeaRef, removeTeaRef: s.removeTeaRef, removeTeaLabProfile: s.removeTeaLabProfile, setTeaRefValue: s.setTeaRefValue, restoreTeaRefDefaults: s.restoreTeaRefDefaults, addTeaAnalyte: s.addTeaAnalyte })));
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === 'admin';
  const [prefill, setPrefill] = useState<{ analyteId: string; name: string; unit: string; section: string } | null>(null);
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [teaMode, setTeaMode] = useState<'common' | 'levels'>('common');
  const [selectedTeaLevels, setSelectedTeaLevels] = useState<number[]>([1, 2]);
  // Giá trị TEa đang gõ giữ trong state để đổi qua lại hai chế độ không mất số.
  const [labDraft, setLabDraft] = useState('');
  const [levelDrafts, setLevelDrafts] = useState<Record<number, string>>({});
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const current = editing && editing !== 'new' ? teaRefs.find((ref) => ref.id === editing) : null;
  const currentSources = useMemo(() => parseSources(current?.sources_json), [current]);
  const normalizedQuery = normalizeTeaKey(query);
  const catalogNames = useMemo(() => new Set(TEA_CATALOG.map((item) => normalizeTeaKey(item.name))), []);
  const labRefsByName = useMemo(() => new Map(teaRefs.filter(hasLabProfile).map((ref) => [normalizeTeaKey(ref.name), ref])), [teaRefs]);
  const overrideByAnalyte = useMemo(() => new Map(teaRefs.filter((ref) => ref.analyte_id).map((ref) => [ref.analyte_id, ref])), [teaRefs]);
  const visibleCatalog = useMemo(() => [...TEA_CATALOG]
    .filter((ref) => normalizeTeaKey(`${ref.name} ${ref.abbr} ${ref.unit} ${ref.section}`).includes(normalizedQuery))
    .sort((left, right) => left.section.localeCompare(right.section, 'vi') || left.name.localeCompare(right.name, 'vi')), [normalizedQuery]);
  const visibleCustomRefs = useMemo(() => teaRefs
    .filter((ref) => !catalogNames.has(normalizeTeaKey(ref.name)))
    .filter((ref) => normalizeTeaKey(`${ref.name} ${ref.unit} ${ref.section} ${ref.lab_source}`).includes(normalizedQuery)), [catalogNames, normalizedQuery, teaRefs]);

  const profileName = current?.name || prefill?.name || '';
  const inferredCatalogId = TEA_CATALOG.find((item) => normalizeTeaKey(item.name) === normalizeTeaKey(profileName))?.id || '';
  const profileAnalyteId = current?.analyte_id || prefill?.analyteId || inferredCatalogId;

  /** Nạp bản nháp MỘT lần khi mở biểu mẫu. Không đồng bộ lại theo `teaRefs`
   * khi đang sửa: bảng tải lại (vd đồng bộ LAN) không được xoá số đang gõ. */
  function openProfile(ref: TeaRef | null, nextPrefill: typeof prefill = null) {
    const levels = [...(ref?.lab_level_defaults || [])].sort((left, right) => left.level - right.level);
    setErr(null);
    setPrefill(nextPrefill);
    setTeaMode(levels.length ? 'levels' : 'common');
    setSelectedTeaLevels(levels.length ? levels.map((item) => item.level) : [1, 2]);
    setLabDraft(ref?.lab != null ? String(ref.lab) : '');
    setLevelDrafts(Object.fromEntries(levels.map((item) => [item.level, String(item.tea)])));
    setEditing(ref ? ref.id : 'new');
  }

  async function commitTeaValue(ref: { id: string; name: string; unit: string; section: string }, field: 'clia' | 'ricos', input: HTMLInputElement) {
    const result = await setTeaRefValue({ analyteId: ref.id, field, value: input.value, name: ref.name, unit: ref.unit, section: ref.section });
    if (!result.ok) { await errorDialog(result.error.message, { title: 'Chưa lưu được TEa' }); }
  }

  async function submit(form: HTMLFormElement) {
    const data = Object.fromEntries(new FormData(form).entries());
    // Mức QC thuộc hồ sơ analyte, không phụ thuộc việc đã tạo xét nghiệm hay
    // máy. Giữ cả ô trống trong payload để cổng kiểm tra chỉ rõ mức nào thiếu.
    const levelValues = teaMode === 'levels'
      ? selectedTeaLevels.map((level) => ({ level, tea: levelDrafts[level] ?? '' }))
      : [];
    const result = await saveTeaRef(editing !== 'new' ? (editing as string) : undefined, { ...data, labValue: labDraft, levelValues });
    if (!result.ok) { setErr(result.error.message); return; }
    setEditing(null);
  }

  async function submitAnalyte(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const result = await addTeaAnalyte({
      name: String(form.get('name') || ''), abbreviation: String(form.get('abbreviation') || ''),
      unit: String(form.get('unit') || ''),
      section: String(form.get('section') || ''), clia: String(form.get('clia') || ''), ricos: String(form.get('ricos') || ''),
      cliaRule: String(form.get('cliaRule') || '') as 'percent' | 'absolute' | 'greater-of',
      cliaAbsolute: String(form.get('cliaAbsolute') || ''), cliaAbsoluteUnit: String(form.get('cliaAbsoluteUnit') || ''),
    });
    if (!result.ok) { setAddErr(result.error.message); return; }
    setAdding(false);
  }

  const saving = useAsyncAction(submit);
  const addingAnalyte = useAsyncAction(submitAnalyte);
  async function remove(id: string, name: string) {
    if (await confirmDialog(`Xoá hồ sơ TEa "${name}"?`, { danger: true })) await removeTeaRef(id);
  }


  async function removeLabProfile(id: string, name: string) {
    if (!(await confirmDialog(`Xoá hồ sơ TEa chuẩn hóa của "${name}"?`, { title: 'Xóa TEa chuẩn hóa', confirmLabel: 'Xóa', danger: true }))) return;
    const result = await removeTeaLabProfile(id);
    if (!result.ok) { await errorDialog(result.error.message, { title: 'Chưa xóa được' }); return; }
    setEditing(null);
  }

  function toggleTeaLevel(level: number) {
    setSelectedTeaLevels((currentLevels) => {
      if (currentLevels.includes(level)) {
        // Luôn giữ ít nhất một mức khi đang chọn chế độ TEa theo mức.
        return currentLevels.length === 1 ? currentLevels : currentLevels.filter((item) => item !== level);
      }
      return [...currentLevels, level].sort((left, right) => left - right);
    });
  }

  return (
    <>
      <div className="rcfg-toolbar"><div><h2>Bảng TEa tham chiếu</h2><p>Tổng hợp TEa từ các nguồn tham chiếu, dùng thống nhất khi tính Sigma.</p></div><div className="rcfg-tools"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên xét nghiệm, nhóm, đơn vị..." /><button className="btn teal" onClick={() => { setAddErr(null); setAdding(true); }}>＋ Thêm xét nghiệm</button></div></div>
      <div className="tea-source-registry">{TEA_SOURCE_CARDS.map((source) => <div className={`tea-source-card ${source.tone}`} key={source.label}><div><b>{source.label}</b><span className={`tag ${source.tone === 'dynamic' ? 'ok' : source.tone === 'retired' ? 'warn' : 'none'}`}>{source.tag}</span></div><p>{source.detail}</p><a href={source.url} target="_blank" rel="noreferrer">Mở nguồn chính thức</a></div>)}</div>
      <div className="panel rcfg-list tea-ref-panel">
      {visibleCatalog.length || visibleCustomRefs.length ? <table className="tea-ref-table">
        <thead><tr><th>Xét nghiệm</th><th>Đơn vị</th><th>Nhóm</th><th>TEa CLIA %</th><th>TEa Ricos %</th><th>TEa chuẩn hóa %</th><th>Trạng thái</th></tr></thead>
        <tbody>
          {visibleCatalog.map((ref) => {
            const override = overrideByAnalyte.get(ref.id);
            const namedRef = labRefsByName.get(normalizeTeaKey(ref.name));
            const labRef = hasLabProfile(override) ? override : hasLabProfile(namedRef) ? namedRef : undefined;
            const hasOverride = !!override && (override.clia != null || override.ricos != null);
            const kind = hasOverride ? 'override' : hasLabProfile(labRef) ? 'lab' : 'default';
            const status = TEA_STATUS[kind];
            // Chỉ ghép viết tắt khi nó KHÁC tên (bỏ qua khác biệt
            // hoa/thường): "Sodium (Na)" nhưng chỉ "Urea", "pH", "D-dimer".
            const sameAbbr = !ref.abbr || ref.abbr.trim().toLocaleLowerCase('vi') === ref.name.trim().toLocaleLowerCase('vi');
            const displayName = sameAbbr ? ref.name : `${ref.name} (${ref.abbr})`;
            return (
              <tr key={ref.id}>
                <td><b>{displayName}</b></td>
                <td>{ref.unit || '—'}</td>
                <td>{ref.section}</td>
                <td><input className="tea-ref-value" disabled={!canManage} type="number" step="any"
                  aria-label={`TEa CLIA % cho ${displayName}`}
                  defaultValue={override?.clia ?? ref.clia ?? ''}
                  onBlur={(event) => commitTeaValue(ref, 'clia', event.currentTarget)} /></td>
                <td><input className="tea-ref-value" disabled={!canManage} type="number" step="any"
                  aria-label={`TEa Ricos % cho ${displayName}`}
                  defaultValue={override?.ricos ?? ref.ricos ?? ''}
                  onBlur={(event) => commitTeaValue(ref, 'ricos', event.currentTarget)} /></td>
                <td><div className="tea-lab-cell">
                  {labRef?.lab_level_defaults?.length ? <b>Theo mức QC</b> : labRef?.lab != null ? <b>{Number(labRef.lab).toFixed(2)}%</b> : null}
                  {canManage ? (
                    labRef && hasLabProfile(labRef)
                      ? <button type="button" className="btn ghost sm" onClick={() => openProfile(labRef)}>Xem hồ sơ</button>
                      : <button type="button" className="btn ghost sm" onClick={() => openProfile(null, { analyteId: ref.id, name: ref.name, unit: ref.unit, section: ref.section })}>Thêm hồ sơ</button>
                  ) : null}
                </div></td>
                <td><div className="tea-ref-status">
                  <span className={`tag ${status.cls}`}>{status.label}</span>
                  {canManage && hasOverride ? <button type="button" className="btn ghost sm" title="Khôi phục giá trị mặc định" onClick={() => restoreTeaRefDefaults(ref.id)}>Khôi phục</button> : null}
                </div></td>
              </tr>
            );
          })}
          {visibleCustomRefs.map((ref) => <tr key={ref.id}><td><b>{ref.name}</b></td><td>{ref.unit || '—'}</td><td>{ref.section || '—'}</td><td>{formatTeaValue(ref.clia)}</td><td>{formatTeaValue(ref.ricos)}</td><td><b>{ref.lab_level_defaults?.length ? 'Theo mức QC' : formatTeaValue(ref.lab)}</b></td><td><div className="tea-ref-status"><span className={`tag ${hasLabProfile(ref) ? 'ok' : 'none'}`}>{hasLabProfile(ref) ? 'TEa PXN' : 'Tự thêm'}</span><RowActionButton kind="edit" label={`Sửa TEa ${ref.name}`} onClick={() => openProfile(ref)} /><RowActionButton kind="delete" label={`Xóa TEa ${ref.name}`} onClick={() => remove(ref.id, ref.name)} /></div></td></tr>)}
        </tbody>
      </table> : <EmptyState title="Không tìm thấy xét nghiệm">Thử tìm lại theo tên, đơn vị hoặc nhóm xét nghiệm.</EmptyState>}
      </div>
      {adding && <Modal busy={addingAnalyte.busy} title="Thêm xét nghiệm tham chiếu" onClose={() => setAdding(false)} size="lg" className="rcfg-modal"
        footer={<><button className="btn ghost" onClick={() => setAdding(false)}>Hủy</button><button className="btn teal" type="submit" form="tea-add-form" disabled={addingAnalyte.busy}>{addingAnalyte.busy ? 'Đang lưu…' : 'Thêm xét nghiệm'}</button></>}>
        <form id="tea-add-form" onSubmit={(event) => { event.preventDefault(); void addingAnalyte.run(event.currentTarget); }}>
          {addErr && <p className="field-error" role="alert">{addErr}</p>}
          <div className="grid2">
            <div className="field"><label>Tên quốc tế <span className="req">*</span></label><input name="name" placeholder="VD: Creatine kinase-MB" autoFocus /></div>
            <div className="field"><label>Viết tắt</label><input name="abbreviation" placeholder="VD: CK-MB" /></div>
          </div>
          <div className="grid2">
            <div className="field"><label>Đơn vị</label><input name="unit" placeholder="U/L" /></div>
            <div className="field"><label>Nhóm</label><input name="section" placeholder="Hóa sinh" /></div>
          </div>
          <div className="grid2">
            <div className="field"><label>TEa CLIA %</label><input name="clia" type="number" step="any" /></div>
            <div className="field"><label>TEa Ricos %</label><input name="ricos" type="number" step="any" /></div>
          </div>
          <div className="grid2">
            <div className="field"><label>Quy tắc CLIA</label><select name="cliaRule" defaultValue="greater-of"><option value="greater-of">Lấy giá trị lớn hơn (% hoặc tuyệt đối)</option><option value="percent">Chỉ dùng %</option><option value="absolute">Chỉ dùng giới hạn tuyệt đối</option></select></div>
            <div className="field"><label>Giới hạn CLIA tuyệt đối</label><input name="cliaAbsolute" type="number" step="any" placeholder="Ví dụ: 0.05" /></div>
          </div>
          <div className="field"><label>Đơn vị giới hạn tuyệt đối</label><input name="cliaAbsoluteUnit" placeholder="Mặc định dùng đơn vị xét nghiệm" /></div>
          <div className="hint flow-note">Chỉ khai giới hạn tuyệt đối khi nguồn CLIA của analyte quy định đơn vị đo; hệ thống sẽ chỉ dùng khi đơn vị tương thích.</div>
          <div className="hint flow-item">Mỗi xét nghiệm dùng một tên quốc tế duy nhất; viết tắt được hiển thị trong ngoặc. TEa chuẩn hóa được lập thành hồ sơ riêng sau khi thêm dòng.</div>
        </form>
      </Modal>}
      {editing && <Modal busy={saving.busy} title={editing === 'new' ? 'Thêm hồ sơ TEa chuẩn hóa' : 'Sửa hồ sơ TEa chuẩn hóa'} onClose={() => { setEditing(null); setPrefill(null); }} size="lg" className="tea-lab-profile-modal" footer={<>
          {current && hasLabProfile(current) ? <button type="button" className="btn danger" onClick={() => removeLabProfile(current.id, current.name)}>Xóa TEa chuẩn hóa</button> : null}
          <button className="btn ghost" onClick={() => setEditing(null)}>Hủy</button>
          <button className="btn teal" type="submit" form="tearef-form" disabled={saving.busy}>{saving.busy ? 'Đang lưu…' : editing === 'new' ? 'Thêm hồ sơ TEa' : 'Lưu thay đổi'}</button>
        </>}>
        <form id="tearef-form" onSubmit={(event) => { event.preventDefault(); void saving.run(event.currentTarget); }}>
          {err && <p className="field-error" role="alert">{err}</p>}
          <input type="hidden" name="analyteId" value={profileAnalyteId} />
          <input type="hidden" name="section" value={current?.section || prefill?.section || ''} />
          <section className="tea-form-section"><b>Thông tin TEa phòng xét nghiệm</b><div className="tea-form-primary"><div className="field"><label>Tên xét nghiệm</label><input name="name" defaultValue={current?.name || prefill?.name || ''} autoFocus /></div><div className="field"><label>Đơn vị</label><input name="unit" defaultValue={current?.unit || prefill?.unit || ''} /></div><div className="field tea-form-source"><label>Nguồn</label><select name="labSource" defaultValue={current?.lab_source || ''}><option value="">— Chọn nguồn chính —</option>{TEA_LAB_SOURCE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div></section>
          <section className="tea-form-section">
            <div className="tea-apply-heading"><div><b>Cách áp dụng TEa</b><p>Chọn một giá trị chung hoặc khai riêng theo từng mức QC.</p></div></div>
            <div className="tea-mode-row">
              <div className="dayseg tea-mode-switch" role="group" aria-label="Cách áp dụng TEa">
                <button type="button" className={teaMode === 'common' ? 'on' : ''} aria-pressed={teaMode === 'common'} onClick={() => setTeaMode('common')}>TEa chung</button>
                <button type="button" className={teaMode === 'levels' ? 'on' : ''} aria-pressed={teaMode === 'levels'} onClick={() => setTeaMode('levels')}>Theo từng mức QC</button>
              </div>
              <span className="tea-mode-help">{teaMode === 'common' ? 'Một giá trị áp dụng cho mọi mức QC.' : 'Nhập riêng TEa cho M1, M2, M3…'}</span>
            </div>
            {teaMode === 'common' ? <div className="tea-common-card"><div className="field"><label>Giá trị TEa (%)</label><input name="labValue" type="number" min="0.01" step="0.01" value={labDraft} onChange={(event) => setLabDraft(event.target.value)} placeholder="Ví dụ: 15" /></div><p>Giá trị này được áp dụng thống nhất cho tất cả mức QC của xét nghiệm.</p></div> : <>
              <div className="tea-level-heading"><div><b>TEa theo mức QC</b><p>Chọn các mức cần áp dụng. M1 và M2 được chọn sẵn khi tạo hồ sơ mới.</p></div><span className="tag none">{selectedTeaLevels.length} mức</span></div>
              <div className="tea-level-picker">
                <div className="tea-level-picker-label"><b>Chọn mức QC</b><small>Có thể bật thêm hoặc bỏ bớt mức trước khi lưu.</small></div>
                <div className="tea-level-options" role="group" aria-label="Các mức QC áp dụng">
                  {[1, 2, 3, 4, 5, 6].map((level) => {
                    const selected = selectedTeaLevels.includes(level);
                    return <button key={level} type="button" className={selected ? 'on' : ''} aria-pressed={selected} onClick={() => toggleTeaLevel(level)}>M{level}</button>;
                  })}
                </div>
              </div>
              <div className="tea-generic-level-grid">{selectedTeaLevels.map((level) => <label className="tea-generic-level-card" key={level}>
                <span><b>Mức {level}</b><small>Giá trị TEa (%)</small></span>
                <input aria-label={`TEa mức ${level}`} type="number" min="0.01" step="0.01" value={levelDrafts[level] ?? ''} onChange={(event) => { const value = event.target.value; setLevelDrafts((drafts) => ({ ...drafts, [level]: value })); }} placeholder="Nhập %" />
              </label>)}</div>
              <div className="tea-level-fallback field"><label>TEa dự phòng (%) <span className="tea-form-label-note">(không bắt buộc)</span></label><input name="labValue" type="number" min="0.01" step="0.01" value={labDraft} onChange={(event) => setLabDraft(event.target.value)} placeholder="Dùng khi một mức chưa nhập riêng" /></div>
            </>}
          </section>
          <section className="tea-form-section"><b>Căn cứ áp dụng</b><div className="field"><label>Tham chiếu <span className="tea-form-label-note">(tối thiểu 3 ký tự)</span></label><input name="reference" defaultValue={currentSources.reference || ''} /></div><div className="field"><label htmlFor="tea-source-url">Link nguồn <span className="tea-form-label-note">(bắt buộc với "Nguồn khác đã thẩm định")</span></label><input id="tea-source-url" name="sourceUrl" inputMode="url" placeholder="https://" defaultValue={currentSources.sourceUrl || ''} /></div><div className="field"><label>Lý do áp dụng <span className="tea-form-label-note">(tối thiểu 10 ký tự)</span></label><textarea name="reason" defaultValue={currentSources.reason || ''} /></div></section>
          <section className="tea-form-section tea-form-section-last"><b>Hiệu lực và phê duyệt</b><div className="tea-form-dates"><DateField label="Ngày hiệu lực" name="effectiveDate" defaultValue={currentSources.effectiveDate || ''} /><DateField label="Ngày duyệt" name="approvedDate" defaultValue={currentSources.approvedDate || ''} /><DateField label="Ngày xem lại kế tiếp" name="nextReviewDate" defaultValue={current?.lab_next_review_date || ''} /></div><div className="tea-form-people"><div className="field"><label>Người chuẩn bị</label><input name="preparedBy" defaultValue={current?.lab_prepared_by || ''} /></div><div className="field"><label>Người duyệt</label><input name="approvedBy" defaultValue={currentSources.approvedBy || ''} /></div></div></section>
        </form>
      </Modal>}
    </>
  );
}


