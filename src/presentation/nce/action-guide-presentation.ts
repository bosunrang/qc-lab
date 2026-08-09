export function createActionGuidePresentation() {
  const steps = Object.freeze([
    { phase: 'Kiểm soát', title: 'Ghi nhận và kiểm soát tức thời', text: 'Dừng hoặc giữ kết quả liên quan, mở mã NCE và phân công người phụ trách.' },
    { phase: 'Phân tầng', title: 'Đánh giá nguy cơ', text: 'Chấm S–O–D, tính RPN và ghi căn cứ phân loại theo SOP của đơn vị.' },
    { phase: 'Điều tra', title: 'Điều tra nguyên nhân', text: 'Kiểm tra QC, thiết bị, hóa chất/calibrator, hiệu chuẩn và lot-to-lot.' },
    { phase: 'Phân tích', title: 'Xác định nguyên nhân gốc', text: 'Ghi bằng chứng; không đồng nhất nguyên nhân với thao tác xử lý tức thời.' },
    { phase: 'Khắc phục', title: 'Thực hiện hành động khắc phục', text: 'Loại bỏ nguyên nhân và giảm khả năng tái diễn.' },
    { phase: 'Xác nhận', title: 'Xác nhận bằng QC', text: 'Chỉ cho phép hoạt động/trả kết quả trở lại sau khi QC chạy lại được chấp nhận.' },
    { phase: 'An toàn người bệnh', title: 'Đánh giá ảnh hưởng bệnh nhân', text: 'Khoanh vùng từ lần QC đạt cuối cùng và xử lý kết quả liên quan.' },
    { phase: 'Khép vòng', title: 'Đánh giá hiệu lực và phê duyệt', text: 'Ghi bằng chứng, đánh giá RPN còn lại và phê duyệt độc lập trước khi khép vòng.' },
  ]);
  return Object.freeze({ steps });
}

export type ActionGuidePresentation = ReturnType<typeof createActionGuidePresentation>;
