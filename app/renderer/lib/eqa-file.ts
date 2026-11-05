// Đọc báo cáo PDF của trung tâm ngoại kiểm ở renderer: pdf.js chỉ trích chữ
// kèm toạ độ, phần hiểu nội dung nằm ở `main/domain/eqa/pdf-report.ts`; main
// kiểm lại toàn bộ trước khi ghi.
import { parseEqaPdfReport, type EqaPdfReport, type EqaPdfTextItem } from '../../main/domain/eqa/pdf-report';

type PdfJs = typeof import('pdfjs-dist');
let pdfjsReady: Promise<PdfJs> | null = null;

/** pdf.js chạy phần xử lý ngay trên luồng chính qua `globalThis.pdfjsWorker`,
 * không tạo Web Worker: CSP của app chỉ cho script cùng nguồn, và báo cáo
 * ngoại kiểm chỉ vài chục trang chữ nên không cần luồng riêng. */
function loadPdfJs(): Promise<PdfJs> {
  pdfjsReady ??= (async () => {
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs');
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
    return import('pdfjs-dist');
  })();
  return pdfjsReady;
}

/** Ngày tạo file theo siêu dữ liệu PDF ("D:20261015222124+07'00'") đổi sang "2026-10-15". */
function pdfDate(value: unknown): string {
  const m = String(value ?? '').match(/D:(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

async function readPdf(file: File): Promise<EqaPdfReport> {
  try {
    const pdfjs = await loadPdfJs();
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const doc = await task.promise;
    try {
      const pages: EqaPdfTextItem[][] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const content = await (await doc.getPage(p)).getTextContent();
        pages.push(content.items.flatMap((item) => ('str' in item && item.str.trim()) ? [{ str: item.str, x: item.transform[4], y: item.transform[5] }] : []));
      }
      const meta = await doc.getMetadata().catch(() => null);
      return parseEqaPdfReport({ fileName: file.name, pages, creationDate: pdfDate((meta?.info as { CreationDate?: unknown } | undefined)?.CreationDate) });
    } finally { void task.destroy(); }
  } catch (error) {
    const empty = parseEqaPdfReport({ fileName: file.name, pages: [], creationDate: '' });
    return { ...empty, warnings: [], errors: [`${file.name}: không đọc được file PDF (${error instanceof Error ? error.message : 'lỗi không rõ'}).`] };
  }
}

/** Mỗi file PDF là báo cáo của một máy (nhóm thiết bị) trong một đợt. */
export function readEqaPdfFiles(files: readonly File[]): Promise<EqaPdfReport[]> {
  return Promise.all(files.map(readPdf));
}
