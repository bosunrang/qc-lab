// So sánh hoá chất — workspace Clinical Precision, giữ tên class nghiệp vụ:
// "Thiết lập so sánh"
// (`rc-toolbar-panel`) → lưới 2 cột `rc-entry-grid` gồm "Thông tin đánh giá"
// (`rc-info-panel`, 10 trường) và "Dữ liệu đo bắt cặp" (`rc-pair-panel`, lưới
// có 2 cột tính sẵn Trung bình/Hiệu số) → "Kết quả thống kê"
// (`rc-stats-panel`) → "Tiêu chí chấp nhận & kết luận" (`rc-crit-panel`) →
// "Biểu đồ" (`rc-chart-panel`).
//
// Toàn bộ phép tính đến từ `calculateReagentComparison()` ở main — trang
// này chỉ trình bày, không tự tính lại thống kê nào.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCatalog } from '../lib/useCatalog';
import { useReagentStore } from '../store/reagent-store';
import { useManageStore } from '../store/manage-store';
import { useAuthStore } from '../store/auth-store';
import { canWrite, isAdmin } from '../lib/permissions';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { LoadNotice } from '../components/LoadNotice';
import { DateField } from '../components/DateField';
import { Modal } from '../components/Modal';
import { RowActionButton } from '../components/RowActionButton';
import { StatsPanel, CriteriaPanel, ReagentCharts } from '../components/ReagentResults';
import { fmtFixed, MIN_PAIRS } from '../lib/reagent-format';
import { ReagentToolIcon } from '../components/ReagentToolIcon';
import { confirmDialog, errorDialog } from '../state/dialog-store';
import { printHtmlToPdf } from '../lib/export';
import { loadPrintIdentity } from '../lib/print-document';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { TEA_CATALOG } from '../../main/domain/tea-catalog';
import type { IpcResult, ReagentComparisonView, TeaRef } from '../../shared/qc-api';

/** Nhãn 1 phép so sánh trong ô chọn, dạng "<hoá chất> — <lô
 * cũ>→<lô mới>". */
function comparisonLabel(row: ReagentComparisonView): string {
  const lots = [row.lot_old, row.lot_new].filter(Boolean).join('→');
  return lots ? `${row.reagent} — ${lots}` : row.reagent;
}



function QuickPickerModal({ type, onPick, onClose }: { type: 'operator' | 'sampleType'; onPick: (value: string) => void; onClose: () => void }) {
  // Danh sách CHUNG toàn app nên giữ ở store (`app_meta`), không phải state
  // cục bộ của modal — nhờ vậy mở lại modal không phải gọi lại IPC, và mọi
  // chỗ khác cần "chọn nhanh" đều đọc chung một nguồn.
  const { quickValues, loadQuickValues, addQuickValue, removeQuickValue } = useReagentStore(useShallow((s) => ({ quickValues: s.quickValues, loadQuickValues: s.loadQuickValues, addQuickValue: s.addQuickValue, removeQuickValue: s.removeQuickValue })));
  const items = quickValues[type];
  const [draft, setDraft] = useState('');
  const label = type === 'operator' ? 'người thực hiện' : 'loại mẫu';

  useEffect(() => { loadQuickValues(); }, [loadQuickValues]);

  async function add() {
    const value = draft.trim();
    if (!value) return;
    const result = await addQuickValue(type, value);
    if (result.ok) setDraft('');
  }
  async function removeItem(index: number) {
    await removeQuickValue(type, index);
  }

  return (
    <Modal title={`Chọn nhanh ${label}`} onClose={onClose} guardUnsaved={false}>
      {!items.length && <EmptyState size="compact">Chưa có {label} trong danh sách.</EmptyState>}
      {items.map((name, i) => (
        <div className="mrow" key={name}>
          <span><b>{name}</b></span>
          <span className="acts">
            <button type="button" className="btn teal sm" onClick={() => onPick(name)}>Chọn</button>
            <RowActionButton kind="delete" label={`Xoá ${name}`} onClick={() => removeItem(i)} />
          </span>
        </div>
      ))}
      <div className="rc-quick-add">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Thêm ${label} mới`} aria-label={`Thêm ${label} mới`}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="btn teal sm" onClick={add}>Thêm</button>
      </div>
    </Modal>
  );
}

function CreateComparisonModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, unit: string) => Promise<boolean> }) {
  const [query, setQuery] = useState('');
  const { teaRefs } = useManageStore(useShallow((s) => ({ teaRefs: s.teaRefs })));
  const needle = query.trim().toLocaleLowerCase('vi');

  // Bảng TEa tham chiếu do trang Cấu hình chung sở hữu — đọc qua store của
  // nó và tự nạp lại khi ai sửa TEa ở đó, để danh sách gợi ý ở đây cũng đúng.
  useCatalog(['teaRefs']);
  const groups = useMemo(() => {
    const visible = makeTeaChoices(teaRefs).filter((item) => !needle || item.search.includes(needle));
    return visible.reduce<Record<string, TeaChoice[]>>((all, item) => {
      (all[item.section] ||= []).push(item);
      return all;
    }, {});
  }, [needle, teaRefs]);

  async function create(name: string, unit = '') {
    await onCreate(name, unit);
  }

  return (
    <Modal title="Thêm hoá chất" onClose={onClose} guardUnsaved={false} footer={<button className="btn ghost" onClick={onClose}>Đóng</button>}>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(query.trim() || 'Hoá chất mới'); } }} placeholder="Tìm xét nghiệm hoặc gõ tên hoá chất mới..." aria-label="Tìm xét nghiệm hoặc nhập tên hoá chất mới" autoFocus />
      <div className="flow-control">
        <button className="refrow rc-create-typed" onClick={() => create(query.trim() || 'Hoá chất mới')}>+ Tạo {query.trim() ? `"${query.trim()}"` : 'hoá chất trống'}</button>
      </div>
      <div className="refcat">Danh mục TEa tham chiếu</div>
      {Object.keys(groups).length ? Object.entries(groups).map(([section, items]) => (
        <div className="rc-tea-category" key={section}>
          <div className="refcat">{section}</div>
          {items.map((item) => <button className="refrow" key={item.key} onClick={() => create(item.name, item.unit)}>{item.name}<span className="meta">{item.unit || 'Chưa có đơn vị'}</span></button>)}
        </div>
      )) : <EmptyState size="compact">Không tìm thấy trong danh mục TEa.</EmptyState>}
    </Modal>
  );
}

/** Danh sách phép so sánh đã nạp thành công trong phiên: quay lại trang thì
 * không hiện "Đang tải…" lần nữa (U30). */
let comparisonsLoadedOnce = false;

export function ReagentPage() {
  const store = useReagentStore(useShallow((s) => ({ comparisons: s.comparisons, create: s.create, load: s.load, remove: s.remove, saveMetadata: s.saveMetadata, saveRows: s.saveRows })));
  const role = useAuthStore((s) => s.user)?.role;
  const writable = canWrite(role);
  const admin = isAdmin(role);
  const [currentId, setCurrentId] = useState('');
  const [creating, setCreating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const pendingWrites = useRef(new Set<Promise<IpcResult<ReagentComparisonView>>>());

  function trackWrite(write: Promise<IpcResult<ReagentComparisonView>>) {
    const pending = write.then((saved) => {
      pendingWrites.current.delete(pending);
      return saved;
    }, (error) => {
      pendingWrites.current.delete(pending);
      throw error;
    });
    pendingWrites.current.add(pending);
    return pending;
  }
  const [quickType, setQuickType] = useState<'operator' | 'sampleType' | null>(null);
  const [rowsDraft, setRowsDraft] = useState<[string, string][]>([]);

  // Lần nạp đầu có trạng thái riêng: store khởi tạo mảng rỗng nên nếu không,
  // trang báo "Chưa có phép so sánh nào" cả khi dữ liệu chưa về hay nạp lỗi.
  const [listState, setListState] = useState<{ state: 'loading' | 'ready' | 'error'; error: string }>(
    () => ({ state: comparisonsLoadedOnce ? 'ready' : 'loading', error: '' }));
  const loadList = useCallback(async () => {
    if (!comparisonsLoadedOnce) setListState({ state: 'loading', error: '' });
    try {
      await useReagentStore.getState().load();
      comparisonsLoadedOnce = true;
      setListState({ state: 'ready', error: '' });
    } catch (e) {
      setListState({ state: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }, []);
  useEffect(() => { void loadList(); }, [loadList]);
  useStoreInvalidation(['reagent_tests'], undefined, store.load);

  const current = useMemo(
    () => store.comparisons.find((c) => c.id === currentId) ?? store.comparisons[0] ?? null,
    [store.comparisons, currentId],
  );
  useEffect(() => { if (current) setRowsDraft(current.rows); }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (listState.state !== 'ready') {
    return (
      <div>
        <PageHeader title="So sánh hoá chất" subtitle="Sàng lọc định lượng · hồi quy mô tả · Bland-Altman · phê duyệt theo SOP" />
        <LoadNotice state={listState.state} error={listState.error} what="danh sách phép so sánh" onRetry={() => { void loadList(); }} />
      </div>
    );
  }

  if (!current) {
    return (
      <div>
        <PageHeader title="So sánh hoá chất" subtitle="Sàng lọc định lượng · hồi quy mô tả · Bland-Altman · phê duyệt theo SOP" />
        <div className="panel"><EmptyState>Chưa có phép so sánh nào. Tạo mới để bắt đầu.</EmptyState></div>
      </div>
    );
  }

  const result = current.result;
  const meta = async (data: Record<string, unknown>) => {
    const saved = await trackWrite(store.saveMetadata(current.id, data));
    if (!saved.ok) await errorDialog(saved.error.message, { title: 'Chưa lưu được thông tin' });
  };
  const wp = { disabled: !writable };

  function updateCell(rowIndex: number, col: 0 | 1, value: string) {
    setRowsDraft((prev) => {
      const next = prev.map((r) => [...r] as [string, string]);
      next[rowIndex][col] = value;
      return next;
    });
  }
  const commitRows = (rows: [string, string][]) => { setRowsDraft(rows); trackWrite(store.saveRows(current.id, rows)); };

  async function removeCurrent() {
    if (!(await confirmDialog(`Xoá phép so sánh "${current.reagent}"? Dữ liệu đã nhập sẽ mất.`, { title: 'Xoá phép so sánh', danger: true, confirmLabel: 'Xoá' }))) return;
    const r = await store.remove(current.id);
    if (!r.ok) await errorDialog(r.error.message);
    else setCurrentId('');
  }

  async function createFromTea(name: string, unit: string): Promise<boolean> {
    const created = await store.create(name, unit);
    if (!created.ok) {
      await errorDialog(created.error.message, { title: 'Chưa tạo được phép so sánh' });
      return false;
    }
    setCurrentId(created.data.id);
    setCreating(false);
    return true;
  }

  /** Chờ các ô vừa rời focus lưu xong rồi lấy lại đúng phép so sánh đang chọn. */
  async function printComparison() {
    if (printing) return;
    setPrinting(true);
    try {
      const writes = await Promise.all([...pendingWrites.current]);
      if (writes.some((saved) => !saved.ok)) throw new Error('Chưa lưu được dữ liệu. Vui lòng kiểm tra lại trước khi in PDF.');
      const comparisons = await window.qcApi.listReagentComparisons();
      const selected = comparisons.find((item) => item.id === current.id);
      if (!selected) throw new Error('Phép so sánh đang chọn không còn tồn tại. Vui lòng tải lại trang.');
      const identity = await loadPrintIdentity('reagent');
      const { buildReagentReport } = await import('../lib/reagent-report');
      const html = buildReagentReport(selected, identity);
      const error = await printHtmlToPdf(html, 'so-sanh-' + selected.reagent + '.pdf', { pageNumbers: true });
      if (error) await errorDialog(error);
    } catch (error) {
      await errorDialog(error instanceof Error ? error.message : String(error), { title: 'Chưa xuất được PDF' });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div>
      <PageHeader title="So sánh hoá chất" subtitle="Sàng lọc định lượng · hồi quy mô tả · Bland-Altman · phê duyệt theo SOP" />

      <div className="panel rc-toolbar-panel">
        <h2 className="panel-title">Thiết lập so sánh</h2>
        <div className="rc-toolbar">
          <div className="field rc-toolbar-selcol">
            <label htmlFor="rcSel">Chọn hoá chất</label>
            <select id="rcSel" aria-label="Chọn hoá chất" value={current.id} onChange={(e) => setCurrentId(e.target.value)}>
              {store.comparisons.map((c) => <option key={c.id} value={c.id}>{comparisonLabel(c)}</option>)}
            </select>
          </div>
          <div className="rc-toolbar-primary"><div>
            {writable && <button className="btn teal rc-add-btn" onClick={() => setCreating(true)}>+ Thêm</button>}
            {admin && <button className="btn danger rc-delete-btn" onClick={removeCurrent} disabled={store.comparisons.length <= 1} title={store.comparisons.length <= 1 ? 'Cần giữ lại ít nhất một phép so sánh' : undefined}><ReagentToolIcon type="trash" /> Xoá</button>}
            <button className="btn teal rc-report-btn" onClick={printComparison} disabled={printing}><ReagentToolIcon type="print" /> {printing ? 'Đang xuất…' : 'In PDF'}</button>
          </div></div>
        </div>
      </div>

      <div className="rc-entry-grid" key={current.id}>
        <div className="panel rc-info-panel">
          <h2 className="panel-title">Thông tin đánh giá</h2>
          <div className="rc-info-grid">
            <div className="field rc-field"><label htmlFor="rc-reagent">Tên hoá chất</label><input {...wp} id="rc-reagent" defaultValue={current.reagent} placeholder="Tên hoá chất / xét nghiệm" onBlur={(e) => meta({ reagent: e.target.value })} /></div>
            <div className="field rc-field"><label htmlFor="rc-unit">Đơn vị</label><input {...wp} id="rc-unit" defaultValue={current.unit} placeholder="mmol/L..." onBlur={(e) => meta({ unit: e.target.value })} /></div>
            <div className="field rc-field"><label htmlFor="rc-lot-old">Số lô cũ</label><input {...wp} id="rc-lot-old" aria-label="Số lô cũ" defaultValue={current.lot_old} onBlur={(e) => meta({ lotOld: e.target.value })} /></div>
            <div className="field rc-field"><label htmlFor="rc-lot-new">Số lô mới</label><input {...wp} id="rc-lot-new" aria-label="Số lô mới" defaultValue={current.lot_new} onBlur={(e) => meta({ lotNew: e.target.value })} /></div>
            <div className="field rc-field rc-date-field">
              <label htmlFor="rc-date">Ngày thực hiện</label>
              <DateField id="rc-date" value={current.date} disabled={!writable} onChange={(v) => meta({ date: v })} />
            </div>
            <div className="field rc-field">
              <label htmlFor="rc-operator">Người thực hiện</label>
              <div className="rc-quick-field">
                {/* `key` bắt ô nhập remount khi giá trị đổi từ modal "Chọn nhanh"
                    — ô này KHÔNG kiểm soát (defaultValue), React chỉ đọc
                    defaultValue lúc mount đầu, không tự cập nhật lại sau đó. */}
                <input {...wp} id="rc-operator" key={current.operator} defaultValue={current.operator} placeholder="Họ tên" onBlur={(e) => meta({ operator: e.target.value })} />
                <button type="button" className="rc-icon-btn" disabled={!writable} onClick={() => setQuickType('operator')} title="Chọn nhanh người thực hiện" aria-label="Chọn nhanh người thực hiện"><ReagentToolIcon type="user" /></button>
              </div>
            </div>
            <div className="field rc-field">
              <label htmlFor="rc-sample-type">Loại mẫu</label>
              <div className="rc-quick-field">
                <input {...wp} id="rc-sample-type" key={current.sample_type} defaultValue={current.sample_type} placeholder="Loại mẫu" onBlur={(e) => meta({ sampleType: e.target.value })} />
                <button type="button" className="rc-icon-btn" disabled={!writable} onClick={() => setQuickType('sampleType')} title="Chọn nhanh loại mẫu" aria-label="Chọn nhanh loại mẫu"><ReagentToolIcon type="sample" /></button>
              </div>
            </div>
            <div className="field rc-field"><label htmlFor="rc-bias-target">Bias mong muốn (%)</label><input {...wp} id="rc-bias-target" aria-label="Bias mong muốn (%)" type="number" step="any" defaultValue={current.bias_target ?? 6} onBlur={(e) => meta({ biasTarget: Number(e.target.value) })} /></div>
            <div className="field rc-field"><label htmlFor="rc-alpha">Mức ý nghĩa (α, alpha)</label><input {...wp} id="rc-alpha" aria-label="Mức ý nghĩa (alpha)" type="number" step="any" defaultValue={current.alpha ?? 0.05} onBlur={(e) => meta({ alpha: Number(e.target.value) })} /></div>
            <div className="field rc-field rc-coverage-cell">
              <label className="rc-coverage-check">
                <input {...wp} type="checkbox" defaultChecked={!!current.coverage_confirmed} onChange={(e) => meta({ coverageConfirmed: e.target.checked })} />
                <span>Mẫu đã bao phủ khoảng đo và/hoặc điểm quyết định lâm sàng theo SOP</span>
              </label>
            </div>
          </div>
        </div>

        <div className="panel rc-pair-panel">
          <h2 className="panel-title">Dữ liệu đo bắt cặp</h2>
          <div className="rc-pair-wrap">
            <div className="rc-pair-head">
              <div>Mẫu</div>
              <div>Lô cũ: {current.lot_old || '—'}</div>
              <div>Lô mới: {current.lot_new || '—'}</div>
              <div>Trung bình</div>
              <div>Hiệu số (cũ − mới)</div>
              <div></div>
            </div>
            {rowsDraft.map((row, i) => {
              const o = Number(row[0]);
              const nv = Number(row[1]);
              const both = Number.isFinite(o) && Number.isFinite(nv) && row[0] !== '' && row[1] !== '';
              const dif = both ? o - nv : null;
              return (
                <div className="rc-pair-row" data-rc-row={i} key={`${rowsDraft.length}-${i}`}>
                  <div className="rc-idx">{i + 1}</div>
                  <input {...wp} type="number" step="any" placeholder="–" aria-label={`Mẫu ${i + 1} – lô cũ`} value={row[0]} onChange={(e) => updateCell(i, 0, e.target.value)} onBlur={() => trackWrite(store.saveRows(current.id, rowsDraft))} />
                  <input {...wp} type="number" step="any" placeholder="–" aria-label={`Mẫu ${i + 1} – lô mới`} value={row[1]} onChange={(e) => updateCell(i, 1, e.target.value)} onBlur={() => trackWrite(store.saveRows(current.id, rowsDraft))} />
                  <div className="rc-calc">{both ? fmtFixed((o + nv) / 2) : '–'}</div>
                  <div className={`rc-calc dif${dif != null && dif < 0 ? ' neg' : ''}`}>{dif != null ? fmtFixed(dif) : '–'}</div>
                  {writable
                    ? <RowActionButton kind="delete" label={`Xoá dòng mẫu ${i + 1}`} onClick={() => commitRows(rowsDraft.filter((_, j) => j !== i))} />
                    : <span></span>}
                </div>
              );
            })}
          </div>
          {writable && (
            <div className="rc-pair-actions">
              <button className="btn ghost sm" onClick={() => commitRows([...rowsDraft, ['', '']])}>+ Thêm mẫu</button>{' '}
              <button className="btn ghost sm" onClick={async () => { if (await confirmDialog('Xoá toàn bộ dữ liệu đã nhập của phép so sánh này?', { danger: true, confirmLabel: 'Xoá' })) commitRows([['', ''], ['', ''], ['', ''], ['', ''], ['', '']]); }}>Xoá dữ liệu</button>
            </div>
          )}
          <div className="hint rc-pair-hint">
            Nhập tối thiểu {MIN_PAIRS} cặp để tính mô tả; để phần mềm đánh dấu “đạt sàng lọc” cần ≥20 cặp hợp lệ, bao phủ khoảng đo/điểm quyết định lâm sàng và %bias trong giới hạn SOP. Không dùng p-value để tự chấp nhận lô.
          </div>
        </div>
      </div>

      <StatsPanel result={result} />
      <CriteriaPanel result={result} />

      <ReagentCharts comparison={current} />

      {creating && <CreateComparisonModal onClose={() => setCreating(false)} onCreate={createFromTea} />}
      {quickType && (
        <QuickPickerModal type={quickType} onClose={() => setQuickType(null)}
          onPick={(value) => { meta(quickType === 'operator' ? { operator: value } : { sampleType: value }); setQuickType(null); }} />
      )}
    </div>
  );
}

type TeaChoice = { key: string; name: string; unit: string; section: string; search: string };

function teaChoiceName(name: string, abbreviation = ''): string {
  return abbreviation && abbreviation.trim().toLocaleLowerCase('vi') !== name.trim().toLocaleLowerCase('vi')
    ? `${name} (${abbreviation})` : name;
}

/** Danh mục của modal tạo PHẢI dùng đúng nguồn dữ liệu tab TEa: catalog mặc
 * định cộng các analyte TEa do PXN thêm/cập nhật, không có danh sách hoá chất
 * riêng cho So sánh hoá chất. */
function makeTeaChoices(refs: TeaRef[]): TeaChoice[] {
  const byKey = new Map<string, TeaChoice>();
  for (const row of TEA_CATALOG) {
    const name = teaChoiceName(row.name, row.abbr);
    byKey.set(row.id, { key: row.id, name, unit: row.unit, section: row.section, search: `${name} ${row.name} ${row.abbr} ${row.unit} ${row.section}`.toLocaleLowerCase('vi') });
  }
  for (const row of refs) {
    const key = row.analyte_id || `custom:${row.name.toLocaleLowerCase('vi')}:${row.unit.toLocaleLowerCase('vi')}`;
    const original = byKey.get(key);
    const name = original?.name || row.name;
    const unit = row.unit || original?.unit || '';
    const section = row.section || original?.section || 'Khác';
    byKey.set(key, { key, name, unit, section, search: `${name} ${row.name} ${unit} ${section}`.toLocaleLowerCase('vi') });
  }
  return [...byKey.values()].sort((left, right) => left.section.localeCompare(right.section, 'vi') || left.name.localeCompare(right.name, 'vi'));
}


