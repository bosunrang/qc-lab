// Phần dùng chung của trang Khắc phục sự cố: khung panel từng bước, ô chọn
// người, bảng snapshot lần chạy và hook nạp/ghi một hồ sơ.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNceStore } from '../../store/nce-store';
import { useStoreInvalidation } from '../../lib/useStoreInvalidation';
import { vnDate } from '../../lib/format';
import { formatAuditDateTimeVN } from '../../../main/domain/audit-format';
import type { IpcResult, NceDossierView, NceRunRow, NceUserOption, NceWriteBase } from '../../../shared/qc-api';
import { nceRunLabel } from '../../../main/domain/nce/presentation';

export const dateText = (iso: string) => vnDate(iso, '—');
export const timeText = (iso: string) => (iso ? formatAuditDateTimeVN(iso) : '—');

export function holdText(value: 0 | 1 | null): string {
  return value === 1 ? 'Có — đã dừng/giữ kết quả liên quan' : value === 0 ? 'Không cần dừng/giữ kết quả' : 'Chưa xác định';
}

/** Một panel của trang hồ sơ: số bước, tiêu đề, nút ở góc phải. */
export function Section({ n, title, actions, children }: { n?: number; title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel" aria-label={title}>
      <div className="panel-head">
        <h2>{n != null && <span className="step-number">{n}</span>}{title}</h2>
        {actions ? <div className="nce-section-actions">{actions}</div> : null}
      </div>
      <div className="nce-section-body">{children}</div>
    </section>
  );
}

/** Cặp nhãn – giá trị ở chế độ xem. */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="nce-facts">
      {items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === '' || value == null ? <span className="hint-inline">Chưa ghi nhận.</span> : value}</dd></div>)}
    </dl>
  );
}

export function Field({ label, htmlFor, children, wide = false }: { label: string; htmlFor?: string; children: ReactNode; wide?: boolean }) {
  return <div className={`field${wide ? ' nce-field-wide' : ''}`}><label htmlFor={htmlFor}>{label}</label>{children}</div>;
}

export function UserSelect({ id, value, users, onChange, disabled }: { id: string; value: string; users: readonly NceUserOption[]; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Chọn tài khoản —</option>
      {users.map((u) => <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>)}
    </select>
  );
}

/** Ô chấm 1–5 cho mức độ nghiêm trọng / khả năng xảy ra. */
export function ScaleSelect({ id, value, onChange }: { id: string; value: number; onChange: (value: number) => void }) {
  return (
    <select id={id} value={String(value || 0)} onChange={(e) => onChange(Number(e.target.value))}>
      <option value="0">— Chưa chấm —</option>
      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}

export function OptionSelect({ id, value, options, onChange, placeholder }: { id: string; value: string; options: Readonly<Record<string, string>>; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder != null && <option value="">{placeholder}</option>}
      {Object.entries(options).filter(([key]) => key !== '').map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
  );
}

const VERDICT: Record<string, { label: string; tone: string }> = {
  ok: { label: 'Đạt', tone: 'ok' }, warn: { label: 'Cảnh báo', tone: 'warn' }, rej: { label: 'Loại', tone: 'rej' }, none: { label: 'Chưa đánh giá', tone: 'none' },
};

export interface SnapshotPoint { level: number; lot: string; val: number; z: number | null; verdict: string; rules: readonly string[]; voided: boolean }

/** Bảng các mức của một lần chạy (snapshot do main chụp, hoặc kết quả đánh giá thử). */
export function SnapshotTable({ points }: { points: readonly SnapshotPoint[] }) {
  if (!points.length) return <p className="hint-inline">Không có điểm QC nào trong lần chạy này.</p>;
  return (
    <table className="nce-table">
      <thead><tr><th scope="col">Mức</th><th scope="col">Lô</th><th scope="col">Giá trị</th><th scope="col">z</th><th scope="col">Kết luận</th><th scope="col">Luật</th></tr></thead>
      <tbody>{points.map((p) => {
        const verdict = p.voided ? { label: 'Đã hủy', tone: 'none' } : VERDICT[p.verdict] ?? VERDICT.none;
        return (
          <tr key={`${p.level}-${p.lot}`}>
            <td>M{p.level}</td><td>{p.lot || '—'}</td><td>{p.val}</td><td>{p.z == null ? '—' : p.z.toFixed(2)}</td>
            <td><span className={`tag ${verdict.tone}`}>{verdict.label}</span></td><td>{p.rules.length ? p.rules.join(', ') : '—'}</td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}

export function runPoints(run: NceRunRow): SnapshotPoint[] {
  try {
    const points = (JSON.parse(run.snapshot_json || '{}') as { points?: SnapshotPoint[] }).points;
    return Array.isArray(points) ? points.map((p) => ({ ...p, rules: p.rules ?? [] })) : [];
  } catch { return []; }
}

export const RUN_ROLE_LABEL: Record<NceRunRow['role'], string> = { trigger: 'Lần chạy khởi đầu', repeat_reject: 'Bị loại thêm', rerun: 'Lần chạy rerun / xác minh' };

export function runRowLabel(run: NceRunRow): string { return nceRunLabel({ date: run.date, runId: run.run_id }); }

export type DossierWrite = (base: NceWriteBase) => Promise<IpcResult<NceDossierView>>;

/** Nạp một hồ sơ và gửi lệnh ghi kèm `row_version` đang xem. Ghi thành công
 * thì dùng ngay hồ sơ main trả về; lệch phiên bản (`stale`) thì báo và cho
 * tải lại thay vì ghi đè thay đổi của người khác. */
export function useDossier(id: string) {
  const get = useNceStore((s) => s.get);
  const [dossier, setDossier] = useState<NceDossierView | null | undefined>(undefined);
  const [error, setError] = useState<{ message: string; stale: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setDossier(await get(id));
    setError(null);
  }, [get, id]);

  useEffect(() => { void reload(); }, [reload]);
  useStoreInvalidation(['nce_records'], undefined, () => { if (!busy) void reload(); });

  const run = useCallback(async (write: DossierWrite): Promise<boolean> => {
    if (!dossier) return false;
    setBusy(true);
    try {
      const result = await write({ id: dossier.record.id, expectedVersion: dossier.record.row_version });
      if (result.ok) { setDossier(result.data); setError(null); return true; }
      setError({ message: result.error.message, stale: result.error.code === 'stale' });
      return false;
    } finally { setBusy(false); }
  }, [dossier]);

  return { dossier, error, busy, reload, run, clearError: () => setError(null) };
}
