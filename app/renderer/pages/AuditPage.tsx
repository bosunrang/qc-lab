// Nhật ký hoạt động — Giai đoạn B8 (docs/APP-V2-PLAN.md): xuất CSV, lưu trữ
// log cũ (12/24/36 tháng, qua reauth vì đây là thao tác không thể hoàn tác),
// nút xác minh chuỗi hash thủ công.
import { useEffect, useRef, useState } from 'react';
import { useAuditStore, type ChainVerifyView } from '../store/audit-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { Modal } from '../components/Modal';
import { DateField } from '../components/DateField';
import { confirmDialog, reauthDialog, infoDialog } from '../state/dialog-store';
import { PageHeader } from '../components/PageHeader';
import { roleLabel } from '../lib/permissions';
import { formatAuditDateTimeVN, formatAuditDetailVN } from '../../main/domain/audit-format';

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const AUTO_VERIFY_MAX = 5000;

export function AuditPage() {
  const { result, error, query, from, to, pageSize, load, setQuery, setRange, setPage, setPageSize, clearFilters, exportCsv, verifyChainNow, archive } = useAuditStore();
  const [archiving, setArchiving] = useState(false);
  const [chain, setChain] = useState<ChainVerifyView | null>(null);
  const chainEpoch = useRef(0);
  /** Ngưỡng tự kiểm chuỗi hash — app cũ (`AUDIT_AUTO_VERIFY_MAX`) tự kiểm khi
   * nhật ký còn nhỏ và chỉ đưa nút bấm khi log lớn, để không băm lại hàng
   * chục nghìn dòng mỗi lần mở trang. */

  useEffect(() => { load(); }, [load]);

  async function refreshChain() {
    const epoch = chainEpoch.current;
    const result = await verifyChainNow();
    // Khi nhật ký đổi giữa lúc băm, kết quả cũ không còn nói về tập dòng hiện
    // tại. Bỏ nó và để lần nạp tiếp theo tự kiểm lại.
    if (result.ok && epoch === chainEpoch.current) setChain(result.data);
    return result;
  }

  // Tự kiểm chuỗi hash khi nhật ký còn nhỏ, đúng app cũ.
  useEffect(() => {
    if (chain || !result.total || result.total > AUTO_VERIFY_MAX) return;
    // `r.ok` là cổng quyền, `r.data.ok` mới là kết luận chuỗi hash. Bị chặn
    // thì im lặng — băng lỗi phía trên đã nói rõ lý do, không cần lặp lại.
    void refreshChain();
  }, [result.total, chain]); // eslint-disable-line react-hooks/exhaustive-deps
  function reloadAfterActivityChange() {
    // Kết luận hash chỉ đúng với đúng tập dòng vừa kiểm. Main báo thay đổi
    // trước khi trang nạp lại, nên bỏ kết luận cũ để tự kiểm lại khi phù hợp.
    chainEpoch.current += 1;
    setChain(null);
    void load();
  }
  useStoreInvalidation(['activity'], undefined, reloadAfterActivityChange);

  async function onExport() {
    const csv = await exportCsv();
    if (!csv.ok) { await infoDialog(csv.error.message); return; }
    downloadCsv(csv.data, `nhat-ky-hoat-dong-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async function onVerify() {
    const r = await refreshChain();
    if (!r.ok) { await infoDialog(r.error.message); return; }
  }

  const hasFilter = !!(query || from || to);

  return (
    <div>
      <PageHeader title="Nhật ký hoạt động" subtitle="Lưu vết các thao tác quan trọng; chỉ quản trị viên được xem" />
      {error && <div className="panel"><p className="field-error audit-page-error">{error}</p></div>}
      <div className="panel audit-tools-panel">
        <div className="panel-head audit-tools-head"><h2>Công cụ</h2></div>
        <div className="audit-tools-body">
          <div className="audit-tools-actions">
            <button className="btn teal sm" onClick={onExport}>Xuất CSV nhật ký</button>
            {result.total > 0 && <button className="btn ghost sm" onClick={() => setArchiving(true)}>Lưu trữ nhật ký cũ</button>}
          </div>
          <div className="audit-integrity-summary">
            <div className="audit-integrity-total"><b>{result.total}</b><span>dòng hoạt động đã ghi nhận</span></div>
            <AuditIntegrityStatus chain={chain} total={result.total} needsManualVerification={result.total > AUTO_VERIFY_MAX} onVerify={onVerify} />
          </div>
        </div>
      </div>

      <div className="panel audit-log-panel">
        <div className="audit-log-head">
          <h2 className="panel-title">Hoạt động gần đây</h2>
          <input type="search" aria-label="Tìm trong nhật ký hoạt động" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo nội dung…" />
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
              <thead><tr><th scope="col">Thời gian</th><th scope="col">Người dùng</th><th scope="col">Hành động</th><th scope="col">Đối tượng</th><th scope="col">Chi tiết</th></tr></thead>
              <tbody>
                {result.rows.map((a) => (
                  <tr key={a.id}>
                    <td><div className="audit-time-cell"><span className="audit-seq">#{a.seq}</span><span className="audit-time">{formatAuditDateTimeVN(a.ts)}</span></div></td>
                    <td><b>{a.user || ''}</b><div className="hint">{roleLabel(a.role)}{a.username ? ` · @${a.username}` : ''}</div></td>
                    <td><span className="pill">{a.type}</span></td>
                    <td>{a.target || <span className="hint">—</span>}</td>
                    <td className="audit-detail">{a.detail ? formatAuditDetailVN(a.detail) : <span className="hint">—</span>}</td>
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
            <span className="hint">Hiển thị {result.resultFrom}–{result.resultTo} / {result.filteredCount} dòng</span>
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

function AuditIntegrityStatus({
  chain, total, needsManualVerification, onVerify,
}: {
  chain: ChainVerifyView | null;
  total: number;
  needsManualVerification: boolean;
  onVerify: () => void;
}) {
  if (!total) return <div className="audit-integrity-status"><span className="tag none">Chưa có nhật ký</span><span>Chưa có dòng nào để kiểm tra chuỗi hash.</span></div>;
  if (!chain) {
    return (
      <div className="audit-integrity-status">
        {needsManualVerification ? <><span className="tag none">Chưa kiểm chuỗi hash</span><button className="btn ghost sm" onClick={onVerify}>Kiểm tra chuỗi hash</button><span>Nhật ký lớn ({total} dòng) nên không tự kiểm mỗi lần mở trang.</span></> : <><span className="tag none">Đang kiểm chuỗi hash</span><span>Hệ thống đang tự xác minh toàn vẹn nhật ký.</span></>}
      </div>
    );
  }
  if (chain.ok) {
    return (
      <div className="audit-integrity-status">
        <span className="tag ok">Chuỗi hash hợp lệ</span>
        <span>{chain.checked} dòng đã khóa hash{chain.legacy ? ` · ${chain.legacy} dòng cũ chưa có hash` : ''}</span>
      </div>
    );
  }
  return (
    <div className="audit-integrity-status audit-integrity-error">
      <span className="tag rej">Audit có dấu hiệu bị sửa</span>
      <span>Lỗi tại dòng #{chain.brokenIndex + 1}: {chain.reason}</span>
    </div>
  );
}

function ArchiveModal({ onClose }: { onClose: () => void }) {
  const { archive, previewArchive } = useAuditStore();
  const [months, setMonths] = useState<'12' | '24' | '36'>('24');
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const preview = await previewArchive(Number(months) as 12 | 24 | 36);
    if (!preview.ok) { setErr(preview.error.message); return; }
    if (!preview.data.removedCount) {
      await infoDialog('Không có dòng nhật ký nào cũ hơn mốc đã chọn.');
      onClose();
      return;
    }
    const firstConfirm = await confirmDialog(
      `Xuất CSV rồi gỡ ${preview.data.removedCount} dòng nhật ký cũ hơn ${months} tháng? Còn lại ${preview.data.retainedCount} dòng trong hệ thống. File CSV giữ nguyên PrevHash/Hash để nối tiếp và kiểm chứng chuỗi còn lại.`,
      { title: 'Lưu trữ nhật ký cũ', confirmLabel: 'Lưu trữ', cancelLabel: 'Hủy', danger: true },
    );
    if (!firstConfirm) return;
    const ok = await reauthDialog({ message: 'Lưu trữ (xoá) nhật ký cũ là thao tác không thể hoàn tác — xác thực lại mật khẩu.' });
    if (!ok) return;
    // CSV là đúng đoạn sẽ bị gỡ, gồm PrevHash/Hash. Nếu bước tải gây lỗi thì
    // luồng dừng trước khi gọi archive(), nên không thể xoá mà mất bản lưu.
    try {
      downloadCsv(preview.data.csv, `luu-tru-nhat-ky-${preview.data.cutoffIso.slice(0, 10)}.csv`);
    } catch {
      setErr('Không tạo được file CSV lưu trữ. Nhật ký chưa bị thay đổi.');
      return;
    }
    const downloaded = await confirmDialog(
      'Mở thư mục Tải xuống và kiểm tra file vừa tải có mở được, đủ dòng và đủ cột PrevHash/Hash.',
      { title: 'Đã có file CSV lưu trữ chưa?', confirmLabel: 'Đã kiểm tra, gỡ khỏi hệ thống', cancelLabel: 'Chưa, giữ nguyên', danger: true },
    );
    if (!downloaded) return;
    const result = await archive(Number(months) as 12 | 24 | 36);
    if (!result.ok) { setErr(result.error.message); return; }
    await infoDialog(result.data.removedCount > 0 ? `Đã lưu trữ ${result.data.removedCount} dòng cũ hơn ${months} tháng.` : 'Không có dòng nào cũ hơn mốc đã chọn.', { type: 'success' });
    onClose();
  }

  return (
    <Modal title="Lưu trữ nhật ký cũ" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Lưu trữ</button></>}>
      {err && <p className="field-error">{err}</p>}
      <p className="audit-archive-copy">Xuất CSV của đúng phần sẽ lưu trữ, gồm PrevHash/Hash để đối chiếu chuỗi. Sau khi xác thực lại, hệ thống chỉ xoá khi bạn xác nhận đã kiểm tra file tải về.</p>
      <div className="field">
        <label>Giữ lại dữ liệu trong</label>
        <select value={months} onChange={(e) => setMonths(e.target.value as never)}>
          <option value="12">12 tháng gần nhất</option><option value="24">24 tháng gần nhất</option><option value="36">36 tháng gần nhất</option>
        </select>
      </div>
    </Modal>
  );
}
