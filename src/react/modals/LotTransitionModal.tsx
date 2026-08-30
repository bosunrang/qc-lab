import { useRef, useState } from 'react';
import { closeModal } from '../dialogs/modal-store';
import { getKernel } from '../state/kernel';
import { syncTargetRange } from '../bridge/manageBridge';
import { DateField } from '../components/DateField';

type LotOption = string;
type TargetRow = { testId: string; name: string; unit: string; mean: string; low: string; high: string; sd: string; assigned: boolean };
type TargetsModel = { kind: 'hint'; message: string } | { kind: 'rows'; lotNo: string; rows: TargetRow[] };

export type LotTransitionModel = {
  id: string;
  panels: { id: string; label: string }[];
  panelId: string;
  fromLotId: string; fromValue: string; fromOptions: LotOption[];
  toLotId: string; toValue: string; toOptions: LotOption[];
  startDate: string;
  status: string;
};

/* Combobox lô cũ/lô mới: input tự do (không controlled — người dùng gõ tự
   do, khớp mờ qua lotTransitionChoiceMatch), datalist chỉ tính MỘT LẦN lúc
   mở modal (giống bản classic). data-lot-id trên chính input là nơi lưu ID
   đã khớp — cùng quy ước 'this'-bound classic để saveLotTransitionV2()
   (không đổi) đọc lại đúng qua lotTransitionSelectedId(). onResolve báo lên
   cha để tính lại bảng Mean/SD, không điều khiển giá trị hiển thị của input. */
function LotComboInput({ inputId, initialValue, initialLotId, options, onResolve }: { inputId: string; initialValue: string; initialLotId: string; options: LotOption[]; onResolve: (lotId: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const resolve = (commit: boolean) => {
    const el = ref.current; if (!el) return;
    const lot = getKernel().manage.lotTransitionChoiceMatch(el.value, el.dataset.lotId || '');
    el.dataset.lotId = (lot && lot.id) || '';
    if (commit && lot) el.value = getKernel().manage.lotTransitionChoiceLabel(lot);
    onResolve((lot && lot.id) || '');
  };
  return (
    <>
      <input ref={ref} id={inputId} list={`${inputId}List`} autoComplete="off" role="combobox" aria-autocomplete="list" placeholder="Gõ số lô hoặc chọn danh sách" defaultValue={initialValue} data-lot-id={initialLotId} onInput={() => resolve(false)} onChange={() => resolve(true)} />
      <datalist id={`${inputId}List`}>{options.map(label => <option value={label} key={label} />)}</datalist>
    </>
  );
}

export function LotTransitionModal({ id, panels, panelId: initialPanelId, fromLotId: initialFromLotId, fromValue, fromOptions, toLotId: initialToLotId, toValue, toOptions, startDate, status }: LotTransitionModel) {
  const [panelId, setPanelId] = useState(initialPanelId);
  const [fromLotId, setFromLotId] = useState(initialFromLotId);
  const [toLotId, setToLotId] = useState(initialToLotId);
  const [searchQuery, setSearchQuery] = useState('');

  const targets = getKernel().manage.lotTransitionTargetsModel(panelId, fromLotId, toLotId) as TargetsModel;
  const q = getKernel().pres.normalizeSearchText(searchQuery);
  const visibleRows = targets.kind === 'rows' ? targets.rows.filter(r => !q || getKernel().pres.normalizeSearchText(r.name).includes(q)) : [];

  return (
    <div className="modal rcfg-modal lot-trans-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h">
        <div><h3 id="modalTitle">{id ? 'Sửa hồ sơ chuyển lô' : 'Thêm hồ sơ chuyển lô'}</h3></div>
        <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={closeModal}>✕</button>
      </div>
      <div className="modal-b">
        <div className="lot-trans-row3">
          <div><label>Panel QC áp dụng</label>
            <select id="cfgTransPanel" value={panelId} onChange={e => setPanelId(e.target.value)}>
              <option value="">— Chọn Panel QC —</option>
              {panels.map(p => <option value={p.id} key={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div><label>Lô cũ</label><LotComboInput inputId="cfgTransFrom" initialValue={fromValue} initialLotId={initialFromLotId} options={fromOptions} onResolve={setFromLotId} /></div>
          <div><label>Lô mới</label><LotComboInput inputId="cfgTransTo" initialValue={toValue} initialLotId={initialToLotId} options={toOptions} onResolve={setToLotId} /></div>
        </div>
        <div className="lot-trans-row2">
          <div><label>Ngày bắt đầu (dd/mm/yyyy)</label><DateField id="cfgTransStart" value={startDate} /></div>
          <div><label>Trạng thái</label>
            <select id="cfgTransStatus" defaultValue={status === 'completed' ? 'active' : status}>
              <option value="planned">Dự kiến</option>
              <option value="active">Đang chạy song song</option>
              <option value="accepted">Chấp nhận lô mới</option>
              <option value="rejected">Không chấp nhận</option>
            </select>
          </div>
        </div>
        <div id="cfgTransTargets" key={`${panelId}:${fromLotId}:${toLotId}`}>
          {targets.kind === 'hint' ? <div className="hint flow-section">{targets.message}</div> : (
            <>
              <div className="lot-trans-target-head-row">
                <label>Mean/SD cho lô mới {targets.lotNo}</label>
                <input type="search" className="lot-trans-target-search" placeholder="Tìm xét nghiệm..." onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <div className="target-table lot-trans-target-table">
                <div className="target-head"><span></span><span>Xét nghiệm</span><span>Trung bình mục tiêu</span><span>Giới hạn dưới</span><span>Giới hạn trên</span><span>Độ lệch chuẩn</span><span>Trạng thái</span></div>
                {visibleRows.map(row => (
                  <div className="target-row" data-test={row.testId} key={row.testId}>
                    <label className="lot-assay-check"><input type="checkbox" checked disabled readOnly /><span></span></label>
                    <div className="lot-assay-name"><b>{row.name}</b><small>{row.unit || 'Chưa có đơn vị'}</small></div>
                    <input className="tm-mean" type="number" step="any" defaultValue={row.mean} placeholder="Trung bình" onChange={e => syncTargetRange(e.currentTarget, 'target')} />
                    <input className="tm-low" type="number" step="any" defaultValue={row.low} placeholder="Giới hạn dưới" onChange={e => syncTargetRange(e.currentTarget, 'limits')} />
                    <input className="tm-high" type="number" step="any" defaultValue={row.high} placeholder="Giới hạn trên" onChange={e => syncTargetRange(e.currentTarget, 'limits')} />
                    <input className="tm-sd" type="number" step="any" defaultValue={row.sd} placeholder="Độ lệch chuẩn" onChange={e => syncTargetRange(e.currentTarget, 'target')} />
                    <span>{row.assigned ? <b className="tag ok">Đã nhập</b> : <b className="tag none">Chưa nhập</b>}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="modal-f">
        <button type="button" className="btn ghost" onClick={closeModal}>Hủy</button>
        <button type="button" className="btn teal" onClick={() => getKernel().manage.saveLotTransitionV2(id)}>{id ? 'Lưu thay đổi' : 'Thêm hồ sơ chuyển lô'}</button>
      </div>
    </div>
  );
}
