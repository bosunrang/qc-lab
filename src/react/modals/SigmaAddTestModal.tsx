import { useState } from 'react';
import { closeModal } from '../dialogs/modal-store';
import { getKernel } from '../state/kernel';

type AddTestRow = { id: string; tracked: boolean; current: boolean; name: string; meta: string; action: 'view' | 'track'; label: string };

/* Modal thứ mười của Giai đoạn 3 chuyển sang 'react' — Six Sigma's "Chọn
   hoặc thêm xét nghiệm" (sgOpenAddTest). Cùng dạng picker-tìm-kiếm như
   ReagentPickerModal: query qua useState cục bộ, không debounce (lọc mảng
   trong React rẻ hơn dựng lại chuỗi HTML). sgOpenAddTestModel() (chỉ kiểm
   quyền admin, đồng bộ) tách khỏi việc mở modal — bridge gọi rồi mới
   openReactModal() nếu true, giống mọi modal Giai đoạn 3 khác. */
export function SigmaAddTestModal() {
  const [query, setQuery] = useState('');
  const rows: AddTestRow[] = getKernel().sigma.sgAddTestPickerItems(query);
  /* Lọc với query rỗng trả về TOÀN BỘ xét nghiệm không đổi — nên rows rỗng VÀ
     query rỗng chỉ có thể nghĩa là Cấu hình chung chưa có xét nghiệm nào,
     khác với "đã có xét nghiệm nhưng tìm không khớp" (rows rỗng, có query). */
  const noTestsAtAll = !query && rows.length === 0;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h">
        <h3 id="modalTitle">Chọn hoặc thêm xét nghiệm vào Six Sigma</h3>
        <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => closeModal()}>✕</button>
      </div>
      <div className="modal-b">
        {noTestsAtAll ? null : <input id="sgAddTestSearch" type="search" placeholder="Tìm tên xét nghiệm, máy hoặc đơn vị..." value={query} onChange={e => setQuery(e.target.value)} autoFocus />}
        <div className="sg-add-test-list">
          {rows.length ? rows.map(row => (
            <button
              type="button"
              className={`refrow sg-add-test-row${row.tracked ? ' is-tracked' : ''}${row.current ? ' is-current' : ''}`}
              aria-current={row.current ? 'true' : undefined}
              key={row.id}
              onClick={() => row.action === 'view' ? getKernel().sigma.sgViewTrackedTest(row.id) : getKernel().sigma.sgTrackTest(row.id)}
            >
              <span><b>{row.name}</b><span className="meta">{row.meta}</span></span>
              <span className={`tag ${row.tracked ? 'ok' : 'none'}`}>{row.label}</span>
            </button>
          )) : noTestsAtAll ? (
            <div className="empty"><div className="empty-title">Chưa có xét nghiệm trong Cấu hình chung</div><div>Hãy nhập xét nghiệm tại Cấu hình chung › Danh mục xét nghiệm trước khi thêm vào Six Sigma.</div></div>
          ) : (
            <div className="empty">Không tìm thấy xét nghiệm phù hợp.</div>
          )}
        </div>
      </div>
      <div className="modal-f">
        <button type="button" className="btn ghost" onClick={() => closeModal()}>Đóng</button>
      </div>
    </div>
  );
}
