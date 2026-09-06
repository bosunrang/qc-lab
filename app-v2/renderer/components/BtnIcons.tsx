// Icon nhỏ trong nút — copy NGUYÊN path SVG của app cũ
// (`src/presentation/router/router-icons.ts`'s `icoDownload`/`icoPrint` và
// `CalcIcon` trong `src/react/pages/SigmaPage.tsx`).
//
// LƯU Ý về class `btn-ico`: nó là class của CHÍNH THẺ <svg> (15×15,
// `flex:0 0 auto`), KHÔNG phải của <button>. Trước 2026-09-03 app-v2 gắn
// `btn-ico` lên nút (Sigma "Bias EQA% Mức n", Westgard "Xuất Excel"/"In PDF"),
// làm nút co lại còn 26px và chữ bị vắt thành nhiều dòng chồng lên tiêu đề
// panel — đúng loại lỗi mà gate UI parity không thấy (chữ vẫn có trong DOM).
const COMMON = {
  className: 'btn-ico',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function DownloadIcon() {
  return (
    <svg {...COMMON}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1={12} y1={15} x2={12} y2={3} />
    </svg>
  );
}

export function PrintIcon() {
  return (
    <svg {...COMMON}>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v7H6z" />
    </svg>
  );
}

export function CalcIcon() {
  return (
    <svg {...COMMON}>
      <rect x={4} y={2} width={16} height={20} rx={2} />
      <line x1={8} y1={6} x2={16} y2={6} />
      <circle cx={8} cy={12} r={0.6} fill="currentColor" stroke="none" />
      <circle cx={12} cy={12} r={0.6} fill="currentColor" stroke="none" />
      <circle cx={16} cy={12} r={0.6} fill="currentColor" stroke="none" />
      <circle cx={8} cy={16} r={0.6} fill="currentColor" stroke="none" />
      <circle cx={12} cy={16} r={0.6} fill="currentColor" stroke="none" />
      <circle cx={16} cy={16} r={0.6} fill="currentColor" stroke="none" />
    </svg>
  );
}
