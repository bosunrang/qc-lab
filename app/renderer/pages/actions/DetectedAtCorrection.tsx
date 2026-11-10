// Đính chính ngày có xác nhận, lý do và phiên bản bản nháp riêng. Nút nằm ở
// cạnh mốc ngày phát hiện ở phần Ghi nhận sự cố, form mở ngay dưới.
import { useState, type ReactNode } from 'react';
import { DateField } from '../../components/DateField';
import { useNceStore } from '../../store/nce-store';
import { confirmDialog } from '../../state/dialog-store';
import { dateText, Field } from './shared';
import type { SectionProps } from './DossierContent';

export function useDetectedAtCorrection(props: SectionProps): { button: ReactNode; form: ReactNode } {
  const { record, can } = props.dossier;
  const update = useNceStore((s) => s.update);
  const [draft, setDraft] = useState<{ detectedAt: string; reason: string; version: number } | null>(null);
  async function save() {
    if (!draft) return;
    if (!(await confirmDialog(`Đính chính ngày phát hiện từ ${dateText(record.detected_at)} thành ${dateText(draft.detectedAt)}? Chỉ ghi ngày thực tế có căn cứ, không lùi ngày để nhận QC cũ. Ngày lập hồ sơ, ngày QC và thời điểm quyết định không đổi.`, { title: 'Đính chính ngày phát hiện', confirmLabel: 'Lưu đính chính', cancelLabel: 'Quay lại', danger: false }))) return;
    if (await props.run((base) => update({ ...base, expectedVersion: draft.version, patch: {}, detectedAtCorrection: { detectedAt: draft.detectedAt, reason: draft.reason } }))) setDraft(null);
  }
  const button = !draft && can.release
    ? <button type="button" className="btn ghost sm" disabled={props.busy} onClick={() => setDraft({ detectedAt: record.detected_at, reason: '', version: record.row_version })}>Đính chính ngày phát hiện</button>
    : null;
  const form = draft && can.release ? <div className="nce-date-correction">
    <div className="nce-form-grid">
      <DateField label="Ngày phát hiện thực tế" id="nceCorrectDetected" value={draft.detectedAt} onChange={(detectedAt) => setDraft({ ...draft, detectedAt })} />
      <Field label="Lý do và căn cứ đính chính" htmlFor="nceCorrectReason" wide><textarea id="nceCorrectReason" rows={2} value={draft.reason} placeholder="Ví dụ: nhập nhầm ngày lập hồ sơ thay cho ngày phát hiện; đối chiếu nhật ký số…" onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></Field>
      {draft.version !== record.row_version && <p className="nce-editor-warning">Hồ sơ đã được cập nhật ở nơi khác</p>}
      <div className="nce-form-actions nce-field-wide"><button type="button" className="btn ghost sm" disabled={props.pending} onClick={() => setDraft(null)}>Bỏ qua</button><button type="button" className="btn sm" disabled={props.busy || draft.reason.trim().length < 10 || !draft.detectedAt || draft.detectedAt === record.detected_at} onClick={() => void save()}>Lưu đính chính</button></div>
    </div>
  </div> : null;
  return { button, form };
}
