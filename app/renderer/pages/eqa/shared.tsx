// Phần dùng chung của trang Phân tích ngoại kiểm: định dạng số, nhãn xếp
// loại, trạng thái kỳ, tín hiệu chuỗi, ô tổng hợp và khối thông tin. Kết luận
// (z, xếp loại, tín hiệu) do main tính.
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

/** Viền trái của dòng bảng theo xếp loại. */
export function rowTone(cls: EqaClassView | null): string | undefined {
  return cls === 'rej' ? 'is-rej' : cls === 'warn' ? 'is-warn' : undefined;
}

export function RoundStatusTag({ status }: { status: string }) {
  return status === 'open' ? <span className="tag ok">Đang dùng</span> : <span className="tag none">Đã huỷ</span>;
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

/** Khối nhãn – giá trị; giá trị trống hiện "Chưa ghi nhận.". */
export function Facts({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <dl className="eqa-facts">
      {items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || <span className="hint-inline">Chưa ghi nhận.</span>}</dd></div>)}
    </dl>
  );
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
