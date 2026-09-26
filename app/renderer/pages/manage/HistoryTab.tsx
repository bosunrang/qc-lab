import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useManageStore } from '../../store/manage-store';
import { Modal } from '../../components/Modal';
import type { HistoryQcPointView, Test, TestLevel, QcLot } from '../../../shared/qc-api';
import { vnDate } from '../../lib/format';
import { EmptyState } from './shared';
import { observedStats } from '../../../main/domain/observed-stats';
import { pointTarget } from '../../../main/domain/westgard-engine';

/** Số điểm mỗi trang trong hộp thoại chi tiết lô. Một lô chạy 2 lần/ngày
 * trong 6 tháng có khoảng 360 điểm mỗi mức; vẽ hết một lần làm hộp thoại mở
 * chậm và khó dò (kế hoạch kiến trúc D.11). */
const HISTORY_POINT_PAGE = 100;

type HistoryEntry = {
  at?: string; mean: number | null; sd: number | null; qcLotId: string | null;
  lot?: string; low?: number | null; high?: number | null;
  effectiveFrom?: string; effectiveTo?: string; source?: 'lab' | 'mfg';
};

type HistoryRow = {
  level: number;
  lotId: string | null;
  lotNo: string;
  group: string;
  mean: number | null;
  sd: number | null;
  low: number | null;
  high: number | null;
  period: string;
  to: string;
  source: 'lab' | 'mfg';
  current: boolean;
  key: string;
};

/** Mean/SD mẫu/CV của một mảng giá trị — công thức chung ở
 * `main/domain/observed-stats.ts`. Trả `null` khi rỗng (hiện "—" thay vì 0,
 * tránh hiểu nhầm "SD bằng 0"). */
function statsOf(values: number[]): { mean: number; sd: number | null; cv: number | null } | null {
  const stats = observedStats(values.map((val) => ({ val })));
  return stats.mean == null ? null : { mean: stats.mean, sd: stats.sd, cv: stats.cv };
}

function parseHistory(json: string): HistoryEntry[] {
  try {
    const value: unknown = JSON.parse(json || '[]');
    return Array.isArray(value) ? value as HistoryEntry[] : [];
  } catch {
    return [];
  }
}



/** `historyPeriodLabel()` hệ thống — hai đầu để trống thì ghi "Không giới hạn". */
function periodLabel(from: string, to: string): string {
  return `${from ? vnDate(from) : 'Không giới hạn'} → ${to ? vnDate(to) : 'Không giới hạn'}`;
}

function fmt(value: number | null, decimals: number): string {
  return value == null ? '—' : value.toFixed(decimals);
}


function testSearchValues(test: Test, levels: TestLevel[], lots: QcLot[], instrumentLabel = ''): string[] {
  const values: unknown[] = [test.name, instrumentLabel, test.section];
  for (const level of levels) {
    const history = parseHistory(level.mean_sd_history_json);
    const entries = [...history, { qcLotId: level.qc_lot_id, at: '', mean: null, sd: null }];
    for (const entry of entries) {
      const lot = lots.find((item) => item.id === (entry.qcLotId || level.qc_lot_id));
      values.push(level.level, `M${level.level}`, `Mức ${level.level}`, lot?.lot_no);
    }
  }
  return values.filter((value) => value != null).map((value) => String(value));
}

export function HistoryTab() {
  const { tests, instruments, lots, lotGroups, levelsByTestId, loadLevels, loadHistoryPoints } = useManageStore(useShallow((s) => ({ tests: s.tests, instruments: s.instruments, lots: s.lots, lotGroups: s.lotGroups, levelsByTestId: s.levelsByTestId, loadLevels: s.loadLevels, loadHistoryPoints: s.loadHistoryPoints })));
  const [testId, setTestId] = useState('');
  const [points, setPoints] = useState<HistoryQcPointView[]>([]);
  const [detail, setDetail] = useState<HistoryRow | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  // Mở một lô khác thì về trang đầu của lô đó.
  useEffect(() => { setDetailPage(1); }, [detail?.key]);
  const [query, setQuery] = useState('');

  useEffect(() => { if (!testId && tests.length) setTestId(tests[0].id); }, [testId, tests]);
  useEffect(() => { if (testId) loadLevels(testId); }, [testId, loadLevels]);
  useEffect(() => { tests.forEach((test) => loadLevels(test.id)); }, [tests, loadLevels]);

  const levels = levelsByTestId[testId] || [];
  const selectedTest = tests.find((test) => test.id === testId);
  const selectedInstrument = instruments.find((instrument) => instrument.id === selectedTest?.instrument_id);
  const decimals = selectedTest?.decimal_places ?? 2;

  // Lấy TOÀN BỘ điểm theo xét nghiệm, gồm cả lô đã dừng. `queryPoints()` chỉ
  // trả lô đang chạy nên dùng nó ở đây sẽ làm dữ liệu lô cũ trông như bị
  // xoá ngay sau khi chấp nhận chuyển tiếp.
  useEffect(() => {
    let alive = true;
    if (!testId) { setPoints([]); return () => { alive = false; }; }
    (async () => {
      await loadHistoryPoints(testId);
      if (alive) setPoints(useManageStore.getState().historyPointsByTestId[testId] || []);
    })();
    return () => { alive = false; };
  }, [testId, loadHistoryPoints]);

  const groupLabel = (lotId: string | null | undefined) => {
    if (!lotId) return 'Chưa thuộc nhóm';
    const group = lotGroups.find((item) => item.lotIds.includes(lotId));
    return group ? group.name : 'Chưa thuộc nhóm';
  };

  const rows = useMemo<HistoryRow[]>(() => levels.flatMap((level) => {
    const k = level.range_k && level.range_k > 0 ? level.range_k : 2;
    const build = (entry: HistoryEntry, current: boolean, from: string, to: string, index: number): HistoryRow => {
      const lot = lots.find((item) => item.id === entry.qcLotId);

      return {
        level: level.level,
        lotId: entry.qcLotId,
        lotNo: entry.lot || lot?.lot_no || '',
        group: groupLabel(entry.qcLotId),
        mean: entry.mean,
        sd: entry.sd,
        // hệ thống in giới hạn dưới/trên ĐÚNG như đã lưu ở mức (`level.low`/
        // `level.high`), để trống thì "—" — KHÔNG suy từ Mean ± k·SD, vì đó là
        // dải hiển thị chứ không phải giới hạn đã được phê duyệt.
        low: entry.low ?? null,
        high: entry.high ?? null,
        period: periodLabel(from, to),
        to,
        source: entry.source || (level.applied === 'lab' ? 'lab' : 'mfg'),
        current,
        key: `${level.level}:${entry.qcLotId || ''}:${current ? 'now' : index}`,
      };
    };
    const currentLot = lots.find((item) => item.id === level.qc_lot_id);
    const history = parseHistory(level.mean_sd_history_json);
    const lastHistoryAt = history.length ? history[history.length - 1].at || '' : '';
    // Với một lô mới, ngày bắt đầu của mốc là Ngày mở khai tại Lô QC. Cột
    // trên test_levels chỉ là fallback cho dữ liệu cũ hoặc lần đổi dải trong
    // cùng một lô.
    const activeFrom = currentLot?.opened || level.mean_sd_effective_from || lastHistoryAt;
    const currentRow = level.mean != null || level.sd != null
      ? [build({ mean: level.mean, sd: level.sd, qcLotId: level.qc_lot_id, lot: currentLot?.lot_no, low: level.low, high: level.high, source: level.applied }, true, activeFrom, currentLot?.exp || '', 0)]
      : [];
    const past = history
      .map((entry, index) => {
        const lot = lots.find((item) => item.id === entry.qcLotId);
        const from = entry.effectiveFrom || lot?.opened || (index > 0 ? (history[index - 1].at || '') : '');
        const to = entry.effectiveTo || entry.at || lot?.exp || '';
        return build(entry, false, from, to, index);
      })
      .filter((row) => !currentRow.some((now) => now.mean === row.mean && now.sd === row.sd && now.lotId === row.lotId));
    return [...currentRow, ...past];
  }), [levels, lots, lotGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  const pointsOf = (row: HistoryRow) => points.filter((point) =>
    point.level === row.level && (row.lotNo ? (point.lot || '') === row.lotNo : true));

  return (
    <>
      <div className="rcfg-toolbar">
        <div><h2>Lịch sử dữ liệu QC</h2><p>Chọn một xét nghiệm và máy để xem các lô/Mean-SD đã từng dùng.</p></div>
        <div className="rcfg-tools"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo xét nghiệm hoặc máy..." /></div>
      </div>
      <div className="panel target-matrix-panel">
      {!tests.length ? <EmptyState title="Chưa có xét nghiệm">Tạo xét nghiệm trước, sau đó cấu hình lô và Mean/SD.</EmptyState> : <>
        <div className="target-selector history-selector">
          <div className="field"><label>Xét nghiệm / Máy</label><select value={testId} onChange={(e) => setTestId(e.target.value)}>{tests.filter((test) => {
            const q = query.trim().toLowerCase();
            const instrument = instruments.find((item) => item.id === test.instrument_id);
            return !q || testSearchValues(test, levelsByTestId[test.id] || [], lots, instrument?.name || '').some((v) => v.toLowerCase().includes(q));
          }).map((test) => {
            const instrument = instruments.find((item) => item.id === test.instrument_id);
            const machine = instrument?.name || 'Máy không còn tồn tại';
            return <option key={test.id} value={test.id}>{test.name} — {machine}</option>;
          })}</select></div>
        </div>
        <div className="rcfg-list">
          {rows.length ? (
            <table className="history-table">
              <thead><tr><th>Mức</th><th>Lô QC / Nhóm lô</th><th className="num">Mean</th><th className="num">Giới hạn dưới</th><th className="num">Giới hạn trên</th><th className="num">SD</th><th>Hiệu lực</th><th>Nguồn</th><th className="num">Điểm QC</th><th></th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.key}>
                  <td><span className="pill">M{row.level}</span></td>
                  <td><b>{row.lotNo || '—'}</b><div className="hint">{row.group}</div></td>
                  <td className="num">{fmt(row.mean, decimals)}</td>
                  <td className="num">{fmt(row.low, decimals)}</td>
                  <td className="num">{fmt(row.high, decimals)}</td>
                  <td className="num">{fmt(row.sd, decimals)}</td>
                  <td>{row.period}</td>
                  <td><span className={`tag ${row.source === 'lab' ? 'warn' : 'ok'}`}>{row.source === 'lab' ? 'PXN' : 'NSX'}</span></td>
                  <td className="num">{pointsOf(row).length}</td>
                  <td><button type="button" className="btn ghost sm" onClick={() => setDetail(row)}>Chi tiết</button></td>
                </tr>
              ))}</tbody>
            </table>
          ) : <EmptyState title="Chưa có dữ liệu lịch sử">Thiết lập Mean/SD cho xét nghiệm để bắt đầu theo dõi thay đổi.</EmptyState>}
        </div>
      </>}
      {detail && (() => {
        const historyEntries = rows.filter((row) => row.level === detail.level && row.lotId === detail.lotId);
        const detailPoints = pointsOf(detail);
        const detailPageCount = Math.max(1, Math.ceil(detailPoints.length / HISTORY_POINT_PAGE));
        const detailPageClamped = Math.min(Math.max(1, detailPage), detailPageCount);
        return (
          <Modal
            title={`${selectedTest?.name || ''}${selectedInstrument?.name ? ` · ${selectedInstrument.name}` : ''} · Mức ${detail.level}${detail.lotNo ? ` · Lô ${detail.lotNo}` : ''}`}
            onClose={() => setDetail(null)} size="xl" className="rcfg-history-detail-modal"
          >
            <h4 className="history-detail-heading">Mean/SD đã dùng</h4>
            {historyEntries.length ? (
              <table className="history-detail-table hist-meansd-table">
                <thead><tr><th>Lô QC</th><th className="num">Mean</th><th className="num">SD</th><th className="num">Mean tích lũy</th><th className="num">SD tích lũy</th><th className="num">CV tích lũy</th><th>Hiệu lực</th><th>Nguồn</th></tr></thead>
                <tbody>{historyEntries.map((row) => {
                  const vals = points.filter((p) => p.level === row.level && (row.lotNo ? (p.lot || '') === row.lotNo : true) && (!row.to || p.date <= row.to)).map((p) => p.val);
                  const st = statsOf(vals);
                  return (
                    <tr key={row.key}>
                      <td><b>{row.lotNo || '—'}</b></td>
                      <td className="num">{fmt(row.mean, decimals)}</td>
                      <td className="num">{fmt(row.sd, decimals)}</td>
                      <td className="num">{st ? fmt(st.mean, decimals) : '—'}</td>
                      <td className="num">{st && st.sd != null ? fmt(st.sd, decimals) : '—'}</td>
                      <td className="num">{st && st.cv != null ? `${st.cv.toFixed(2)}%` : '—'}</td>
                      <td>{row.period}</td>
                      <td><span className={`tag ${row.source === 'lab' ? 'warn' : 'ok'}`}>{row.source === 'lab' ? 'PXN' : 'NSX'}</span></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            ) : <EmptyState title="Chưa có mốc Mean/SD">Không tìm thấy lịch sử Mean/SD cho lô này.</EmptyState>}
            <h4 className="flow-panel space-after-section">Điểm QC đã nhập ({detailPoints.length})</h4>
            {detailPoints.length ? (<>
              <table className="history-detail-table hist-points-table">
                <thead><tr><th>Ngày</th><th>Lần chạy</th><th className="num">Giá trị</th><th className="num">Z</th><th className="num">Mean lúc nhập</th><th className="num">SD lúc nhập</th><th>Phân loại Z-score</th><th>Người thực hiện</th></tr></thead>
                <tbody>{detailPoints.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.run_id).localeCompare(String(b.run_id), 'vi', { numeric: true }))
                  .slice((detailPageClamped - 1) * HISTORY_POINT_PAGE, detailPageClamped * HISTORY_POINT_PAGE).map((point) => {
                  // Cùng quy tắc với kết luận Westgard: Mean/SD chốt lúc nhập chỉ
                  // dùng khi có đủ cả cặp. Trước đây lấy `qc_mean` và `qc_sd`
                  // độc lập, nên cùng một điểm có thể ra Z khác trang Nhập QC.
                  const target = pointTarget({ val: point.val, qcMean: point.qc_mean, qcSd: point.qc_sd }, detail.mean, detail.sd);
                  const z = target.z;
                  const mean = target.key ? target.mean : null;
                  const sd = target.key ? target.sd : null;
                  const abs = Math.abs(z);
                  // Nhãn đọc nhanh theo dải Z, không phải verdict Westgard
                  // (chuỗi/luật liên mức chỉ có ở trang Phân tích Westgard).
                  const verdict = !Number.isFinite(z) ? '—' : abs > 3 ? 'Ngoài ±3s' : abs > 2 ? 'Ngoài ±2s' : 'Trong ±2s';
                  return (
                    <tr key={point.id}>
                      <td>{vnDate(point.date)}</td>
                      <td>{point.run_id}</td>
                      <td className="num">{point.val.toFixed(decimals)}</td>
                      <td className="num">{Number.isFinite(z) ? `${z >= 0 ? '+' : ''}${z.toFixed(2)}s` : '—'}</td>
                      <td className="num">{mean != null ? fmt(mean, decimals) : '—'}</td>
                      <td className="num">{sd ? fmt(sd, decimals) : '—'}</td>
                      <td><span title="Phân loại theo Z-score, không phải kết luận Westgard" className={`tag ${verdict === 'Ngoài ±3s' ? 'rej' : verdict === 'Ngoài ±2s' ? 'warn' : 'ok'}`}>{verdict}</span></td>
                      <td>{point.operator_username || point.operator_name || '—'}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
              {detailPageCount > 1 && (
                <div className="table-pagination">
                  <span className="hint">Hiển thị {(detailPageClamped - 1) * HISTORY_POINT_PAGE + 1}–{Math.min(detailPageClamped * HISTORY_POINT_PAGE, detailPoints.length)} / {detailPoints.length} điểm</span>
                  <div>
                    <button type="button" className="btn ghost sm" disabled={detailPageClamped <= 1} onClick={() => setDetailPage(detailPageClamped - 1)}>‹ Trước</button>
                    <b>Trang {detailPageClamped}/{detailPageCount}</b>
                    <button type="button" className="btn ghost sm" disabled={detailPageClamped >= detailPageCount} onClick={() => setDetailPage(detailPageClamped + 1)}>Sau ›</button>
                  </div>
                </div>
              )}
            </>) : <EmptyState title="Chưa có điểm QC">Không có điểm QC nào khớp với lô/mức này.</EmptyState>}
          </Modal>
        );
      })()}
      </div>
    </>
  );
}


