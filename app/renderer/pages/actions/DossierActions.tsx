// Phần 6 — hành động khắc phục nhiều dòng: mỗi dòng có loại, người chịu trách
// nhiệm (tài khoản), hạn; hoàn thành phải kèm bằng chứng, huỷ phải có lý do.
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Modal } from '../../components/Modal';
import { DateField } from '../../components/DateField';
import { EmptyState } from '../../components/EmptyState';
import { RowActionButton } from '../../components/RowActionButton';
import { useNceStore } from '../../store/nce-store';
import { todayIso } from '../../lib/format';
import type { NceActionRow } from '../../../shared/qc-api';
import { NCE_ACTION_KIND_LABEL } from '../../../main/domain/nce/labels';
import type { SectionProps } from './DossierContent';
import { dateText, Field, OptionSelect, Section, UserSelect } from './shared';

interface ActionDraft { kind: string; description: string; ownerUserId: string; dueDate: string }

const STATUS: Record<NceActionRow['status'], { label: string; tone: string }> = {
  open: { label: 'Chưa xong', tone: 'warn' }, done: { label: 'Hoàn thành', tone: 'ok' }, cancelled: { label: 'Đã huỷ', tone: 'none' },
};

export function ActionsSection(props: SectionProps) {
  const { actions, can } = props.dossier;
  const store = useNceStore(useShallow((s) => ({ addAction: s.addAction, updateAction: s.updateAction, completeAction: s.completeAction, cancelAction: s.cancelAction })));
  const [editing, setEditing] = useState<{ id: string | null; version: number; draft: ActionDraft } | null>(null);
  const [completing, setCompleting] = useState<{ id: string; version: number; description: string; doneAt: string; evidence: string } | null>(null);
  const [cancelling, setCancelling] = useState<{ id: string; version: number; description: string; reason: string } | null>(null);
  const startAction = () => setEditing({ id: null, version: props.dossier.record.row_version, draft: { kind: 'corrective', description: '', ownerUserId: '', dueDate: '' } });

  async function saveDraft() {
    if (!editing) return;
    const ok = editing.id
      ? await props.run((base) => store.updateAction({ ...base, expectedVersion: editing.version, actionId: editing.id!, action: editing.draft }))
      : await props.run((base) => store.addAction({ ...base, expectedVersion: editing.version, action: editing.draft }));
    if (ok) { setEditing(null); props.onSaved?.(); }
  }
  async function complete() {
    if (!completing) return;
    if (await props.run((base) => store.completeAction({ ...base, expectedVersion: completing.version, actionId: completing.id, doneAt: completing.doneAt, evidence: completing.evidence }))) { setCompleting(null); props.onSaved?.(); }
  }
  async function cancelAction() {
    if (!cancelling) return;
    if (await props.run((base) => store.cancelAction({ ...base, expectedVersion: cancelling.version, actionId: cancelling.id, reason: cancelling.reason }))) { setCancelling(null); props.onSaved?.(); }
  }

  return (
    <Section title="Hành động khắc phục và phòng ngừa" disclosure={props.disclosure} headingLevel={props.headingLevel}
      actions={can.edit && actions.length > 0 ? <button type="button" className="btn ghost sm" disabled={props.busy} onClick={startAction}>Thêm hành động</button> : null}>
      {actions.length ? (
        <><p className="nce-note">{actions.length} hành động · {actions.filter((action) => action.status === 'done').length} hoàn thành · {actions.filter((action) => action.status === 'open').length} đang theo dõi{actions.some((action) => action.status === 'cancelled') && ` · ${actions.filter((action) => action.status === 'cancelled').length} đã huỷ`}</p>
        <div className="nce-capa-actions-table"><table className="nce-table">
          <thead><tr><th scope="col">Loại</th><th scope="col">Nội dung</th><th scope="col">Chịu trách nhiệm / hạn</th><th scope="col">Trạng thái</th><th scope="col" className="nce-col-action">Thao tác</th></tr></thead>
          <tbody>{actions.map((action) => (
            <tr key={action.id} className={action.status === 'cancelled' ? 'nce-row-muted' : undefined}>
              <td title={NCE_ACTION_KIND_LABEL[action.kind]}>{action.kind === 'corrective' ? 'Khắc phục' : action.kind === 'preventive' ? 'Phòng ngừa' : NCE_ACTION_KIND_LABEL[action.kind] ?? action.kind}</td>
              <td className="nce-col-text">{action.description}
                {action.status === 'done' && <div className="nce-sub">Bằng chứng: {action.evidence}</div>}
                {action.status === 'cancelled' && <div className="nce-sub">Lý do huỷ: {action.cancel_reason}</div>}
              </td>
              <td>{action.owner_name || '—'}<div className={`nce-sub${action.overdue_days > 0 ? ' nce-overdue' : ''}`}>hạn {dateText(action.due_date)}{action.overdue_days > 0 ? ` · quá hạn ${action.overdue_days} ngày` : ''}</div></td>
              <td><span className={`tag ${STATUS[action.status].tone}`}>{STATUS[action.status].label}</span>{action.status === 'done' && <div className="nce-sub">{dateText(action.done_at)} · {action.done_by_name}</div>}</td>
              <td className="nce-col-action">{can.edit && action.status === 'open' && (
                <div className="nce-row-actions">
                  <button type="button" className="btn sm" disabled={props.busy} onClick={() => setCompleting({ id: action.id, version: props.dossier.record.row_version, description: action.description, doneAt: todayIso(), evidence: '' })}>Hoàn thành</button>
                  <RowActionButton kind="edit" label="Sửa" disabled={props.busy} onClick={() => setEditing({ id: action.id, version: props.dossier.record.row_version, draft: { kind: action.kind, description: action.description, ownerUserId: action.owner_user_id, dueDate: action.due_date } })} />
                  <RowActionButton kind="delete" label="Huỷ" disabled={props.busy} onClick={() => setCancelling({ id: action.id, version: props.dossier.record.row_version, description: action.description, reason: '' })} />
                </div>
              )}</td>
            </tr>
          ))}</tbody>
        </table></div></>
      ) : <EmptyState size="compact" title="Chưa có hành động" action={can.edit && <button type="button" className="btn ghost" disabled={props.busy} onClick={startAction}>Thêm hành động</button>}>Ghi hành động, người phụ trách và hạn hoàn thành để theo dõi.</EmptyState>}

      {editing && (
        <Modal busy={props.pending} title={editing.id ? 'Sửa hành động' : 'Thêm hành động'} onClose={() => setEditing(null)}
          footer={<><button type="button" className="btn ghost" disabled={props.pending} onClick={() => setEditing(null)}>Bỏ qua</button><button type="button" className="btn teal" disabled={props.busy} onClick={() => void saveDraft()}>Lưu</button></>}>
          {props.error && <div className="alert rej" role="alert">{props.error.message}</div>}
          <div className="nce-form-grid">
            <Field label="Loại hành động" htmlFor="actKind" wide><OptionSelect id="actKind" value={editing.draft.kind} options={NCE_ACTION_KIND_LABEL} onChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, kind: v } })} /></Field>
            <Field label="Nội dung hành động" htmlFor="actDesc" wide><textarea id="actDesc" rows={3} value={editing.draft.description} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, description: e.target.value } })} /></Field>
            <Field label="Người chịu trách nhiệm" htmlFor="actOwner"><UserSelect id="actOwner" value={editing.draft.ownerUserId} users={props.users} onChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, ownerUserId: v } })} /></Field>
            <DateField label="Hạn hoàn thành" id="actDue" value={editing.draft.dueDate} onChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, dueDate: v } })} />
          </div>
        </Modal>
      )}
      {completing && (
        <Modal busy={props.pending} title="Hoàn thành hành động" onClose={() => setCompleting(null)}
          footer={<><button type="button" className="btn ghost" disabled={props.pending} onClick={() => setCompleting(null)}>Bỏ qua</button><button type="button" className="btn teal" disabled={props.busy} onClick={() => void complete()}>Xác nhận hoàn thành</button></>}>
          <p className="nce-note">Hành động đang xác nhận: {completing.description}</p>
          {props.error && <div className="alert rej" role="alert">{props.error.message}</div>}
          {completing.version !== props.dossier.record.row_version && <p className="nce-editor-warning" role="alert">Hồ sơ đã được cập nhật ở nơi khác. Đóng hộp thoại và rà soát nội dung mới trước khi xác nhận.</p>}
          <div className="nce-form-grid">
            <DateField label="Ngày hoàn thành" id="actDone" value={completing.doneAt} onChange={(v) => setCompleting({ ...completing, doneAt: v })} />
            <Field label="Bằng chứng (mã phiếu, tài liệu, kết quả…)" htmlFor="actEvidence" wide><textarea id="actEvidence" rows={3} value={completing.evidence} onChange={(e) => setCompleting({ ...completing, evidence: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {cancelling && (
        <Modal busy={props.pending} title="Huỷ hành động" size="sm" onClose={() => setCancelling(null)}
          footer={<><button type="button" className="btn ghost" disabled={props.pending} onClick={() => setCancelling(null)}>Quay lại</button><button type="button" className="btn danger" disabled={props.busy} onClick={() => void cancelAction()}>Huỷ hành động</button></>}>
          <p className="nce-note">Hành động đang xác nhận: {cancelling.description}</p>
          {props.error && <div className="alert rej" role="alert">{props.error.message}</div>}
          {cancelling.version !== props.dossier.record.row_version && <p className="nce-editor-warning" role="alert">Hồ sơ đã được cập nhật ở nơi khác. Đóng hộp thoại và rà soát nội dung mới trước khi xác nhận.</p>}
          <Field label="Lý do huỷ" htmlFor="actCancel"><textarea id="actCancel" rows={3} value={cancelling.reason} onChange={(e) => setCancelling({ ...cancelling, reason: e.target.value })} /></Field>
        </Modal>
      )}
    </Section>
  );
}
