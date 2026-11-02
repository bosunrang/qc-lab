// Tab "TransitionsTab" của trang Cấu hình chung — tách khỏi ManagePage.tsx
// (2026-09-03) khi file đó lên 1121 dòng gồm 6 tab. Phần dùng chung ở ./shared.
//
// Viết lại 2026-09-03 (lần 2): modal có 1 ô "Trạng thái" chọn được cả 4 giá
// trị + 1 nút Lưu DUY NHẤT — không phải các nút hành động tách rời (Kích
// hoạt/Chấp nhận/Không chấp nhận) như bản trước, thiết kế mà người dùng đã
// yêu cầu bỏ.
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useManageStore } from '../../store/manage-store';
import { Modal } from '../../components/Modal';
import { DateField } from '../../components/DateField';
import { RowActionButton } from '../../components/RowActionButton';
import { confirmDialog, infoDialog, errorDialog, reauthDialog } from '../../state/dialog-store';
import { normalizeTargetPick, syncTargetRange } from '../../lib/target-range';
import { vnDate } from '../../lib/format';
import { todayIso } from '../../state/date-picker-store';
import { EmptyState } from './shared';
import { normalizeSearch } from '../../lib/useTestSelection';
import type { LotTransition } from '../../../shared/qc-api';
import { useAsyncAction } from '../../components/AsyncButton';
import { formError, formErrorFrom, type FieldErrorMap, type FormError } from '../../lib/field-error';
import { useInvalidField } from '../../lib/useInvalidField';

/** Mã lỗi `createLotTransition` (`validateLotTransition` + handler) → ô cần
 * sửa. Thiếu lô thì chỉ vào ô lô còn trống. `duplicate-transition` và
 * `missing-target` không gắn ô: lỗi thuộc cả bộ Panel/lô hoặc bảng Mean/SD. */
const TRANSITION_FIELD_ERRORS: FieldErrorMap = {
  'missing-panel': 'panelId', 'missing-lots': ['fromLotId', 'toLotId'], 'same-lot': 'toLotId',
  'different-levels': 'toLotId', 'no-target-tests': 'fromLotId', 'accepted-immutable': 'status',
};

/** Giờ:phút + ngày dạng Việt Nam; giá trị không hợp lệ thì trả rỗng. */
function formatDateTimeVN(value: string): string {
  const date = new Date(value);
  return isNaN(+date) ? '' : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('vi-VN');
}


const STATUS_TEXT: Record<string, { text: string; cls: string }> = {
  active: { text: 'Đang chạy song song', cls: 'warn' },
  accepted: { text: 'Chấp nhận lô mới', cls: 'ok' },
  rejected: { text: 'Không chấp nhận', cls: 'rej' },
};
function statusOf(status: string) { return STATUS_TEXT[status] || { text: 'Dự kiến', cls: 'none' }; }

export function TransitionsTab({ onGoPanels, onGoLots }: { onGoPanels?: () => void; onGoLots?: () => void } = {}) {
  const { lotTransitions, panels, lots, tests, instruments, levelsByTestId, loadLevels, createLotTransition, removeLotTransition } = useManageStore(useShallow((s) => ({ lotTransitions: s.lotTransitions, panels: s.panels, lots: s.lots, tests: s.tests, instruments: s.instruments, levelsByTestId: s.levelsByTestId, loadLevels: s.loadLevels, createLotTransition: s.createLotTransition, removeLotTransition: s.removeLotTransition })));
  const instrumentName = (id: string) => instruments.find((i) => i.id === id)?.name || '';
  const [targetQuery, setTargetQuery] = useState('');
  const targetNeedle = normalizeSearch(targetQuery);


  function transitionToNo(lotId: string): string {
    const accepted = lotTransitions.find((tr) => tr.from_lot_id === lotId && tr.status === 'accepted');
    return accepted ? lots.find((lot) => lot.id === accepted.to_lot_id)?.lot_no || '' : '';
  }

  function availableLots(selectedId: string) { return lots.filter((lot) => !lot.depleted || lot.id === selectedId); }
  function lotOptionLabel(lot: (typeof lots)[number]): string {
    const suffix = lot.depleted ? ` · ${transitionToNo(lot.id) ? `đã chuyển tiếp qua lô ${transitionToNo(lot.id)}` : 'đã hết QC'}` : '';
    return `${lot.lot_no} · M${lot.level}${suffix}`;
  }

  async function removeTransition(tr: LotTransition) {
    if (!(await confirmDialog('Xoá dòng chuyển tiếp lô này?', { title: 'Xoá dòng chuyển tiếp lô', danger: true, confirmLabel: 'Xoá' }))) return;
    const result = await removeLotTransition(tr.id);
    if (!result.ok) await errorDialog(result.error.message);
  }
  // `'new'` = thêm mới, một hồ sơ = đang SỬA hồ sơ đó (cả 2 chiều trên cùng
  // modal). Hồ sơ đã 'accepted' vẫn mở "Sửa" được (mọi dòng luôn hiện nút
  // Sửa) nhưng đổi status khác 'accepted' sẽ bị main chặn
  // (`accepted-immutable` — không đổi được kết luận đã chấp nhận).
  const [creating, setCreating] = useState<'new' | LotTransition | null>(null);
  const [err, setErr] = useState<FormError | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errorId = useInvalidField(formRef, err);
  const [draftPanelId, setDraftPanelId] = useState('');
  const [draftFromLotId, setDraftFromLotId] = useState('');
  const [draftToLotId, setDraftToLotId] = useState('');
  const draftPanel = panels.find((panel) => panel.id === draftPanelId);
  // Chỉ xét nghiệm thuộc Panel và ĐANG dùng lô cũ mới là đối tượng của một
  // hồ sơ chuyển lô. Khi không có dòng nào thì
  // không thể chuyển tiếp (hay thay lô) cho Panel đó.
  const draftTests = tests
    .filter((test) => draftPanel?.testIds.includes(test.id))
    .filter((test) => (levelsByTestId[test.id] || []).some((level) => level.qc_lot_id === draftFromLotId)) || [];
  const draftFromLot = lots.find((lot) => lot.id === draftFromLotId);
  const draftToLot = lots.find((lot) => lot.id === draftToLotId);
  const targetTableReady = Boolean(draftPanel && draftFromLot && draftToLot
    && draftFromLotId !== draftToLotId && draftFromLot.level === draftToLot.level && draftTests.length);
  // Mean/SD ỨNG VIÊN đã lưu trong hồ sơ (criteria_json) — dùng để nạp lại
  // đúng giá trị khi mở "Sửa", vì lúc này test_levels VẪN LÀ số của lô CŨ
  // (chưa "Chấp nhận" thì chưa áp gì cả — xem config-handlers.ts).
  const draftCriteria = new Map<string, { mean: number; sd: number; low: number | null; high: number | null }>();
  if (creating && creating !== 'new') {
    try {
      const parsed = JSON.parse(creating.criteria_json || '[]') as { testId: string; level: number; mean: number; sd: number; low?: number | null; high?: number | null }[];
      if (Array.isArray(parsed)) for (const item of parsed) draftCriteria.set(`${item.testId}:${item.level}`, { mean: item.mean, sd: item.sd, low: item.low ?? null, high: item.high ?? null });
    } catch { /* criteria_json hỏng thì coi như chưa nhập gì */ }
  }

  useEffect(() => { draftPanel?.testIds.forEach((id) => loadLevels(id)); }, [draftPanel, loadLevels]);

  async function openNew() {
    if (!panels.length) { await infoDialog('Hãy tạo Panel QC trước khi tạo chuyển tiếp lô.'); onGoPanels?.(); return; }
    if (lots.length < 2) { await infoDialog('Cần ít nhất 2 lô QC để tạo chuyển tiếp.'); onGoLots?.(); return; }
    setErr(null); setDraftPanelId(panels[0]?.id || ''); setDraftFromLotId(''); setDraftToLotId(''); setTargetQuery(''); setCreating('new');
  }

  /** Lưu hồ sơ — MỘT hành động duy nhất: gửi kèm status + Mean/SD ứng viên
   * (`criteria`) trong CÙNG 1 lần gọi. Đổi status sang 'accepted'/'rejected'
   * lần đầu (`finalChanged`) thì xác thực lại mật khẩu TRƯỚC khi gọi API —
   * cùng 1 câu hỏi cho cả 2 trường hợp (không tách riêng "Xác thực chấp
   * nhận"/"Xác thực từ chối"). KHÔNG có confirmDialog trước reauth — đi
   * thẳng từ nút Lưu sang ô nhập mật khẩu. */
  const saving = useAsyncAction(submit);
  async function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const status = String(fd.get('status') || 'planned') as LotTransition['status'];
    // Đọc bảng Mean/SD TRƯỚC khi lưu: sai định dạng thì dừng lại, không để
    // lưu xong mới báo lỗi (hồ sơ đã ghi thì không tự rút lại được).
    const criteria: { testId: string; level: number; mean: number; sd: number; low: number | null; high: number | null }[] = [];
    for (const row of document.querySelectorAll<HTMLElement>('.lot-trans-target-table .target-row')) {
      const read = (selector: string) => row.querySelector<HTMLInputElement>(selector)?.value.trim() || '';
      if (!read('.tm-mean') && !read('.tm-low') && !read('.tm-high') && !read('.tm-sd')) continue;
      const parsed = normalizeTargetPick({
        meanRaw: read('.tm-mean'), lowRaw: read('.tm-low'), highRaw: read('.tm-high'), sdRaw: read('.tm-sd'),
        k: Number(row.getAttribute('data-k') || 2) || 2,
      });
      if ('error' in parsed) { setErr(formError(parsed.message)); return; }
      criteria.push({ testId: row.getAttribute('data-test') || '', level: Number(row.getAttribute('data-level') || 1), mean: parsed.mean, sd: parsed.sd, low: parsed.low, high: parsed.high });
    }
    const editing = creating !== 'new' ? creating : null;
    const finalChanged = (status === 'accepted' || status === 'rejected') && (!editing || editing.status !== status);
    if (finalChanged && !(await reauthDialog({ title: 'Xác thực kết luận chuyển lô', message: 'Nhập lại mật khẩu trước khi chấp nhận hoặc từ chối lô QC mới.' }))) return;
    const result = await createLotTransition({
      panelId: String(fd.get('panelId') || ''), fromLotId: String(fd.get('fromLotId') || ''),
      toLotId: String(fd.get('toLotId') || ''), startDate: String(fd.get('startDate') || ''), note: editing?.note || '',
      status, criteria,
    }, editing?.id);
    if (!result.ok) { setErr(formErrorFrom(result.error, TRANSITION_FIELD_ERRORS)); return; }
    setCreating(null);
  }

  return (
    <>
        <div className="rcfg-toolbar">
          <div><h2>Chuyển tiếp lô QC</h2><p>Theo dõi lô cũ, lô mới và trạng thái khi thay lô.</p></div>
          <div className="rcfg-tools"><button className="btn teal" onClick={openNew}>＋ Thêm hồ sơ chuyển lô</button></div>
        </div>
      <div className="panel rcfg-list transition-list">
        {lotTransitions.length ? <table className="transition-table">
          <thead><tr><th>Panel QC</th><th>Chuyển lô</th><th>Bắt đầu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {lotTransitions.map((tr) => {
              const status = statusOf(tr.status);
              const fromLot = lots.find((l) => l.id === tr.from_lot_id);
              const toLot = lots.find((l) => l.id === tr.to_lot_id);
              const fromLotLabel = fromLot ? `${fromLot.lot_no} · Mức ${fromLot.level}` : '—';
              const toLotLabel = toLot ? `${toLot.lot_no} · Mức ${toLot.level}` : '—';
              const toLotNo = toLot?.lot_no || '';
              return <tr key={tr.id}>
                <td>{panels.find((p) => p.id === tr.panel_id)?.name || '—'}</td>
                <td><div><b>{fromLotLabel}</b></div><div className="hint">→ {toLotLabel}</div></td>
                <td>{tr.start_date ? vnDate(tr.start_date) : '—'}</td>
                <td>
                  <span className={`tag ${status.cls}`}>{status.text}</span>
                  {tr.status === 'accepted' && toLotNo ? <div className="hint">Đã chuyển tiếp qua lô {toLotNo}</div> : null}
                  {tr.approved_by ? <div className="hint">Duyệt: {tr.approved_by}{tr.approved_at ? ` · ${formatDateTimeVN(tr.approved_at)}` : ''}</div> : null}
                </td>
                <td><div className="manage-actions">
                  <RowActionButton kind="edit" label={`Sửa hồ sơ chuyển lô ${fromLotLabel} sang ${toLotLabel}`} onClick={() => {
                    setErr(null); setDraftPanelId(tr.panel_id); setDraftFromLotId(tr.from_lot_id);
                    setDraftToLotId(tr.to_lot_id); setTargetQuery(''); setCreating(tr);
                  }} />
                  <RowActionButton kind="delete" label={`Xoá hồ sơ chuyển lô ${fromLotLabel} sang ${toLotLabel}`} onClick={() => removeTransition(tr)} />
                </div></td>
              </tr>;
            })}
          </tbody>
        </table> : <EmptyState title="Chưa có hồ sơ chuyển lô">Tạo hồ sơ để theo dõi chuyển từ lô cũ sang lô mới.</EmptyState>}
        {creating && (
          <Modal busy={saving.busy} title={creating === 'new' ? 'Thêm hồ sơ chuyển lô' : 'Sửa hồ sơ chuyển lô'} onClose={() => setCreating(null)} size="xl" className="rcfg-modal lot-trans-modal"
            footer={<><button className="btn ghost" onClick={() => setCreating(null)}>Huỷ</button><button className="btn teal" type="submit" form="transition-form" disabled={saving.busy}>{saving.busy ? 'Đang lưu…' : creating === 'new' ? 'Thêm hồ sơ chuyển lô' : 'Lưu thay đổi'}</button></>}>
            <form id="transition-form" ref={formRef} onSubmit={(e) => { e.preventDefault(); void saving.run(e.currentTarget); }}>
              {err && <p id={errorId} className="field-error" role="alert">{err.message}</p>}
              <div className="lot-trans-row3">
                <div className="field">
                  <label htmlFor="transition-panel">Panel QC áp dụng</label>
                  <select id="transition-panel" name="panelId" value={draftPanelId} onChange={(e) => setDraftPanelId(e.target.value)}><option value="">— Chọn Panel QC —</option>{panels.map((p) => <option key={p.id} value={p.id}>{p.name} · {instrumentName(p.instrument_id)}</option>)}</select>
                </div>
                <div className="field"><label htmlFor="transition-from-lot">Lô cũ</label><select id="transition-from-lot" name="fromLotId" value={draftFromLotId} onChange={(e) => setDraftFromLotId(e.target.value)}><option value="">Chọn số lô</option>{availableLots(draftFromLotId).filter((lot) => lot.id !== draftToLotId).map((lot) => <option key={lot.id} value={lot.id}>{lotOptionLabel(lot)}</option>)}</select></div>
                <div className="field"><label htmlFor="transition-to-lot">Lô mới</label><select id="transition-to-lot" name="toLotId" value={draftToLotId} onChange={(e) => setDraftToLotId(e.target.value)}><option value="">Chọn số lô</option>{availableLots(draftToLotId).filter((lot) => lot.id !== draftFromLotId).map((lot) => <option key={lot.id} value={lot.id}>{lotOptionLabel(lot)}</option>)}</select></div>
              </div>
              <div className="lot-trans-row2">
                <DateField id="transition-start-date" name="startDate" label="Ngày bắt đầu" defaultValue={creating && creating !== 'new' ? creating.start_date : todayIso()} />
                <div className="field">
                  <label htmlFor="transition-status">Trạng thái</label>
                  <select id="transition-status" name="status" defaultValue={creating !== 'new' ? creating.status : 'planned'}>
                    <option value="planned">Dự kiến</option>
                    <option value="active">Đang chạy song song</option>
                    <option value="accepted">Chấp nhận lô mới</option>
                    <option value="rejected">Không chấp nhận</option>
                  </select>
                </div>
              </div>
              <section className="lot-transition-targets" aria-label="Mean SD cho lô mới">
                {/* Cấu trúc: `.lot-trans-target-head-row` +
                    `.target-table.lot-trans-target-table` dùng lại `.target-head`/
                    `.target-row` của bảng Mean/SD (cùng CSS, cùng `syncTargetRange`). */}
                <div className="lot-trans-target-head-row">
                  <label>Mean/SD cho lô mới {draftToLot?.lot_no || ''}</label>
                  {targetTableReady ? <input type="search" className="lot-trans-target-search" placeholder="Tìm xét nghiệm..."
                    value={targetQuery} onChange={(event) => setTargetQuery(event.target.value)} /> : null}
                </div>
                {targetTableReady ? <div className="target-table lot-trans-target-table">
                  <div className="target-head"><span></span><span>Xét nghiệm</span><span>Trung bình mục tiêu</span><span>Giới hạn dưới</span><span>Giới hạn trên</span><span>Độ lệch chuẩn</span><span>Trạng thái</span></div>
                  {draftTests
                    .map((test) => {
                      // Dòng không khớp ô tìm chỉ bị ẩn (CSS), không bị bỏ khỏi DOM: lúc
                      // lưu, `submit()` đọc Mean/SD từ mọi dòng. Bỏ khỏi DOM thì hồ sơ
                      // được ghi lại chỉ còn các dòng đang hiện và giá trị đã gõ bị mất.
                      const matches = !targetNeedle || normalizeSearch(`${test.name} ${test.unit}`).includes(targetNeedle);
                      const levelNo = draftToLot?.level ?? 1;
                      // Ưu tiên Mean/SD ỨNG VIÊN đã lưu trong hồ sơ (khi sửa)
                      // — test_levels vẫn là số của lô CŨ cho tới khi "Chấp
                      // nhận", nên không dùng nó làm giá trị hiện tại ở đây.
                      // Chỉ dùng test_levels của LÔ CŨ làm GỢI Ý khi tạo mới
                      // (điểm bắt đầu hợp lý: số đang chạy trên lô cũ).
                      const saved = draftCriteria.get(`${test.id}:${levelNo}`);
                      const live = (levelsByTestId[test.id] || []).find((item) => item.level === levelNo && item.qc_lot_id === draftFromLotId);
                      const decimals = test.decimal_places;
                      const k = live?.range_k || 2;
                      const mean = saved ? saved.mean : live?.mean ?? null;
                      const sd = saved ? saved.sd : live?.sd ?? null;
                      const ready = mean != null && sd != null && sd > 0;
                      const status = saved ? 'Đã nhập' : 'Chưa nhập';
                      // Giá trị các ô là `defaultValue`, nên phải dựng lại khi đổi BẤT
                      // KỲ lô nào. Chỉ dùng mức QC trong key sẽ giữ số của lô cũ khi
                      // người dùng đổi sang một lô khác cùng mức, rồi có thể lưu nhầm.
                      return <div className={`target-row${matches ? '' : ' is-filtered-out'}`} key={`${test.id}:${draftFromLotId}:${draftToLotId}:${levelNo}:${saved ? '1' : '0'}`} data-test={test.id} data-level={levelNo} data-decimals={decimals} data-k={k}>
                        {/* checkbox chỉ trang trí, luôn đã chọn — mọi xét nghiệm
                            đang dùng lô cũ đều là ứng viên, không có nút bỏ
                            chọn từng dòng (`checked disabled readOnly`). */}
                        <label className="lot-assay-check"><input type="checkbox" checked disabled readOnly /><span></span></label>
                        <div className="lot-assay-name"><b>{test.name}</b><small>{test.unit || 'Chưa có đơn vị'}</small></div>
                        <input className="tm-mean" type="number" step="any" defaultValue={mean ?? ''} placeholder="Trung bình" onChange={(event) => syncTargetRange(event.currentTarget, 'target')} />
                        <input className="tm-low" type="number" step="any" defaultValue={ready ? (mean! - k * sd!).toFixed(decimals) : ''} placeholder="Giới hạn dưới" onChange={(event) => syncTargetRange(event.currentTarget, 'limits')} />
                        <input className="tm-high" type="number" step="any" defaultValue={ready ? (mean! + k * sd!).toFixed(decimals) : ''} placeholder="Giới hạn trên" onChange={(event) => syncTargetRange(event.currentTarget, 'limits')} />
                        <input className="tm-sd" type="number" step="any" defaultValue={sd ?? ''} placeholder="Độ lệch chuẩn" onChange={(event) => syncTargetRange(event.currentTarget, 'target')} />
                        <span><b className={`tag ${saved ? 'ok' : 'none'}`}>{status}</b></span>
                      </div>;
                    })}
                </div> : <div className="hint flow-section">{draftPanel && draftFromLot && draftToLot && draftFromLot.level !== draftToLot.level
                  ? 'Lô cũ và lô mới phải cùng mức QC để nhập Mean/SD chuyển tiếp.'
                  : draftPanel && draftFromLot && draftToLot && !draftTests.length
                    ? `Panel QC đã chọn không có xét nghiệm nào đang dùng lô cũ ${draftFromLot.lot_no}.`
                    : 'Chọn Panel QC, Lô cũ và Lô mới (khác nhau, cùng mức) để nhập Mean/SD cho lô mới.'}</div>}
              </section>
            </form>
          </Modal>
        )}
      </div>
    </>
  );
}


