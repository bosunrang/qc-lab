// Hai màn chi tiết dùng chung lựa chọn lọc; phạm vi mới luôn bắt đầu từ tất cả.
import { useState } from 'react';
import type { EqaClassView } from '../../../shared/qc-api';

export type EqaResultFilterValue = 'all' | 'attention' | EqaClassView;
const OPTIONS = [
  { value: 'attention', label: 'Cần xem' }, { value: 'ok', label: 'Chấp nhận' },
  { value: 'warn', label: 'Cảnh báo' }, { value: 'rej', label: 'Không chấp nhận' },
] as const;

export function useEqaResultFilter(key: string) {
  const [state, setState] = useState<{ key: string; value: EqaResultFilterValue }>({ key, value: 'all' });
  if (state.key !== key) setState({ key, value: 'all' });
  const value = state.key === key ? state.value : 'all';
  return [value, (value: EqaResultFilterValue) => setState({ key, value })] as const;
}

export function EqaResultFilter({ value, onChange, label, allLabel }: {
  value: EqaResultFilterValue; onChange: (value: EqaResultFilterValue) => void; label: string; allLabel: string;
}) {
  return <select className="eqa-map-filter" aria-label={label} value={value} onChange={(event) => onChange(event.target.value as EqaResultFilterValue)}>
    <option value="all">{allLabel}</option>
    {OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
  </select>;
}
