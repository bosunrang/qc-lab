// Đăng ký refetch khi main báo `store:changed` đúng phạm vi (bảng nào vừa
// đổi) — dùng ở mọi store thay cho việc chỉ nạp một lần khi mở trang.
// `tables` là danh sách
// bảng trang này quan tâm; `testId` (tuỳ chọn) lọc thêm theo xét nghiệm đang
// mở — bỏ qua (undefined) nếu trang không có khái niệm "đang xem 1 xét
// nghiệm", hoặc nếu trang cần biết MỌI thay đổi của bảng đó bất kể testId
// (ví dụ Dashboard/Westgard tổng quan).
import { useEffect, useRef } from 'react';

export function useStoreInvalidation(tables: string[], testId: string | undefined, onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const tablesKey = tables.join(',');

  useEffect(() => {
    const watched = tablesKey.split(',').filter(Boolean);
    return window.qcApi.onStoreChanged((payload) => {
      if (!payload.tables.some((t) => watched.includes(t))) return;
      if (testId && payload.testIds.length && !payload.testIds.includes(testId)) return;
      onChangeRef.current();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesKey, testId]);
}

