import { create } from 'zustand';
import type { SoftwareLicenseStatus, SoftwareUpdateStatus } from '../../shared/qc-api';

interface SoftwareState {
  license: SoftwareLicenseStatus | null; update: SoftwareUpdateStatus | null; licenseError: string;
  loadLicense(): Promise<void>; loadUpdate(): Promise<void>;
}
let licenseRequest = 0, updateRequest = 0;
export const useSoftwareStore = create<SoftwareState>((set) => ({
  license: null, update: null, licenseError: '',
  loadLicense: async () => {
    const request = ++licenseRequest;
    try {
      const license = await window.qcApi.getLicenseStatus();
      if (!license) throw new Error('Không đọc được trạng thái kích hoạt của máy chủ.');
      if (request === licenseRequest) set({ license, licenseError: '' });
    } catch (error) {
      // Mất mạng tạm thời không được tháo trang đang nhập và làm mất nháp.
      // Chưa có kết quả lần đầu thì vẫn chặn; quyền thật luôn do máy chủ kiểm.
      if (request === licenseRequest) set({ licenseError: error instanceof Error ? error.message : 'Không kiểm tra được giấy phép.' });
    }
  },
  loadUpdate: async () => {
    const request = ++updateRequest;
    try { const update = await window.qcApi.getSoftwareUpdateStatus(); if (request === updateRequest) set({ update }); }
    catch { /* Trạng thái cập nhật không được làm gián đoạn thao tác QC. */ }
  },
}));
