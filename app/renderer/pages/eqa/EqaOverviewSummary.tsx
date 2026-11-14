import type { EqaInstrumentGridRow, EqaRoundRow } from '../../../shared/qc-api';
import { overviewTotals, type EqaOverviewFilter } from './overview-model';
import { EqaResultsSummary } from './EqaResultsSummary';

export function EqaOverviewSummary({ rows, rounds, loading, failed = false, filter, onFilter }: {
  rows: readonly EqaInstrumentGridRow[]; rounds: readonly EqaRoundRow[]; loading: boolean; failed?: boolean;
  filter: EqaOverviewFilter; onFilter: (filter: EqaOverviewFilter) => void;
}) {
  return <EqaResultsSummary totals={overviewTotals(rows)} loading={loading} failed={failed} filter={filter} onFilter={onFilter}
    description={loading || failed ? 'Chỉ số tổng hợp theo từng mẫu' : `${rounds.length} đợt · ${rows.length} xét nghiệm · Chỉ số tổng hợp theo từng mẫu`} rejectionHint="Xem xét nghiệm liên quan" />;
}
