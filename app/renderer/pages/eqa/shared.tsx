// Phần dùng chung của trang Phân tích ngoại kiểm: định dạng số, nhãn xếp
// loại, tín hiệu chuỗi và ô tổng hợp. Kết luận (z, xếp loại, tín hiệu) do main tính.
import type { ReactNode } from 'react';
import type { EqaClassView, EqaSignalView } from '../../../shared/qc-api';
import { EQA_CLASS_LABEL } from '../../../main/domain/eqa/evaluation';
import { EQA_SIGNAL_LABEL } from '../../../main/domain/eqa/series';

export function numText(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);
}

/** Kết quả và giá trị ấn định giữ đủ chữ số như báo cáo gốc. */
export function rawNum(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : String(Number(value.toPrecision(10)));
}

export function pctText(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`;
}

export function ClassTag({ cls }: { cls: EqaClassView | null }) {
  return cls ? <span className={`tag ${cls}`}>{EQA_CLASS_LABEL[cls]}</span> : <span className="tag none">Chưa đánh giá</span>;
}

/** Tín hiệu chuỗi của xét nghiệm (N-07) và trạng thái không thành công (N-06). */
export function TrendTags({ signals, unsuccessful }: { signals: readonly EqaSignalView[]; unsuccessful: boolean }) {
  if (!signals.length && !unsuccessful) return <span className="hint-inline">Không có tín hiệu</span>;
  return (
    <span className="eqa-tags">
      {unsuccessful && <span className="tag rej">Không thành công</span>}
      {signals.map((s) => <span key={s} className={`tag ${s === 'reject' ? 'rej' : 'warn'}`}>{EQA_SIGNAL_LABEL[s]}</span>)}
    </span>
  );
}

export function roundLabel(round: { round: string; year: number | null }): string {
  return `${round.round} / ${round.year ?? '—'}`;
}

export function StatCard({ tone, label, value, detail }: { tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral'; label: string; value: ReactNode; detail?: string }) {
  return (
    <div className={`eqa-stat is-${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}
