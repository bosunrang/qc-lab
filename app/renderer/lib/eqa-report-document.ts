// Phiếu BMQL một trang: cùng mô hình nội dung trên màn hình, PDF và Word.
import type { EqaReportView, EqaReviewKind, EqaReviewDraft } from '../../shared/qc-api';
import { assertCompactEqaPaper, eqaPaperModel, EQA_ASSESSMENT_LABELS, type EqaPaperStage } from '../../main/domain/eqa/report-form';
import { escapeHtml, type PrintIdentity } from './print-document';
import EQA_PAPER_CSS from '../print/eqa.css?raw';

export const EQA_REVIEW_LABELS: Record<EqaReviewKind, string> = {
  preliminary_review: 'Xem xét sơ khởi', analysis_review: 'Xem xét phân tích', system_review: 'Xem xét hệ thống',
};

export function eqaSourceLines(view: EqaReportView['rounds'][number]): string[] {
  const lines: string[] = [];
  for (const d of view.decisions) {
    if (!['import', 'append', 'reimport'].includes(d.type)) continue;
    try {
      const p = JSON.parse(d.payload_json) as { version?: number; sourceFiles?: { fileName: string; sha256: string; creationDate: string }[] };
      for (const f of p.sourceFiles || []) lines.push(`Phiên bản ${p.version || 1} · ${f.fileName} · Ngày tạo: ${f.creationDate || 'Không có trong PDF'} · SHA-256: ${f.sha256}`);
    } catch { /* Dữ liệu cũ chưa lưu mã băm được ghi rõ, không tạo lại dấu vết giả. */ }
  }
  return lines.length ? lines : ['Chưa lưu mã băm SHA-256 của tệp nguồn.'];
}

const text = escapeHtml;
function assessmentHtml(stage: EqaPaperStage): string {
  return `<div class="eqa-paper-choices">${(['appropriate', 'not_appropriate', 'pending'] as const).map((key) => `<span><i aria-hidden="true">${stage.assessment === key ? 'X' : ''}</i>${EQA_ASSESSMENT_LABELS[key]}</span>`).join('')}</div>`;
}
function signatureHtml(stage: EqaPaperStage): string {
  return `<p class="eqa-paper-sign"><b>Người xem xét / người được uỷ quyền:</b> ${text(stage.reviewer)}<br/><b>Ngày xem xét:</b> ${text(stage.date)}</p>`;
}

/** Nội dung đã escape toàn bộ dữ liệu; dùng nguyên bản cho phần xem trước và PDF. */
export function buildEqaPaperBody(identity: PrintIdentity, report: EqaReportView, drafts: readonly EqaReviewDraft[] = []): string {
  const m = eqaPaperModel(report, drafts);
  const meta = [['Chương trình', report.program_name], ['Đợt / năm', m.period], ['Thiết bị', m.instruments], ['Mã báo cáo', m.reportCode], ['Ngày nhận', m.receivedDate], ['Ngày báo cáo', m.reportDate]];
  return `<header class="eqa-paper-header"><div><b>${text(identity.labName || 'Đơn vị xét nghiệm')}</b>${identity.labDept ? `<span>${text(identity.labDept)}</span>` : ''}</div><div><b>${text(identity.form.formCode)}</b><span>${m.isDraft ? 'BẢN NHÁP · CHƯA KÝ' : report.reviews.some((r) => r.current) ? 'Hồ sơ xem xét' : 'Chưa ký xem xét'}</span></div></header>
    <h2 class="eqa-paper-title">${m.title}</h2>
    <dl class="eqa-paper-meta">${meta.map(([label, value]) => `<div><dt>${label}:</dt><dd>${text(value)}</dd></div>`).join('')}</dl>
    <section class="eqa-paper-section"><h3>1. Kết quả sơ khởi</h3><div>
      <p><b>Theo nhà cung cấp:</b> ${text(m.totals)}</p><p><b>Kết quả cần lưu ý:</b> ${text(m.attention)}</p>
      <p><b>Nhận xét:</b> ${text(m.preliminary.conclusion)}</p>${assessmentHtml(m.preliminary)}${signatureHtml(m.preliminary)}
    </div></section>
    <section class="eqa-paper-section"><h3>2. Kết quả phân tích và kết luận</h3><div>
      <p><b>Xu hướng qua các đợt:</b> ${text(m.trend)}</p>${m.coverage ? `<p><b>Bao phủ:</b> ${text(m.coverage)}</p>` : ''}
      <p><b>Nhận định và hướng xử lý:</b> ${text(m.analysis.conclusion)}</p>${m.warning ? `<p><b>Xử lý cảnh báo:</b> ${text(m.warning)}</p>` : ''}
      ${assessmentHtml(m.analysis)}${signatureHtml(m.analysis)}
    </div></section>
    <section class="eqa-paper-section"><h3>3. Truyền đạt kết quả và đề xuất CAR</h3><div>
      <p><b>Đã trao đổi:</b> ${text(m.communication)}<br/><b>Thời điểm:</b> ${text(m.communicationDate)}</p>
      <p><b>Đề xuất CAR:</b> ${text(m.carLabel)}<br/><b>Mã hồ sơ CAR / NCE:</b> ${text(m.carReference)}</p>
      ${m.requiresInvestigation ? '<p class="eqa-paper-note">Có kết quả hoặc tín hiệu thuộc diện cần điều tra; theo dõi xử lý bằng hồ sơ NCE.</p>' : ''}
      ${m.nextReviewDate ? `<p><b>Hẹn xem xét:</b> ${text(m.nextReviewDate)}</p>` : ''}
    </div></section>
    <footer class="eqa-paper-footer"><span>Phiên bản: ${text(identity.form.version)}${identity.form.effectiveDate ? ` · Ngày hiệu lực: ${text(identity.form.effectiveDate)}` : ''}</span><span>Trang 1 / 1</span></footer>`;
}

export function buildEqaReportHtml(identity: PrintIdentity, report: EqaReportView, drafts: readonly EqaReviewDraft[] = []): string {
  assertCompactEqaPaper(report, drafts);
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${eqaPaperModel(report, drafts).title}</title><style>${EQA_PAPER_CSS}</style></head><body><article class="eqa-paper">${buildEqaPaperBody(identity, report, drafts)}</article></body></html>`;
}

/** Gói Word OOXML thật, dùng cùng nội dung phiếu và giữ nguyên kết luận đã ký. */
export async function buildEqaReportDocx(identity: PrintIdentity, report: EqaReportView, drafts: readonly EqaReviewDraft[] = []): Promise<Blob> {
  assertCompactEqaPaper(report, drafts);
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const m = eqaPaperModel(report, drafts);
  const p = (s: string, bold = false, title = false, keepNext = false) => `<w:p><w:pPr>${title ? '<w:pStyle w:val="Title"/><w:jc w:val="center"/>' : ''}${keepNext ? '<w:keepNext/>' : ''}<w:spacing w:after="50" w:line="225" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>${bold ? '<w:b/>' : ''}<w:sz w:val="${title ? 27 : 19}"/></w:rPr><w:t xml:space="preserve">${text(s)}</w:t></w:r></w:p>`;
  const choice = (s: EqaPaperStage) => (['appropriate', 'not_appropriate', 'pending'] as const).map((key) => `[${s.assessment === key ? 'X' : ' '}] ${EQA_ASSESSMENT_LABELS[key]}`).join('     ');
  const sig = (s: EqaPaperStage) => [p(`Người xem xét / người được uỷ quyền: ${s.reviewer}`, false, false, true), p(`Ngày xem xét: ${s.date}`)].join('');
  const sections = [
    p('1. Kết quả sơ khởi', true, false, true) + p(`Theo nhà cung cấp: ${m.totals}`, false, false, true) + p(`Kết quả cần lưu ý: ${m.attention}`, false, false, true) + p(`Nhận xét: ${m.preliminary.conclusion}`, false, false, true) + p(choice(m.preliminary), false, false, true) + sig(m.preliminary),
    p('2. Kết quả phân tích và kết luận', true, false, true) + p(`Xu hướng qua các đợt: ${m.trend}`, false, false, true) + (m.coverage ? p(`Bao phủ: ${m.coverage}`, false, false, true) : '') + p(`Nhận định và hướng xử lý: ${m.analysis.conclusion}`, false, false, true) + (m.warning ? p(`Xử lý cảnh báo: ${m.warning}`, false, false, true) : '') + p(choice(m.analysis), false, false, true) + sig(m.analysis),
    p('3. Truyền đạt kết quả và đề xuất CAR', true, false, true) + p(`Đã trao đổi: ${m.communication}`, false, false, true) + p(`Thời điểm: ${m.communicationDate}`, false, false, true) + p(`Đề xuất CAR: ${m.carLabel}`, false, false, true) + p(`Mã hồ sơ CAR / NCE: ${m.carReference}`, false, false, true) + (m.requiresInvestigation ? p('Có kết quả hoặc tín hiệu thuộc diện cần điều tra; theo dõi xử lý bằng hồ sơ NCE.', false, false, true) : '') + (m.nextReviewDate ? p(`Hẹn xem xét: ${m.nextReviewDate}`) : p('')),
  ];
  const box = `<w:tbl><w:tblPr><w:tblW w:w="10400" w:type="dxa"/><w:tblBorders>${['top','left','bottom','right','insideH'].map((side) => `<w:${side} w:val="single" w:sz="4" w:color="CCD7DC"/>`).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="10400"/></w:tblGrid>${sections.map((s) => `<w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="10400" w:type="dxa"/></w:tcPr>${s}</w:tc></w:tr>`).join('')}</w:tbl>`;
  const body = p(identity.labName || 'Đơn vị xét nghiệm', true) + (identity.labDept ? p(identity.labDept) : '') + p(identity.form.formCode, true) + (m.isDraft ? p('BẢN NHÁP - CHƯA KÝ XEM XÉT', true) : '') + p(m.title, true, true, true)
    + p(`Chương trình: ${report.program_name}`) + p(`Thiết bị: ${m.instruments}     Đợt / năm: ${m.period}`) + p(`Mã báo cáo: ${m.reportCode}     Ngày báo cáo: ${m.reportDate}`)
    + p(`Ngày nhận: ${m.receivedDate}`) + box + p(`Phiên bản: ${identity.form.version} · Ngày hiệu lực: ${identity.form.effectiveDate || 'Chưa khai'}                                  Trang 1 / 1`);
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="680" w:right="680" w:bottom="680" w:left="680"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
}
