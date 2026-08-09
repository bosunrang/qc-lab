const labels = {
  check: { ok: 'Đạt', abnormal: 'Bất thường', na: 'Không áp dụng', 'not-needed': 'Không cần', 'checked-ok': 'Đạt', 'checked-abnormal': 'Bất thường' },
  containment: { held: 'Đã dừng/giữ kết quả liên quan', none: 'Không có kết quả bệnh nhân liên quan' },
  patient: { none: 'Không có mẫu/kết quả bị ảnh hưởng', held: 'Đã giữ kết quả để rà soát', affected: 'Có kết quả cần xử lý lại' },
  cause: { qc: 'Vật liệu QC', operator: 'Thao tác', instrument: 'Thiết bị', reagent: 'Hóa chất / calibrator', calibration: 'Hiệu chuẩn', environment: 'Môi trường', unknown: 'Chưa xác định' },
  source: { iqc: 'Nội kiểm IQC', eqa: 'Ngoại kiểm EQA', instrument: 'Cảnh báo thiết bị', clinical: 'Phản hồi lâm sàng', audit: 'Đánh giá / audit', other: 'Nguồn khác' },
  phase: { pre: 'Trước xét nghiệm', exam: 'Trong xét nghiệm', post: 'Sau xét nghiệm' },
  risk: { low: 'Thấp', medium: 'Trung bình', high: 'Cao', critical: 'Nghiêm trọng' },
  release: { released: 'Đã cho phép hoạt động/trả kết quả trở lại' },
} as const;

export const nceActionLabels = Object.freeze({
  protocolChecks: Object.freeze([
    ['qcMaterialStatus', 'Vật liệu QC'], ['instrumentStatus', 'Máy phân tích'],
    ['reagentStatus', 'Hóa chất / calibrator'], ['calibrationStatus', 'Hiệu chuẩn'],
    ['lotToLotStatus', 'So sánh lot-to-lot'],
  ] as const),
  riskScale: Object.freeze([1, 2, 3, 4, 5]),
  actionLabels: Object.freeze(labels),
});

export type NceActionLabels = typeof nceActionLabels;
