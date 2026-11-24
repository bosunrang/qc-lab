import type { ReactNode } from 'react';

// Thẻ số liệu dùng chung (U9): nhãn nhỏ, con số lớn, dòng phụ tuỳ chọn.
// Trước đây Tổng quan (`.dash-kpi`) và So sánh hoá chất (`.rc-stat-card`) mỗi
// trang tự dựng một kiểu khác lề, khác cỡ chữ. Thẻ Sigma tô nền theo vùng
// Sigma nên vẫn là kiểu riêng.

export type StatTone = 'accent' | 'danger';

export function StatCard({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: StatTone }) {
  return <div className="stat-card">
    <div className="stat-label">{label}</div>
    <div className={tone ? `stat-value ${tone}` : 'stat-value'}>{value}</div>
    {sub != null && <div className="stat-sub">{sub}</div>}
  </div>;
}
