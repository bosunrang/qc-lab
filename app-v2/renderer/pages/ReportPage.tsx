import { useEffect, useState } from 'react';
import { useManageStore } from '../store/manage-store';
import { useReportStore } from '../store/report-store';

function currentYm(): string { return new Date().toISOString().slice(0, 7); }

export function ReportPage() {
  const { tests, loadTests } = useManageStore();
  const { locks, points, error, loadLocks, lock, unlock, loadPoints } = useReportStore();
  const [lockYm, setLockYm] = useState(currentYm());
  const [lockNote, setLockNote] = useState('');
  const [unlockNote, setUnlockNote] = useState<Record<string, string>>({});
  const [testId, setTestId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => { loadTests(); loadLocks(); }, [loadTests, loadLocks]);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Báo cáo (thí điểm)</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h2>Khoá kỳ báo cáo</h2>
      <p>Khoá 1 kỳ sẽ chặn thêm/sửa/huỷ điểm QC của mọi xét nghiệm có ngày rơi vào kỳ đó.</p>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead><tr><th>Kỳ</th><th>Khoá lúc</th><th>Người khoá</th><th>Ghi chú</th><th>Mở khoá</th></tr></thead>
        <tbody>
          {locks.map(l => (
            <tr key={l.id}>
              <td>{l.ym}</td><td>{l.locked_at}</td><td>{l.locked_by}</td><td>{l.note}</td>
              <td>
                <input placeholder="Lý do mở khoá (≥5 ký tự)" value={unlockNote[l.ym] || ''} onChange={e => setUnlockNote(v => ({ ...v, [l.ym]: e.target.value }))} />
                <button onClick={() => { unlock(l.ym, unlockNote[l.ym] || ''); setUnlockNote(v => ({ ...v, [l.ym]: '' })); }}>Mở khoá</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8 }}>
        <input type="month" value={lockYm} onChange={e => setLockYm(e.target.value)} />
        <input placeholder="Ghi chú (tuỳ chọn)" value={lockNote} onChange={e => setLockNote(e.target.value)} />
        <button onClick={async () => { await lock(lockYm, lockNote); setLockNote(''); }}>Khoá kỳ này</button>
      </div>

      <h2 style={{ marginTop: 24 }}>Xem lại điểm QC</h2>
      <select value={testId} onChange={e => setTestId(e.target.value)}>
        <option value="">Chọn xét nghiệm</option>
        {tests.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
      <input type="date" value={to} onChange={e => setTo(e.target.value)} />
      <button onClick={() => testId && loadPoints(testId, from, to)} disabled={!testId}>Xem</button>

      <table style={{ marginTop: 12, borderCollapse: 'collapse' }}>
        <thead><tr><th>Ngày</th><th>Mức</th><th>Lần chạy</th><th>Giá trị</th><th>Trạng thái</th></tr></thead>
        <tbody>
          {points.map(p => (
            <tr key={p.id} style={p.voided ? { color: '#999', textDecoration: 'line-through' } : undefined}>
              <td>{p.date}</td><td>{p.level}</td><td>{p.run_id}</td><td>{p.val}</td><td>{p.voided ? 'Đã huỷ' : 'Hợp lệ'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
