import { useEffect } from 'react';
import { useAuditStore } from '../store/audit-store';

export function AuditPage() {
  const { result, query, from, to, load, setQuery, setRange, setPage } = useAuditStore();

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Nhật ký hoạt động (thí điểm)</h1>

      <div>
        <input placeholder="Tìm kiếm…" value={query} onChange={e => setQuery(e.target.value)} />
        {' '}Từ: <input type="date" value={from} onChange={e => setRange(e.target.value, to)} />
        {' '}Đến: <input type="date" value={to} onChange={e => setRange(from, e.target.value)} />
      </div>

      <table style={{ marginTop: 16, borderCollapse: 'collapse' }}>
        <thead><tr><th>#</th><th>Thời gian</th><th>Người dùng</th><th>Vai trò</th><th>Loại</th><th>Chi tiết</th><th>Đối tượng</th></tr></thead>
        <tbody>
          {result.rows.map(a => (
            <tr key={a.id}>
              <td>{a.seq}</td><td>{a.ts}</td><td>{a.user}</td><td>{a.role}</td><td>{a.type}</td><td>{a.detail}</td><td>{a.target}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 8 }}>
        Dòng {result.resultFrom}–{result.resultTo} — trang {result.page}/{result.pageCount}
        {' '}
        <button disabled={result.page <= 1} onClick={() => setPage(result.page - 1)}>← Trước</button>
        {' '}
        <button disabled={result.page >= result.pageCount} onClick={() => setPage(result.page + 1)}>Sau →</button>
      </div>
    </div>
  );
}
