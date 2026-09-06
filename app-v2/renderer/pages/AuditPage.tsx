// Nhật ký hoạt động — Giai đoạn B8 (docs/APP-V2-PLAN.md): xuất CSV, lưu trữ
// log cũ (12/24/36 tháng, qua reauth vì đây là thao tác không thể hoàn tác),
// nút xác minh chuỗi hash thủ công.
import { useEffect, useState } from 'react';
import { useAuditStore } from '../store/audit-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { Modal } from '../components/Modal';
import { DateField } from '../components/DateField';
import { reauthDialog, infoDialog } from '../state/dialog-store';
import { PageHeader } from '../components/PageHeader';
import { roleLabel } from '../lib/permissions';

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** `formatDateTimeVN()` app cũ. */
function formatDateTimeVN(value: string): string {
  const date = new Date(value);
  return isNaN(+date) ? '' : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('vi-VN');
}

export function AuditPage() {
  const { result, query, from, to, pageSize, load, setQuery, setRange, setPage, setPageSize, clearFilters, exportCsv, verifyChainNow, archive } = useAuditStore();
  const [archiving, setArchiving] = useState(false);
  const [chain, setChain] = useState<{ ok: boolean; checked: number; legacy: number; brokenIndex: number; reason: string } | null>(null);
  /** Ngưỡng tự kiểm chuỗi hash — app cũ (`AUDIT_AUTO_VERIFY_MAX`) tự kiểm khi
   * nhật ký còn nhỏ và chỉ đưa nút bấm khi log lớn, để không băm lại hàng
   * chục nghìn dòng mỗi lần mở trang. */
  const AUTO_VERIFY_MAX = 5000;

  useEffect(() => { load(); }, [load]);
  // Tự kiểm chuỗi hash khi nhật ký còn nhỏ, đúng app cũ.
  useEffect(() => {
    if (chain || !result.total || result.total > AUTO_VERIFY_MAX) return;
    verifyChainNow().then(setChain);
  }, [result.total, chain]); // eslint-disable-line react-hooks/exhaustive-deps
  useStoreInvalidation(['activity'], undefined, load);

  async function onExport() {
    const csv = await exportCsv();
    downloadCsv(csv, `nhat-ky-hoat-dong-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async function onVerify() {
    setChain(await verifyChainNow());
  }

  const hasFilter = !!(query || from || to);

  return (
    <div>
      <PageHeader title="Nhật ký hoạt động" subtitle="Lưu vết các thao tác quan trọng; chỉ quản trị viên được xem" />
      <div className="panel">
        <div className="panel-head"><h2>Công cụ</h2></div>
        <div className="row-flex" style={{ margin: '0 var(--space-panel)' }}>
          <button className="btn teal sm" onClick={onExport}>Xuất CSV nhật ký</button>
          {result.resultTo > 0 && <button className="btn ghost sm" onClick={() => setArchiving(true)}>Lưu trữ nhật ký cũ</button>}
        </div>
        <div className="hint audit-summary-status flow-item">
          {result.total} dòng hoạt động đã ghi nhận.{' '}
          {!chain ? (
            <>
              <span className="tag none">Chưa kiểm chuỗi hash</span>{' '}
              <button className="btn ghost sm" onClick={onVerify}>Kiểm tra chuỗi hash</button>{' '}
              <span className="hint">Nhật ký lớn ({result.total} dòng) nên không tự kiểm mỗi lần mở trang.</span>
            </>
          ) : chain.ok ? (
            <>
              <span className="tag ok">Chuỗi hash hợp lệ</span>{' '}
              <span className="hint">{chain.checked} dòng đã khóa hash{chain.legacy ? ` · ${chain.legacy} dòng cũ chưa có hash` : ''}</span>
            </>
          ) : (
            <>
              <span className="tag rej">Audit có dấu hiệu bị sửa</span>{' '}
              <span className="hint">Lỗi tại dòng #{chain.brokenIndex + 1}: {chain.reason}</span>
            </>
          )}
        </div>
      </div>

      <div className="panel audit-log-panel">
        <div className="audit-log-head">
          <h2 className="panel-title">Hoạt động gần đây</h2>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo nội dung…" />
        </div>
        <div className="audit-filterbar">
          <DateField label="Từ ngày" className="audit-date" value={from} onChange={(v) => setRange(v, to)} />
          <DateField label="Đến ngày" className="audit-date" value={to} onChange={(v) => setRange(from, v)} />
          <div><label>Số dòng mỗi trang</label>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option value={25}>25 dòng</option><option value={50}>50 dòng</option><option value={100}>100 dòng</option>
            </select>
          </div>
          {hasFilter && <button className="btn ghost sm audit-clear-filter" onClick={clearFilters}>Xóa bộ lọc</button>}
          <div className="audit-filter-summary" role="status">{result.filteredCount}/{result.total} dòng</div>
        </div>

        {result.rows.length ? (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
              <tbody>
                {result.rows.map((a) => (
                  <tr key={a.id}>
                    <td><div className="audit-time-cell"><span className="audit-seq">#{a.seq}</span><span className="audit-time">{formatDateTimeVN(a.ts)}</span></div></td>
                    <td><b>{a.user || ''}</b><div className="hint">{roleLabel(a.role)}{a.username ? ` · @${a.username}` : ''}</div></td>
                    <td><span className="pill">{a.type}</span></td>
                    <td>{a.target || <span className="hint">—</span>}</td>
                    <td className="audit-detail">{a.detail || <span className="hint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty"><div className="empty-title">Không có dữ liệu phù hợp</div><div>Thử xoá bộ lọc hoặc chọn khoảng ngày khác.</div></div>
        )}

        {result.resultTo > 0 && (
          <div className="audit-pagination">
            <span className="hint">Hiển thị {result.resultFrom}–{result.resultTo} / {result.resultTo} dòng</span>
            <div>
              <button className="btn ghost sm" disabled={result.page <= 1} onClick={() => setPage(result.page - 1)}>‹ Trước</button>
              <b>Trang {result.page}/{result.pageCount}</b>
              <button className="btn ghost sm" disabled={result.page >= result.pageCount} onClick={() => setPage(result.page + 1)}>Sau ›</button>
            </div>
          </div>
        )}
      </div>

      {archiving && <ArchiveModal onClose={() => setArchiving(false)} />}
    </div>
  );
}

function ArchiveModal({ onClose }: { onClose: () => void }) {
  const { archive, exportCsv } = useAuditStore();
  const [months, setMonths] = useState<'12' | '24' | '36'>('24');
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const ok = await reauthDialog({ message: 'Lưu trữ (xoá) nhật ký cũ là thao tác không thể hoàn tác — xác thực lại mật khẩu.' });
    if (!ok) return;
    // Xuất CSV toàn bộ log HIỆN CÓ trước khi cắt — người dùng luôn có bản sao
    // trước khi phần cũ biến mất khỏi bảng sống.
    const csv = await exportCsv();
    downloadCsv(csv, `luu-tru-nhat-ky-truoc-khi-cat-${new Date().toISOString().slice(0, 10)}.csv`);
    const result = await archive(Number(months) as 12 | 24 | 36);
    if (!result.ok) { setErr(result.error.message); return; }
    await infoDialog(result.data.removedCount > 0 ? `Đã lưu trữ ${result.data.removedCount} dòng cũ hơn ${months} tháng.` : 'Không có dòng nào cũ hơn mốc đã chọn.', { type: 'success' });
    onClose();
  }

  return (
    <Modal title="Lưu trữ nhật ký cũ" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Lưu trữ</button></>}>
      {err && <p className="field-error">{err}</p>}
      <p style={{ marginBottom: 'var(--space-md)' }}>Xoá vĩnh viễn các dòng nhật ký cũ hơn mốc thời gian đã chọn khỏi bảng đang dùng. Một bản CSV đầy đủ sẽ được tải về TRƯỚC KHI xoá.</p>
      <div className="field">
        <label>Giữ lại dữ liệu trong</label>
        <select value={months} onChange={(e) => setMonths(e.target.value as never)}>
          <option value="12">12 tháng gần nhất</option><option value="24">24 tháng gần nhất</option><option value="36">36 tháng gần nhất</option>
        </select>
      </div>
    </Modal>
  );
}
