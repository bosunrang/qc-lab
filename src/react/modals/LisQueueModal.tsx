import { closeModal } from '../dialogs/modal-store';
import { getKernel, useAppStore } from '../state/kernel';

type QueueRow =
  | { resolved: true; when: string; name: string; level: unknown; lot: string; value: string; runId: string; operator: string; messageId: unknown }
  | { resolved: false; when: string; analyzerId: string; testCode: string; reason: string; value: string; runId: string; operator: string; messageId: unknown };

/* Modal thứ tư của Giai đoạn 3 chuyển sang 'react' — Settings' "Xem hàng chờ QC"
   (lisOpenQueueModal). Cùng huớng sửa như ReagentPickerModal: subscribe
   useAppStore() để tự vẽ lại khi rerender() chạy sau khi Làm mới/Nhận/Bỏ —
   lis-queue-controller.ts's lisQueueRefresh/lisQueueImport/lisQueueReject giờ gọi
   deps.rerender() thay vì tự mở lại modal HTML cũ (lisRenderQueueModal(), xóa khỏi
   luồng chính, chỉ còn dùng trong a11y-audit.js's seed tắt). Logic gateway pull/check
   VẪN ở modular-pilot.js (kernel.settings.lisOpenQueueModal() trả true/false) —
   component này chỉ hiển thị dữ liệu đã có qua kernel.settings.lisQueueModel(). */
function QueueRowView({ row }: { row: QueueRow }) {
  return (
    <tr>
      <td>{row.when}</td>
      {row.resolved
        ? <td><b>{row.name}</b><div className="hint">M{String(row.level)} · Lô {row.lot}</div></td>
        : <td><b>{row.analyzerId}/{row.testCode}</b><div className="hint">{row.reason}</div></td>}
      <td className="num">{row.value}</td>
      <td>{row.runId}{row.operator ? ` · ${row.operator}` : ''}</td>
      <td className="acts">
        {row.resolved ? <button type="button" className="btn teal sm" onClick={() => getKernel().settings.lisQueueImport(row.messageId)}>Nhận</button> : null}
        <button type="button" className="btn ghost sm" onClick={() => getKernel().settings.lisQueueReject(row.messageId)}>Bỏ</button>
      </td>
    </tr>
  );
}

function QueueSection({ title, rows }: { title: string; rows: QueueRow[] }) {
  if (!rows.length) return null;
  return (
    <>
      <h4>{title} ({rows.length})</h4>
      <div className="table-wrap">
        <table className="lis-queue-table">
          <thead><tr><th>Thời gian đo</th><th>Xét nghiệm</th><th className="num">Giá trị</th><th>Lần chạy · NV</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
          <tbody>{rows.map((row, i) => <QueueRowView row={row} key={i} />)}</tbody>
        </table>
      </div>
    </>
  );
}

export function LisQueueModal() {
  useAppStore();
  const model = getKernel().settings.lisQueueModel();
  const hasAny = model.pending.length > 0 || model.unresolved.length > 0;
  return (
    <div className="modal" style={{ width: 820 }} role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h">
        <h3 id="modalTitle">QC chờ nhập từ LIS</h3>
        <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => closeModal()}>✕</button>
      </div>
      <div className="modal-b" tabIndex={0}>
        {hasAny ? (
          <>
            <QueueSection title="Sẵn sàng nhận" rows={model.pending} />
            {model.unresolved.length ? <div className="flow-panel"><QueueSection title="Chưa khớp cấu hình" rows={model.unresolved} /></div> : null}
          </>
        ) : (
          <div className="empty"><div className="empty-title">Hàng chờ trống</div><div>Không có kết quả QC nào đang chờ từ LIS Gateway.</div></div>
        )}
      </div>
      <div className="modal-f">
        <button type="button" className="btn ghost" onClick={() => getKernel().settings.lisQueueRefresh()}>Làm mới</button>
        <button type="button" className="btn ghost" onClick={() => closeModal()}>Đóng</button>
      </div>
    </div>
  );
}
