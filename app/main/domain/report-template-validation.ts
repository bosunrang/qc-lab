import { cleanText } from './text-utils';

export const DEFAULT_SIGMA_REPORT_TEMPLATE = {
  formCode: 'BM-SS-01',
  version: '1.0',
} as const;

export interface ReportTemplateInput {
  formCode?: unknown;
  version?: unknown;
}

export type ReportTemplateValidation =
  | { ok: true; data: { formCode: string; version: string } }
  | { ok: false; code: string; message: string };

/** Mã và phiên bản là thông tin nhận diện của biểu mẫu, không phải tên tự do
 * dài. Giữ giới hạn nhỏ để tránh làm vỡ phần đầu PDF. */
export function validateReportTemplate(input: ReportTemplateInput = {}): ReportTemplateValidation {
  const formCode = cleanText(input.formCode, 40).trim();
  const version = cleanText(input.version, 20).trim();
  if (!formCode) return { ok: false, code: 'missing-form-code', message: 'Nhập mã biểu mẫu.' };
  if (!version) return { ok: false, code: 'missing-form-version', message: 'Nhập phiên bản biểu mẫu.' };
  return { ok: true, data: { formCode, version } };
}


