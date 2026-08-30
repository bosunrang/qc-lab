import { closeModal } from '../dialogs/modal-store';
import { getKernel } from '../state/kernel';

type InstrumentOption = { id: string; selected: boolean; section: string; label: string };
type TeaOption = { value: string; label: string };
type RuleRow = { id: string; action: string; scope: string };

export type AssayModel = {
  id: string;
  title: string;
  name: string;
  teaOptions: TeaOption[];
  teaRefKey: string;
  teaSource: string;
  unit: string;
  instruments: InstrumentOption[];
  section: string;
  method: string;
  decimalValue: string;
  reagent: string;
  tea: string;
  ruleRows: RuleRow[];
  hasRuleOverrides: boolean;
  cusumOn: boolean;
  cusumK: string;
  cusumH: string;
  closed: boolean;
};

/* Modal cuối cùng của Giai đoạn 3 chuyển sang 'react' — Manage's xét nghiệm
   (openConfigAssay), form lớn nhất trong toàn bộ migration. saveConfigAssay()
   GIỮ NGUYÊN không đổi — đọc mọi trường qua document.getElementById(...) như
   InstrumentModal/LotModal, nên component chỉ cần render đúng các id đó.
   Hai hiệu ứng tự động điền vẫn dùng ĐÚNG hàm classic cũ (không port lại
   logic): configAssaySuggestionInput(value) tra cứu TEa theo tên gõ vào rồi
   tự ghi đè #cfgAssayTeaRefKey/#cfgAssayTeaSource/#cfgAssayUnit/#cfgAssayTea
   (không đụng #cfgAssaySection — Khoa/Khu vực vẫn theo máy);
   configAssayInstrumentChanged (this-bound, đọc this.selectedOptions[0])
   tự điền #cfgAssaySection theo option đã chọn — cùng mẫu `this`-bound đã
   dùng cho syncTargetRange/toggleTargetRow. */
export function AssayModal({ id, title, name, teaOptions, teaRefKey, teaSource, unit, instruments, section, method, decimalValue, reagent, tea, ruleRows, hasRuleOverrides, cusumOn, cusumK, cusumH, closed }: AssayModel) {
  return (
    <div className="modal rcfg-modal rcfg-assay-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h">
        <div><h3 id="modalTitle">{title}</h3></div>
        <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={closeModal}>✕</button>
      </div>
      <div className="modal-b">
        <div className="assay-form-heading"><h4>Thông tin xét nghiệm</h4></div>
        <div className="assay-main-grid">
          <div>
            <label>Tên xét nghiệm <span className="req">*</span></label>
            <input id="cfgAssayName" list="cfgAssayTeaSuggestions" autoComplete="off" defaultValue={name} placeholder="Gõ tên, viết tắt hoặc bí danh" onChange={e => getKernel().manage.configAssaySuggestionInput(e.target.value)} />
            <datalist id="cfgAssayTeaSuggestions">{teaOptions.map(o => <option value={o.value} label={o.label} key={o.value} />)}</datalist>
            <input id="cfgAssayTeaRefKey" type="hidden" defaultValue={teaRefKey} />
            <input id="cfgAssayTeaSource" type="hidden" defaultValue={teaSource} />
          </div>
          <div><label>Đơn vị</label><input id="cfgAssayUnit" aria-label="Đơn vị" defaultValue={unit} /></div>
          <div>
            <label>Máy xét nghiệm <span className="req">*</span></label>
            <select id="cfgAssayInstrument" aria-label="Máy xét nghiệm" defaultValue={instruments.find(i => i.selected)?.id || ''} onChange={e => getKernel().manage.configAssayInstrumentChanged.call(e.currentTarget)}>
              {instruments.map(i => <option value={i.id} data-section={i.section} key={i.id}>{i.label}</option>)}
            </select>
          </div>
          <div><label>Khoa / Khu vực</label><input id="cfgAssaySection" defaultValue={section} placeholder="VD: Điện giải" /></div>
        </div>
        <div className="assay-detail-grid">
          <div><label>Phương pháp</label><input id="cfgAssayMethod" aria-label="Phương pháp" defaultValue={method} /></div>
          <div><label>Số thập phân</label>
            <select id="cfgAssayDecimals" aria-label="Số chữ số thập phân" defaultValue={decimalValue}>
              {[0, 1, 2, 3, 4, 5, 6].map(v => <option value={v} key={v}>{v}</option>)}
            </select>
          </div>
          <div><label>Hóa chất</label><input id="cfgAssayReagent" aria-label="Hóa chất" defaultValue={reagent} /></div>
          <div><label>TEa %</label><input id="cfgAssayTea" aria-label="TEa %" type="number" step="any" defaultValue={tea} /></div>
        </div>
        <details className="assay-advanced" open={hasRuleOverrides}>
          <summary><span><b>Cấu hình Westgard nâng cao</b><small>Mặc định dùng cấu hình chung của hệ thống</small></span></summary>
          <div className="assay-advanced-body">
            <div className="assay-rule-head" aria-hidden="true"><span>Luật</span><span>Hành động</span><span>Phạm vi áp dụng</span></div>
            <div className="assay-rule-grid">
              {ruleRows.map(row => (
                <div className="assay-rule-row" key={row.id}>
                  <b>{row.id}</b>
                  <select className="cfg-assay-rule" data-rule={row.id} aria-label={`Hành động ${row.id}`} defaultValue={row.action}>
                    <option value="">Theo cấu hình chung</option>
                    <option value="inactive">Không dùng</option>
                    <option value="alert">Cảnh báo</option>
                    <option value="reject">Loại bỏ</option>
                  </select>
                  <select className="cfg-assay-scope" data-rule={row.id} aria-label={`Phạm vi ${row.id}`} defaultValue={row.scope}>
                    <option value="">Phạm vi SOP khuyến nghị</option>
                    <option value="within">Chỉ trong từng mức</option>
                    <option value="across">Chỉ chéo mức/lần chạy</option>
                    <option value="both">Cả hai phạm vi</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </details>
        <details className="assay-advanced" open={cusumOn}>
          <summary><span><b>Giám sát xu hướng CUSUM</b><small>Tùy chọn hỗ trợ phát hiện trôi hoặc dịch chuyển kéo dài</small></span></summary>
          <div className="assay-advanced-body">
            <label className="rcfg-check"><input id="cfgAssayCusumOn" type="checkbox" defaultChecked={cusumOn} /> Bật biểu đồ CUSUM cho xét nghiệm này</label>
            <div className="assay-cusum-grid">
              <div><label>Ngưỡng tích lũy k (SD)</label><input id="cfgAssayCusumK" aria-label="Ngưỡng tích lũy k (SD)" type="number" step="0.1" min="0.1" defaultValue={cusumK} /></div>
              <div><label>Ngưỡng cảnh báo h (SD)</label><input id="cfgAssayCusumH" aria-label="Ngưỡng cảnh báo h (SD)" type="number" step="0.5" min="0.5" defaultValue={cusumH} /></div>
            </div>
          </div>
        </details>
        <label className="rcfg-check"><input id="cfgAssayClosed" type="checkbox" defaultChecked={closed} /> Ngừng sử dụng xét nghiệm này cho cấu hình QC mới</label>
      </div>
      <div className="modal-f">
        <button type="button" className="btn ghost" onClick={closeModal}>Hủy</button>
        <button type="button" className="btn teal" onClick={() => getKernel().manage.saveConfigAssay(id)}>{id ? 'Lưu thay đổi' : 'Thêm xét nghiệm'}</button>
      </div>
    </div>
  );
}
