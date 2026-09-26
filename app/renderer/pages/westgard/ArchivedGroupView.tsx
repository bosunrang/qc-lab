// Tab "Nhóm lô đã dừng/lưu trữ" của trang Phân tích Westgard: phần chọn nằm
// trong panel "Thiết lập phân tích", phần kết quả nằm bên dưới. Cả hai đọc
// cùng trạng thái của `useArchivedWestgard`.
import { QcMultiChart } from '../../components/QcChart';
import { EmptyState } from '../../components/EmptyState';
import { WestgardPointTable, vnDate } from './shared';
import type { ArchivedWestgardState } from './useArchivedWestgard';

export function ArchivedGroupPicker({ state }: { state: ArchivedWestgardState }) {
  const {
    archivedQuery, setArchivedQuery, archivedMatchedTests, archivedOrderedTests, archivedTestId, setArchivedTestId,
    archivedTestsLoading, archivedTestOptions, archivedTestPickerLabel, archivedGroupOptions, archivedGroups, archivedGroupId, setArchivedGroupId,
  } = state;
  return (
    <>
      <div className="wg-test-picker wg-test-picker-3">
        <div className="field">
          <label>Tìm nhanh</label>
          <input type="search" placeholder="Tên xét nghiệm hoặc số lô..." value={archivedQuery} onChange={(e) => setArchivedQuery(e.target.value)} />
        </div>
        <div className="field"><label>Chọn xét nghiệm <span className="hint">({archivedMatchedTests.length || archivedOrderedTests.length}/{archivedOrderedTests.length})</span></label>
          <select value={archivedTestId} disabled={archivedTestsLoading || !archivedTestOptions.length} onChange={(e) => setArchivedTestId(e.target.value)}>
            {!archivedTestOptions.length && <option value="">{archivedTestsLoading ? 'Đang nạp xét nghiệm...' : 'Nhóm lô này chưa dùng cho xét nghiệm nào'}</option>}
            {archivedTestOptions.map((t) => <option key={t.id} value={t.id}>{archivedTestPickerLabel(t)}</option>)}
          </select>
        </div>
        <div className="field"><label>Nhóm lô đã dừng/lưu trữ <span className="hint">({archivedGroupOptions.length}/{archivedGroups.length})</span></label>
          <select value={archivedGroupId} onChange={(e) => setArchivedGroupId(e.target.value)}>
            {archivedGroupOptions.map((g) => <option key={g.id} value={g.id}>{g.name} · {g.active === 0 ? 'đã lưu trữ' : 'đã dừng'}{g.stopped_at ? ` ${vnDate(g.stopped_at)}` : ''}</option>)}
          </select>
        </div>
      </div>
      <p className="hint wg-archive-note">Ưu tiên Mean/SD lưu tại từng điểm QC, dùng dải lịch sử của lô khi điểm cũ chưa có snapshot; kết luận được đánh giá lại theo bộ luật Westgard đang bật hiện nay, không phải cấu hình luật tại thời điểm nhóm lô còn hoạt động.</p>
    </>
  );
}

export function ArchivedGroupResults({ state }: { state: ArchivedWestgardState }) {
  const { archivedGroupId, archivedTestsLoading, archivedTestId, archivedTests, archivedBlocksLoading, archivedBlocks, archivedDecimals, archivedStatusLabel } = state;
  return (
    <>
      {archivedGroupId && archivedTestsLoading && (
        <div className="panel"><EmptyState>Đang nạp xét nghiệm và dữ liệu lịch sử của nhóm lô…</EmptyState></div>
      )}

      {archivedGroupId && !archivedTestsLoading && !archivedTestId && !archivedTests.length && (
        <div className="panel"><EmptyState title="Không tìm thấy xét nghiệm nào">Nhóm lô này không gắn với xét nghiệm/mức nào có Mean/SD lịch sử hợp lệ.</EmptyState></div>
      )}

      {archivedTestId && archivedBlocksLoading && (
        <div className="panel"><EmptyState>Đang đánh giá Westgard cho dữ liệu lịch sử…</EmptyState></div>
      )}

      {archivedTestId && !archivedBlocksLoading && !archivedBlocks.length && (
        <div className="panel"><EmptyState title="Chưa có dữ liệu phân tích">Không có lô nào của nhóm này có Mean/SD lịch sử hợp lệ cho xét nghiệm đã chọn.</EmptyState></div>
      )}

      {archivedTestId && archivedBlocks.length >= 2 && (
        <div className="panel wg-multi-panel">
          <h2 className="panel-title">Levey-Jennings tổng hợp</h2>
          <div className="hint wg-panel-intro">Biểu đồ quy đổi từng mức về Z-score theo Mean/SD đã chốt của chính lô để so sánh trên cùng trục; kết luận được đánh giá lại theo bộ luật Westgard đang bật.</div>
          <div className="chart-scroll"><QcMultiChart className="wgLJMultiArchived" height={300} responsiveHeight decimals={archivedDecimals}
            series={archivedBlocks.map((b) => ({ level: b.level, lot: b.lotNo, points: b.analysis.points }))} /></div>
        </div>
      )}

      {archivedTestId && archivedBlocks.map((b) => (
        <div className={`panel wg-level-panel${b.analysis.points.length ? ' wg-prev-lot' : ''}`} key={`${b.level}-${b.lotId}`}>
          <h3>
            <div className="wg-level-title"><span>Mức {b.level}</span><span className="wg-lot-name">Lô {b.lotNo}</span></div>
            <div className="wg-level-meta"><span className="tag rej">{archivedStatusLabel}</span><span>Mean {b.mean.toFixed(archivedDecimals)}</span><span>SD {b.sd.toFixed(archivedDecimals)}</span><span>{b.analysis.points.length} điểm</span></div>
          </h3>
          {!b.analysis.points.length ? (
            <EmptyState title="Chưa có dữ liệu">Không tìm thấy điểm QC nào cho lô này.</EmptyState>
          ) : (
            <WestgardPointTable points={b.analysis.points} decimals={archivedDecimals} />
          )}
        </div>
      ))}
    </>
  );
}
