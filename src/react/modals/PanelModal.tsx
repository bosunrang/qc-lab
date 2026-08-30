import { useState } from 'react';
import { closeModal } from '../dialogs/modal-store';
import { getKernel } from '../state/kernel';

type PanelTest = { id: string; name: string; instrument: string; unit: string; instrumentId: string };
export type PanelModel = {
  id: string; name: string;
  instruments: { id: string; label: string }[];
  instrumentId: string;
  allTests: PanelTest[];
  testIds: string[];
  note: string; active: boolean;
};

/* Modal thứ tám của Giai đoạn 3 chuyển sang 'react' — Manage's Panel QC
   (openConfigPanel). Khác Instrument/Lot: danh sách xét nghiệm phụ thuộc máy
   đang chọn — bản classic dựng lại chuỗi HTML mỗi lần đổi máy
   (renderConfigPanelTests(), đã xóa); bản React chỉ lọc lại allTests theo
   instrumentId (state cục bộ) và để React tự mount/unmount checkbox theo
   danh sách mới. defaultChecked chỉ áp dụng cho instrumentId BAN ĐẦU — đổi
   sang máy khác luôn hiện danh sách trắng (chưa chọn gì), đúng hành vi cũ:
   renderConfigPanelTests() không bao giờ truyền "selected" khi máy đổi. */
export function PanelModal({ id, name, instruments, instrumentId: initialInstrumentId, allTests, testIds, note, active }: PanelModel) {
  const [instrumentId, setInstrumentId] = useState(initialInstrumentId);
  const visibleTests = allTests.filter(t => t.instrumentId === instrumentId);
  return (
    <div className="modal rcfg-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h">
        <div><h3 id="modalTitle">{id ? 'Sửa Panel QC' : 'Thêm Panel QC'}</h3></div>
        <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => closeModal()}>✕</button>
      </div>
      <div className="modal-b">
        <div className="grid2">
          <div><label>Tên Panel QC</label><input id="cfgPanelName" defaultValue={name} placeholder="VD: Sinh hóa AU5800" /></div>
          <div><label>Máy xét nghiệm</label>
            <select id="cfgPanelInstrument" value={instrumentId} onChange={e => setInstrumentId(e.target.value)}>
              {instruments.map(i => <option value={i.id} key={i.id}>{i.label}</option>)}
            </select>
          </div>
        </div>
        <label>Chọn xét nghiệm trong panel</label>
        <div id="cfgPanelTests" className="group-lot-picker assay-group-picker">
          {visibleTests.length ? visibleTests.map(t => (
            <label key={t.id}>
              <input className="cfg-panel-test" type="checkbox" value={t.id} defaultChecked={instrumentId === initialInstrumentId && testIds.includes(t.id)} />
              <span><b>{t.name}</b><small>{t.instrument} · {t.unit || 'Chưa có đơn vị'}</small></span>
            </label>
          )) : <div className="empty cfg-panel-empty">Máy này chưa có xét nghiệm.</div>}
        </div>
        <label>Ghi chú</label>
        <textarea id="cfgPanelNote" defaultValue={note} />
        <label className="rcfg-check"><input id="cfgPanelActive" type="checkbox" defaultChecked={active} /> Panel đang sử dụng</label>
      </div>
      <div className="modal-f">
        <button type="button" className="btn ghost" onClick={() => closeModal()}>Hủy</button>
        <button type="button" className="btn teal" onClick={() => getKernel().manage.saveConfigPanel(id)}>{id ? 'Lưu thay đổi' : 'Thêm Panel QC'}</button>
      </div>
    </div>
  );
}
