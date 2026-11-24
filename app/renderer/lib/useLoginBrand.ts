import { useEffect, useState } from 'react';
import type { LoginBrand } from '../../shared/qc-api';

/** Nhận diện chung cho đăng nhập và màn bắt buộc đổi mật khẩu. Lỗi tải dùng
 * nhận diện mặc định; phản hồi đến sau khi đóng màn không cập nhật state. */
export function useLoginBrand(): LoginBrand | null {
  const [brand, setBrand] = useState<LoginBrand | null>(null);
  useEffect(() => {
    let cancelled = false;
    void window.qcApi.getLoginBrand().then((value) => { if (!cancelled) setBrand(value); }).catch(() => { /* Dùng nhận diện mặc định. */ });
    return () => { cancelled = true; };
  }, []);
  return brand;
}
