// Chi tiết đọc từ đúng kỳ báo cáo; không suy diễn giá trị cho ô còn thiếu.
import { useCallback } from 'react';
import { useEqaStore } from '../../store/eqa-store';
import { EmptyState } from '../../components/EmptyState';
import { vnDate } from '../../lib/format';
import { EQA_PROVIDER_CHECK_LABEL } from '../../../main/domain/eqa/evaluation';
import { ClassTag, Facts, numText, pctText, rawNum, TrendTags } from './shared';
import { useEqaRead, useEqaRevision } from './useEqaRead';
import type { EqaSelection } from './useEqaScope';

export function EqaResultInspector({ selection, onOpenRound, onOpenTest, onClose }: {
  selection: EqaSelection; onOpenRound: (id: string, resultId?: string) => void; onOpenTest?: () => void; onClose?: () => void;
}) {
  const get = useEqaStore((s) => s.get);
  const revision = useEqaRevision();
  const read = useCallback(() => get(selection.roundId), [get, selection.roundId]);
  const { data: view, error, retry } = useEqaRead(`${selection.roundId}:${revision}`, read);
  const result = view?.results.find((r) => r.test_id === selection.testId && (selection.resultId ? r.id === selection.resultId : r.sample === (selection.sample ?? '')));
  const unit = (value: string) => (result?.unit && value !== '—' ? `${value} ${result.unit}` : value);
  const teaText = !result || result.tea_pct === null ? 'Chưa khai TEa'
    : `${pctText(result.tea_pct)} · ${result.within_tea === null ? 'chưa đủ dữ liệu đối chiếu' : result.within_tea ? 'trong TEa' : 'vượt TEa'}`;
  const zDiscrepancy = result?.provider_check === 'mismatch' || result?.provider_check === 'swapped';
  const hasSignals = !!(result?.trend?.signals.length || result?.trend?.unsuccessful);
  return <section className="panel eqa-inspector" aria-label="Kết quả đang chọn">
    <div className="panel-head"><h2>Kết quả đang chọn</h2>{onClose && <button type="button" className="btn ghost sm" aria-label="Đóng chi tiết kết quả" onClick={onClose}>Đóng</button>}</div>
    <div className="eqa-section-body" aria-live="polite">
      {error ? <EmptyState size="compact" title="Không tải được kết quả" action={<button className="btn ghost sm" onClick={retry}>Thử lại</button>}>{error}</EmptyState>
        : view === undefined ? <EmptyState size="compact" title="Đang tải kết quả…" />
        : !view ? <EmptyState size="compact" title="Không tìm thấy kỳ báo cáo" /> : <>
          <div className="eqa-inspector-title"><h3>{result?.test_name ?? 'Chưa có kết quả'}</h3><span className="eqa-sub">{view.round.round} / {view.round.year}{(result?.sample || selection.sample) ? ` · Mẫu ${result?.sample || selection.sample}` : ''}</span></div>
          {result ? <>
            <div className="eqa-result-score"><b>{numText(result.z_official)}</b><span className="eqa-score-label">z-score</span><ClassTag cls={result.class} /></div>
            {zDiscrepancy && <p className="eqa-note eqa-z-discrepancy" role="status">z tính lại: {numText(result.z)} · {EQA_PROVIDER_CHECK_LABEL[result.provider_check]}</p>}
            {/* Số liệu của báo cáo tách khỏi phần đối chiếu nội bộ với TEa (N-05). */}
            <div className="eqa-facts-group"><h4 className="eqa-facts-title">Số liệu báo cáo</h4>
              <Facts items={[
                ['Kết quả', unit(rawNum(result.result))], ['Giá trị ấn định', unit(rawNum(result.assigned))],
                ['σp', unit(rawNum(result.sigma_p))],
              ]} /></div>
            <div className="eqa-facts-group"><h4 className="eqa-facts-title">So với TEa của PXN</h4>
              <Facts items={[['% lệch', pctText(result.pct)], ['TEa', teaText]]} /></div>
            {hasSignals && <TrendTags signals={result.trend?.signals ?? []} unsuccessful={result.trend?.unsuccessful ?? false} />}
            {!result.trend ? <span className="hint-inline">Chưa có dữ liệu đánh giá chuỗi</span>
              : !result.trend.enough ? <span className="hint-inline">Chưa đủ số đợt để kết luận về xu hướng</span>
              : !hasSignals ? <span className="hint-inline">Không có tín hiệu chuỗi</span> : null}
            <details key={result.id} className="eqa-details"><summary>Đối chiếu và nhóm so sánh</summary>
              <p className="eqa-note">{EQA_PROVIDER_CHECK_LABEL[result.provider_check]}</p>
              <Facts items={[
                ['z nhà cung cấp', numText(result.z_provider)], ['z tính lại', numText(result.z)],
                ['Phương pháp', result.method || '—'], ['Nhóm thiết bị', result.peer_group || '—'],
                ['Máy', result.instrument_name],
              ]} />
              {result.assigned_check?.uncertain && <p className="eqa-note">Giá trị ấn định kém chắc chắn · z′ = {numText(result.assigned_check.z_prime)}.</p>}
              {result.warnings.length > 0 && <ul className="eqa-list">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
            </details>
          </> : <EmptyState size="compact" title="Chưa ghi nhận kết quả ở ô này">Kiểm tra báo cáo của đợt trước khi kết luận thiếu mẫu hoặc chưa tham gia.</EmptyState>}
          <div className="eqa-source"><span className="eqa-sub">Thông tin nguồn của kỳ · lần nhập gần nhất</span><b>{view.round.report_code || view.round.program_name}</b>
            <span>Ngày báo cáo: {vnDate(view.round.report_date, 'Chưa ghi ngày')}</span>
            <details key={view.round.id} className="eqa-details"><summary>Tệp báo cáo</summary><span>{view.round.source_name || 'Chưa ghi tên tệp'}</span></details>
            <button type="button" className="btn ghost sm" onClick={() => onOpenRound(view.round.id, result?.id)}>Mở kỳ báo cáo</button>
          </div>
          {onOpenTest && result && <button type="button" className="btn sm" onClick={onOpenTest}>Phân tích xét nghiệm →</button>}
        </>}
    </div>
  </section>;
}
