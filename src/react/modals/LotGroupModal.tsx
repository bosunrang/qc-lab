import { closeModal } from '../dialogs/modal-store';
import { getKernel } from '../state/kernel';

type GroupLot = { id: string; lotNo: string; expiry: string; selected: boolean; depleted: boolean; locked: boolean; depletedLabel: string };
type GroupColumn = { level: number; lots: GroupLot[] };
export type LotGroupModel = { id: string; levelLayout: string; columns: GroupColumn[]; name: string; note: string };

/* Modal thứ chín của Giai đoạn 3 chuyển sang 'react' — Manage's nhóm lô
   (openConfigGroup). Danh sách lô theo mức KHÔNG cần state React (không có
   logic lọc lại như Panel QC) nên dựng thẳng bằng JSX — checkbox
   uncontrolled (defaultChecked), suggestConfigGroupName() (không đổi, vẫn
   đọc DOM .cfg-group-lot:checked trực tiếp và ghi vào #cfgGroupName) được
   gọi qua onChange bắt ở container cha, thay data-notify-changed cũ. */
export function LotGroupModal({ id, levelLayout, columns, name, note }: LotGroupModel) {
  return (
    <div className={`modal rcfg-modal rcfg-group-modal ${levelLayout}`} role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h">
        <div><h3 id="modalTitle">{id ? 'Sửa nhóm lô' : 'Thêm nhóm lô'}</h3></div>
        <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => closeModal()}>✕</button>
      </div>
      <div className="modal-b">
        <label>Chọn các lô QC</label>
        <div className="lot-level-picker" onChange={() => getKernel().manage.suggestConfigGroupName()}>
          {columns.map(column => (
            <div className="lot-level-col" key={column.level}>
              <div className="lot-level-title">Mức {column.level}</div>
              {column.lots.map(lot => (
                <label className={lot.depleted ? 'lot-opt-depleted' : ''} title={lot.locked ? `Lô ${lot.depletedLabel} — không thể chọn` : undefined} key={lot.id}>
                  <input className="cfg-group-lot" type="checkbox" value={lot.id} defaultChecked={lot.selected} disabled={lot.locked} />
                  <span><b>{lot.lotNo}</b><small>HSD {lot.expiry}{lot.depleted ? ` · ${lot.depletedLabel}` : ''}</small></span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <label>Tên nhóm lô</label>
        <input id="cfgGroupName" defaultValue={name} placeholder="Tự động: 1102/1103" />
        <label>Ghi chú</label>
        <textarea id="cfgGroupNote" defaultValue={note} />
      </div>
      <div className="modal-f">
        <button type="button" className="btn ghost" onClick={() => closeModal()}>Hủy</button>
        <button type="button" className="btn teal" onClick={() => getKernel().manage.saveConfigGroup(id)}>{id ? 'Lưu thay đổi' : 'Thêm nhóm lô'}</button>
      </div>
    </div>
  );
}
