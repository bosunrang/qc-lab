import { useState } from 'react';
import { closeModal } from '../dialogs/modal-store';
import { getKernel, useAppStore } from '../state/kernel';

type PickerItem = { id: string; label: string; unit: string; rowCount: number; selected: boolean };

/* Modal thứ ba của Giai đoạn 3 chuyển sang 'react' — Reagent's "Chọn phép so
   sánh" (reagent:find-existing). Khác ArchiveLogModal: có ô tìm kiếm sống
   (useState cục bộ, không cần debounce như bản classic vì lọc lại mảng
   trong React rẻ hơn nhiều so với dựng lại chuỗi HTML mỗi phím — bản classic
   phải debounce vì scheduleSearchRender() gọi openModal() lại từ đầu, tốn
   hơn nhiều so với chỉ setState một mảng). rcPickerItems()/rcPick()/
   rcDeleteFromModal() đều đọc qua kernel.reagent — không có gì mới. */
export function ReagentPickerModal() {
  useAppStore();
  const [query, setQuery] = useState('');
  const canWrite = getKernel().pres.canWrite();
  const items: PickerItem[] = getKernel().reagent.rcPickerItems(query);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h">
        <h3 id="modalTitle">Chọn phép so sánh</h3>
        <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => closeModal()}>✕</button>
      </div>
      <div className="modal-b">
        <input placeholder="Tìm phép so sánh..." value={query} onChange={e => setQuery(e.target.value)} autoFocus />
        <div className="flow-control">
          {items.length ? items.map(item => (
            <div className={`mrow ${item.selected ? 'on' : ''}`} key={item.id}>
              <span><b>{item.label}</b><div className="hint flow-tight">{item.unit} {item.rowCount ? `· ${item.rowCount} dòng` : ''}</div></span>
              <span className="acts">
                <button type="button" className={`btn ${item.selected ? 'teal' : 'ghost'} sm`} onClick={() => getKernel().reagent.rcPick(item.id)}>{item.selected ? 'Đang chọn' : 'Chọn'}</button>
                {canWrite ? <button type="button" className="x" title="Xóa" onClick={() => getKernel().reagent.rcDeleteFromModal(item.id)}>✕</button> : null}
              </span>
            </div>
          )) : <div className="empty">Không có phép so sánh phù hợp.</div>}
        </div>
      </div>
      <div className="modal-f">
        <button type="button" className="btn ghost" onClick={() => closeModal()}>Đóng</button>
      </div>
    </div>
  );
}
