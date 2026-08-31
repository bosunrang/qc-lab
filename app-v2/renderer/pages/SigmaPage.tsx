import { useEffect, useState } from 'react';
import { useManageStore } from '../store/manage-store';
import { useSigmaStore } from '../store/sigma-store';

export function SigmaPage() {
  const { tests, loadTests } = useManageStore();
  const { periods, error, loadPeriods, savePeriod } = useSigmaStore();
  const [testId, setTestId] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [tea, setTea] = useState('');
  const [cv, setCv] = useState('');
  const [biasEqa, setBiasEqa] = useState('');
  const [uCal, setUCal] = useState('');

  useEffect(() => { loadTests(); }, [loadTests]);
  useEffect(() => { if (testId) loadPeriods(testId); }, [testId, loadPeriods]);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Six Sigma (thí điểm)</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <select value={testId} onChange={e => setTestId(e.target.value)}>
        <option value="">Chọn xét nghiệm</option>
        {tests.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>

      {testId && (
        <>
          <table style={{ marginTop: 16, borderCollapse: 'collapse' }}>
            <thead><tr><th>Kỳ</th><th>TEa</th><th>CV%</th><th>Bias%</th><th>Sigma</th><th>MU (U)</th><th>Đủ thành phần?</th></tr></thead>
            <tbody>
              {periods.map(p => p.levels.map(lv => (
                <tr key={p.id + ':' + lv.level}>
                  <td>{p.period}</td><td>{p.tea ?? '—'}</td><td>{lv.cv ?? '—'}</td><td>{lv.biasEqa ?? '—'}</td>
                  <td>{lv.sigma ? lv.sigma.sigma.toFixed(2) : '—'}</td>
                  <td>{lv.mu ? lv.mu.U.toFixed(2) : '—'}</td>
                  <td>{lv.mu ? (lv.mu.complete ? 'Đủ' : `Thiếu: ${lv.mu.missing.join(', ')}`) : '—'}</td>
                </tr>
              )))}
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <h3>Thêm/sửa kỳ</h3>
            <input placeholder="Kỳ YYYY-MM" value={period} onChange={e => setPeriod(e.target.value)} />
            <input placeholder="TEa" value={tea} onChange={e => setTea(e.target.value)} />
            <input placeholder="CV%" value={cv} onChange={e => setCv(e.target.value)} />
            <input placeholder="Bias% (EQA)" value={biasEqa} onChange={e => setBiasEqa(e.target.value)} />
            <input placeholder="u(cal)" value={uCal} onChange={e => setUCal(e.target.value)} />
            <button onClick={() => savePeriod(testId, period, tea, cv, biasEqa, uCal)}>Lưu kỳ</button>
          </div>
        </>
      )}
    </div>
  );
}
