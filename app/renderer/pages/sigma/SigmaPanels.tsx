// Các khối chỉ hiển thị của trang Six Sigma: tình trạng kỳ đang xem, thiết kế
// QC theo Sigma (OPSpecs), độ không đảm bảo đo và biểu đồ. Tách khỏi
// `SigmaPage.tsx` ngày 2026-09-26 (kế hoạch kiến trúc D.7); dữ liệu và kết luận
// đều do main process tính, các khối này chỉ trình bày.
import { SigmaTrendChart, SigmaMdcChart } from '../../components/SigmaCharts';
import { sigmaDesignEligible } from '../../lib/sigma-workflow';
import { ImprovementCard } from './ImprovementCard';
import { cohortStatusLabel, designRunText, formatDpmo, missingSigmaInputs, sigmaZone, vnPeriod } from './shared';
import type { SigmaLevelResult, SigmaPeriodView } from '../../../shared/qc-api';

export function SigmaStatusPanel({ period, testName, teaText }: { period: SigmaPeriodView | undefined; testName: string; teaText: string }) {
  return (
    <div className="panel">
      <h2 className="sg-setup-heading panel-title">Tình trạng</h2>
      {!period
        ? <div className="hint">Chưa có kỳ Sigma. Hãy thêm kỳ để bắt đầu.</div>
        : (
          <>
            <div className="hint space-after-item">Kỳ đang xem: <b>{vnPeriod(period.period)}</b> · {testName} · TEa {teaText}</div>
            <div id="sgStatus"><div className="sgcards">
              {period.levels.map((lv) => {
                const zone = sigmaZone(lv.sigma?.sigma);
                return (
                  <div className="sgbig" key={lv.level} style={{ background: zone.c }}>
                    <div className="lab">Mức {lv.level} — Sigma</div>
                    <div className="v">{lv.sigma ? lv.sigma.sigma.toFixed(2) : '—'}</div>
                    <div className="grade">{lv.sigma ? `${sigmaDesignEligible(lv) ? '' : 'Ước tính · '}${zone.label}` : ''}</div>
                    <div className="sub">
                      {lv.sigma
                        ? <>CV IQC {lv.cv != null ? lv.cv.toFixed(2) : '—'}% · {lv.eqaRounds.length ? 'Bias RMS EQA/EQC' : 'Bias EQA/EQC'} {lv.biasEqa != null ? lv.biasEqa.toFixed(2) : '—'}%{lv.eqaRounds.length > 1 && lv.biasMean != null ? ` · TB có dấu ${lv.biasMean.toFixed(2)}%` : ''}<br />DPMO {formatDpmo(lv.sigma.dpmo)} · Yield {lv.sigma.yieldPercent.toFixed(4)}%</>
                        : `Chưa tính được Sigma — còn thiếu ${missingSigmaInputs(lv).join(', ')}`}
                    </div>
                  </div>
                );
              })}
            </div></div>
            {period.levels.map((lv) => <ImprovementCard key={lv.level} level={lv.level} result={lv} tea={lv.tea} />)}
          </>
        )}
    </div>
  );
}

export function SigmaOpspecsPanel({ period, governingLevel, hasSingleOperationalLevel }: {
  period: SigmaPeriodView; governingLevel: SigmaLevelResult | null | undefined; hasSingleOperationalLevel: boolean;
}) {
  return (
    <details className="panel sg-collapse-panel">
      <summary className="sg-collapse-summary"><span role="heading" aria-level={2}>Thiết kế QC theo Sigma (OPSpecs)</span></summary>
      <div className="sg-collapse-body">
        <div className="hint sg-selected-period-hint">Kỳ đang xem: <b>{vnPeriod(period.period)}</b>. Gợi ý không tự thay đổi luật Westgard đang áp dụng.</div>
        <div className="sg-opspec-table-wrap"><table className="sg-opspec-table"><thead><tr><th>Mức</th><th>Sigma</th><th>Bộ quy tắc QC gợi ý</th><th>Mức nguy cơ tham khảo</th><th>Hành động</th></tr></thead><tbody>
          {period.levels.map((lv) => {
            const eligible = sigmaDesignEligible(lv);
            const design = eligible ? lv.qualityDesign : null;
            return <tr key={lv.level}><td>Mức {lv.level}</td><td className="num" style={{ color: sigmaZone(lv.sigma?.sigma).c }}>{lv.sigma?.sigma.toFixed(2) ?? '—'}</td>
              {!lv.sigma ? <><td>—</td><td>Chưa đủ CV/Bias</td><td>Chưa đánh giá</td></>
                : hasSingleOperationalLevel ? <><td><span className="hint">Chưa áp dụng</span></td><td>Cần tối thiểu 2 mức QC đang vận hành</td><td>Không đưa gợi ý Sigma Rules</td></>
                : !eligible ? <><td><span className="hint">Chưa đủ điều kiện</span></td><td>{lv.cvSource !== 'iqc-cohort' ? 'CV nhập tay' : lv.cohortStale ? 'Cần nạp và rà soát lại' : !lv.cohortReviewed ? 'Chưa xác nhận rà soát' : cohortStatusLabel(lv.cohortStatus)}</td><td>Không dùng để đề xuất QC</td></>
                  : !design ? <><td>—</td><td>—</td><td>—</td></>
                    : <><td><b>{design.rules.join(' / ')}</b><div className="sg-cell-meta">{designRunText(design)} · bảng {design.levels} mức</div></td><td>{design.risk}</td><td>{design.plan}</td></>}
            </tr>;
          })}
        </tbody></table></div>
        {governingLevel?.qualityDesign ? (
          <div className="alert info sg-governing-rule">
            <b>Thiết kế QC dùng chung cho xét nghiệm</b>
            <div>Mức quyết định: Mức {governingLevel.level} · Sigma {governingLevel.sigma?.sigma.toFixed(2)}. Áp dụng tham khảo: <b>{governingLevel.qualityDesign.rules.join(' / ')}</b> · {designRunText(governingLevel.qualityDesign)} · theo bảng Westgard Sigma Rules cho <b>{governingLevel.qualityDesign.levels} mức QC</b> (xét nghiệm đang có {governingLevel.qualityDesign.levelCount} mức).</div>
          </div>
        ) : <div className="hint sg-governing-rule">{hasSingleOperationalLevel ? 'Chưa đề xuất QC dùng chung: cần tối thiểu 2 mức QC đang vận hành để áp dụng bảng Westgard Sigma Rules.' : 'Chưa đề xuất QC dùng chung: cần đủ đầu vào và xác nhận rà soát IQC cho tất cả mức; không bỏ qua mức thiếu dữ liệu hoặc mất kiểm soát.'}</div>}
        <div className="alert info sg-opspec-note">Gợi ý theo <b>Westgard Sigma Rules</b> chỉ là điểm khởi đầu. Người phụ trách phải rà soát nguy cơ, độ ổn định hệ thống, khối lượng mẫu và hậu quả lâm sàng trước khi tự cấu hình luật Westgard.</div>
      </div>
    </details>
  );
}

export function SigmaMuPanel({ period, unit, writable, onEdit }: {
  period: SigmaPeriodView; unit: string; writable: boolean; onEdit: (level: SigmaLevelResult) => void;
}) {
  return (
    <details className="panel sg-collapse-panel sg-mu-panel">
      <summary className="sg-collapse-summary"><span role="heading" aria-level={2}>Độ không đảm bảo đo (MU)</span></summary>
      <div className="sg-collapse-body">
        <div className="sg-mu-table-wrap">
          <table className="sg-mu-summary-table">
            <thead><tr><th>Mức</th><th className="num">Mean mục tiêu</th><th className="num">u(Rw)</th><th className="num">u(Cref)</th><th className="num">u(bias)</th><th className="num">u(cal)</th><th className="num">u_c</th><th className="num">U (k=2)</th><th className="num">U tại Mean</th><th className="num">U / TEa</th><th>Trạng thái</th><th>Thành phần thiếu</th><th>Thao tác</th></tr></thead>
            <tbody>
              {period.levels.map((lv) => (
                <tr key={lv.level}>
                  <td>Mức {lv.level}</td>
                  <td className="num">{lv.targetMean != null ? `${lv.targetMean}${unit ? ` ${unit}` : ''}` : '—'}</td>
                  <td className="num">{lv.mu?.uRw != null ? lv.mu.uRw.toFixed(4) : '—'}</td>
                  <td className="num">{lv.mu?.uCref != null ? lv.mu.uCref.toFixed(4) : '—'}</td>
                  <td className="num">{lv.mu?.uBias != null ? lv.mu.uBias.toFixed(4) : '—'}</td>
                  <td className="num">{lv.mu?.uCal != null ? lv.mu.uCal.toFixed(4) : '—'}</td>
                  <td className="num">{lv.mu?.uc != null ? <>{lv.mu.uc.toFixed(4)}{!lv.mu.complete && <small className="hint"> · tạm tính</small>}</> : '—'}</td>
                  <td className="num">{lv.mu?.U != null ? <>{lv.mu.U.toFixed(4)}{!lv.mu.complete && <small className="hint"> · tạm tính</small>}</> : '—'}</td>
                  <td className="num">{lv.mu?.complete && lv.mu.absoluteU != null ? `${lv.mu.absoluteU.toFixed(4)}${unit ? ` ${unit}` : ''}` : '—'}</td>
                  <td className="num">{lv.mu?.teaRatio != null ? <b className={lv.mu.withinTea ? 'sg-mu-within' : 'sg-mu-over'}>{(lv.mu.teaRatio * 100).toFixed(0)}%</b> : '—'}</td>
                  <td>{!lv.mu ? <span className="hint">Chưa có CV IQC</span> : !lv.mu.complete ? <span className="tag warn">Chưa đủ</span> : lv.mu.withinTea === false ? <span className="tag rej">U vượt TEa</span> : <span className="tag ok">Đủ thành phần</span>}</td>
                  <td>{lv.mu?.missing?.length ? lv.mu.missing.join(', ') : <span className="hint">Đủ thành phần</span>}</td>
                  <td>{writable && <button type="button" className="btn ghost sm" onClick={() => onEdit(lv)}>{lv.mu ? 'Sửa MU' : 'Nhập MU'}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

export function SigmaChartsPanel({ periods, hasChartData }: { periods: SigmaPeriodView[]; hasChartData: boolean }) {
  return (
    <div className="panel">
      <h2 className="panel-title">Biểu đồ Sigma &amp; MDC</h2>
      <div className="sg-chart-grid">
        <div className="sg-chart-box">
          <h3>Xu hướng Sigma theo kỳ</h3>
          <div className="chart-inner">
            <SigmaTrendChart periods={periods} />
          </div>
        </div>
        <div className="sg-chart-box">
          <h3>Biểu đồ Quyết định Phương pháp (MDC)</h3>
          {hasChartData && <div className="hint">X = CV/TEA, Y = |BIAS|/TEA. Điểm to nhất là kỳ gần nhất.</div>}
          <div className="chart-inner"><SigmaMdcChart periods={periods} /></div>
        </div>
      </div>
    </div>
  );
}
