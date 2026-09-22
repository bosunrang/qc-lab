// Validate cho trang Cai dat: ho so phong xet nghiem (bang `lab`, luon dung
// 1 dong id=1 - xem schema.ts). Khong co truong bat buoc that su (day la
// thong tin mo ta, khong phai du lieu QC) - chi lam sach/gioi han do dai va
// giu mac dinh cho brandTitle/brandSub neu bo trong, khop DEFAULT trong schema.
import { cleanText } from './text-utils';

export interface LabProfileInput {
  name?: unknown; dept?: unknown; address?: unknown; brandTitle?: unknown; brandSub?: unknown;
  logoText?: unknown; logoData?: unknown; clearLogo?: unknown;
}
export interface PreparedLabProfile {
  name: string; dept: string; address: string; brandTitle: string; brandSub: string;
  logoText: string; logoData: string;
}

// Logo đã được resize/nén thành data URL PNG ở renderer (canvas, xem
// SettingsPage.tsx) TRƯỚC khi gửi qua IPC — giới hạn 300KB ở đây chỉ là lưới
// an toàn tầng cuối (chặn payload thất thường), không phải bước nén chính.
const LOGO_DATA_MAX = 300_000;

/** `existing` = logo hiện có trong DB — form không gửi lại ảnh mỗi lần lưu
 * (chỉ gửi khi người dùng thật sự chọn ảnh mới), nên thiếu `logoData` trong
 * input nghĩa là GIỮ NGUYÊN, không phải xoá logo đã có. */
export function prepareLabProfile(input: LabProfileInput = {}, existing?: Partial<PreparedLabProfile>): PreparedLabProfile {
  const logoData = cleanText(input.logoData, LOGO_DATA_MAX).trim();
  return {
    name: cleanText(input.name, 200).trim(),
    dept: cleanText(input.dept, 200).trim(),
    address: cleanText(input.address, 300).trim(),
    brandTitle: cleanText(input.brandTitle, 100).trim() || 'QC Lab',
    brandSub: cleanText(input.brandSub, 200).trim() || 'Nội kiểm xét nghiệm',
    logoText: cleanText(input.logoText, 10).trim() || existing?.logoText || 'QC',
    logoData: input.clearLogo === true ? '' : (logoData.startsWith('data:image/') ? logoData : (existing?.logoData || '')),
  };
}
