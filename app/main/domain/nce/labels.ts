// Nhãn tiếng Việt cho các mã của hồ sơ NCE. Cột CSDL lưu MÃ; mọi nơi hiện cho
// người dùng (trang Khắc phục sự cố, phụ lục báo cáo PDF/Excel/CSV) đọc qua
// đây để không in mã máy ra văn bản chính thức.
export { NCE_STATUS_LABEL } from './state';
export { NCE_CHECK_LABELS } from './checklist';
export { NCE_ACTION_KIND_LABEL } from './actions';
export { NCE_PATIENT_OUTCOME_LABEL } from './patient-impact';
export { NCE_MEAN_RESET_LABEL, NCE_TECHNICAL_ERROR_LABEL, NCE_TECHNICAL_SIGNAL_LABEL } from './technical-assessment';

export const NCE_SOURCE_LABEL: Readonly<Record<string, string>> = {
  iqc: 'Nội kiểm (IQC)', eqa: 'Ngoại kiểm (EQA)', instrument: 'Thiết bị', reagent: 'Hoá chất / vật tư', calibration: 'Hiệu chuẩn', other: 'Nguồn khác',
};

export const NCE_PHASE_LABEL: Readonly<Record<string, string>> = { pre: 'Trước xét nghiệm', exam: 'Trong xét nghiệm', post: 'Sau xét nghiệm' };

export const NCE_TIER_LABEL: Readonly<Record<string, string>> = { low: 'Xử lý nhanh', capa: 'CAPA đầy đủ', '': 'Chưa phân tầng' };

export const NCE_RISK_LEVEL_LABEL: Readonly<Record<string, string>> = { low: 'Thấp', medium: 'Trung bình', high: 'Cao', critical: 'Nghiêm trọng', '': '—' };

export const NCE_CAUSE_STATUS_LABEL: Readonly<Record<string, string>> = { identified: 'Đã xác định', suspected: 'Nghi ngờ', undetermined: 'Chưa xác định', '': '—' };

export const NCE_CAUSE_CATEGORY_LABEL: Readonly<Record<string, string>> = {
  eqa_administrative: 'Lỗi hành chính', eqa_technical: 'Lỗi kỹ thuật', eqa_program: 'Vấn đề chương trình / mẫu ngoại kiểm',
  qc_material: 'Vật liệu QC', operator: 'Thao tác', instrument: 'Thiết bị', reagent: 'Hoá chất / calibrator', calibration: 'Hiệu chuẩn',
  environment: 'Môi trường', method: 'Phương pháp', sample: 'Mẫu', information_system: 'Hệ thống thông tin / LIS', other: 'Khác', '': '—',
};

export const NCE_EFFECTIVENESS_RESULT_LABEL: Readonly<Record<string, string>> = { effective: 'Hiệu quả', ineffective: 'Không hiệu quả', extend: 'Cần theo dõi thêm' };

export const NCE_DECISION_LABEL: Readonly<Record<string, string>> = {
  release: 'Cho phép hoạt động trở lại', technical_assessment: 'Xác minh kỹ thuật IQC', patient_impact: 'Đánh giá ảnh hưởng bệnh nhân', effectiveness: 'Đánh giá hiệu lực',
  submit: 'Nộp duyệt', approve: 'Duyệt đóng hồ sơ', return: 'Trả lại', cancel: 'Huỷ hồ sơ',
};
