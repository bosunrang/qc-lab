// Phần 6 — hành động khắc phục nhiều dòng: mỗi dòng có loại, người chịu trách
// nhiệm (tài khoản), hạn; hoàn thành phải kèm bằng chứng, hủy phải có lý do.
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Modal } from '../../components/Modal';
import { DateField } from '../../components/DateField';
import { useNceStore } from '../../store/nce-store';
import { todayIso } from '../../lib/format';
import type { NceActionRow } from '../../../shared/qc-api';
import { NCE_ACTION_KIND_LABEL } from '../../../main/domain/nce/labels';
import type { SectionProps } from './DossierContent';
import { dateText, Field, OptionSelect, Section, UserSelect } from './shared';

interface ActionDraft { kind: string; description: string; ownerUserId: string; dueDate: string }

const STATUS: Record<NceActionRow['status'], { label: string; tone: string }> = {
  open: { label: 'Chưa xong', tone: 'warn' }, done: { label: 'Hoàn thành', tone: 'ok' }, cancelled: { label: 'Đã hủy', tone: 'none' },
};

export function ActionsSection(props: SectionProps) {
  const { actions, can } = props.dossier;
  const store = useNceStore(useShallow((s) => ({ addAction: s.addAction, updateAction: s.updateAction, completeAction: s.completeAction, cancelAction: s.cancelAction })));
  const [editing, setEditing] = useState<{ id: string | null; draft: ActionDraft } | null>(null);
  const [completing, setCompleting] = useState<{ id: string; doneAt: string; evidence: string } | null>(null);
  const [cancelling, setCancelling] = useState<{ id: string; reason: string } | null>(null);

  async function saveDraft() {
    if (!editing) return;
    const ok = editing.id
      ? await props.run((base) => store.updateAction({ ...base, actionId: editing.id!, action: editing.draft }))
      : await props.run((base) => store.addAction({ ...base, action: editing.draft }));
    if (ok) setEditing(null);
  }
  async function complete() {
    if (!completing) return;
    if (await props.run((base) => store.completeAction({ ...base, actionId: completing.id, doneAt: completing.doneAt, evidence: completing.evidence }))) setCompleting(null);
  }
  async function cancelAction() {
    if (!cancelling) return;
    if (await props.run((base) => store.cancelAction({ ...base, actionId: cancelling.id, reason: cancelling.reason }))) setCancelling(null);
  }

  return (
    <Section n={6} title="Hành động khắc phục và phòng ngừa"
      actions={can.edit ? <button type="button" className="btn ghost sm" onClick={() => setEditing({ id: null, draft: { kind: 'corrective', description: '', ownerUserId: '', dueDate: '' } })}>Thêm hành động</button> : null}>
      {actions.length ? (
        <table className="nce-table">
          <thead><tr><th scope="col">Loại</th><th scope="col">Nội dung</th><th scope="col">Chịu trách nhiệm / hạn</th><th scope="col">Trạng thái</th><th scope="col" className="nce-col-action">Thao tác</th></tr></thead>
          <tbody>{actions.map((action) => (
            <tr key={action.id} className={action.status === 'cancelled' ? 'nce-row-muted' : undefined}>
              <td>{NCE_ACTION_KIND_LABEL[action.kind] ?? action.kind}</td>
              <td className="nce-col-text">{action.description}
                {action.status === 'done' && <div className="nce-sub">Bằng chứng: {action.evidence}</div>}
                {action.status === 'cancelled' && <div className="nce-sub">Lý do hủy: {action.cancel_reason}</div>}
              </td>
              <td>{action.owner_name || '—'}<div className={`nce-sub${action.overdue_days > 0 ? ' nce-overdue' : ''}`}>hạn {dateText(action.due_date)}{action.overdue_days > 0 ? ` · quá hạn ${action.overdue_days} ngày` : ''}</div></td>
              <td><span className={`tag ${STATUS[action.status].tone}`}>{STATUS[action.status].label}</span>{action.status === 'done' && <div className="nce-sub">{dateText(action.done_at)} · {action.done_by_name}</div>}</td>
              <td className="nce-col-action">{can.edit && action.status === 'open' && (
                <div className="nce-row-actions">
                  <button type="button" className="btn sm" onClick={() => setCompleting({ id: action.id, doneAt: todayIso(), evidence: '' })}>Hoàn thành</button>
                  <button type="button" className="btn ghost sm" onClick={() => setEditing({ id: action.id, draft: { kind: action.kind, description: action.description, ownerUserId: action.owner_user_id, dueDate: action.due_date } })}>Sửa</button>
                  <button type="button" className="btn ghost sm" onClick={() => setCancelling({ id: action.id, reason: '' })}>Hủy</button>
                </div>
              )}</td>
            </tr>
          ))}</tbody>
        </table>
      ) : <p className="hint-inline">Chưa có hành động nào. Tầng CAPA phải có ít nhất một hành động khắc phục đã hoàn thành.</p>}

      {editing && (
        <Modal title={editing.id ? 'Sửa hành động' : 'Thêm hành động'} onClose={() => setEditing(null)}
          footer={<><button type="button" className="btn ghost" onClick={() => setEditing(null)}>Hủy</button><button type="button" className="btn teal" disabled={props.busy} onClick={() => void saveDraft()}>Lưu</button></>}>
          <div className="nce-form-grid">
            <Field label="Loại hành động" htmlFor="actKind" wide><OptionSelect id="actKind" value={editing.draft.kind} options={NCE_ACTION_KIND_LABEL} onChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, kind: v } })} /></Field>
            <Field label="Nội dung hành động" htmlFor="actDesc" wide><textarea id="actDesc" rows={3} value={editing.draft.description} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, description: e.target.value } })} /></Field>
            <Field label="Người chịu trách nhiệm" htmlFor="actOwner"><UserSelect id="actOwner" value={editing.draft.ownerUserId} users={props.users} onChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, ownerUserId: v } })} /></Field>
            <DateField label="Hạn hoàn thành" id="actDue" value={editing.draft.dueDate} onChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, dueDate: v } })} />
          </div>
        </Modal>
      )}
      {completing && (
        <Modal title="Hoàn thành hành động" onClose={() => setCompleting(null)}
          footer={<><button type="button" className="btn ghost" onClick={() => setCompleting(null)}>Hủy</button><button type="button" className="btn teal" disabled={props.busy} onClick={() => void complete()}>Xác nhận hoàn thành</button></>}>
          <div className="nce-form-grid">
            <DateField label="Ngày hoàn thành" id="actDone" value={completing.doneAt} onChange={(v) => setCompleting({ ...completing, doneAt: v })} />
            <Field label="Bằng chứng (mã phiếu, tài liệu, kết quả…)" htmlFor="actEvidence" wide><textarea id="actEvidence" rows={3} value={completing.evidence} onChange={(e) => setCompleting({ ...completing, evidence: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {cancelling && (
        <Modal title="Hủy hành động" size="sm" onClose={() => setCancelling(null)}
          footer={<><button type="button" className="btn ghost" onClick={() => setCancelling(null)}>Quay lại</button><button type="button" className="btn danger" disabled={props.busy} onClick={() => void cancelAction()}>Hủy hành động</button></>}>
          <Field label="Lý do hủy" htmlFor="actCancel"><textarea id="actCancel" rows={3} value={cancelling.reason} onChange={(e) => setCancelling({ ...cancelling, reason: e.target.value })} /></Field>
        </Modal>
      )}
    </Section>
  );
}
