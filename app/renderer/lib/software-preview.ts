import type { SoftwareLicenseStatus, SoftwareUpdateStatus } from '../../shared/qc-api';

// Hai tính năng thuộc máy cài Electron. Bản xem trước hiển thị rõ trạng
// thái không áp dụng, không giả vờ nhận mã hoặc tải một bộ cài thật.
export const previewLicense: SoftwareLicenseStatus = { state: 'development', runtime: 'browser-preview', machine_code: '', license_id: '', licensed_to: '', issued_at: '', expires_at: null, message: 'Bản xem trước không yêu cầu kích hoạt.' };
export const previewUpdate: SoftwareUpdateStatus = { phase: 'unsupported', current_version: import.meta.env.VITE_APP_VERSION, available_version: '', release_notes: '', checked_at: '', percent: 0, transferred: 0, total: 0, message: 'Cập nhật phần mềm chỉ có trong bản cài Windows.' };
