import { useEffect, useMemo, useState } from 'react';
import { useReagentStore } from '../store/reagent-store';

export function ReagentPage() {
  const { comparisons, error, load, create, saveMetadata, saveRows, remove } = useReagentStore();
  const [currentId, setCurrentId] = useState('');
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [rowsDraft, setRowsDraft] = useState<[string, string][]>([]);

  useEffect(() => { load(); }, [load]);

  const current = useMemo(() => comparisons.find(c => c.id === currentId) ?? comparisons[0] ?? null, [comparisons, currentId]);

  useEffect(() => { if (current) setRowsDraft(current.rows); }, [current?.id]);

  if (!current) return <div style={{ padding: 24, fontFamily: 'sans-serif' }}><h1>So sánh hóa chất (thí điểm)</h1><p>Đang tải...</p></div>;

  const R = current.result;

  function updateCell(rowIndex: number, col: 0 | 1, value: string) {
    setRowsDraft(prev => {
      const next = prev.map(r => [...r] as [string, string]);
      next[rowIndex][col] = value;
      return next;
    });
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>So sánh hóa chất (thí điểm)</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ marginBottom: 12 }}>
        <select value={current.id} onChange={e => setCurrentId(e.target.value)}>
          {comparisons.map(c => <option key={c.id} value={c.id}>{c.reagent}</option>)}
        </select>
        {' '}
        <input placeholder="Tên hóa chất mới" value={newName} onChange={e => setNewName(e.target.value)} />
        <input placeholder="Đơn vị" value={newUnit} onChange={e => setNewUnit(e.target.value)} />
        <button onClick={() => { if (newName.trim()) { create(newName.trim(), newUnit.trim()); setNewName(''); setNewUnit(''); } }}>+ Thêm phép so sánh</button>
        {comparisons.length > 1 && <button onClick={() => remove(current.id)}>Xóa phép so sánh này</button>}
      </div>

      <div key={current.id} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 16 }}>
        <h3>Thông tin</h3>
        <input placeholder="Tên hóa chất" defaultValue={current.reagent} onBlur={e => saveMetadata(current.id, { reagent: e.target.value })} />
        <input placeholder="Lô cũ" defaultValue={current.lot_old} onBlur={e => saveMetadata(current.id, { lotOld: e.target.value })} />
        <input placeholder="Lô mới" defaultValue={current.lot_new} onBlur={e => saveMetadata(current.id, { lotNew: e.target.value })} />
        <input placeholder="Đơn vị" defaultValue={current.unit} onBlur={e => saveMetadata(current.id, { unit: e.target.value })} />
        <input placeholder="Mục tiêu bias %" type="number" defaultValue={current.bias_target ?? 6} onBlur={e => saveMetadata(current.id, { biasTarget: Number(e.target.value) })} />
        <label>
          <input type="checkbox" defaultChecked={!!current.coverage_confirmed} onChange={e => saveMetadata(current.id, { coverageConfirmed: e.target.checked })} />
          Đã xác nhận đủ độ bao phủ (coverage)
        </label>
      </div>

      <div style={{ border: '1px solid #ccc', padding: 12, marginBottom: 16 }}>
        <h3>Cặp giá trị (Lô cũ / Lô mới)</h3>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead><tr><th>#</th><th>Lô cũ</th><th>Lô mới</th></tr></thead>
          <tbody>
            {rowsDraft.map((row, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><input value={row[0]} onChange={e => updateCell(i, 0, e.target.value)} style={{ width: 80 }} /></td>
                <td><input value={row[1]} onChange={e => updateCell(i, 1, e.target.value)} style={{ width: 80 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => setRowsDraft(prev => [...prev, ['', '']])}>+ Thêm dòng</button>
        <button onClick={() => saveRows(current.id, rowsDraft)}>Lưu số liệu</button>
      </div>

      <div style={{ border: '1px solid #ccc', padding: 12 }}>
        <h3>Kết quả thống kê</h3>
        {!R && <p>Chưa đủ dữ liệu (tối thiểu 5 cặp giá trị hợp lệ).</p>}
        {R && (
          <ul>
            <li>Số cặp (N): {R.N}</li>
            <li>%Bias: {R.bias.toFixed(2)}% (mục tiêu &lt; {R.biasT}%) — {R.passBias ? 'Đạt' : 'Không đạt'}</li>
            <li>Hồi quy OLS: y = {R.fit.a.toFixed(3)} + {R.fit.b.toFixed(3)}x, R² = {R.fit.r2.toFixed(4)}</li>
            <li>Passing-Bablok: y = {R.pb.a.toFixed(3)} + {R.pb.b.toFixed(3)}x</li>
            <li>Đủ ≥20 cặp: {R.enoughN ? 'Có' : 'Chưa'}</li>
            <li>Kết luận sàng lọc: <strong>{R.level === 'ok' ? 'Đạt' : R.level === 'mid' ? 'Chưa đủ điều kiện' : 'Không đạt'}</strong></li>
          </ul>
        )}
      </div>
    </div>
  );
}
