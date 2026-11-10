import type { NceDossierView } from '../../../shared/qc-api';

/** Phản hồi lỗi LAN hoặc thiếu mã/phiên bản không được nhận như hồ sơ đã lưu. */
export function assertDossier(value: unknown, expectedId?: string): asserts value is NceDossierView {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  if (input.ok === false) {
    const error = input.error && typeof input.error === 'object' ? input.error as Record<string, unknown> : {};
    throw new Error(typeof error.message === 'string' ? error.message : 'Máy chính từ chối đọc hồ sơ.');
  }
  const record = input.record && typeof input.record === 'object' ? input.record as Record<string, unknown> : {};
  if (typeof record.id !== 'string' || !record.id || (expectedId !== undefined && record.id !== expectedId)
    || !Number.isInteger(record.row_version) || Number(record.row_version) < 1) {
    throw new Error('Dữ liệu hồ sơ nhận được không hợp lệ.');
  }
}
