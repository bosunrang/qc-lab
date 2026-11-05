// Bản đồ z của một máy trong một chương trình–năm: mỗi dòng một xét nghiệm,
// mỗi cột một mẫu của một đợt, ô tô màu theo xếp loại do main tính. Nhìn một
// lượt thấy xét nghiệm nào lặp lại cảnh báo hoặc lệch dần về một phía.
import { useMemo } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { vnDate } from '../../lib/format';
import { EQA_CLASS_LABEL } from '../../../main/domain/eqa/evaluation';
import type { EqaInstrumentGridRow, EqaRoundRow } from '../../../shared/qc-api';
import { numText } from './shared';
import type { EqaSelection } from './useEqaScope';

export function EqaZMap({ rounds, rows, selected, onSelect, onOpenTest }: {
  /** Đợt đang dùng của chương trình–năm, đã xếp theo số đợt. */
  rounds: readonly EqaRoundRow[]; rows: readonly EqaInstrumentGridRow[]; selected?: EqaSelection;
  onSelect: (selection: EqaSelection) => void; onOpenTest: (testId: string) => void;
}) {
  // Cột = (đợt, mẫu) có mặt trong lưới, theo thứ tự đợt rồi mẫu.
  const columns = useMemo(() => rounds.flatMap((round) => {
    const samples = [...new Set((rows ?? []).flatMap((r) => r.cells.filter((c) => c.round_id === round.id).map((c) => c.sample)))]
      .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
    return (samples.length ? samples : ['']).map((sample) => ({ round, sample, multi: samples.length > 1 }));
  }), [rounds, rows]);

  if (!rows.length || !columns.length) return <EmptyState size="compact" title="Máy chưa có kết quả trong chương trình này" />;

  return (
    <div className="eqa-zmap-wrap">
      <table className="eqa-zmap">
        <thead>
          <tr>
            <th scope="col" className="eqa-zmap-test">Xét nghiệm</th>
            {columns.map(({ round, sample, multi }) => (
              <th key={`${round.id}-${sample}`} scope="col">
                <span className="eqa-zmap-round">{round.round}</span>
                <span className="eqa-zmap-meta">{multi ? `Mẫu ${sample}` : vnDate(round.report_date, '—')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.test_id}>
              <th scope="row" className="eqa-zmap-test">
                <button type="button" className="eqa-test-link" onClick={() => onOpenTest(row.test_id)}>{row.test_name}</button>
                {row.unit && <span className="eqa-zmap-meta">{row.unit}</span>}
              </th>
              {columns.map(({ round, sample }) => {
                const cell = row.cells.find((c) => c.round_id === round.id && c.sample === sample);
                const active = selected?.testId === row.test_id && selected.roundId === round.id && (selected.resultId ? selected.resultId === cell?.result_id : selected.sample === sample);
                const label = `${row.test_name} · ${round.round}${sample ? ` · mẫu ${sample}` : ''}: ${cell ? `z = ${numText(cell.z)} · ${EQA_CLASS_LABEL[cell.class]}` : 'chưa có kết quả'}`;
                return <td key={`${round.id}-${sample}`} className={`eqa-zcell is-${cell?.class ?? 'empty'}${active ? ' is-selected' : ''}`}>
                  <button type="button" className="eqa-cell-button" title={label} aria-label={label} aria-pressed={active}
                    onClick={() => onSelect({ testId: row.test_id, roundId: round.id, resultId: cell?.result_id, sample })}>{cell ? numText(cell.z) : '—'}</button>
                </td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
