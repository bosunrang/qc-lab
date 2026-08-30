/* JSX thật thay cho reportActionIcon('print')/reportActionIconPresentation
   cũ (chuỗi SVG qua dangerouslySetInnerHTML) — cùng path data, chỉ đổi cách
   dựng. reportActionIconPresentation TypeScript vẫn giữ nguyên (còn dùng cho
   HTML in ấn cổ điển ở report-page-controller.ts), chỉ phía JSX này đổi. */
export function PrintIcon() {
  return (
    <svg className="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x={6} y={14} width={12} height={8} rx={1} />
      <path d="M18 12h.01" />
    </svg>
  );
}
