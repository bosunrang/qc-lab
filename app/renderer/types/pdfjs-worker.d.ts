// pdfjs-dist không kèm khai báo kiểu cho bản worker; app chỉ gán mô-đun này
// vào `globalThis.pdfjsWorker` để pdf.js xử lý trên luồng chính (lib/eqa-file.ts).
declare module 'pdfjs-dist/build/pdf.worker.min.mjs' {
  export const WorkerMessageHandler: unknown;
}
