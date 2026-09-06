// Icon máy in cho nút "Tạo báo cáo & In" — copy nguyên path SVG từ
// `src/react/components/PrintIcon.tsx` của app cũ (Giai đoạn D3.2), không
// tự vẽ lại.
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
