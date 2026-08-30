import { useEffect, useState } from 'react';
import { useAppStore } from '../state/kernel';
import {
  auditModel, roleLabel, formatDateTimeVN, dateBoxHtml, headOnlyHtml, auditSetQuery,
  type AuditModel,
} from '../bridge/auditBridge';

function Head() {
  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: headOnlyHtml('Nhật ký hoạt động', 'Lưu vết các thao tác quan trọng; chỉ quản trị viên được xem') }} />;
}

function DateBox({ id, value, action }: { id: string; value: string; action: string }) {
  const attrs = `aria-label="${action === 'from' ? 'Lọc nhật ký từ ngày' : 'Lọc nhật ký đến ngày'}" data-action="auditSetDate" data-args='["${action}"]' data-action-on="change"`;
  return <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: dateBoxHtml(id, value, 'audit-date', attrs) }} />;
}

function ChainStatus({ model }: { model: AuditModel }) {
  const { chain } = model;
  if (chain.idle) {
    return (
      <>
        <span className="tag none">Chưa kiểm chuỗi hash</span>{' '}
        <button className="btn ghost sm" data-action="auditVerifyChainNow">Kiểm tra chuỗi hash</button>{' '}
        <span className="hint">Nhật ký lớn ({chain.total} dòng) nên không tự kiểm mỗi lần mở trang.</span>
      </>
    );
  }
  if (chain.ok) {
    return (
      <>
        <span className="tag ok">Chuỗi hash hợp lệ</span>{' '}
        <span className="hint">{chain.checked} dòng đã khóa hash{chain.legacy ? ` · ${chain.legacy} dòng cũ chưa có hash` : ''}</span>
      </>
    );
  }
  return (
    <>
      <span className="tag rej">Audit có dấu hiệu bị sửa</span>{' '}
      <span className="hint">Lỗi tại dòng #{model.brokenSeq}: {chain.reason}</span>
    </>
  );
}

/* Ô tìm kiếm là ngoại lệ duy nhất của trang này KHÔNG dùng data-action: gõ
   chữ cần input do React kiểm soát thật (value+onChange) để không bị chính
   React ghi đè giá trị đang gõ dở — value+data-action-on="input" (không có
   onChange) khiến React coi đây là controlled input và đặt lại value về rỗng
   ngay sau mỗi phím gõ (đã kiểm chứng trực tiếp trong trình duyệt). onChange
   vẫn gọi thẳng auditSetQuery() (debounce + rerender y hệt bản cũ qua
   scheduleSearchRender) nên hành vi lọc/độ trễ không đổi — chỉ đổi cơ chế
   kích hoạt. useEffect đồng bộ ngược khi model.query đổi do nguyên nhân
   NGOÀI ô này (ví dụ bấm "Xóa bộ lọc"). */
function SearchInput({ query }: { query: string }) {
  const [value, setValue] = useState(query);
  useEffect(() => { setValue(query); }, [query]);
  return (
    <input
      id="auditSearch" type="search" aria-label="Tìm nhật ký hoạt động"
      placeholder="Tìm người dùng, hành động, đối tượng..."
      value={value}
      onChange={e => { setValue(e.target.value); auditSetQuery(e.target.value); }}
    />
  );
}

function AuditRow({ activity }: { activity: any }) {
  return (
    <tr>
      <td><div className="audit-time-cell"><span className="audit-seq">{activity.seq ? `#${activity.seq}` : ''}</span><span className="audit-time">{formatDateTimeVN(activity.ts)}</span></div></td>
      <td><b>{activity.user || ''}</b><div className="hint">{roleLabel(activity.role || 'viewer')}{activity.username ? ` · @${activity.username}` : ''}</div></td>
      <td><span className="pill">{activity.type || ''}</span></td>
      <td>{activity.target ? activity.target : <span className="hint">—</span>}</td>
      <td className="audit-detail">{activity.detail ? activity.detail : <span className="hint">—</span>}</td>
    </tr>
  );
}

export function AuditPage() {
  useAppStore();
  const model = auditModel();

  return (
    <>
      <Head />
      <div className="panel">
        <h2 className="panel-title">Công cụ</h2>
        <div className="row-flex">
          <button className="btn teal sm" data-action="exportActivityCSV">Xuất CSV nhật ký</button>
          {model.total > 0 && <button className="btn ghost sm" data-action="archiveActivityLog">Lưu trữ nhật ký cũ</button>}
        </div>
        <div className="hint audit-summary-status flow-item">
          {model.total} dòng hoạt động đã ghi nhận.{' '}
          <ChainStatus model={model} />
          {model.oversize && (
            <>
              {' '}<span className="tag warn">Nhật ký đang rất lớn</span>{' '}
              <span className="hint">Nên lưu trữ bớt dòng cũ — hệ thống sẽ tự xoay vòng ở {model.hardCap} dòng (không xuất CSV).</span>
            </>
          )}
        </div>
      </div>
      <div className="panel audit-log-panel">
        <div className="audit-log-head">
          <h2 className="panel-title">Hoạt động gần đây</h2>
          <SearchInput query={model.query} />
        </div>
        <div className="audit-filterbar">
          <div><label>Từ ngày</label><DateBox id="auditFromDate" value={model.from} action="from" /></div>
          <div><label>Đến ngày</label><DateBox id="auditToDate" value={model.to} action="to" /></div>
          <div>
            <label>Số dòng mỗi trang</label>
            <select aria-label="Số dòng nhật ký mỗi trang" data-action="auditSetPageSize" data-action-on="change" defaultValue={model.pageSize}>
              {model.pageSizes.map(size => <option value={size} key={size}>{size} dòng</option>)}
            </select>
          </div>
          {model.hasFilter && <button className="btn ghost sm audit-clear-filter" data-action="auditClearFilters">Xóa bộ lọc</button>}
          <div className="audit-filter-summary" role="status">{model.filteredCount}/{model.total} dòng</div>
        </div>
        {model.rows.length ? (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
              <tbody>{model.rows.map((activity, i) => <AuditRow activity={activity} key={activity.seq ?? i} />)}</tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <div className="empty-title">{model.total ? 'Không tìm thấy nhật ký' : 'Chưa có hoạt động'}</div>
            <div>{model.total ? 'Thử từ khóa hoặc khoảng ngày khác.' : 'Nhật ký sẽ bắt đầu ghi từ các thao tác tiếp theo.'}</div>
          </div>
        )}
        {model.filteredCount > 0 && (
          <div className="audit-pagination">
            <span className="hint">Hiển thị {model.resultFrom}–{model.resultTo} / {model.filteredCount} dòng</span>
            <div>
              <button className="btn ghost sm" data-action="auditSetPage" data-args={JSON.stringify([model.page - 1])} disabled={model.page <= 1}>‹ Trước</button>
              <b>Trang {model.page}/{model.pageCount}</b>
              <button className="btn ghost sm" data-action="auditSetPage" data-args={JSON.stringify([model.page + 1])} disabled={model.page >= model.pageCount}>Sau ›</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
