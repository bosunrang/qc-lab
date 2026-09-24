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

export function RestoreIcon() {
  return (
    <svg {...COMMON}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 3 3 9 9 9" />
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

export function TrashIcon() {
  return (
    <svg {...COMMON}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}


