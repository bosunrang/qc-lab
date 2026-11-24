import { FormErrorMessage } from '../../components/FormErrorMessage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Modal } from '../../components/Modal';
import { DateField } from '../../components/DateField';
import { RowActionButton } from '../../components/RowActionButton';
import { TEA_CATALOG, TEA_SOURCE_CARDS } from '../../../main/domain/tea-catalog';
import { useManageStore } from '../../store/manage-store';
import { reportFormError, confirmDialog, errorDialog } from '../../state/dialog-store';
import { useAuthStore } from '../../store/auth-store';
import type { PublicUser, TeaRef, TeaRefVersion } from '../../../shared/qc-api';
import { useUsersStore } from '../../store/users-store';
import { useStoreInvalidation } from '../../lib/useStoreInvalidation';
import { isoLocalDate, viDate } from '../../../main/domain/local-date';
import { EmptyState } from './shared';
import { useAsyncAction } from '../../components/AsyncButton';
import { formError, formErrorFrom, type FieldErrorMap, type FormError } from '../../lib/field-error';
import { useInvalidField } from '../../lib/useInvalidField';


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
  { value: 'professional', label: 'Hiệp hội / uỷ ban chuyên môn' },
  { value: 'other', label: 'Nguồn khác đã thẩm định' },
];

/** Mã lỗi `addTeaAnalyte` → ô cần sửa. */
const TEA_ADD_FIELD_ERRORS: FieldErrorMap = { 'missing-name': 'name', duplicate: 'name', 'missing-clia-absolute': 'cliaAbsolute' };
/** Mã lỗi `saveTeaRef` (`validateTeaRef`) → ô cần sửa. Hai mã có danh sách
 * ô: chỉ vào ô còn trống trong cặp. Lỗi TEa theo mức chọn ô ngay lúc lưu
 * (xem `submit`) vì phải biết mức nào sai. */
const TEA_PROFILE_FIELD_ERRORS: FieldErrorMap = {
  'missing-name': 'name', 'invalid-value': 'labValue', 'missing-source': 'labSource', 'invalid-source': 'labSource',
  'invalid-reference': 'reference', 'invalid-source-url': 'sourceUrl', 'missing-source-url': 'sourceUrl',
  'invalid-reason': 'reason', 'missing-dates': ['effectiveDate', 'approvedDate'],
  'approved-after-effective': 'approvedDate', 'review-before-effective': 'nextReviewDate', 'effective-in-future': 'effectiveDate',
  'missing-signoff': ['preparedBy', 'approvedBy'],
};

function normalizeTeaKey(value: string) { return value.trim().toLocaleLowerCase('vi'); }
function formatTeaValue(value: number | null | undefined) { return value == null ? '—' : `${value}%`; }

function parseSources(json: string | undefined) {
  try { return JSON.parse(json || '{}') as Record<string, string>; } catch { return {}; }
}

function hasLabProfile(ref: Pick<TeaRef, 'lab' | 'lab_level_defaults'> | null | undefined) {
  return ref?.lab != null || !!ref?.lab_level_defaults?.length;
}

/** Hồ sơ TEa PXN đã qua ngày xem xét lại kế tiếp (ISO 15189:2022 8.3). */
function reviewOverdue(ref: Pick<TeaRef, 'lab' | 'lab_level_defaults' | 'lab_next_review_date'> | null | undefined, today: string) {
  return hasLabProfile(ref) && !!ref?.lab_next_review_date && ref.lab_next_review_date < today;
}

function OverdueTag({ teaRef, today }: { teaRef: TeaRef | null | undefined; today: string }) {
  if (!teaRef || !reviewOverdue(teaRef, today)) return null;
  return <span className="tag warn" title={`Ngày xem lại kế tiếp: ${viDate(teaRef.lab_next_review_date)}`}>Quá hạn xem xét</span>;
}

function versionTeaText(version: TeaRefVersion) {
  if (version.action === 'remove') return 'Đã xoá hồ sơ';
  const levels = [...version.levels].sort((left, right) => left.level - right.level).map((item) => `M${item.level} ${item.tea}%`);
  return [...(version.lab != null ? [`Chung ${version.lab}%`] : []), ...levels].join(' · ') || '—';
}

/** Các phiên bản đã lưu của hồ sơ TEa PXN (N8), mới nhất trước. */
function TeaVersionHistory({ versions }: { versions: TeaRefVersion[] }) {
  if (!versions.length) return null;
  const rows = versions.map((version, index) => ({ version, no: index + 1 })).reverse();
  return (
    <section className="tea-version-history" aria-labelledby="tea-version-title">
      <b id="tea-version-title">Lịch sử phiên bản</b>
      <table className="tea-version-table">
        <thead><tr><th>#</th><th>Lưu</th><th>TEa</th><th>Hiệu lực</th><th>Lý do</th></tr></thead>
        <tbody>{rows.map(({ version, no }) => {
          const sources = parseSources(version.sources_json);
          return <tr key={version.id}>
            <td>{no}</td>
            <td>{version.action === 'baseline' ? 'Có từ trước' : `${viDate(isoLocalDate(new Date(version.saved_at)))} · ${version.saved_by || '—'}`}</td>
            <td>{versionTeaText(version)}</td>
            <td>{version.action === 'remove' ? '—' : viDate(sources.effectiveDate || '') || '—'}</td>
            <td>{version.action === 'remove' ? '—' : sources.reason || '—'}</td>
          </tr>;
        })}</tbody>
      </table>
    </section>
  );
}

type ProfilePersonDraft = { userId: string; name: string };

/** Chọn tài khoản bằng id để phân biệt tên trùng, nhưng lưu bản tên tại lúc
 * lập hồ sơ như trước. Tên lịch sử không phụ thuộc đổi tên/xoá tài khoản. */
function ProfilePersonSelect({ id, field, label, users, value, onChange }: {
  id: string; field: 'preparedBy' | 'approvedBy'; label: string;
  users: readonly PublicUser[]; value: ProfilePersonDraft; onChange: (next: ProfilePersonDraft) => void;
}) {
  const activeUsers = users.filter(user => user.active);
  const selectedValue = value.userId || (value.name ? '__saved_name__' : '');
  const keepSavedName = value.name && (!value.userId || !activeUsers.some(user => user.id === value.userId));
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <input type="hidden" name={field} value={value.name} />
    <select id={id} data-field={field} value={selectedValue} onChange={(event) => {
      const person = activeUsers.find(user => user.id === event.target.value);
      if (person) onChange({ userId: person.id, name: person.name });
      else if (!event.target.value) onChange({ userId: '', name: '' });
    }}>
      <option value="">— Chọn {label.toLocaleLowerCase('vi')} —</option>
      {keepSavedName && <option value={selectedValue}>{value.name} (đã lưu)</option>}
      {activeUsers.map(user => <option key={user.id} value={user.id}>{user.id === value.userId ? value.name : user.name} (@{user.username})</option>)}
    </select>
  </div>;
}

export function TeaRefsTab() {
  const { teaRefs, saveTeaRef, removeTeaRef, removeTeaLabProfile, setTeaRefValue, restoreTeaRefDefaults, addTeaAnalyte } = useManageStore(useShallow((s) => ({ teaRefs: s.teaRefs, saveTeaRef: s.saveTeaRef, removeTeaRef: s.removeTeaRef, removeTeaLabProfile: s.removeTeaLabProfile, setTeaRefValue: s.setTeaRefValue, restoreTeaRefDefaults: s.restoreTeaRefDefaults, addTeaAnalyte: s.addTeaAnalyte })));
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === 'admin';
  const { users, load: loadUsers } = useUsersStore(useShallow((state) => ({ users: state.users, load: state.load })));
  const [prefill, setPrefill] = useState<{ analyteId: string; name: string; unit: string; section: string } | null>(null);
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [preparedBy, setPreparedBy] = useState<ProfilePersonDraft>({ userId: '', name: '' });
  const [approvedBy, setApprovedBy] = useState<ProfilePersonDraft>({ userId: '', name: '' });
  useEffect(() => { if (editing && canManage) void loadUsers(); }, [editing, canManage, loadUsers]);
  useStoreInvalidation(['users'], undefined, () => { if (editing && canManage) void loadUsers(); });
  const [teaMode, setTeaMode] = useState<'common' | 'levels'>('common');
  const [selectedTeaLevels, setSelectedTeaLevels] = useState<number[]>([1, 2]);
  // Giá trị TEa đang gõ giữ trong state để đổi qua lại hai chế độ không mất số.
  const [labDraft, setLabDraft] = useState('');
  const [levelDrafts, setLevelDrafts] = useState<Record<number, string>>({});
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState<FormError | null>(null);
  const [err, setErr] = useState<FormError | null>(null);
  const addFormRef = useRef<HTMLFormElement>(null);
  const profileFormRef = useRef<HTMLFormElement>(null);
  const addErrorId = useInvalidField(addFormRef, addErr);
  const errorId = useInvalidField(profileFormRef, err);
  const [query, setQuery] = useState('');
  const today = isoLocalDate();
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
    setPreparedBy({ userId: '', name: ref?.lab_prepared_by || '' });
    setApprovedBy({ userId: '', name: parseSources(ref?.sources_json).approvedBy || '' });
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
    const formData = new FormData(form);
    // Lựa chọn radio chỉ điều khiển bản nháp, không lưu thành trường riêng.
    formData.delete('teaApplication');
    const data = Object.fromEntries(formData.entries());
    // Mức QC thuộc hồ sơ analyte, không phụ thuộc việc đã tạo xét nghiệm hay
    // máy. Giữ cả ô trống trong payload để cổng kiểm tra chỉ rõ mức nào thiếu.
    const levelValues = teaMode === 'levels'
      ? selectedTeaLevels.map((level) => ({ level, tea: levelDrafts[level] ?? '' }))
      : [];
    // Theo mức chỉ lưu các giá trị riêng, không giữ một TEa chung đang ẩn.
    const result = await saveTeaRef(editing !== 'new' ? (editing as string) : undefined, { ...data, labValue: teaMode === 'common' ? labDraft : '', levelValues });
    if (!result.ok) {
      // TEa theo mức sai: chỉ vào ô của mức đầu tiên chưa có số dương.
      const levelError = result.error.code === 'invalid-level-value' || result.error.code === 'duplicate-level';
      const badLevel = levelError ? selectedTeaLevels.find((level) => !(Number(levelDrafts[level]) > 0)) : undefined;
      await reportFormError(badLevel != null ? formError(result.error.message, `levelTea:${badLevel}`) : formErrorFrom(result.error, TEA_PROFILE_FIELD_ERRORS), setErr);
      return;
    }
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
    if (!result.ok) { await reportFormError(formErrorFrom(result.error, TEA_ADD_FIELD_ERRORS), setAddErr); return; }
    setAdding(false);
  }

  const saving = useAsyncAction(submit);
  const addingAnalyte = useAsyncAction(submitAnalyte);
  async function remove(id: string, name: string) {
    if (await confirmDialog(`Xoá hồ sơ TEa "${name}"?`, { danger: true })) await removeTeaRef(id);
  }


  async function removeLabProfile(id: string, name: string) {
    if (!(await confirmDialog(`Xoá hồ sơ TEa chuẩn hoá của "${name}"?`, { title: 'Xoá TEa chuẩn hoá', confirmLabel: 'Xoá', danger: true }))) return;
    const result = await removeTeaLabProfile(id);
    if (!result.ok) { await errorDialog(result.error.message, { title: 'Chưa xoá được' }); return; }
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
      <div className="rcfg-toolbar"><div><h2>Bảng TEa tham chiếu</h2><p>Tổng hợp TEa từ các nguồn tham chiếu, dùng thống nhất khi tính Sigma.</p></div><div className="rcfg-tools"><input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên xét nghiệm, nhóm, đơn vị..." aria-label="Tìm trong bảng TEa tham chiếu" /><button className="btn teal" onClick={() => { setAddErr(null); setAdding(true); }}>＋ Thêm xét nghiệm</button></div></div>
      <div className="tea-source-registry">{TEA_SOURCE_CARDS.map((source) => <div className={`tea-source-card ${source.tone}`} key={source.label}><div><b>{source.label}</b><span className={`tag ${source.tone === 'dynamic' ? 'ok' : source.tone === 'retired' ? 'warn' : 'none'}`}>{source.tag}</span></div><p>{source.detail}</p><a href={source.url} target="_blank" rel="noreferrer">Mở nguồn chính thức</a></div>)}</div>
      <div className="panel rcfg-list tea-ref-panel">
      {visibleCatalog.length || visibleCustomRefs.length ? <table className="tea-ref-table">
        <thead><tr><th>Xét nghiệm</th><th>Đơn vị</th><th>Nhóm</th><th>TEa CLIA %</th><th>TEa Ricos %</th><th>TEa chuẩn hoá %</th><th>Hồ sơ</th><th>Trạng thái</th></tr></thead>
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
                <td className="tea-lab-value">
                  {labRef?.lab_level_defaults?.length ? <b>Theo mức QC</b> : labRef?.lab != null ? <b>{Number(labRef.lab).toFixed(2)}%</b> : '—'}
                </td>
                <td><div className="tea-profile-cell">
                  {canManage ? (
                    labRef && hasLabProfile(labRef)
                      ? <button type="button" className="btn ghost sm" onClick={() => openProfile(labRef)}>Xem hồ sơ</button>
                      : <button type="button" className="btn ghost sm" onClick={() => openProfile(null, { analyteId: ref.id, name: ref.name, unit: ref.unit, section: ref.section })}>Thêm hồ sơ</button>
                  ) : '—'}
                </div></td>
                <td><div className="tea-ref-status">
                  <span className={`tag ${status.cls}`}>{status.label}</span>
                  <OverdueTag teaRef={labRef} today={today} />
                  {canManage && hasOverride ? <button type="button" className="btn ghost sm" title="Khôi phục giá trị mặc định" onClick={() => restoreTeaRefDefaults(ref.id)}>Khôi phục</button> : null}
                </div></td>
              </tr>
            );
          })}
          {visibleCustomRefs.map((ref) => <tr key={ref.id}><td><b>{ref.name}</b></td><td>{ref.unit || '—'}</td><td>{ref.section || '—'}</td><td>{formatTeaValue(ref.clia)}</td><td>{formatTeaValue(ref.ricos)}</td><td className="tea-lab-value"><b>{ref.lab_level_defaults?.length ? 'Theo mức QC' : formatTeaValue(ref.lab)}</b></td><td><div className="tea-profile-cell"><button type="button" className="btn ghost sm" onClick={() => openProfile(ref)}>{hasLabProfile(ref) ? 'Xem hồ sơ' : 'Thêm hồ sơ'}</button></div></td><td><div className="tea-ref-status"><span className={`tag ${hasLabProfile(ref) ? 'ok' : 'none'}`}>{hasLabProfile(ref) ? 'TEa PXN' : 'Tự thêm'}</span><OverdueTag teaRef={ref} today={today} /><RowActionButton kind="delete" label={`Xoá TEa ${ref.name}`} onClick={() => remove(ref.id, ref.name)} /></div></td></tr>)}
        </tbody>
      </table> : <EmptyState title="Không tìm thấy xét nghiệm">Thử tìm lại theo tên, đơn vị hoặc nhóm xét nghiệm.</EmptyState>}
      </div>
      {adding && <Modal busy={addingAnalyte.busy} title="Thêm xét nghiệm tham chiếu" onClose={() => setAdding(false)} size="lg" className="rcfg-modal"
        footer={<><button className="btn ghost" onClick={() => setAdding(false)}>Huỷ</button><button className="btn teal" type="submit" form="tea-add-form" disabled={addingAnalyte.busy}>{addingAnalyte.busy ? 'Đang lưu…' : 'Thêm xét nghiệm'}</button></>}>
        <form id="tea-add-form" ref={addFormRef} onSubmit={(event) => { event.preventDefault(); void addingAnalyte.run(event.currentTarget); }}>
          <FormErrorMessage rootRef={addFormRef} error={addErr} id={addErrorId} />
          <div className="grid2">
            <div className="field"><label htmlFor="tea-add-name">Tên quốc tế <span className="req">*</span></label><input id="tea-add-name" name="name" placeholder="VD: Creatine kinase-MB" autoFocus /></div>
            <div className="field"><label htmlFor="tea-add-abbreviation">Viết tắt</label><input id="tea-add-abbreviation" name="abbreviation" placeholder="VD: CK-MB" /></div>
          </div>
          <div className="grid2">
            <div className="field"><label htmlFor="tea-add-unit">Đơn vị</label><input id="tea-add-unit" name="unit" placeholder="U/L" /></div>
            <div className="field"><label htmlFor="tea-add-section">Nhóm</label><input id="tea-add-section" name="section" placeholder="Hoá sinh" /></div>
          </div>
          <div className="grid2">
            <div className="field"><label htmlFor="tea-add-clia">TEa CLIA %</label><input id="tea-add-clia" name="clia" type="number" step="any" /></div>
            <div className="field"><label htmlFor="tea-add-ricos">TEa Ricos %</label><input id="tea-add-ricos" name="ricos" type="number" step="any" /></div>
          </div>
          <div className="grid2">
            <div className="field"><label htmlFor="tea-add-clia-rule">Quy tắc CLIA</label><select id="tea-add-clia-rule" name="cliaRule" defaultValue="greater-of"><option value="greater-of">Lấy giá trị lớn hơn (% hoặc tuyệt đối)</option><option value="percent">Chỉ dùng %</option><option value="absolute">Chỉ dùng giới hạn tuyệt đối</option></select></div>
            <div className="field"><label htmlFor="tea-add-clia-absolute">Giới hạn CLIA tuyệt đối</label><input id="tea-add-clia-absolute" name="cliaAbsolute" type="number" step="any" placeholder="Ví dụ: 0.05" /></div>
          </div>
          <div className="field"><label htmlFor="tea-add-clia-absolute-unit">Đơn vị giới hạn tuyệt đối</label><input id="tea-add-clia-absolute-unit" name="cliaAbsoluteUnit" placeholder="Mặc định dùng đơn vị xét nghiệm" /></div>
        </form>
      </Modal>}
      {editing && <Modal busy={saving.busy} title={editing === 'new' ? 'Thêm hồ sơ TEa chuẩn hoá' : 'Sửa hồ sơ TEa chuẩn hoá'} onClose={() => { setEditing(null); setPrefill(null); }} size="lg" className="tea-lab-profile-modal" footer={<>
          {current && hasLabProfile(current) ? <button type="button" className="btn danger" onClick={() => removeLabProfile(current.id, current.name)}>Xoá TEa chuẩn hoá</button> : null}
          <button className="btn ghost" onClick={() => setEditing(null)}>Huỷ</button>
          <button className="btn teal" type="submit" form="tearef-form" disabled={saving.busy}>{saving.busy ? 'Đang lưu…' : editing === 'new' ? 'Thêm hồ sơ TEa' : 'Lưu thay đổi'}</button>
        </>}>
        <form id="tearef-form" ref={profileFormRef} onSubmit={(event) => { event.preventDefault(); void saving.run(event.currentTarget); }}>
          <FormErrorMessage rootRef={profileFormRef} error={err} id={errorId} />
          <input type="hidden" name="analyteId" value={profileAnalyteId} />
          <input type="hidden" name="section" value={current?.section || prefill?.section || ''} />
          <section className="tea-form-section"><b>Thông tin TEa phòng xét nghiệm</b><div className="tea-form-primary"><div className="field"><label htmlFor="tea-profile-name">Tên xét nghiệm</label><input id="tea-profile-name" name="name" defaultValue={current?.name || prefill?.name || ''} autoFocus /></div><div className="field"><label htmlFor="tea-profile-unit">Đơn vị</label><input id="tea-profile-unit" name="unit" defaultValue={current?.unit || prefill?.unit || ''} /></div><div className="field tea-form-source"><label htmlFor="tea-profile-source">Nguồn</label><select id="tea-profile-source" name="labSource" defaultValue={current?.lab_source || ''}><option value="">— Chọn nguồn chính —</option>{TEA_LAB_SOURCE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div></section>
          <section className="tea-form-section">
            <div className="tea-apply-heading"><b>Cách áp dụng TEa</b></div>
            <div className="tea-apply-choices" role="radiogroup" aria-label="Cách áp dụng TEa">
              <label className={`choice-card tea-apply-choice${teaMode === 'common' ? ' is-selected' : ''}`}>
                <input type="radio" name="teaApplication" value="common" checked={teaMode === 'common'} onChange={() => setTeaMode('common')} aria-label="TEa chung" />
                <span><b>TEa chung</b><small>Một giá trị cho tất cả mức QC</small></span>
              </label>
              <label className={`choice-card tea-apply-choice${teaMode === 'levels' ? ' is-selected' : ''}`}>
                <input type="radio" name="teaApplication" value="levels" checked={teaMode === 'levels'} onChange={() => setTeaMode('levels')} aria-label="Theo từng mức QC" />
                <span><b>Theo từng mức QC</b><small>Mỗi mức có một giá trị riêng</small></span>
              </label>
            </div>
            {teaMode === 'common' ? <div className="tea-common-card">
              <div className="field"><label htmlFor="tea-profile-value">TEa chung (%)</label><div className="tea-percent-input"><input id="tea-profile-value" name="labValue" type="number" min="0.01" step="0.01" value={labDraft} onChange={(event) => setLabDraft(event.target.value)} placeholder="Ví dụ: 15" /><span aria-hidden="true">%</span></div></div>
            </div> : <>
              <div className="tea-level-heading"><div><b>Chọn mức và nhập TEa (%)</b><p>Chọn ít nhất một mức. Mức 1 và 2 được chọn sẵn.</p></div><span className="tag none">{selectedTeaLevels.length} mức</span></div>
              <div className="tea-generic-level-grid" role="group" aria-label="Các mức QC áp dụng">{[1, 2, 3, 4, 5, 6].map((level) => {
                const selected = selectedTeaLevels.includes(level);
                return <div className={`tea-level-editor${selected ? ' is-selected' : ''}`} data-field-container key={level}>
                  <label className="tea-level-toggle"><input type="checkbox" checked={selected} disabled={selected && selectedTeaLevels.length === 1} onChange={() => toggleTeaLevel(level)} aria-label={`Áp dụng TEa mức ${level}`} /><span>Mức {level}</span></label>
                  <div className="tea-percent-input"><input aria-label={`TEa mức ${level}`} data-field={`levelTea:${level}`} type="number" min="0.01" step="0.01" disabled={!selected} value={levelDrafts[level] ?? ''} onChange={(event) => { const value = event.target.value; setLevelDrafts((drafts) => ({ ...drafts, [level]: value })); }} placeholder={selected ? 'Nhập' : '—'} /><span aria-hidden="true">%</span></div>
                </div>
              })}</div>
            </>}
          </section>
          <section className="tea-form-section"><b>Căn cứ áp dụng</b><div className="field"><label htmlFor="tea-profile-reference">Tham chiếu <span className="tea-form-label-note">(tối thiểu 3 ký tự)</span></label><input id="tea-profile-reference" name="reference" defaultValue={currentSources.reference || ''} /></div><div className="field"><label htmlFor="tea-source-url">Link nguồn <span className="tea-form-label-note">(bắt buộc với "Nguồn khác đã thẩm định")</span></label><input id="tea-source-url" name="sourceUrl" inputMode="url" placeholder="https://" defaultValue={currentSources.sourceUrl || ''} /></div><div className="field"><label htmlFor="tea-profile-reason">Lý do áp dụng <span className="tea-form-label-note">(tối thiểu 10 ký tự)</span></label><textarea id="tea-profile-reason" name="reason" defaultValue={currentSources.reason || ''} /></div></section>
          <section className="tea-form-section tea-form-section-last"><b>Hiệu lực và phê duyệt</b><div className="tea-form-dates"><DateField id="tea-effective-date" label="Ngày hiệu lực" name="effectiveDate" defaultValue={currentSources.effectiveDate || ''} /><DateField id="tea-approved-date" label="Ngày duyệt" name="approvedDate" defaultValue={currentSources.approvedDate || ''} /><DateField id="tea-next-review-date" label="Ngày xem lại kế tiếp" name="nextReviewDate" defaultValue={current?.lab_next_review_date || ''} /></div><div className="tea-form-people">
            <ProfilePersonSelect id="tea-profile-prepared-by" field="preparedBy" label="Người chuẩn bị" users={canManage ? users : []} value={preparedBy} onChange={setPreparedBy} />
            <ProfilePersonSelect id="tea-profile-approved-by" field="approvedBy" label="Người duyệt" users={canManage ? users : []} value={approvedBy} onChange={setApprovedBy} />
          </div></section>
        </form>
        <TeaVersionHistory versions={current?.lab_versions || []} />
      </Modal>}
    </>
  );
}


