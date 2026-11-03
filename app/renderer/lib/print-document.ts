// Phần kiểm soát tài liệu dùng chung cho mọi PDF của app: nhận diện đơn vị,
// mã biểu mẫu, phiên bản, ngày hiệu lực và khu vực ký. Số trang "Trang x / y"
// do main in ở chân trang khi gọi `printHtmlToPdf(..., { pageNumbers: true })`.
// Trước đây chỉ PDF Six Sigma có các thông tin này; PDF nội kiểm, Westgard và
// so sánh hoá chất in ra không có tên đơn vị, mã biểu mẫu hay chỗ ký.
import type { ReportForm, ReportFormKind } from '../../shared/qc-api';

export interface PrintIdentity {
  /** Hồ sơ đơn vị được lấy tức thời trước khi in, nên luôn theo dữ liệu đã
   * đồng bộ từ phần Cài đặt thay vì một bản sao cũ trong trang. */
  labName: string;
  labDept: string;
  labAddress: string;
  logoData: string;
  form: ReportForm;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

export function printedDate(): string {
  return new Intl.DateTimeFormat('vi-VN').format(new Date());
}

const vnDay = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso);

/** Đọc hồ sơ đơn vị và biểu mẫu của loại báo cáo ngay trước lúc in. */
export async function loadPrintIdentity(kind: ReportFormKind): Promise<PrintIdentity> {
  const [lab, templates] = await Promise.all([window.qcApi.getLabProfile(), window.qcApi.getReportTemplateSettings()]);
  return { labName: lab.name, labDept: lab.dept, labAddress: lab.address, logoData: lab.logo_data, form: templates[kind] };
}

/** Phần đầu biểu mẫu. Hồ sơ đơn vị không bắt buộc, vì vậy khi chưa khai báo
 * vẫn in được mà không để trống một vùng nhận diện khó hiểu. */
export function documentHeader(identity: PrintIdentity, title: string, subtitle: string, meta: string[]): string {
  const name = identity.labName.trim() || 'Đơn vị xét nghiệm';
  const dept = identity.labDept.trim();
  const address = identity.labAddress.trim();
  const logo = identity.logoData.startsWith('data:image/') ? `<div class="lab-logo"><img src="${escapeHtml(identity.logoData)}" alt="Logo đơn vị"></div>` : '';
  const { formCode, version, effectiveDate } = identity.form;
  const control = [`Mã biểu mẫu: ${escapeHtml(formCode)}`, `Phiên bản: ${escapeHtml(version)}`]
    .concat(effectiveDate ? [`Ngày hiệu lực: ${escapeHtml(vnDay(effectiveDate))}`] : []);
  return `<header class="report-header"><div class="lab-identity">${logo}<div class="lab-copy"><div class="lab-name">${escapeHtml(name)}</div>${dept ? `<div class="lab-detail">${escapeHtml(dept)}</div>` : ''}${address ? `<div class="lab-detail lab-address">${escapeHtml(address)}</div>` : ''}</div></div><div class="document-control">${control.map((line) => `<span>${line}</span>`).join('')}</div><div class="report-title">${escapeHtml(title)}</div>${subtitle ? `<div class="report-subtitle">${escapeHtml(subtitle)}</div>` : ''}<div class="report-meta">${meta.concat(`Ngày in: ${printedDate()}`).map((line) => `<span>${escapeHtml(line)}</span>`).join('')}</div></header>`;
}

/** Chừa đủ khoảng trắng để ký tay sau khi in PDF; không gán người ký hoặc
 * xác nhận điện tử vì app chưa có nghiệp vụ phê duyệt báo cáo. */
export function signatureBlock(): string {
  return `<section class="signatures" aria-label="Khu vực ký duyệt"><div><b>NGƯỜI LẬP BÁO CÁO</b><span>(Ký, ghi rõ họ tên)</span><i></i></div><div><b>NGƯỜI PHỤ TRÁCH</b><span>(Ký, ghi rõ họ tên)</span><i></i></div><div><b>PHÊ DUYỆT</b><span>(Ký, ghi rõ họ tên)</span><i></i></div></section>`;
}

export const DOCUMENT_CSS = '.report-header{position:relative;border-bottom:2px solid #31869b;padding:0 0 8px;margin-bottom:10px;text-align:center}.lab-identity{display:flex;width:fit-content;align-items:center;gap:8px;text-align:center}.lab-logo{width:42px;height:42px;flex:0 0 42px}.lab-logo img{display:block;width:100%;height:100%;object-fit:contain}.lab-name{font-size:15px;font-weight:700;color:#215968;text-transform:uppercase}.lab-detail{margin-top:2px;color:#526975}.document-control{position:absolute;top:0;right:0;display:grid;gap:2px;text-align:right;color:#526975;font-size:8px}.report-title{font-size:18px;font-weight:700;color:#215968;margin-top:10px}.report-subtitle{margin-top:3px;color:#40515c}.report-meta{display:flex;justify-content:center;gap:12px;margin-top:7px;color:#526975;font-size:9px}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:22px;break-inside:avoid;text-align:center}.signatures b{display:block;font-size:9px}.signatures span{display:block;margin-top:3px;color:#526975;font-size:8px;font-style:italic}.signatures i{display:block;height:52px}';
