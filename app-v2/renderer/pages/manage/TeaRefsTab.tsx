import { useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { DateField } from '../../components/DateField';
import { RowActionButton } from '../../components/RowActionButton';
import { TEA_CATALOG, TEA_SOURCE_CARDS } from '../../../main/domain/tea-catalog';
import { useManageStore } from '../../store/manage-store';
import { confirmDialog, infoDialog } from '../../state/dialog-store';
import { useAuthStore } from '../../store/auth-store';
import { EmptyState } from './shared';

/** 3 trạng thái của một dòng TEa — copy nguyên nhãn app cũ (`TEA_STATUS`). */
const TEA_STATUS: Record<string, { cls: string; label: string }> = {
  default: { cls: 'none', label: 'Mặc định' },
  override: { cls: 'warn', label: 'Đã sửa' },
  lab: { cls: 'ok', label: 'TEa PXN' },
};

/** Danh sách ĐÓNG 6 nguồn TEa — port `TEA_LAB_BASIS_SOURCES` app cũ, khớp
 * đúng 6 khoá `TEA_LAB_SOURCES` ở `main/domain/tea-ref-validation.ts` (cổng
 * chặn thật nằm ở đó — danh sách này chỉ để dựng `<select>`). Trước đây ô
 * "Nguồn" là input gõ tự do, không khớp bất kỳ danh sách chuẩn nào. */
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

export function TeaRefsTab() {
  const { teaRefs, saveTeaRef, removeTeaRef, removeTeaLabProfile, setTeaRefValue, restoreTeaRefDefaults, addTeaAnalyte } = useManageStore();
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === 'admin';
  const [prefill, setPrefill] = useState<{ name: string; unit: string; section: string } | null>(null);
  const [editing, setEditing] = useState<'new' | string | null>(null);
  // Modal "Thêm xét nghiệm tham chiếu" (thêm 1 DÒNG analyte mới vào danh
  // mục) — TÁCH BIỆT với modal hồ sơ TEa PXN ở trên. app-v2 trước đây thiếu
  // hẳn nghiệp vụ này và nút toolbar mở sai sang modal hồ sơ.
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const current = editing && editing !== 'new' ? teaRefs.find((ref) => ref.id === editing) : null;
  const currentSources = useMemo(() => parseSources(current?.sources_json), [current]);
  const normalizedQuery = normalizeTeaKey(query);
  const catalogNames = useMemo(() => new Set(TEA_CATALOG.map((item) => normalizeTeaKey(item.name))), []);
  const labRefsByName = useMemo(() => new Map(teaRefs.map((ref) => [normalizeTeaKey(ref.name), ref])), [teaRefs]);
  const overrideByAnalyte = useMemo(() => new Map(teaRefs.filter((ref) => ref.analyte_id).map((ref) => [ref.analyte_id, ref])), [teaRefs]);
  const visibleCatalog = useMemo(() => [...TEA_CATALOG]
    .filter((ref) => normalizeTeaKey(`${ref.name} ${ref.abbr} ${ref.unit} ${ref.section}`).includes(normalizedQuery))
    .sort((left, right) => left.section.localeCompare(right.section, 'vi') || left.name.localeCompare(right.name, 'vi')), [normalizedQuery]);
  const visibleCustomRefs = useMemo(() => teaRefs
    .filter((ref) => !catalogNames.has(normalizeTeaKey(ref.name)))
    .filter((ref) => normalizeTeaKey(`${ref.name} ${ref.unit} ${ref.section} ${ref.lab_source}`).includes(normalizedQuery)), [catalogNames, normalizedQuery, teaRefs]);

  /** Ghi đè TEa CLIA%/Ricos% của 1 analyte trong danh mục — port
   * `teaRefEdit()` app cũ: lưu khi ô mất focus, để trống = bỏ ghi đè. */
  async function commitTeaValue(ref: { id: string; name: string; unit: string; section: string }, field: 'clia' | 'ricos', input: HTMLInputElement) {
    const result = await setTeaRefValue({ analyteId: ref.id, field, value: input.value, name: ref.name, unit: ref.unit, section: ref.section });
    if (!result.ok) { await infoDialog(result.error.message, { title: 'Chưa lưu được TEa' }); }
  }

  async function submit(form: HTMLFormElement) {
    const data = Object.fromEntries(new FormData(form).entries());
    const result = await saveTeaRef(editing !== 'new' ? (editing as string) : undefined, { ...data, labValue: Number(data.labValue || 0) });
    if (!result.ok) { setErr(result.error.message); return; }
    setEditing(null);
  }

  async function remove(id: string, name: string) {
    if (await confirmDialog(`Xoá hồ sơ TEa "${name}"?`, { danger: true })) await removeTeaRef(id);
  }

  /** Xoá RIÊNG hồ sơ TEa PXN — port nút "Xóa TEa chuẩn hóa" trong modal app
   * cũ (`hasProfile` là điều kiện DUY NHẤT để hiện, không phân biệt analyte
   * built-in hay tự thêm). Trước đây analyte có sẵn trong danh mục tích hợp
   * (built-in) không có đường nào xoá hồ sơ PXN — chỉ "Khôi phục" (chỉ xoá
   * CLIA/Ricos% ghi đè, giữ nguyên hồ sơ PXN). */
  async function removeLabProfile(id: string, name: string) {
    if (!(await confirmDialog(`Xoá hồ sơ TEa chuẩn hóa của "${name}"?`, { title: 'Xóa TEa chuẩn hóa', confirmLabel: 'Xóa', danger: true }))) return;
    const result = await removeTeaLabProfile(id);
    if (!result.ok) { await infoDialog(result.error.message, { title: 'Chưa xóa được' }); return; }
    setEditing(null);
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
            const labRef = override && override.lab != null ? override : labRefsByName.get(normalizeTeaKey(ref.name));
            const hasOverride = !!override && (override.clia != null || override.ricos != null);
            // Thứ tự ưu tiên: `override` (đã sửa CLIA/Ricos%) THẮNG `lab` (có
            // hồ sơ PXN) khi cả hai cùng đúng — port đúng `teaReferenceKind()`
            // app cũ (`if(!isDefault)return'custom';if(externallyChanged)
            // return'override';if(hasLabValue)return'lab';`, kiểm override
            // TRƯỚC lab). Bản trước kiểm ngược lại, hiện "TEa PXN" thay vì
            // "Đã sửa" cho dòng vừa ghi đè CLIA/Ricos% vừa có hồ sơ PXN.
            const kind = hasOverride ? 'override' : labRef?.lab != null ? 'lab' : 'default';
            const status = TEA_STATUS[kind];
            // App cũ chỉ ghép viết tắt khi nó KHÁC tên (bỏ qua khác biệt
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
                  {labRef?.lab != null ? <b>{Number(labRef.lab).toFixed(2)}%</b> : null}
                  {canManage ? (
                    labRef?.lab != null
                      ? <button type="button" className="btn ghost sm" onClick={() => { setErr(null); setEditing(labRef.id); }}>Xem hồ sơ</button>
                      : <button type="button" className="btn ghost sm" onClick={() => { setErr(null); setPrefill({ name: ref.name, unit: ref.unit, section: ref.section }); setEditing('new'); }}>Thêm hồ sơ</button>
                  ) : null}
                </div></td>
                <td><div className="tea-ref-status">
                  <span className={`tag ${status.cls}`}>{status.label}</span>
                  {canManage && hasOverride ? <button type="button" className="btn ghost sm" title="Khôi phục giá trị mặc định" onClick={() => restoreTeaRefDefaults(ref.id)}>Khôi phục</button> : null}
                </div></td>
              </tr>
            );
          })}
          {visibleCustomRefs.map((ref) => <tr key={ref.id}><td><b>{ref.name}</b></td><td>{ref.unit || '—'}</td><td>{ref.section || '—'}</td><td>{formatTeaValue(ref.clia)}</td><td>{formatTeaValue(ref.ricos)}</td><td><b>{formatTeaValue(ref.lab)}</b></td><td><div className="tea-ref-status"><span className={`tag ${ref.lab != null ? 'ok' : 'none'}`}>{ref.lab != null ? 'TEa PXN' : 'Tự thêm'}</span><RowActionButton kind="edit" label={`Sửa TEa ${ref.name}`} onClick={() => { setErr(null); setEditing(ref.id); }} /><RowActionButton kind="delete" label={`Xóa TEa ${ref.name}`} onClick={() => remove(ref.id, ref.name)} /></div></td></tr>)}
        </tbody>
      </table> : <EmptyState title="Không tìm thấy xét nghiệm">Thử tìm lại theo tên, đơn vị hoặc nhóm xét nghiệm.</EmptyState>}
      </div>
      {adding && <Modal title="Thêm xét nghiệm tham chiếu" onClose={() => setAdding(false)} className="rcfg-modal"
        footer={<><button className="btn ghost" onClick={() => setAdding(false)}>Hủy</button><button className="btn teal" type="submit" form="tea-add-form">Thêm xét nghiệm</button></>}>
        <form id="tea-add-form" onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const result = await addTeaAnalyte({
            name: String(form.get('name') || ''), abbreviation: String(form.get('abbreviation') || ''),
            unit: String(form.get('unit') || ''),
            section: String(form.get('section') || ''), clia: String(form.get('clia') || ''), ricos: String(form.get('ricos') || ''),
            cliaRule: String(form.get('cliaRule') || '') as 'percent' | 'absolute' | 'greater-of',
            cliaAbsolute: String(form.get('cliaAbsolute') || ''), cliaAbsoluteUnit: String(form.get('cliaAbsoluteUnit') || ''),
          });
          if (!result.ok) { setAddErr(result.error.message); return; }
          setAdding(false);
        }}>
          {addErr && <p className="field-error">{addErr}</p>}
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
      {editing && <Modal title={editing === 'new' ? 'Thêm hồ sơ TEa chuẩn hóa' : 'Sửa hồ sơ TEa chuẩn hóa'} onClose={() => { setEditing(null); setPrefill(null); }} className="tea-lab-profile-modal" footer={<>
          {current && current.lab != null ? <button type="button" className="btn danger" onClick={() => removeLabProfile(current.id, current.name)}>Xóa TEa chuẩn hóa</button> : null}
          <button className="btn ghost" onClick={() => setEditing(null)}>Hủy</button>
          <button className="btn teal" type="submit" form="tearef-form">{editing === 'new' ? 'Thêm hồ sơ TEa' : 'Lưu thay đổi'}</button>
        </>}>
        <form id="tearef-form" onSubmit={(event) => { event.preventDefault(); submit(event.currentTarget); }}>
          {err && <p className="field-error">{err}</p>}
          <section className="tea-form-section"><b>Thông tin TEa phòng xét nghiệm</b><div className="tea-form-primary"><div className="field"><label>Tên xét nghiệm</label><input name="name" defaultValue={current?.name || prefill?.name || ''} autoFocus /></div><div className="field"><label>Đơn vị</label><input name="unit" defaultValue={current?.unit || prefill?.unit || ''} /></div><div className="field"><label>Giá trị TEa (%)</label><input name="labValue" type="number" step="0.01" defaultValue={current?.lab ?? ''} /></div><div className="field"><label>Nguồn</label><select name="labSource" defaultValue={current?.lab_source || ''}><option value="">— Chọn nguồn chính —</option>{TEA_LAB_SOURCE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div></section>
          <section className="tea-form-section"><b>Căn cứ áp dụng</b><div className="field"><label>Tham chiếu (≥3 ký tự)</label><input name="reference" defaultValue={currentSources.reference || ''} /></div><div className="field"><label>Lý do áp dụng (≥10 ký tự)</label><textarea name="reason" defaultValue={currentSources.reason || ''} /></div></section>
          <section className="tea-form-section tea-form-section-last"><b>Hiệu lực và phê duyệt</b><div className="tea-form-dates"><DateField label="Ngày hiệu lực" name="effectiveDate" defaultValue={currentSources.effectiveDate || ''} /><DateField label="Ngày duyệt" name="approvedDate" defaultValue={currentSources.approvedDate || ''} /><DateField label="Ngày xem lại kế tiếp" name="nextReviewDate" defaultValue={current?.lab_next_review_date || ''} /></div><div className="tea-form-people"><div className="field"><label>Người chuẩn bị</label><input name="preparedBy" defaultValue={current?.lab_prepared_by || ''} /></div><div className="field"><label>Người duyệt</label><input name="approvedBy" defaultValue={currentSources.approvedBy || ''} /></div></div></section>
        </form>
      </Modal>}
    </>
  );
}
