import { useEffect, useState } from 'react';
import { useWestgardStore } from '../store/westgard-store';

const VERDICT_COLOR: Record<string, string> = { ok: 'black', warn: 'orange', rej: 'red' };

export function WestgardPage() {
  const { summaries, analysis, loadSummaries, loadAnalysis, toggleRule } = useWestgardStore();
  const [selected, setSelected] = useState<{ testId: string; level: number } | null>(null);

  useEffect(() => { loadSummaries(); }, [loadSummaries]);
  useEffect(() => { if (selected) loadAnalysis(selected.testId, selected.level); }, [selected, loadAnalysis]);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Phân tích Westgard (thí điểm)</h1>

      <h2>Tổng quan</h2>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead><tr><th>Xét nghiệm</th><th>Máy</th><th>Mức</th><th>Số điểm</th><th>Kết luận tệ nhất</th></tr></thead>
        <tbody>
          {summaries.flatMap(s => s.levels.map(lv => (
            <tr key={s.testId + ':' + lv.level} style={{ color: VERDICT_COLOR[lv.worstVerdict], cursor: 'pointer' }}
              onClick={() => setSelected({ testId: s.testId, level: lv.level })}>
              <td>{s.testName}</td><td>{s.instrumentName}</td><td>{lv.level}</td><td>{lv.pointCount}</td><td>{lv.worstVerdict}</td>
            </tr>
          )))}
        </tbody>
      </table>

      {selected && analysis && (
        <>
          <h2>Chi tiết: {selected.testId} — Mức {selected.level}</h2>
          <table style={{ borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead><tr><th>Ngày</th><th>Lần chạy</th><th>Giá trị</th><th>z</th><th>Kết luận</th><th>Luật</th></tr></thead>
            <tbody>
              {analysis.points.map(p => (
                <tr key={p.id} style={{ color: VERDICT_COLOR[p.verdict] }}>
                  <td>{p.date}</td><td>{p.runId}</td><td>{p.val}</td><td>{p.z.toFixed(2)}</td><td>{p.verdict}</td><td>{p.rules.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>CUSUM (Cpos / Cneg)</h3>
          <p>{analysis.cusum.cPos.map((v, i) => `${v.toFixed(2)}/${analysis.cusum.cNeg[i].toFixed(2)}`).join(' · ')}</p>

          <h3>Bật/tắt luật</h3>
          <ul>
            {analysis.ruleActions.map(r => (
              <li key={r.id}>
                <label>
                  <input type="checkbox" checked={r.on} onChange={e => toggleRule(selected.testId, selected.level, r.id, e.target.checked)} />
                  {r.id} — {r.desc}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
