// Tổng quan trang Khắc phục sự cố: hàng chờ lần chạy bị loại (main tính, mỗi
// dòng một lần chạy) và danh sách hồ sơ có thẻ lọc.
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNceStore } from '../../store/nce-store';
import { useAuthStore } from '../../store/auth-store';
import { canWrite } from '../../lib/permissions';
import { EmptyState } from '../../components/EmptyState';
import { confirmDialog, infoDialog } from '../../state/dialog-store';
import { nceStatusBadge } from '../../lib/nce-labels';
import { NCE_SOURCE_LABEL } from '../../../main/domain/nce/labels';
import type { NceDossierView, NceQueueRowView } from '../../../shared/qc-api';
import { filterNceRecords, nceFilterCounts, nceRunLabel, NCE_LIST_FILTERS, type NceListFilter } from '../../../main/domain/nce/presentation';
import { CreateNceModal, type NceCreatePrefill } from './CreateNceModal';
import { dateText } from './shared';

function queueSummary(row: NceQueueRowView): string {
  return row.rejected_levels.map((l) => `M${l.level} (${l.rules.join(', ')})`).join('; ');
}

export function NceOverview({ onOpen }: { onOpen: (id: string) => void }) {
  const { records, queue, attachRun, get } = useNceStore(useShallow((s) => ({ records: s.records, queue: s.queue, attachRun: s.attachRun, get: s.get })));
  const user = useAuthStore((s) => s.user);
  const writable = canWrite(user?.role);
  const [filter, setFilter] = useState<NceListFilter>('active');
  const [creating, setCreating] = useState<{ prefill: NceCreatePrefill | null } | null>(null);
  const counts = useMemo(() => nceFilterCounts(records, user?.id ?? ''), [records, user?.id]);
  const shown = useMemo(() => filterNceRecords(records, filter, user?.id ?? ''), [records, filter, user?.id]);

  async function attach(row: NceQueueRowView) {
    if (!row.attach_to) return;
    if (!(await confirmDialog(`Gắn lần chạy ${nceRunLabel({ date: row.date, runId: row.run_id })} vào hồ sơ ${row.attach_to.nce_id}? QC tiếp tục bị loại sau xử lý tức thời nên hồ sơ sẽ phải xử lý theo CAPA đầy đủ.`, { title: 'Gắn vào hồ sơ đang mở', confirmLabel: 'Gắn vào hồ sơ' }))) return;
    const current = await get(row.attach_to.id);
    if (!current) return;
    const result = await attachRun({ id: current.record.id, expectedVersion: current.record.row_version, run: { date: row.date, runId: row.run_id } });
    if (!result.ok) { await infoDialog(result.error.message, { type: 'warn' }); return; }
    onOpen(result.data.record.id);
  }

  function created(dossier: NceDossierView) {
    setCreating(null);
    onOpen(dossier.record.id);
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Lần chạy bị loại cần xử lý {queue.length > 0 && <span className="count">{queue.length}</span>}</h2>
          {writable && <button type="button" className="btn ghost sm" onClick={() => setCreating({ prefill: null })}>Lập hồ sơ từ nguồn khác</button>}
        </div>
        <div className="nce-section-body">
          {!queue.length
            ? <EmptyState size="compact" title="Không có lần chạy bị loại nào cần lập hồ sơ">Cảnh báo (ví dụ 1-2s) không loại lần chạy nên không vào danh sách này.</EmptyState>
            : (
              <table className="nce-table">
                <thead><tr><th scope="col">Lần chạy</th><th scope="col">Xét nghiệm</th><th scope="col">Mức bị loại</th><th scope="col">Hồ sơ</th><th scope="col" className="nce-col-action">Thao tác</th></tr></thead>
                <tbody>{queue.map((row) => (
                  <tr key={`${row.test_id}:${row.date}:${row.run_id}`}>
                    <td>{nceRunLabel({ date: row.date, runId: row.run_id })}</td>
                    <td>{row.test_name}</td>
                    <td>{queueSummary(row)}</td>
                    <td>{row.record ? row.record.nce_id : row.attach_to ? <span className="hint-inline">Có thể gắn vào {row.attach_to.nce_id}</span> : <span className="tag rej">Chưa có hồ sơ</span>}</td>
                    <td className="nce-col-action"><div className="nce-row-actions">
                      {row.record && <button type="button" className="btn ghost sm" onClick={() => onOpen(row.record!.id)}>Mở hồ sơ</button>}
                      {!row.record && row.attach_to && writable && <button type="button" className="btn ghost sm" onClick={() => void attach(row)}>Gắn vào {row.attach_to.nce_id}</button>}
                      {!row.record && writable && <button type="button" className="btn sm" onClick={() => setCreating({ prefill: { testId: row.test_id, testName: row.test_name, date: row.date, runId: row.run_id, summary: `Lần chạy bị loại: ${queueSummary(row)}.` } })}>Lập hồ sơ</button>}
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Hồ sơ NCE</h2>
          <div className="nce-filters" role="group" aria-label="Lọc hồ sơ">
            {NCE_LIST_FILTERS.map(([key, label]) => (
              <button type="button" key={key} className={filter === key ? 'on' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<b className="count">{counts[key]}</b></button>
            ))}
          </div>
        </div>
        <div className="nce-section-body">
          {!shown.length
            ? <EmptyState size="compact" title="Không có hồ sơ nào ở mục này" />
            : (
              <table className="nce-table">
                <thead><tr><th scope="col">Mã hồ sơ</th><th scope="col">Phát hiện</th><th scope="col">Nguồn / xét nghiệm</th><th scope="col">Mô tả</th><th scope="col">Phụ trách / hạn</th><th scope="col">Trạng thái</th><th scope="col" className="nce-col-action">Thao tác</th></tr></thead>
                <tbody>{shown.map((record) => {
                  const badge = nceStatusBadge(record);
                  return (
                    <tr key={record.id} className={record.status === 'cancelled' ? 'nce-row-muted' : undefined}>
                      <td><b>{record.nce_id}</b>{record.protocol_version < 4 && <div className="nce-sub">Phiên bản cũ</div>}</td>
                      <td>{dateText(record.detected_at)}</td>
                      <td>{NCE_SOURCE_LABEL[record.source] ?? record.source}{record.test_name ? <div className="nce-sub">{record.test_name}</div> : null}</td>
                      <td className="nce-col-text">{record.description}</td>
                      <td>{record.owner_name || '—'}<div className="nce-sub">hạn {dateText(record.due_date)}</div></td>
                      <td>
                        <span className={`tag ${badge.tone}`}>{badge.label}</span>
                        {record.overdue_days > 0 && <div className="nce-sub nce-overdue">Quá hạn {record.overdue_days} ngày</div>}
                        {record.overdue_actions > 0 && <div className="nce-sub nce-overdue">{record.overdue_actions} hành động quá hạn</div>}
                      </td>
                      <td className="nce-col-action"><button type="button" className="btn ghost sm" onClick={() => onOpen(record.id)}>Mở hồ sơ</button></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            )}
        </div>
      </div>

      {creating && <CreateNceModal prefill={creating.prefill} onClose={() => setCreating(null)} onCreated={created} />}
    </>
  );
}
