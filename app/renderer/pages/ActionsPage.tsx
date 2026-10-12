// Trang Khắc phục sự cố — BẢN TẠM của giai đoạn 2 kế hoạch làm lại NCE
// (docs/NCE-REDESIGN-2026-10-12.md). Chỉ đọc: hàng chờ theo lần chạy, danh
// sách hồ sơ và chi tiết hồ sơ do main tính. Giao diện thao tác theo từng bước
// làm ở giai đoạn 3 và thay toàn bộ tệp này.
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNceStore } from '../store/nce-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { vnDate as formatVnDate } from '../lib/format';
import { nceStatusBadge } from '../lib/nce-labels';
import { NCE_SOURCE_LABEL, NCE_TIER_LABEL } from '../../main/domain/nce/labels';
import type { NceDossierView } from '../../shared/qc-api';

const vnDate = (iso: string) => formatVnDate(iso, '—');

export function ActionsPage() {
  const { records, queue, load, get } = useNceStore(useShallow((s) => ({ records: s.records, queue: s.queue, load: s.load, get: s.get })));
  const [detail, setDetail] = useState<NceDossierView | null>(null);

  useEffect(() => { void load(); }, [load]);
  useStoreInvalidation(['nce_records', 'qc_points'], undefined, load);

  async function openDetail(id: string) { setDetail(await get(id)); }

  return (
    <div>
      <PageHeader title="Khắc phục sự cố" subtitle="Hồ sơ sự không phù hợp theo lần chạy QC" />
      <div className="alert warn">Giao diện thao tác hồ sơ NCE mới đang được hoàn thiện; trang này tạm thời chỉ để xem.</div>

      <div className="panel">
        <div className="action-card-head">
          <div><h2 className="panel-title">Lần chạy bị loại cần xử lý</h2><p>Mỗi dòng là một lần chạy; cảnh báo không vào danh sách này.</p></div>
          {queue.length > 0 && <span className="tag warn">{queue.length} lần chạy</span>}
        </div>
        {!queue.length ? <div className="alert ok">Không có lần chạy bị loại nào cần lập hồ sơ.</div> : (
          <div className="action-log-wrap"><table className="action-log-table">
            <thead><tr><th scope="col">Lần chạy</th><th scope="col">Xét nghiệm</th><th scope="col">Mức bị loại</th><th scope="col">Hồ sơ</th></tr></thead>
            <tbody>{queue.map((row) => (
              <tr key={`${row.test_id}:${row.date}:${row.run_id}`}>
                <td>{vnDate(row.date)} · lần {row.run_id || '—'}</td>
                <td>{row.test_name}</td>
                <td>{row.rejected_levels.map((l) => `M${l.level} (${l.rules.join(', ')})`).join('; ')}</td>
                <td>{row.record ? row.record.nce_id : row.attach_to ? `Có thể gắn vào ${row.attach_to.nce_id}` : 'Chưa có hồ sơ'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      <div className="panel action-log-panel">
        <div className="action-card-head"><div><h2 className="panel-title">Hồ sơ NCE</h2><p>Toàn bộ hồ sơ được lưu vết, kể cả hồ sơ đã hủy.</p></div></div>
        {!records.length ? <EmptyState title="Chưa có hồ sơ">Hồ sơ NCE sẽ xuất hiện ở đây sau khi được lập.</EmptyState> : (
          <div className="action-log-wrap"><table className="action-log-table">
            <thead><tr><th scope="col">Mã</th><th scope="col">Phát hiện</th><th scope="col">Nguồn / xét nghiệm</th><th scope="col">Phụ trách</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
            <tbody>{records.map((record) => {
              const badge = nceStatusBadge(record);
              return (
                <tr key={record.id} className={record.status === 'cancelled' ? 'action-log-row-cancelled' : undefined}>
                  <td>{record.nce_id}{record.protocol_version < 4 ? <div className="action-sub">Phiên bản cũ</div> : null}</td>
                  <td>{vnDate(record.detected_at)}{record.overdue_days > 0 ? <div className="action-sub">Quá hạn {record.overdue_days} ngày</div> : null}</td>
                  <td>{NCE_SOURCE_LABEL[record.source] || record.source}{record.test_name ? ` · ${record.test_name}` : ''}</td>
                  <td>{record.owner_name || '—'}</td>
                  <td><span className={`tag ${badge.tone}`}>{badge.label}</span></td>
                  <td><button type="button" className="btn ghost sm" onClick={() => void openDetail(record.id)}>Chi tiết</button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>

      {detail && <Modal title={`Hồ sơ ${detail.record.nce_id}`} onClose={() => setDetail(null)} footer={<button type="button" className="btn ghost" onClick={() => setDetail(null)}>Đóng</button>}>
        <p>{detail.record.description}</p>
        <p className="action-detail-muted">Xử lý tức thời: {detail.record.correction || '—'}</p>
        <p className="action-detail-muted">Tầng: {NCE_TIER_LABEL[detail.record.tier]} · Hạn {vnDate(detail.record.due_date)} · Trạng thái {nceStatusBadge(detail.record).label}</p>
        {detail.missing.length > 0 && <>
          <b>Còn thiếu để qua bước tiếp theo</b>
          <ul className="action-detail-list">{detail.missing.map((item) => <li key={item.code}>{item.message}</li>)}</ul>
        </>}
      </Modal>}
    </div>
  );
}
