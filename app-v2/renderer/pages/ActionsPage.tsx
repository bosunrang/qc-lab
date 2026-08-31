import { useEffect, useState } from 'react';
import { useManageStore } from '../store/manage-store';
import { useNceStore } from '../store/nce-store';

export function ActionsPage() {
  const { tests, loadTests } = useManageStore();
  const { records, error, load, create, approve, returnForRevision, cancel, setCompletedDate, markEffectiveness } = useNceStore();

  const [testId, setTestId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rule, setRule] = useState('');
  const [errorType, setErrorType] = useState('');
  const [correction, setCorrection] = useState('');
  const [dueDate, setDueDate] = useState('');

  const [completedDateById, setCompletedDateById] = useState<Record<string, string>>({});
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  useEffect(() => { loadTests(); load(); }, [loadTests, load]);

  const testName = (id: string | null) => tests.find(t => t.id === id)?.name ?? '(không rõ)';

  async function submitCreate() {
    const ok = await create({ testId: testId || undefined, date, rule, errorType, correction, dueDate: dueDate || undefined });
    if (ok) { setRule(''); setErrorType(''); setCorrection(''); setDueDate(''); }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Khắc phục sự cố / NCE (thí điểm)</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ border: '1px solid #ccc', padding: 12, marginBottom: 16 }}>
        <h3>Mở hồ sơ NCE mới</h3>
        <select value={testId} onChange={e => setTestId(e.target.value)}>
          <option value="">(không gắn xét nghiệm)</option>
          {tests.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <input placeholder="Luật vi phạm (vd 1-3s)" value={rule} onChange={e => setRule(e.target.value)} />
        <input placeholder="Loại lỗi (SE/RE)" value={errorType} onChange={e => setErrorType(e.target.value)} />
        <input placeholder="Hạn hoàn thành" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        <div>
          <textarea placeholder="Xử lý tức thời (>=10 ký tự)" value={correction} onChange={e => setCorrection(e.target.value)} rows={2} style={{ width: '100%' }} />
        </div>
        <button onClick={submitCreate}>Tạo hồ sơ</button>
      </div>

      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>Mã NCE</th><th>Xét nghiệm</th><th>Ngày</th><th>Trạng thái duyệt</th><th>Hiệu lực</th><th>Hồ sơ</th><th>Ngày hoàn thành</th><th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id} style={{ opacity: r.record_status === 'cancelled' ? 0.5 : 1 }}>
              <td>{r.nce_id}</td>
              <td>{testName(r.test_id)}</td>
              <td>{r.date}</td>
              <td>{r.approval_status}</td>
              <td>{r.effectiveness_status}</td>
              <td>{r.record_status}</td>
              <td>
                {r.action_completed_date || (
                  <>
                    <input type="date" value={completedDateById[r.id] ?? ''} onChange={e => setCompletedDateById(m => ({ ...m, [r.id]: e.target.value }))} />
                    <button onClick={() => completedDateById[r.id] && setCompletedDate(r.id, completedDateById[r.id])}>Lưu</button>
                  </>
                )}
              </td>
              <td>
                {r.record_status !== 'cancelled' && (
                  <>
                    {r.approval_status !== 'approved' && <button onClick={() => approve(r.id)}>Duyệt</button>}
                    {r.action_completed_date && r.effectiveness_status === 'pending' && (
                      <>
                        <button onClick={() => markEffectiveness(r.id, 'effective')}>Hiệu quả</button>
                        <button onClick={() => markEffectiveness(r.id, 'ineffective')}>Không hiệu quả</button>
                      </>
                    )}
                    <input placeholder="Ghi chú" value={noteById[r.id] ?? ''} onChange={e => setNoteById(m => ({ ...m, [r.id]: e.target.value }))} />
                    <button onClick={() => noteById[r.id] && returnForRevision(r.id, noteById[r.id])}>Trả lại</button>
                    {r.approval_status !== 'approved' && (
                      <button onClick={() => noteById[r.id] && cancel(r.id, noteById[r.id])}>Hủy</button>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
