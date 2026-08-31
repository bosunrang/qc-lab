import { useEffect, useState } from 'react';
import { useManageStore } from '../store/manage-store';
import { useEntryStore } from '../store/entry-store';

const VERDICT_COLOR: Record<string, string> = { ok: 'black', warn: 'orange', rej: 'red' };

export function EntryPage() {
  const { tests, loadTests } = useManageStore();
  const { points, error, loadPoints, addPoint, voidPoint } = useEntryStore();
  const [testId, setTestId] = useState('');
  const [level, setLevel] = useState('1');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [val, setVal] = useState('');
  const [voidReason, setVoidReason] = useState<Record<string, string>>({});

  useEffect(() => { loadTests(); }, [loadTests]);
  useEffect(() => { if (testId) loadPoints(testId, Number(level)); }, [testId, level, loadPoints]);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Nhập QC (thí điểm)</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <select value={testId} onChange={e => setTestId(e.target.value)}>
        <option value="">Chọn xét nghiệm</option>
        {tests.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <input placeholder="Mức" value={level} onChange={e => setLevel(e.target.value)} style={{ width: 40 }} />

      {testId && (
        <>
          <table style={{ marginTop: 16, borderCollapse: 'collapse' }}>
            <thead><tr><th>Ngày</th><th>Lần chạy</th><th>Giá trị</th><th>Kết luận</th><th>Luật</th><th></th></tr></thead>
            <tbody>
              {points.map(p => (
                <tr key={p.id} style={{ color: VERDICT_COLOR[p.verdict] }}>
                  <td>{p.date}</td><td>{p.run_id}</td><td>{p.val}</td><td>{p.verdict}</td><td>{p.rules.join(', ')}</td>
                  <td>
                    <input placeholder="Lý do hủy" value={voidReason[p.id] || ''} onChange={e => setVoidReason(v => ({ ...v, [p.id]: e.target.value }))} />
                    <button onClick={() => voidPoint(testId, Number(level), p.id, voidReason[p.id] || '')}>Hủy</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            <input placeholder="Giá trị" value={val} onChange={e => setVal(e.target.value)} />
            <button onClick={async () => { await addPoint(testId, Number(level), date, Number(val), `${date}-1`); setVal(''); }}>Thêm điểm QC</button>
          </div>
        </>
      )}
    </div>
  );
}
