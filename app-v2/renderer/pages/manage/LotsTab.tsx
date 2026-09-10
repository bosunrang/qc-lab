// Tab "LotsTab" của trang Cấu hình chung — tách khỏi ManagePage.tsx
// (2026-09-03) khi file đó lên 1121 dòng gồm 6 tab. Phần dùng chung ở ./shared.
import { useState } from 'react';
import { useManageStore } from '../../store/manage-store';
import { useWestgardStore } from '../../store/westgard-store';
import { Modal } from '../../components/Modal';
import { DateField } from '../../components/DateField';
import { RowActionButton } from '../../components/RowActionButton';
import { confirmDialog, reauthDialog, infoDialog } from '../../state/dialog-store';
import { vnDate } from '../../lib/format';
import { EmptyState, lotStatus } from './shared';
import type { QcLot, LotGroup } from '../../../shared/qc-api';

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
  /** Tick/bỏ tick lô → ghi lại "Tên nhóm lô" bằng các số lô đang chọn, nối
   * bằng "/" (port `suggestConfigGroupName()` app cũ: ghi ĐÈ, kể cả khi
   * người dùng đã tự gõ tên — đúng hành vi bản cũ). Ghi thẳng vào DOM của
   * form vì ô tên để uncontrolled, giống bản cũ. */
  function suggestGroupName(box: HTMLInputElement, checked: Set<string>) {
    const form = box.form;
    if (!form) return;
    const nameEl = form.elements.namedItem('name') as HTMLInputElement | null;
    if (!nameEl) return;
    nameEl.value = lots.filter((lot) => checked.has(lot.id)).map((lot) => lot.lot_no).filter(Boolean).join('/');
  }

  const { lots: allLots, lotGroups: allGroups, lotTransitions, saveLot, saveLotGroup, removeLot, removeLotGroup, stopLotGroup, activateLotGroup } = useManageStore();
  /** Lô đã hết dùng chuyển tiếp SANG lô nào — port `transitionToNo()` app
   * cũ: tra hồ sơ chuyển tiếp đã 'accepted' có `from_lot_id` đúng lô này. */
  const transitionToNo = (lotId: string): string | undefined => {
    const accepted = lotTransitions.find((tr) => tr.from_lot_id === lotId && tr.status === 'accepted');
    return accepted ? allLots.find((lot) => lot.id === accepted.to_lot_id)?.lot_no : undefined;
  };
  const { summaries } = useWestgardStore();
  const allLevels = summaries.flatMap((summary) => summary.levels);
  const [query, setQuery] = useState('');
  const [editingLot, setEditingLot] = useState<QcLot | 'new' | null>(null);
  const [editingGroup, setEditingGroup] = useState<LotGroup | 'new' | null>(null);
  const [lotErr, setLotErr] = useState<string | null>(null);
  const [groupErr, setGroupErr] = useState<string | null>(null);
  const [groupChecked, setGroupChecked] = useState<Set<string>>(new Set());

  // Lọc theo cùng bộ field mà `manageMatch()` app cũ dùng cho tab này (số
  // lô, mô tả, nhà cung cấp, chương trình, tên nhóm lô, mức, hạn dùng).
  const q = query.trim().toLowerCase();
  const groupNameOfLot = (id: string) => allGroups.find((g) => g.lotIds.includes(id))?.name || '';
  const match = (values: unknown[]) => !q || values.some((v) => String(v ?? '').toLowerCase().includes(q));
  const lots = allLots.filter((l) => match([l.lot_no, l.description, l.supplier, l.program, groupNameOfLot(l.id), l.level, l.exp]));
  // App cũ đặt class `levels-1|2|3plus` lên chính modal nhóm lô (bề rộng +
  // số cột lưới chọn lô thay đổi theo SỐ MỨC đang có lô), không dùng
  // auto-fit — xem `.rcfg-group-modal.levels-*` trong professional-config.css.
  const groupLevelCount = new Set(allLots.map((l) => l.level)).size;
  const lotGroups = allGroups.filter((g) => match([g.name, g.note, ...g.lotIds.map((id) => allLots.find((l) => l.id === id)?.lot_no)]));

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
   * khác (cùng danh sách thao tác nhạy cảm của app cũ). */
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
    // Đổi số lô là VIẾT LẠI HÀNG LOẠT bản ghi lịch sử (nhãn lô nằm trên từng
    // điểm QC), không phải sửa một ô cấu hình — người dùng phải thấy con số
    // TRƯỚC khi làm, không chỉ đọc được trong nhật ký SAU khi làm. Hỏi trước
    // khi gọi `saveLot` nên bấm Hủy là không còn dấu vết gì. Port đúng cách
    // `saveConfigLot()` app cũ hỏi.
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
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo số lô, nhóm lô QC..." />
        </div>
      </div>
      <div className="lot-config-grid">
      <div className="panel rcfg-list lot-config-left">
        <div className="rcfg-panel-h"><h3>Lô QC</h3><button className="btn teal sm" onClick={() => { setLotErr(null); setEditingLot('new'); }}>Thêm lô QC</button></div>
        {lots.length ? <table className="data-table lot-table">
          <thead><tr><th>Số lô</th><th>Mức</th><th>Hạn dùng</th><th>Trạng thái</th><th className="num">Gán</th><th>Thao tác</th></tr></thead>
          <tbody>
            {lots.map((l) => (
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
      </div>

      <div className="panel rcfg-list lot-config-right">
        <div className="rcfg-panel-h"><h3>Nhóm lô QC</h3><button className="btn teal sm" onClick={openNewGroup}>Thêm nhóm lô</button></div>
        {lotGroups.length ? <div className="lot-group-list">{[...lotGroups].sort((a, b) => groupSortPriority(a) - groupSortPriority(b)).map((g) => {
          const groupLots = lots.filter((lot) => g.lotIds.includes(lot.id));
          // `archived` (nhóm "Đã lưu trữ" do CHẤP NHẬN chuyển tiếp lô tạo ra,
          // `active=0`) KHÁC hẳn "Đã dừng" (`status='stopped'`, tự tay bấm
          // Dừng, `active` vẫn 1) — port `lotGroupStatus()`/`lotGroupToggleAction()`
          // app cũ: nhóm lưu trữ không có nút Kích hoạt/Dừng (lô bên trong đã
          // hết dùng, kích hoạt lại vô nghĩa). Bản trước gộp cả hai vào chung
          // "Đã dừng" + luôn hiện nút Kích hoạt — người dùng chỉ ảnh app cũ
          // cho thấy khác hẳn.
          //
          // "Đang hoạt động" KHÔNG phải literal `status==='active'` — app cũ
          // (`qcLotGroupOperational()`/`lotGroupInUse()`) không bao giờ lưu
          // giá trị đó, nó là trạng thái SUY từ `g.inUse` (có lô nào của
          // nhóm đang gán Mean/SD cho xét nghiệm nào không, tính ở main).
          // Bản trước gán cứng `status:'active'` lúc tạo nhóm mới, nên một
          // nhóm VỪA TẠO — CHƯA gán lô cho xét nghiệm nào cả — vẫn hiện
          // "Đang hoạt động" và có nút "Dừng", sai mô hình "hoạt động suy từ
          // đang-dùng-thật" của app cũ.
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
      </div>
      </div>

      {editingLot && (
        <Modal title={editingLot === 'new' ? 'Thêm lô QC' : 'Sửa thông tin lô QC'} onClose={() => setEditingLot(null)} className="rcfg-modal lot-modal"
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
        <Modal title={editingGroup === 'new' ? 'Thêm nhóm lô' : 'Sửa nhóm lô'} onClose={() => setEditingGroup(null)} className={`rcfg-modal rcfg-group-modal levels-${groupLevelCount >= 3 ? '3plus' : groupLevelCount || 1}`}
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
                    // Lô đã hết dùng bị KHOÁ khỏi việc CHỌN THÊM vào nhóm khác
                    // — port `locked = l.depleted && !selected` app cũ: vẫn
                    // cho GIỮ LẠI nếu nó đã là thành viên hiện tại (sửa nhóm
                    // cũ), chỉ chặn thêm mới một lô đã hết dùng.
                    const locked = !!lot.depleted && !groupChecked.has(lot.id);
                    return <label className={lot.depleted ? 'lot-opt-depleted' : ''} title={locked ? 'Lô đã hết QC — không thể chọn' : undefined} key={lot.id}>
                      <input className="cfg-group-lot" type="checkbox" checked={groupChecked.has(lot.id)} disabled={locked} onChange={(e) => {
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
              {!lots.length && <div className="empty-state">Chưa có lô QC để tạo nhóm.</div>}
            </div>
            <div className="field"><label>Tên nhóm lô</label><input name="name" placeholder="Tự động: 1102/1103" defaultValue={editingGroup !== 'new' ? editingGroup.name : ''} autoFocus /></div>
          </form>
        </Modal>
      )}
    </>
  );
}

// ---------------- Mean/SD ----------------
