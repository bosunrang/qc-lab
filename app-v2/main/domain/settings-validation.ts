// Validate cho trang Cai dat: ho so phong xet nghiem (bang `lab`, luon dung
// 1 dong id=1 - xem schema.ts). Khong co truong bat buoc that su (day la
// thong tin mo ta, khong phai du lieu QC) - chi lam sach/gioi han do dai va
// giu mac dinh cho brandTitle/brandSub neu bo trong, khop DEFAULT trong schema.
import { cleanText } from './text-utils';

export interface LabProfileInput {
  name?: unknown; dept?: unknown; address?: unknown; brandTitle?: unknown; brandSub?: unknown;
}
export interface PreparedLabProfile {
  name: string; dept: string; address: string; brandTitle: string; brandSub: string;
}

export function prepareLabProfile(input: LabProfileInput = {}): PreparedLabProfile {
  return {
    name: cleanText(input.name, 200).trim(),
    dept: cleanText(input.dept, 200).trim(),
    address: cleanText(input.address, 300).trim(),
    brandTitle: cleanText(input.brandTitle, 100).trim() || 'QC Lab',
    brandSub: cleanText(input.brandSub, 200).trim() || 'Nội kiểm xét nghiệm',
  };
}
