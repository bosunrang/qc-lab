// Phần trình bày kết quả dùng chung cho màn hình và bản in PDF.
import type { ReagentComparisonResult, ReagentComparisonView } from '../../shared/qc-api';
import { fmt, fmtT, equation, MIN_PAIRS } from '../lib/reagent-format';
import { EmptyState } from './EmptyState';
import { StatCard } from './StatCard';
import { ReagentChart } from './ReagentChart';

function verdictOf(result: ReagentComparisonResult): { cls: string; icon: string; title: string; desc: string } {
  const calibrationWarning = !result.passR2 || !result.passSlope;
  if (result.level === 'ok') {
    return {
      cls: 'ok', icon: '✓', title: 'Kết luận: Đạt tiêu chí sàng lọc phần mềm',
      desc: 'Độ chệch trong giới hạn, đủ cỡ mẫu (n≥20) và đã xác nhận bao phủ khoảng đo/điểm quyết định. Lô mới đủ điều kiện trình phê duyệt theo SOP trước khi đưa vào sử dụng cho mẫu bệnh nhân.'
        + (calibrationWarning || !result.passP ? ' Lưu ý: một số chỉ số mô tả (P-value/R²/độ dốc) chưa lý tưởng, cần ghi nhận khi phê duyệt.' : ''),
    };
  }
  if (result.level === 'mid') {
    return {
      cls: 'mid', icon: '!', title: 'Kết luận: Chưa đủ điều kiện sàng lọc',
      desc: 'Độ chệch (%Bias) nằm trong giới hạn cho phép, song chưa đủ cỡ mẫu (n≥20) và/hoặc chưa xác nhận bao phủ khoảng đo/điểm quyết định theo SOP.'
        + (calibrationWarning ? ' Ngoài ra hệ số tương quan và/hoặc độ dốc hồi quy chưa đạt, nên kiểm tra hiệu chuẩn.' : '')
        + ' Bổ sung dữ liệu hoặc ghi nhận ngoại lệ theo SOP trước khi phê duyệt.',
    };
  }
  return {
    cls: 'no', icon: '✕', title: 'Kết luận: Hai lô hoá chất có khác biệt',
    desc: 'Độ chệch (%Bias) vượt giới hạn cho phép. Không đưa lô mới vào sử dụng cho mẫu bệnh nhân; tiến hành điều tra, xử lý theo quy trình.',
  };
}

function StatRow({ label, value }: { label: string; value: unknown }) {
  return <div className="rc-stat-row"><span>{label}</span><b>{String(value)}</b></div>;
}

export function StatsPanel({ result }: { result: ReagentComparisonResult | null }) {
  return (
    <div className="panel rc-stats-panel">
      <h2 className="panel-title">Kết quả thống kê</h2>
      {!result ? (
        <EmptyState>
          Nhập tối thiểu {MIN_PAIRS} cặp giá trị hợp lệ để xem thống kê mô tả; khuyến nghị ≥20 cặp cho sàng lọc phần mềm.
        </EmptyState>
      ) : (
        <div className="rc-stats-content">
          <div className="rc-stat-kpis">
            <StatCard label="Hệ số tương quan (Pearson r)" value={fmt(result.r, 4)} sub={<>R² = {fmt(result.fit.r2, 4)}</>} tone="accent" />
            <StatCard label="%Bias" value={<>{fmt(result.bias, 3)}%</>} sub={<>Mong muốn &lt; {fmt(result.biasT, 3)}%</>} tone={result.passBias ? 'accent' : 'danger'} />
            <StatCard label="P (hai phía / two-tail)" value={fmt(result.p2, 4)} sub={<>α = {fmt(result.alpha, 4)}</>} tone="accent" />
          </div>
          <div className="rc-stat-section">
            <h4>Kiểm định t bắt cặp (t-Test: Paired Two Sample for Means)</h4>
            <div className="rc-stat-columns">
              <div>
                <StatRow label="Trung bình (Mean) – Lô cũ / Lô mới" value={`${fmt(result.mO, 3)} / ${fmt(result.mN, 3)}`} />
                <StatRow label="Phương sai (Variance) – cũ / mới" value={`${fmt(result.vO, 3)} / ${fmt(result.vN, 3)}`} />
                <StatRow label="Số quan sát (Observations), n" value={result.N} />
                <StatRow label="Tương quan Pearson (Pearson Correlation)" value={fmt(result.r, 5)} />
                <StatRow label="Chênh lệch TB giả định (Hypothesized Mean Diff.)" value="0" />
              </div>
              <div>
                <StatRow label="Bậc tự do (df)" value={result.df} />
                <StatRow label="Giá trị t (t Stat)" value={fmtT(result.tStat)} />
                <StatRow label="P(T≤t) một phía (one-tail)" value={fmt(result.p1, 5)} />
                <StatRow label="t tới hạn một phía (t Critical one-tail)" value={fmt(result.tc1, 4)} />
                <StatRow label="P(T≤t) hai phía (two-tail)" value={fmt(result.p2, 4)} />
                <StatRow label="t tới hạn hai phía (t Critical two-tail)" value={fmt(result.tc2, 4)} />
              </div>
            </div>
          </div>
          <div className="rc-stat-section">
            <h4>Hồi quy &amp; độ chệch (Regression &amp; bias)</h4>
            <div className="rc-stat-columns">
              <div>
                <StatRow label="Hồi quy tuyến tính (OLS)" value={equation(result.fit.b, result.fit.a)} />
                <StatRow label="R² (OLS)" value={fmt(result.fit.r2, 5)} />
              </div>
              <div>
                <StatRow label="Passing-Bablok" value={equation(result.pb.b, result.pb.a)} />
                <StatRow label="Chênh lệch tương đối TB theo cặp (Mean abs. rel. diff.)" value={`${fmt(result.mard, 3)}%`} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CriteriaPanel({ result }: { result: ReagentComparisonResult | null }) {
  if (!result) return (
    <div className="panel rc-crit-panel">
      <h2 className="panel-title">Tiêu chí chấp nhận &amp; kết luận</h2>
      <EmptyState title="Chưa đủ dữ liệu để kết luận">
        Nhập tối thiểu {MIN_PAIRS} cặp giá trị hợp lệ để xem các tiêu chí; cần ≥20 cặp, xác nhận bao phủ khoảng đo/điểm quyết định và %Bias trong giới hạn SOP để đạt sàng lọc phần mềm.
      </EmptyState>
    </div>
  );
  // 6 tiêu chí theo thứ tự cố định. `decision` = tiêu chí QUYẾT
  // ĐỊNH (ĐẠT/KHÔNG ĐẠT), còn lại chỉ mô tả (TỐT/LƯU Ý).
  const criteria: [boolean, boolean, string, string][] = [
    [result.passBias, true, 'Độ chệch trong giới hạn cho phép (tiêu chí quyết định)',
      `%Bias = ${fmt(result.bias, 3)}% ${result.passBias ? '<' : '≥'} ${fmt(result.biasT, 3)}% mong muốn`],
    [result.enoughN, true, 'Đủ cỡ mẫu sàng lọc (tiêu chí quyết định)',
      `n = ${result.N} ${result.enoughN ? '≥' : '<'} 20 cặp hợp lệ`],
    [result.coverage, true, 'Bao phủ khoảng đo / điểm quyết định (tiêu chí quyết định)',
      result.coverage ? 'Đã xác nhận theo SOP' : 'Chưa xác nhận theo SOP'],
    [result.passP, false, 'Không khác biệt có ý nghĩa thống kê (mô tả)',
      `P(two-tail) = ${fmt(result.p2, 4)} ${result.passP ? '>' : '≤'} α = ${fmt(result.alpha, 4)}; không dùng riêng để chấp nhận lô`],
    [result.passR2, false, 'Tương quan chặt chẽ (mô tả)',
      `R² = ${fmt(result.fit.r2, 4)}; cần ≥ 0,95 để xem là tương quan chặt`],
    [result.passSlope, false, 'Độ dốc hồi quy chấp nhận được (mô tả)',
      `Slope = ${fmt(result.fit.b, 4)}; mục tiêu trong khoảng [0,90 - 1,10]`],
  ];
  const verdict = verdictOf(result);
  return (
    <div className="panel rc-crit-panel">
      <h2 className="panel-title">Tiêu chí chấp nhận &amp; kết luận</h2>
      <div className="rc-criteria-content">
        {criteria.map(([ok, decision, title, why]) => {
          // Tiêu chí quyết định: đạt/không đạt; tiêu chí tham khảo: tốt/lưu ý.
          const tone = decision ? (ok ? 'ok' : 'rej') : (ok ? 'ok' : 'warn');
          const text = decision ? (ok ? 'ĐẠT' : 'KHÔNG ĐẠT') : (ok ? 'TỐT' : 'LƯU Ý');
          return (
            <div className="rc-crit-item" key={title}>
              <span className={`tag rc-crit-status ${tone}`}>{text}</span>
              <div className="rc-crit-text">{title}<div>{why}</div></div>
            </div>
          );
        })}
      </div>
      <div className="rc-verdict-wrap">
        <div className={`rc-verdict ${verdict.cls}`}>
          <div className="rc-verdict-icon">{verdict.icon}</div>
          <div>
            <div className="rc-verdict-title">{verdict.title}</div>
            <div className="rc-verdict-desc">{verdict.desc}</div>
          </div>
        </div>
      </div>
    </div>
  );
}


export function ReagentCharts({ comparison }: { comparison: ReagentComparisonView }) {
  const result = comparison.result;
  return (
    <div className="panel rc-chart-panel">
        <h2 className="panel-title">Biểu đồ</h2>
        {!result ? (
          <EmptyState title="Chưa có biểu đồ">Nhập tối thiểu {MIN_PAIRS} cặp giá trị hợp lệ để vẽ biểu đồ.</EmptyState>
        ) : (
          <div className="rc-charts">
            <div className="rc-chart-box">
              <h3>Biểu đồ tương quan</h3>
              <p>Lô cũ (trục X) so với Lô mới (trục Y)</p>
              <ReagentChart mode="scatter" result={result} lotOld={comparison.lot_old} lotNew={comparison.lot_new} />
              <div className="rc-chart-legend"><span><i className="reg"></i>Đường hồi quy</span><span><i className="ideal"></i>Đường lý tưởng y = x</span><span>Lô cũ ({comparison.lot_old || '—'})</span><span>Lô mới ({comparison.lot_new || '—'})</span></div>
            </div>
            <div className="rc-chart-box">
              <h3>Biểu đồ Bland-Altman</h3>
              <p>Hiệu số (cũ − mới) so với giá trị trung bình</p>
              <ReagentChart mode="bland" result={result} />
              <div className="rc-chart-legend"><span><i className="bias"></i>Bias trung bình</span><span><i className="limit"></i>±1.96 SD</span>
                <span>Trung bình (cũ + mới)/2</span>
                <span>Bias {fmt(result.md, 3)}</span><span>+1.96SD {fmt(result.loaUpper, 3)}</span><span>−1.96SD {fmt(result.loaLower, 3)}</span></div>
            </div>
          </div>
        )}
      </div>
  );
}
