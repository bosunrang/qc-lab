import { cleanText } from './text-utils';
import type { ReportForm, ReportFormKind, ReportTemplateSettings } from '../../shared/qc-api';

/** Các biểu mẫu PDF có kiểm soát tài liệu (ISO 15189:2022 mục 8.3: tài liệu
 * được nhận diện duy nhất, có phiên bản, ngày hiệu lực và đánh số trang).
 * Mỗi loại báo cáo một mã riêng: dùng chung một mã cho mọi PDF thì không
 * phân biệt được bản in thuộc biểu mẫu nào khi lưu hồ sơ. */
export const REPORT_FORM_KINDS = ['iqc', 'westgard', 'sigma', 'reagent'] as const satisfies readonly ReportFormKind[];

export const REPORT_FORM_LABELS: Record<ReportFormKind, string> = {
  iqc: 'Báo cáo nội kiểm',
  westgard: 'Phân tích Westgard',
  sigma: 'Báo cáo Six Sigma',
  reagent: 'So sánh hoá chất',
};

export const DEFAULT_REPORT_TEMPLATES: ReportTemplateSettings = {
  iqc: { formCode: 'BM-NK-01', version: '1.0', effectiveDate: '' },
  westgard: { formCode: 'BM-WG-01', version: '1.0', effectiveDate: '' },
  sigma: { formCode: 'BM-SS-01', version: '1.0', effectiveDate: '' },
  reagent: { formCode: 'BM-HC-01', version: '1.0', effectiveDate: '' },
};

export interface ReportTemplateInput {
  kind?: unknown;
  formCode?: unknown;
  version?: unknown;
  effectiveDate?: unknown;
}

export type ReportTemplateValidation =
  | { ok: true; data: { kind: ReportFormKind; form: ReportForm } }
  | { ok: false; code: string; message: string };

const isKind = (value: unknown): value is ReportFormKind => (REPORT_FORM_KINDS as readonly unknown[]).includes(value);

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Mã và phiên bản là thông tin nhận diện của biểu mẫu, không phải tên tự do
 * dài. Giữ giới hạn nhỏ để tránh làm vỡ phần đầu PDF. Ngày hiệu lực không bắt
 * buộc: đơn vị chưa ban hành biểu mẫu thì PDF bỏ dòng này. */
export function validateReportTemplate(input: ReportTemplateInput = {}): ReportTemplateValidation {
  if (!isKind(input.kind)) return { ok: false, code: 'invalid-form-kind', message: 'Loại biểu mẫu không hợp lệ.' };
  const formCode = cleanText(input.formCode, 40).trim();
  const version = cleanText(input.version, 20).trim();
  const effectiveDate = cleanText(input.effectiveDate, 10).trim();
  if (!formCode) return { ok: false, code: 'missing-form-code', message: 'Nhập mã biểu mẫu.' };
  if (!version) return { ok: false, code: 'missing-form-version', message: 'Nhập phiên bản biểu mẫu.' };
  if (effectiveDate && !validDate(effectiveDate)) return { ok: false, code: 'invalid-effective-date', message: 'Ngày hiệu lực không hợp lệ.' };
  return { ok: true, data: { kind: input.kind, form: { formCode, version, effectiveDate } } };
}

/** Đọc cấu hình đã lưu. Bản cũ chỉ có `{ formCode, version }` của biểu mẫu
 * Six Sigma: giữ nguyên làm biểu mẫu Sigma, các loại khác lấy mặc định. */
export function parseReportTemplates(raw: unknown): ReportTemplateSettings {
  const result: ReportTemplateSettings = {
    iqc: { ...DEFAULT_REPORT_TEMPLATES.iqc }, westgard: { ...DEFAULT_REPORT_TEMPLATES.westgard },
    sigma: { ...DEFAULT_REPORT_TEMPLATES.sigma }, reagent: { ...DEFAULT_REPORT_TEMPLATES.reagent },
  };
  if (!raw || typeof raw !== 'object') return result;
  const stored = raw as Record<string, unknown>;
  const legacy = typeof stored.formCode === 'string' ? { sigma: stored } : stored;
  for (const kind of REPORT_FORM_KINDS) {
    const entry = legacy[kind];
    if (!entry || typeof entry !== 'object') continue;
    const checked = validateReportTemplate({ ...(entry as Record<string, unknown>), kind });
    if (checked.ok) result[kind] = checked.data.form;
  }
  return result;
}
