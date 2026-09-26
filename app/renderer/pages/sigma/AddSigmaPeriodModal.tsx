// Hộp thoại thêm kỳ Sigma của trang Six Sigma.
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { PERIOD_YEARS, currentPeriod, vnPeriod } from './shared';

export function AddSigmaPeriodModal({ periods, onClose, onSubmit }: {
  periods: string[]; onClose: () => void;
  onSubmit: (period: string) => Promise<{ ok: boolean; error?: { message: string } }>;
}) {
  const initial = currentPeriod();
  const [month, setMonth] = useState(initial.slice(5, 7));
  const [year, setYear] = useState(initial.slice(0, 4));
  const [error, setError] = useState<string | null>(null);
  const period = `${year}-${month}`;
  const duplicate = periods.includes(period);

  async function submit() {
    if (duplicate) { setError(`Kỳ ${vnPeriod(period)} đã tồn tại. Hãy chọn một kỳ khác.`); return; }
    const result = await onSubmit(period);
    if (!result.ok) setError(result.error?.message || 'Không thể thêm kỳ Sigma.');
  }

  return <Modal title="Thêm kỳ Sigma" onClose={onClose} size="sm"
    footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Thêm kỳ</button></>}>
    <div className="sg-add-period-form">
      <p className="hint">Chọn trực tiếp kỳ cần nhập, kể cả kỳ trước đó. Kỳ đã tồn tại sẽ không bị ghi đè.</p>
      <div className="sg-add-period-picker">
        <label>Tháng
          <select value={month} onChange={(event) => { setMonth(event.target.value); setError(null); }} aria-label="Tháng kỳ mới">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={String(value).padStart(2, '0')}>{String(value).padStart(2, '0')}</option>)}
          </select>
        </label>
        <label>Năm
          <select value={year} onChange={(event) => { setYear(event.target.value); setError(null); }} aria-label="Năm kỳ mới">
            {PERIOD_YEARS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  </Modal>;
}
