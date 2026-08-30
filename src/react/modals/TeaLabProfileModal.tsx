import { closeModal } from '../dialogs/modal-store';
import { getKernel } from '../state/kernel';
import { DateField } from '../components/DateField';

export type TeaLabProfileModel = {
  refKey: string;
  hasProfile: boolean;
  title: string;
  labValue: number | string;
  sourceOptions: { value: string; label: string }[];
  source: string;
  referenceValue: string;
  reasonValue: string;
  effective: string;
  nextReview: string;
  prepared: string;
  approved: string;
  approvedDate: string;
};

export function TeaLabProfileModal({ refKey, hasProfile, title, labValue, sourceOptions, source, referenceValue, reasonValue, effective, nextReview, prepared, approved, approvedDate }: TeaLabProfileModel) {
  return (
    <div className="modal tea-lab-profile-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h"><h3 id="modalTitle">{title}</h3><button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={closeModal}>✕</button></div>
      <div className="modal-b">
        <div className="grid2">
          <div><label>TEa chuẩn hóa % <span className="req">*</span></label><input id="teaLabValue" type="number" step="any" min="0" aria-label="TEa chuẩn hóa phần trăm" defaultValue={labValue} /></div>
          <div><label>Nguồn chính <span className="req">*</span></label>
            <select id="teaLabSource" aria-label="Nguồn chính của TEa chuẩn hóa" defaultValue={source}>
              <option value="">— Chọn nguồn chính —</option>
              {sourceOptions.map(o => <option value={o.value} key={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div><label>Tài liệu / phiên bản / đường dẫn tham chiếu <span className="req">*</span></label><input id="teaLabReference" aria-label="Tài liệu tham chiếu TEa chuẩn hóa" defaultValue={referenceValue} placeholder="VD: 42 CFR §493.931, hiệu lực 11/07/2024" /></div>
        <div><label>Lý do lựa chọn <span className="req">*</span></label><textarea id="teaLabReason" className="tea-lab-reason" aria-label="Lý do lựa chọn TEa chuẩn hóa" rows={1} placeholder="Nêu lý do chọn nguồn và mức TEa này cho mục đích sử dụng của xét nghiệm..." defaultValue={reasonValue} /></div>
        <div className="tea-lab-meta-grid tea-lab-meta-primary">
          <div><label>Ngày hiệu lực <span className="req">*</span></label><DateField id="teaLabEffectiveDate" value={effective} className="manage-date" ariaLabel="Ngày hiệu lực TEa chuẩn hóa" /></div>
          <div><label>Ngày xem xét lại</label><DateField id="teaLabNextReviewDate" value={nextReview} className="manage-date" ariaLabel="Ngày xem xét lại TEa chuẩn hóa" /></div>
          <div><label>Người xây dựng <span className="req">*</span></label><input id="teaLabPreparedBy" aria-label="Người xây dựng TEa chuẩn hóa" defaultValue={prepared} /></div>
        </div>
        <div className="tea-lab-meta-grid tea-lab-meta-approval">
          <div><label>Người phê duyệt <span className="req">*</span></label><input id="teaLabApprovedBy" aria-label="Người phê duyệt TEa chuẩn hóa" defaultValue={approved} /></div>
          <div><label>Ngày phê duyệt <span className="req">*</span></label><DateField id="teaLabApprovedDate" value={approvedDate} className="manage-date" ariaLabel="Ngày phê duyệt TEa chuẩn hóa" /></div>
        </div>
      </div>
      <div className="modal-f">
        {hasProfile ? <button type="button" className="btn danger" onClick={() => getKernel().manage.teaLabProfileRemove(refKey)}>Xóa TEa chuẩn hóa</button> : null}
        <button type="button" className="btn ghost" onClick={closeModal}>Hủy</button>
        <button type="button" className="btn teal" onClick={() => getKernel().manage.teaLabProfileSave(refKey)}>{hasProfile ? 'Lưu thay đổi' : 'Thêm hồ sơ TEa'}</button>
      </div>
    </div>
  );
}
