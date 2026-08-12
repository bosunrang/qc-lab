type Config = { mean?: number | string; sd?: number | string; low?: number | string; high?: number | string };
type Row = { linked?: unknown; assigned?: boolean; cfg?: Config };
type Stats = { linked: number; other: number; empty: number; missing: number };

export function targetMatrixStats(rows: Row[]) {
  return rows.reduce<Stats>((stats, row) => {
    if (row.linked) stats.linked++;
    else if (row.assigned) stats.other++;
    else stats.empty++;
    const config = row.cfg;
    const hasMean = !!config && Number.isFinite(Number(config.mean));
    const hasSd = !!config && Number.isFinite(Number(config.sd)) && Number(config.sd) > 0;
    const hasRange = !!config && Number.isFinite(Number(config.low)) && Number.isFinite(Number(config.high)) && Number(config.high) > Number(config.low);
    if (!hasMean || (!hasSd && !hasRange)) stats.missing++;
    return stats;
  }, { linked: 0, other: 0, empty: 0, missing: 0 });
}
