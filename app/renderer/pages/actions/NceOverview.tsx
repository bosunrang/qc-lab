// Tổng quan ưu tiên việc cần làm; kết luận và số ngày quá hạn do main tính.
import { useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNceStore } from '../../store/nce-store';
import { useAuthStore } from '../../store/auth-store';
import { canWrite } from '../../lib/permissions';
import { EmptyState } from '../../components/EmptyState';
import { useAsyncAction } from '../../components/AsyncButton';
import { withDeadline } from '../../lib/async-deadline';
import { sendClientError } from '../../lib/unhandled-errors';
import { confirmDialog, errorDialog } from '../../state/dialog-store';
import { nceStatusBadge } from '../../lib/nce-labels';
import { NCE_SOURCE_LABEL } from '../../../main/domain/nce/labels';
import type { NceDossierView, NceQueueRowView } from '../../../shared/qc-api';
import { filterNceRecords, nceFilterCounts, nceRunLabel, NCE_LIST_FILTERS, type NceListFilter } from '../../../main/domain/nce/presentation';
import { CreateNceModal, type NceCreatePrefill } from './CreateNceModal';
import { dateText } from './shared';
import { nceSearchText, NEXT_STEP_TEXT } from './workflow';
import { QUEUE_PAGE_SIZE, queuePage, queueTestOptions } from './queue-groups';
import { Pagination, pageBounds } from '../../components/Pagination';
import { assertDossier } from './dossier-data';

function queueSummary(row: NceQueueRowView): string {
  return row.rejected_levels.map(queueLevelLabel).join('; ');
}

function queueLevelLabel(level: NceQueueRowView['rejected_levels'][number]): string {
  const rules = level.rules.length ? ` (${level.rules.join(', ')})` : '';
  return `M${level.level}${rules}`;
}

function SummaryCard({ tone, urgent = false, label, value, detail, onClick }: {
  tone: 'info' | 'warning' | 'success' | 'danger';
  urgent?: boolean;
  label: string;
  value: number;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`nce-summary-card is-${tone}${urgent ? ' is-urgent' : ''}`} onClick={onClick}>
      <span>{label}</span>
      <b>{value}</b>
      <small>{detail}</small>
    </button>
  );
}

/** Một lần chạy trong bảng hàng chờ; tên xét nghiệm nằm ở dòng nhóm phía trên. */
function QueueRow({ row, writable, busy, onOpen, onAttach, onCreate }: {
  row: NceQueueRowView;
  writable: boolean;
  busy: boolean;
  onOpen: (id: string) => void;
  onAttach: (row: NceQueueRowView) => void;
  onCreate: (row: NceQueueRowView) => void;
}) {
  const dossier = row.record;
  const attachTo = row.attach_to;

  return (
    <tr className={`nce-queue-item${dossier ? ' is-tracked' : ''}`} aria-label={`Sự cố ${row.test_name} ${row.date} ${row.run_id}`}>
      <td>{nceRunLabel({ date: row.date, runId: row.run_id })}</td>
      <td><div className="nce-queue-levels">
        {row.rejected_levels.map((level) => <span className="tag rej" key={`${level.level}:${level.point_id}`}>{queueLevelLabel(level)}</span>)}
      </div></td>
      <td>
        <span className={`tag ${dossier ? 'warn' : 'rej'}`}>{dossier ? 'Đã có hồ sơ' : 'Chưa có hồ sơ'}</span>
        {dossier
          ? <div className="nce-sub">Đang xử lý trong {dossier.nce_id}</div>
          : attachTo && <div className="nce-sub">Cùng xét nghiệm có hồ sơ {attachTo.nce_id} đang mở.</div>}
      </td>
      <td className="nce-col-action"><div className="nce-queue-actions">
        {dossier && <button type="button" className="btn ghost sm" disabled={busy} onClick={() => onOpen(dossier.id)}>Mở hồ sơ</button>}
        {!dossier && attachTo && writable && <button type="button" className="btn sm" disabled={busy} onClick={() => onAttach(row)}>Gắn vào {attachTo.nce_id}</button>}
        {!dossier && writable && <button type="button" className={`btn sm${attachTo ? ' ghost' : ''}`} disabled={busy} onClick={() => onCreate(row)}>Lập hồ sơ</button>}
      </div></td>
    </tr>
  );
}

export function NceOverview({ onOpen }: { onOpen: (id: string) => void }) {
  const { records, queue, attachRun, get, loading, error, load } = useNceStore(useShallow((s) => ({ records: s.records, queue: s.queue, attachRun: s.attachRun, get: s.get, loading: s.loading, error: s.error, load: s.load })));
  const user = useAuthStore((s) => s.user);
  const writable = canWrite(user?.role);
  const [filter, setFilter] = useState<NceListFilter>('active');
  const [query, setQuery] = useState('');
  const [showTracked, setShowTracked] = useState(false);
  const [creating, setCreating] = useState<{ prefill: NceCreatePrefill | null } | null>(null);
  const queueRef = useRef<HTMLElement>(null);
  const recordsRef = useRef<HTMLElement>(null);
  const counts = useMemo(() => nceFilterCounts(records, user?.id ?? ''), [records, user?.id]);
  const untracked = queue.filter((row) => !row.record);
  const visibleQueue = showTracked ? queue : untracked;
  const [queueTest, setQueueTest] = useState('');
  const [queuePageNo, setQueuePageNo] = useState(1);
  const testOptions = useMemo(() => queueTestOptions(visibleQueue), [visibleQueue]);
  // Xét nghiệm đang lọc không còn trong hàng chờ (đã lập hồ sơ hết) thì về "Tất cả".
  const activeTest = testOptions.some((option) => option.testId === queueTest) ? queueTest : '';
  const queueView = useMemo(() => queuePage(visibleQueue, activeTest, queuePageNo), [visibleQueue, activeTest, queuePageNo]);
  const shown = useMemo(() => {
    const search = nceSearchText(query);
    return filterNceRecords(records, filter, user?.id ?? '')
      .filter((record) => !search || nceSearchText([record.nce_id, record.description, record.test_name, record.owner_name, NCE_SOURCE_LABEL[record.source]].join(' ')).includes(search))
      // Danh sách hồ sơ là nhật ký tạo mới; hồ sơ quá hạn vẫn được nhận diện
      // ở cột hạn và thẻ tổng quan, không được đẩy hồ sơ mới xuống cuối bảng.
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.updated_at.localeCompare(a.updated_at) || b.nce_id.localeCompare(a.nce_id));
  }, [records, filter, query, user?.id]);

  function selectFilter(next: NceListFilter) {
    setFilter(next);
    recordsRef.current?.scrollIntoView({ block: 'start' });
  }

  const { busy: attaching, run: attach } = useAsyncAction(async (row: NceQueueRowView) => {
    if (!row.attach_to) return;
    if (!(await confirmDialog(`Gắn lần chạy ${nceRunLabel({ date: row.date, runId: row.run_id })} vào hồ sơ ${row.attach_to.nce_id}? QC tiếp tục bị loại sau xử lý tức thời nên hồ sơ sẽ phải xử lý theo CAPA đầy đủ.`, { title: 'Gắn vào hồ sơ đang mở', confirmLabel: 'Gắn vào hồ sơ', cancelLabel: 'Quay lại', danger: false }))) return;
    let current: NceDossierView | null;
    const targetId = row.attach_to.id;
    try {
      current = await withDeadline(() => get(targetId), 30_000);
      if (current !== null) assertDossier(current, targetId);
    } catch (error) {
      sendClientError(error);
      await errorDialog('Không tải được hồ sơ để gắn lần chạy. Thử lại sau khi kết nối ổn định.');
      return;
    }
    if (!current) { await errorDialog('Hồ sơ không còn tồn tại. Tải lại danh sách để đối chiếu.'); void load(); return; }
    let attached: NceDossierView;
    try {
      const result = await withDeadline(() => attachRun({ id: current.record.id, expectedVersion: current.record.row_version, run: { date: row.date, runId: row.run_id } }), 30_000);
      if (!result.ok) {
        if (result.error.code === 'internal-error') throw new Error(result.error.message);
        await errorDialog(result.error.message); return;
      }
      attached = result.data;
      assertDossier(attached, current.record.id);
    } catch (error) {
      sendClientError(error);
      // Không tự gắn lại khi mất phản hồi; mở hồ sơ để đối chiếu lệnh đã gửi.
      await errorDialog('Chưa xác nhận được lần chạy đã được gắn hay chưa. Mở hồ sơ để đối chiếu trước khi thao tác lại.');
      onOpen(current.record.id);
      return;
    }
    onOpen(attached.record.id);
  });

  function createFromRun(row: NceQueueRowView) {
    setCreating({ prefill: { testId: row.test_id, testName: row.test_name, date: row.date, runId: row.run_id, summary: `Lần chạy bị loại: ${queueSummary(row)}.` } });
  }

  function created(dossier: NceDossierView) { setCreating(null); onOpen(dossier.record.id); }

  // Tải lại một danh sách đang trống vẫn phải giữ hộp thoại/bản nháp đang mở.
  const idle = !creating && !attaching;
  if (idle && loading && !records.length && !queue.length) return <div className="panel"><EmptyState title="Đang tải sự cố và hồ sơ xử lý…" /></div>;
  if (idle && error && !records.length && !queue.length) return <div className="panel"><EmptyState title="Không tải được danh sách sự cố" action={<button type="button" className="btn" onClick={() => void load()}>Thử lại</button>}>{error}</EmptyState></div>;

  return (
    <div className="nce-overview">
      <div className="nce-overview-intro">
        <div><h2>Việc cần xử lý</h2><p>Lập hồ sơ cho sự cố mới hoặc tiếp tục công việc đang phụ trách.</p></div>
        {writable && <button type="button" className="btn" disabled={attaching} onClick={() => setCreating({ prefill: null })}>+ Lập hồ sơ từ nguồn khác</button>}
      </div>
      {error && <div className="alert rej" role="alert">{error}<button type="button" className="btn ghost sm" onClick={() => void load()}>Thử lại</button></div>}
      <div className="nce-summary" aria-label="Tình hình xử lý sự cố">
        <SummaryCard tone="info" urgent={untracked.length > 0} label="QC cần lập hồ sơ" value={untracked.length} detail="Lần chạy bị loại chưa có hồ sơ" onClick={() => queueRef.current?.scrollIntoView({ block: 'start' })} />
        <SummaryCard tone="warning" label="Đang xử lý" value={counts.active} detail="Hồ sơ chưa đóng" onClick={() => selectFilter('active')} />
        <SummaryCard tone="success" label="Chờ duyệt" value={counts.approve} detail="Cần người duyệt độc lập" onClick={() => selectFilter('approve')} />
        <SummaryCard tone="danger" urgent={counts.overdue > 0} label="Quá hạn" value={counts.overdue} detail="Hồ sơ hoặc hành động quá hạn" onClick={() => selectFilter('overdue')} />
      </div>

      <section className="panel nce-overview-section" aria-label="Lần chạy QC cần xử lý" ref={queueRef}>
        <div className="panel-head">
          <h2>Lần chạy QC cần xử lý <span className="count">{visibleQueue.length}</span></h2>
          <div className="nce-queue-tools">
            {testOptions.length > 1 && <select aria-label="Lọc lần chạy theo xét nghiệm" value={activeTest} onChange={(event) => { setQueueTest(event.target.value); setQueuePageNo(1); }}>
              <option value="">Tất cả xét nghiệm ({visibleQueue.length})</option>
              {testOptions.map((option) => <option key={option.testId} value={option.testId}>{option.testName} ({option.count})</option>)}
            </select>}
            {queue.some((row) => row.record) && <button type="button" className="btn ghost sm" aria-pressed={showTracked} onClick={() => { setShowTracked((value) => !value); setQueuePageNo(1); }}>{showTracked ? 'Chỉ xem lần chưa có hồ sơ' : `Xem cả lần đã có hồ sơ (${queue.length - untracked.length})`}</button>}
          </div>
        </div>
        <div className="nce-section-body">
          {!visibleQueue.length
            ? <EmptyState size="compact" title="Không có lần chạy QC mới cần lập hồ sơ">{queue.length ? 'Các lần chạy bị loại đã có hồ sơ. Tiếp tục xử lý trong danh sách bên dưới.' : 'Các sự cố đã ghi nhận vẫn được theo dõi trong danh sách hồ sơ bên dưới.'}</EmptyState>
            : <>
              <div className="nce-record-table"><table className="nce-table nce-queue-table">
                <thead><tr><th scope="col">Lần chạy</th><th scope="col">Mức vi phạm</th><th scope="col">Hồ sơ</th><th scope="col" className="nce-col-action">Thao tác</th></tr></thead>
                {queueView.groups.map((group) => (
                  <tbody key={group.testId}>
                    <tr className="nce-queue-group"><th scope="rowgroup" colSpan={4}>{group.testName} <span className="count">{group.total}</span></th></tr>
                    {group.rows.map((row) => (
                      <QueueRow key={`${row.test_id}:${row.date}:${row.run_id}`} row={row} writable={writable} busy={attaching} onOpen={onOpen} onAttach={(selected) => void attach(selected)} onCreate={createFromRun} />
                    ))}
                  </tbody>
                ))}
              </table></div>
              <Pagination page={queueView.page} pageCount={queueView.pageCount} {...pageBounds(queueView.page, QUEUE_PAGE_SIZE, queueView.total)} total={queueView.total}
                unit="lần chạy" label="Phân trang lần chạy QC cần xử lý" onPageChange={setQueuePageNo} />
            </>}
        </div>
      </section>

      <section className="panel nce-overview-section" aria-label="Danh sách hồ sơ NCE" ref={recordsRef}>
        <div className="panel-head">
          <h2>Hồ sơ NCE <span className="count">{records.length}</span></h2>
          <div className="nce-record-search"><input type="search" aria-label="Tìm hồ sơ NCE" placeholder="Tìm mã hồ sơ, xét nghiệm, người phụ trách…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        </div>
        <div className="nce-section-body">
          <div className="nce-filters" role="group" aria-label="Lọc hồ sơ">{NCE_LIST_FILTERS.map(([key, label]) => <button type="button" key={key} className={filter === key ? 'on' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<b className="count">{counts[key]}</b></button>)}</div>
          {!shown.length
            ? <EmptyState size="compact" title={query.trim() ? 'Không tìm thấy hồ sơ phù hợp' : 'Không có hồ sơ nào ở mục này'} action={(query || filter !== 'all') && records.length > 0 ? <button type="button" className="btn ghost sm" onClick={() => { setQuery(''); setFilter('all'); }}>Xem tất cả hồ sơ</button> : undefined} />
            : <div className="nce-record-table"><table className="nce-table">
              <thead><tr><th scope="col">Hồ sơ / sự kiện</th><th scope="col">Phụ trách</th><th scope="col">Tiến độ</th><th scope="col">Hạn hoàn thành</th><th scope="col" className="nce-col-action">Thao tác</th></tr></thead>
              <tbody>{shown.map((record) => {
                const badge = nceStatusBadge(record);
                return <tr key={record.id} className={record.status === 'cancelled' ? 'nce-row-muted' : undefined}>
                  <td className="nce-record-description"><b>{record.nce_id}</b><div className="nce-record-copy" title={record.description}>{record.description}</div><div className="nce-sub">{record.test_name || NCE_SOURCE_LABEL[record.source]} · {dateText(record.detected_at)}{record.protocol_version < 4 && ' · Phiên bản cũ'}</div></td>
                  <td>{record.owner_name || 'Chưa có người phụ trách'}</td>
                  <td><span className={`tag ${badge.tone}`}>{badge.label}</span><div className="nce-sub">{record.next_step ? NEXT_STEP_TEXT[record.next_step] : record.status === 'closed' ? 'Đã hoàn tất hồ sơ' : 'Hồ sơ được lưu để truy vết'}</div></td>
                  <td>{dateText(record.due_date)}{record.overdue_days > 0 && <div className="nce-sub nce-overdue">Quá hạn {record.overdue_days} ngày</div>}{record.overdue_actions > 0 && <div className="nce-sub nce-overdue">{record.overdue_actions} hành động quá hạn</div>}</td>
                  <td className="nce-col-action"><button type="button" className="btn ghost sm" onClick={() => onOpen(record.id)}>Mở hồ sơ</button></td>
                </tr>;
              })}</tbody>
            </table></div>}
        </div>
      </section>
      {creating && <CreateNceModal prefill={creating.prefill} onClose={() => setCreating(null)} onCreated={created} />}
    </div>
  );
}
