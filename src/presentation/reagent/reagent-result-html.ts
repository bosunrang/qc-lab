type Result = Record<string, any>;
type NumberFormat = (value: unknown, decimals?: number) => string;

function resultVerdict(result: Result, format: NumberFormat) {
  const calibrationWarning = !result.passR2 || !result.passSlope;
  if (result.level === 'ok') return {
    cls: 'ok', icon: '✓', title: 'Kết luận: Đạt tiêu chí sàng lọc phần mềm',
    desc: 'Độ chệch trong giới hạn, đủ cỡ mẫu (n≥20) và đã xác nhận bao phủ khoảng đo/điểm quyết định. Lô mới đủ điều kiện trình phê duyệt theo SOP trước khi đưa vào sử dụng cho mẫu bệnh nhân.' + (calibrationWarning || !result.passP ? ' Lưu ý: một số chỉ số mô tả (P-value/R²/độ dốc) chưa lý tưởng, cần ghi nhận khi phê duyệt.' : ''),
  };
  if (result.level === 'mid') return {
    cls: 'mid', icon: '!', title: 'Kết luận: Chưa đủ điều kiện sàng lọc',
    desc: 'Độ chệch (%Bias) nằm trong giới hạn cho phép, song chưa đủ cỡ mẫu (n≥20) và/hoặc chưa xác nhận bao phủ khoảng đo/điểm quyết định theo SOP.' + (calibrationWarning ? ' Ngoài ra hệ số tương quan và/hoặc độ dốc hồi quy chưa đạt, nên kiểm tra hiệu chuẩn.' : '') + ' Bổ sung dữ liệu hoặc ghi nhận ngoại lệ theo SOP trước khi phê duyệt.',
  };
  return { cls: 'no', icon: '✕', title: 'Kết luận: Hai lô hóa chất có khác biệt', desc: 'Độ chệch (%Bias) vượt giới hạn cho phép. Không đưa lô mới vào sử dụng cho mẫu bệnh nhân; tiến hành điều tra, xử lý theo quy trình.' };
}

export function createReagentResultHtml() {
  return (result: Result | null | undefined, minimumPairs: number, format: NumberFormat, formatT: (value: unknown) => string) => {
    if (!result) return { statsHtml: `<div class="empty">Nhập tối thiểu ${minimumPairs} cặp giá trị hợp lệ để xem thống kê mô tả; khuyến nghị ≥20 cặp cho sàng lọc phần mềm.</div>`, criteriaHtml: '', verdictHtml: '' };
    const row = (label: string, value: unknown) => `<div class="rc-stat-row"><span>${label}</span><b>${value}</b></div>`;
    const equation = (slope: number, intercept: number) => `y = ${format(slope, 4)}x ${intercept >= 0 ? '+' : '−'} ${format(Math.abs(intercept), 4)}`;
    const statsHtml = `<div class="rc-stat-kpis">
      <div class="rc-stat-card"><div class="rc-stat-label">Hệ số tương quan (Pearson r)</div><div class="rc-stat-value">${format(result.r, 4)}</div><div class="rc-stat-sub">R² = ${format(result.fit.r2, 4)}</div></div>
      <div class="rc-stat-card"><div class="rc-stat-label">%Bias</div><div class="rc-stat-value ${result.passBias ? 'ok' : 'bad'}">${format(result.bias, 3)}%</div><div class="rc-stat-sub">Mong muốn &lt; ${format(result.biasT, 3)}%</div></div>
      <div class="rc-stat-card"><div class="rc-stat-label">P (hai phía / two-tail)</div><div class="rc-stat-value">${format(result.p2, 4)}</div><div class="rc-stat-sub">α = ${format(result.alpha, 4)}</div></div>
    </div><div class="rc-stat-section"><h4>Kiểm định t bắt cặp (t-Test: Paired Two Sample for Means)</h4><div class="rc-stat-columns"><div>${row('Trung bình (Mean) – Lô cũ / Lô mới', `${format(result.mO, 3)} / ${format(result.mN, 3)}`)}${row('Phương sai (Variance) – cũ / mới', `${format(result.vO, 3)} / ${format(result.vN, 3)}`)}${row('Số quan sát (Observations), n', result.N)}${row('Tương quan Pearson (Pearson Correlation)', format(result.r, 5))}${row('Chênh lệch TB giả định (Hypothesized Mean Diff.)', '0')}</div><div>${row('Bậc tự do (df)', result.df)}${row('Giá trị t (t Stat)', formatT(result.tStat))}${row('P(T≤t) một phía (one-tail)', format(result.p1, 5))}${row('t tới hạn một phía (t Critical one-tail)', format(result.tc1, 4))}${row('P(T≤t) hai phía (two-tail)', format(result.p2, 4))}${row('t tới hạn hai phía (t Critical two-tail)', format(result.tc2, 4))}</div></div></div><div class="rc-stat-section"><h4>Hồi quy &amp; độ chệch (Regression &amp; bias)</h4><div class="rc-stat-columns"><div>${row('Hồi quy tuyến tính (OLS)', equation(result.fit.b, result.fit.a))}${row('R² (OLS)', format(result.fit.r2, 5))}</div><div>${row('Passing-Bablok', equation(result.pb.b, result.pb.a))}${row('Chênh lệch tương đối TB theo cặp (Mean abs. rel. diff.)', `${format(result.mard, 3)}%`)}</div></div></div>`;
    const criteria = [
      [result.passBias, true, 'Độ chệch trong giới hạn cho phép (tiêu chí quyết định)', `%Bias = ${format(result.bias, 3)}% ${result.passBias ? '<' : '≥'} ${format(result.biasT, 3)}% mong muốn`],
      [result.enoughN, true, 'Đủ cỡ mẫu sàng lọc (tiêu chí quyết định)', `n = ${result.N} ${result.enoughN ? '≥' : '<'} 20 cặp hợp lệ`],
      [result.coverage, true, 'Bao phủ khoảng đo / điểm quyết định (tiêu chí quyết định)', result.coverage ? 'Đã xác nhận theo SOP' : 'Chưa xác nhận theo SOP'],
      [result.passP, false, 'Không khác biệt có ý nghĩa thống kê (mô tả)', `P(two-tail) = ${format(result.p2, 4)} ${result.passP ? '>' : '≤'} α = ${format(result.alpha, 4)}; không dùng riêng để chấp nhận lô`],
      [result.passR2, false, 'Tương quan chặt chẽ (mô tả)', `R² = ${format(result.fit.r2, 4)}; cần ≥ 0,95 để xem là tương quan chặt`],
      [result.passSlope, false, 'Độ dốc hồi quy chấp nhận được (mô tả)', `Slope = ${format(result.fit.b, 4)}; mục tiêu trong khoảng [0,90 - 1,10]`],
    ];
    const criteriaHtml = criteria.map(([ok, decision, title, why]) => { const cls = decision ? ok ? 'pass' : 'fail' : ok ? 'info' : 'note', text = decision ? ok ? 'ĐẠT' : 'KHÔNG ĐẠT' : ok ? 'TỐT' : 'LƯU Ý'; return `<div class="rc-crit-item"><span class="rc-crit-badge ${cls}">${text}</span><div class="rc-crit-text">${title}<div>${why}</div></div></div>`; }).join('');
    const verdict = resultVerdict(result, format), verdictHtml = `<div class="rc-verdict ${verdict.cls}"><div class="rc-verdict-icon">${verdict.icon}</div><div><div class="rc-verdict-title">${verdict.title}</div><div class="rc-verdict-desc">${verdict.desc}</div></div></div>`;
    return { statsHtml, criteriaHtml, verdictHtml };
  };
}
