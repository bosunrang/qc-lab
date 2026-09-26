// Tab "LotsTab" của trang Cấu hình chung — tách khỏi ManagePage.tsx
// (2026-09-03) khi file đó lên 1121 dòng gồm 6 tab. Phần dùng chung ở ./shared.
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useManageStore } from '../../store/manage-store';
import { useWestgardStore } from '../../store/westgard-store';
import { Modal } from '../../components/Modal';
import { DateField } from '../../components/DateField';
import { RowActionButton } from '../../components/RowActionButton';
import { confirmDialog, reauthDialog, infoDialog } from '../../state/dialog-store';
import { vnDate } from '../../lib/format';
import { EmptyState, lotStatus } from './shared';
import type { QcLot, LotGroup } from '../../../shared/qc-api';

const LOTS_PAGE_SIZE = 15;
const LOT_GROUPS_PAGE_SIZE = 10;

function ListPagination({ page, pageCount, pageSize, total, itemLabel, onPageChange }: {
  page: number; pageCount: number; pageSize: number; total: number; itemLabel: string; onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, from + pageSize - 1);
  return <nav className="lot-list-pagination" aria-label={`Phân trang ${itemLabel}`}>
    <span className="hint" role="status">{from}–{to} trên {total} {itemLabel}</span>
    <div className="lot-page-controls">
      <button className="btn ghost lot-page-button" type="button" aria-label="Trang trước" title="Trang trước" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>‹</button>
      <b aria-current="page">{page}/{pageCount}</b>
      <button className="btn ghost lot-page-button" type="button" aria-label="Trang sau" title="Trang sau" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>›</button>
    </div>
  </nav>;
}

/** Thứ tự hiển thị nhóm lô: nhóm đang thật sự hoạt động lên ĐẦU, "Đã dừng"/
 * "Đã lưu trữ" đẩy xuống CUỐI — người dùng yêu cầu để nhóm đang dùng không
 * bị chìm giữa các nhóm không còn liên quan. Cùng logic trạng thái đã tính
 * ở chỗ render (archived/operational/inUse), tách riêng để dùng cho sort. */
function groupSortPriority(g: LotGroup): number {
  if (g.active === 0) return 3; // Đã lưu trữ — luôn cuối cùng
  if (g.status === 'stopped') return 2; // Đã dừng
  if (g.status !== 'planned' && g.inUse) return 0; // Đang hoạt động — luôn đầu tiên
  return 1; // Dự kiến / Chưa dùng
}

export function LotsTab() {

  function suggestGroupName(box: HTMLInputElement, checked: Set<string>) {
    const form = box.form;
    if (!form) return;
    const nameEl = form.elements.namedItem('name') as HTMLInputElement | null;
    if (!nameEl) return;
    nameEl.value = lots.filter((lot) => checked.has(lot.id)).map((lot) => lot.lot_no).filter(Boolean).join('/');
  }

  const { lots: allLots, lotGroups: allGroups, lotTransitions, saveLot, saveLotGroup, removeLot, removeLotGroup, stopLotGroup, activateLotGroup } = useManageStore(useShallow((s) => ({ lots: s.lots, lotGroups: s.lotGroups, lotTransitions: s.lotTransitions, saveLot: s.saveLot, saveLotGroup: s.saveLotGroup, removeLot: s.removeLot, removeLotGroup: s.removeLotGroup, stopLotGroup: s.stopLotGroup, activateLotGroup: s.activateLotGroup })));

  const transitionToNo = (lotId: string): string | undefined => {
    const accepted = lotTransitions.find((tr) => tr.from_lot_id === lotId && tr.status === 'accepted');
    return accepted ? allLots.find((lot) => lot.id === accepted.to_lot_id)?.lot_no : undefined;
  };
  const { summaries } = useWestgardStore(useShallow((s) => ({ summaries: s.summaries })));
  const allLevels = summaries.flatMap((summary) => summary.levels);
  const [query, setQuery] = useState('');
  const [lotPage, setLotPage] = useState(1);
  const [lotGroupPage, setLotGroupPage] = useState(1);
  const [editingLot, setEditingLot] = useState<QcLot | 'new' | null>(null);
  const [editingGroup, setEditingGroup] = useState<LotGroup | 'new' | null>(null);
  const [lotErr, setLotErr] = useState<string | null>(null);
  const [groupErr, setGroupErr] = useState<string | null>(null);
  const [groupChecked, setGroupChecked] = useState<Set<string>>(new Set());

  // Lọc theo bộ field của tab này (số lô, mô tả, nhà cung cấp, chương trình,
  // tên nhóm lô, mức, hạn dùng).
  const q = query.trim().toLowerCase();
  const groupNameOfLot = (id: string) => allGroups.find((g) => g.lotIds.includes(id))?.name || '';
  const match = (values: unknown[]) => !q || values.some((v) => String(v ?? '').toLowerCase().includes(q));
  const lots = allLots.filter((l) => match([l.lot_no, l.description, l.supplier, l.program, groupNameOfLot(l.id), l.level, l.exp]));
  // Class `levels-1|2|3plus` đặt lên chính modal nhóm lô (bề rộng + số cột
  // lưới chọn lô thay đổi theo SỐ MỨC đang có lô).
  const groupLevelCount = new Set(allLots.map((l) => l.level)).size;
  const lotGroups = allGroups.filter((g) => match([g.name, g.note, ...g.lotIds.map((id) => allLots.find((l) => l.id === id)?.lot_no)]));
  const lotPageCount = Math.max(1, Math.ceil(lots.length / LOTS_PAGE_SIZE));
  const currentLotPage = Math.min(lotPage, lotPageCount);
  const pagedLots = lots.slice((currentLotPage - 1) * LOTS_PAGE_SIZE, currentLotPage * LOTS_PAGE_SIZE);
  const sortedLotGroups = [...lotGroups].sort((a, b) => groupSortPriority(a) - groupSortPriority(b));
  const lotGroupPageCount = Math.max(1, Math.ceil(sortedLotGroups.length / LOT_GROUPS_PAGE_SIZE));
  const currentLotGroupPage = Math.min(lotGroupPage, lotGroupPageCount);
  const pagedLotGroups = sortedLotGroups.slice((currentLotGroupPage - 1) * LOT_GROUPS_PAGE_SIZE, currentLotGroupPage * LOT_GROUPS_PAGE_SIZE);

  async function removeLotRow(lot: QcLot) {
    if (!(await confirmDialog(`Xóa lô QC ${lot.lot_no}?`, { title: 'Xóa lô QC', danger: true, confirmLabel: 'Xóa lô QC' }))) return;
    const result = await removeLot(lot.id);
    if (!result.ok) await infoDialog(result.error.message, { type: 'warn' });
  }

  async function removeGroup(group: LotGroup) {
    if (!(await confirmDialog(`Xóa nhóm lô ${group.name}? Các lô QC bên trong vẫn được giữ nguyên.`, { title: 'Xóa nhóm lô', danger: true, confirmLabel: 'Xóa nhóm lô' }))) return;
    const result = await removeLotGroup(group.id);
    if (!result.ok) await infoDialog(result.error.message, { type: 'warn' });
  }

  /** Kích hoạt nhóm lô — áp Mean/SD ĐÃ LƯU của từng lô trong nhóm sang các
   * mức QC tương ứng và dừng nhóm bị thay thế. Đây là thao tác ghi vào cấu
   * hình QC đang vận hành nên đi qua `reauthDialog` như mọi thao tác Mean/SD
   * khác (cùng danh sách thao tác nhạy cảm). */
  async function activateGroup(group: LotGroup) {
    if (!(await confirmDialog(
      `Áp dụng Mean/SD của nhóm lô ${group.name} cho các xét nghiệm liên quan và chuyển sang dùng nhóm này?`
      + ' Nhóm lô đang giữ các mức đó sẽ được đánh dấu đã dừng.',
      { title: 'Kích hoạt nhóm lô', confirmLabel: 'Áp dụng' },
    ))) return;
    if (!(await reauthDialog({ title: 'Xác thực Mean/SD', message: 'Nhập lại mật khẩu trước khi áp Mean/SD của nhóm lô này.' }))) return;
    const result = await activateLotGroup(group.id);
    if (!result.ok) { await infoDialog(result.error.message, { type: 'warn' }); return; }
    await infoDialog(result.data.status === 'applied'
      ? `Đã áp Mean/SD cho ${result.data.applied} mức QC.`
        + (result.data.stoppedGroups.length ? ` Dừng ${result.data.stoppedGroups.length} nhóm lô bị thay thế.` : '')
      : 'Nhóm lô này đã đang được dùng — không có mức nào cần áp thêm.', { type: 'success' });
  }

  async function stopGroup(group: LotGroup) {
    if (!(await confirmDialog(`Dừng nhóm lô ${group.name}? Nhóm đã dừng vẫn giữ nguyên lịch sử Mean/SD của các xét nghiệm đã dùng nó.`, { title: 'Dừng nhóm lô', confirmLabel: 'Dừng nhóm lô' }))) return;
    const result = await stopLotGroup(group.id);
    if (!result.ok) await infoDialog(result.error.message, { type: 'warn' });
  }

  async function submitLot(form: HTMLFormElement) {
    const fd = new FormData(form);
    const data = {
      lotNo: String(fd.get('lotNo') || ''), level: Number(fd.get('level') || 1),
      description: String(fd.get('description') || ''), supplier: String(fd.get('supplier') || ''),
      exp: String(fd.get('exp') || ''), opened: String(fd.get('opened') || ''),
      active: editingLot !== 'new' && editingLot ? editingLot.active === 1 : true,
      depleted: editingLot !== 'new' && editingLot ? editingLot.depleted === 1 : false,
      note: editingLot !== 'new' && editingLot ? editingLot.note : '',
    };
    const id = editingLot !== 'new' && editingLot ? editingLot.id : undefined;
    if (id) {
      // Chỉ ĐẾM để hỏi người dùng trước khi ghi (không ghi gì, không hiển
      // thị lâu dài) — đọc tức thời là đúng, không cần store.
      const preview = await window.qcApi.previewLotRename({ id, lotNo: data.lotNo });
      if (preview.ok && preview.data.rename && preview.data.rename.affected > 0) {
        const plan = preview.data.rename;
        const lockNote = plan.lockedCount
          ? ` Trong đó ${plan.lockedCount} điểm thuộc kỳ đã khóa (${plan.lockedPeriods.join(', ')}).`
          : '';
        const ok = await confirmDialog(
          `Đổi số lô "${plan.oldLotNo}" thành "${plan.newLotNo}" sẽ cập nhật ${plan.affected} điểm QC đã ghi.`
          + ` Số lô là nhãn nhận dạng — giá trị, ngày và Mean/SD của từng điểm không đổi.${lockNote}`,
          { title: 'Đổi số lô QC', confirmLabel: 'Đổi số lô' },
        );
        if (!ok) return;
      }
    }
    const result = await saveLot(id, data);
    if (!result.ok) { setLotErr(result.error.message); return; }
    setEditingLot(null);
  }

  async function submitGroup(form: HTMLFormElement) {
    const fd = new FormData(form);
    const data = {
      name: String(fd.get('name') || ''),
      manufacturer: editingGroup !== 'new' && editingGroup ? editingGroup.manufacturer : '',
      material: editingGroup !== 'new' && editingGroup ? editingGroup.material : '',
      catalog: editingGroup !== 'new' && editingGroup ? editingGroup.catalog : '',
      note: editingGroup !== 'new' && editingGroup ? editingGroup.note : '',
      // '' (không phải 'active') — trạng thái "Đang hoạt động" giờ SUY từ
      // `inUse` (lô của nhóm có đang gán cho xét nghiệm nào không), không
      // phải literal lưu cứng lúc tạo. Sửa hồ sơ vẫn gửi lại đúng status
      // hiện có (không đụng 'stopped'/'planned' đã tự đặt).
      status: editingGroup !== 'new' && editingGroup ? editingGroup.status : '',
      active: editingGroup !== 'new' && editingGroup ? editingGroup.active === 1 : true,
      lotIds: Array.from(groupChecked),
    };
    const id = editingGroup !== 'new' && editingGroup ? editingGroup.id : undefined;
    const result = await saveLotGroup(id, data);
    if (!result.ok) { setGroupErr(result.error.message); return; }
    setEditingGroup(null);
  }

  async function openNewGroup() {
    if (!lots.length) { await infoDialog('Hãy tạo lô QC trước khi tạo nhóm lô.'); return; }
    setGroupErr(null); setGroupChecked(new Set()); setEditingGroup('new');
  }

  return (
    <>
      <div className="rcfg-toolbar">
        <div>
          <h2>Lô &amp; Nhóm QC</h2>
          <p>Quản lý từng lô và nhóm lô QC.</p>
        </div>
        <div className="rcfg-tools">
          <input value={query} onChange={(e) => { setQuery(e.target.value); setLotPage(1); setLotGroupPage(1); }} placeholder="Tìm theo số lô, nhóm lô QC..." />
        </div>
      </div>
      <div className="lot-config-grid">
      <div className="panel rcfg-list lot-config-left">
        <div className="rcfg-panel-h"><h3>Lô QC</h3><button className="btn teal sm" onClick={() => { setLotErr(null); setEditingLot('new'); }}>+ Thêm lô</button></div>
        {lots.length ? <table className="lot-table">
          <thead><tr><th>Số lô</th><th>Mức</th><th>Hạn dùng</th><th>Trạng thái</th><th className="num">Gán</th><th>Thao tác</th></tr></thead>
          <tbody>
            {pagedLots.map((l) => (
              <tr key={l.id}>
                <td><b>{l.lot_no}</b>{l.description && <div className="hint">{l.description}</div>}</td><td><span className="pill">M{l.level}</span></td><td>{l.exp ? vnDate(l.exp) : '—'}</td>
                <td><span className={`tag ${lotStatus(l, transitionToNo(l.id)).cls}`}>{lotStatus(l, transitionToNo(l.id)).text}</span></td>
                <td className="num">{allLevels.filter((level) => level.qcLotId === l.id).length}</td>
                <td><div className="lot-row-actions">
                  <RowActionButton kind="edit" label={`Sửa lô QC ${l.lot_no}`} onClick={() => { setLotErr(null); setEditingLot(l); }} />
                  <RowActionButton kind="delete" label={`Xóa lô QC ${l.lot_no}`} onClick={() => removeLotRow(l)} />
                </div></td>
              </tr>
            ))}
          </tbody>
        </table> : <EmptyState title="Chưa có lô QC">Tạo từng lô QC độc lập, sau đó ghép nhóm và thiết lập Mean/SD.</EmptyState>}
        <ListPagination page={currentLotPage} pageCount={lotPageCount} pageSize={LOTS_PAGE_SIZE} total={lots.length} itemLabel="lô" onPageChange={setLotPage} />
      </div>

      <div className="panel rcfg-list lot-config-right">
        <div className="rcfg-panel-h"><h3>Nhóm lô QC</h3><button className="btn teal sm" onClick={openNewGroup}>+ Thêm nhóm lô</button></div>
        {lotGroups.length ? <div className="lot-group-list">{pagedLotGroups.map((g) => {
          const groupLots = allLots.filter((lot) => g.lotIds.includes(lot.id));
          const archived = g.active === 0;
          const operational = g.status !== 'stopped' && g.status !== 'planned';
          const statusClass = archived || g.status === 'stopped' ? 'rej' : g.status === 'planned' ? 'warn' : operational && g.inUse ? 'ok' : 'none';
          const statusText = archived ? 'Đã lưu trữ' : g.status === 'stopped' ? 'Đã dừng' : g.status === 'planned' ? 'Dự kiến' : operational && g.inUse ? 'Đang hoạt động' : 'Chưa dùng';
          return <article className="lot-group-card" key={g.id}>
            <div className="lot-group-card-h"><div><b>{g.name}</b><small>{g.note || 'Nhóm lô để gán Mean/SD theo Panel'}</small></div><span className={`tag ${statusClass}`}>{statusText}</span></div>
            <div className="lot-group-chipline">{groupLots.length ? groupLots.map((lot) => <span className="pill" key={lot.id}>{lot.lot_no} · M{lot.level}</span>) : <span className="hint">Chưa chọn lô QC</span>}</div>
            <div className="lot-group-actions">
              {!archived && (operational && g.inUse
                ? <button className="btn ghost sm btn-stop-tint" onClick={() => stopGroup(g)}>Dừng</button>
                : <button className="btn teal sm" onClick={() => activateGroup(g)}>Kích hoạt</button>)}
              <RowActionButton kind="edit" label={`Sửa nhóm lô ${g.name}`} onClick={() => { setGroupErr(null); setGroupChecked(new Set(g.lotIds)); setEditingGroup(g); }} />
              <RowActionButton kind="delete" label={`Xóa nhóm lô ${g.name}`} onClick={() => removeGroup(g)} />
            </div>
          </article>;
        })}</div> : <EmptyState title="Chưa có nhóm lô QC">Chọn ít nhất hai lô QC để tạo một nhóm lô dùng cho Mean/SD.</EmptyState>}
        <ListPagination page={currentLotGroupPage} pageCount={lotGroupPageCount} pageSize={LOT_GROUPS_PAGE_SIZE} total={lotGroups.length} itemLabel="nhóm lô" onPageChange={setLotGroupPage} />
      </div>
      </div>

      {editingLot && (
        <Modal title={editingLot === 'new' ? 'Thêm lô QC' : 'Sửa thông tin lô QC'} onClose={() => setEditingLot(null)} size="md" className="rcfg-modal"
          footer={<><button className="btn ghost" onClick={() => setEditingLot(null)}>Hủy</button><button className="btn teal" type="submit" form="lot-form">{editingLot === 'new' ? 'Thêm lô QC' : 'Lưu thay đổi'}</button></>}>
          <form id="lot-form" onSubmit={(e) => { e.preventDefault(); submitLot(e.currentTarget); }}>
            {lotErr && <p className="field-error">{lotErr}</p>}
            <div className="grid2">
              <div className="field"><label>Số lô</label><input name="lotNo" placeholder="VD: 1234UE" defaultValue={editingLot !== 'new' ? editingLot.lot_no : ''} autoFocus /></div>
              <div className="field">
                <label>Mức QC</label>
                <select name="level" defaultValue={editingLot !== 'new' ? editingLot.level : 1}>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div className="grid2">
              <div className="field"><label>Mô tả</label><input name="description" placeholder="VD: Acusera Assayed Chemistry Control" defaultValue={editingLot !== 'new' ? editingLot.description : ''} /></div>
              <div className="field"><label>Nhà cung cấp</label><input name="supplier" placeholder="Randox" defaultValue={editingLot !== 'new' ? editingLot.supplier : ''} /></div>
            </div>
            <div className="grid2">
              <DateField id="lot-opened" name="opened" label="Ngày mở" defaultValue={editingLot !== 'new' ? editingLot.opened : ''} />
              <DateField id="lot-exp" name="exp" label="Hạn sử dụng" defaultValue={editingLot !== 'new' ? editingLot.exp : ''} />
            </div>
          </form>
        </Modal>
      )}

      {editingGroup && (
        <Modal title={editingGroup === 'new' ? 'Thêm nhóm lô' : 'Sửa nhóm lô'} onClose={() => setEditingGroup(null)} size={groupLevelCount >= 3 ? 'xl' : groupLevelCount === 2 ? 'lg' : 'md'} className={`rcfg-modal rcfg-group-modal levels-${groupLevelCount >= 3 ? '3plus' : groupLevelCount || 1}`}
          footer={<><button className="btn ghost" onClick={() => setEditingGroup(null)}>Hủy</button><button className="btn teal" type="submit" form="lot-group-form">{editingGroup === 'new' ? 'Thêm nhóm lô' : 'Lưu thay đổi'}</button></>}>
          <form id="lot-group-form" onSubmit={(e) => { e.preventDefault(); submitGroup(e.currentTarget); }}>
            {groupErr && <p className="field-error">{groupErr}</p>}
            <label className="lot-group-picker-label">Chọn các lô QC</label>
            <div className="lot-level-picker">
              {[1, 2, 3, 4, 5, 6].map((level) => {
                const levelLots = lots.filter((lot) => lot.level === level);
                if (!levelLots.length) return null;
                return <div className="lot-level-col" key={level}>
                  <div className="lot-level-title">Mức {level}</div>
                  {levelLots.map((lot) => {
                    const locked = !!lot.depleted && !groupChecked.has(lot.id);
                    return <label className={lot.depleted ? 'lot-opt-depleted' : ''} title={locked ? 'Lô đã hết QC — không thể chọn' : undefined} key={lot.id}>
                      <input type="checkbox" checked={groupChecked.has(lot.id)} disabled={locked} onChange={(e) => {
                        const next = new Set(groupChecked);
                        if (e.target.checked) next.add(lot.id); else next.delete(lot.id);
                        setGroupChecked(next);
                        suggestGroupName(e.currentTarget, next);
                      }} />
                      <span><b>{lot.lot_no}</b><small>HSD {lot.exp ? vnDate(lot.exp) : '—'}{lot.depleted ? ' · Đã hết' : ''}</small></span>
                    </label>;
                  })}
                </div>;
              })}
              {!lots.length && <EmptyState size="compact">Chưa có lô QC để tạo nhóm.</EmptyState>}
            </div>
            <div className="field"><label>Tên nhóm lô</label><input name="name" placeholder="Tự động: 1102/1103" defaultValue={editingGroup !== 'new' ? editingGroup.name : ''} autoFocus /></div>
          </form>
        </Modal>
      )}
    </>
  );
}



