// So sánh hóa chất — Giai đoạn D3.7 (docs/APP-V2-PLAN.md): bố cục + từng
// chuỗi chữ port theo golden master `src/react/pages/ReagentPage.tsx` +
// `src/presentation/reagent/reagent-result-html.ts` của app cũ.
//
// Cấu trúc app cũ, giữ nguyên tên panel/class: "Thiết lập so sánh"
// (`rc-toolbar-panel`) → lưới 2 cột `rc-entry-grid` gồm "Thông tin đánh giá"
// (`rc-info-panel`, 10 trường) và "Dữ liệu đo bắt cặp" (`rc-pair-panel`, lưới
// có 2 cột tính sẵn Trung bình/Hiệu số) → "Kết quả thống kê"
// (`rc-stats-panel`) → "Tiêu chí chấp nhận & kết luận" (`rc-crit-panel`) →
// "Biểu đồ" (`rc-chart-panel`).
//
// Toàn bộ phép tính đến từ `calculateReagentComparison()` ở main (đã có từ
// Giai đoạn B6) — trang này chỉ trình bày, không tự tính lại thống kê nào.
import { useEffect, useMemo, useState } from 'react';
import { useReagentStore } from '../store/reagent-store';
import { useAuthStore } from '../store/auth-store';
import { canWrite, isAdmin } from '../lib/permissions';
import { PageHeader } from '../components/PageHeader';
import { DateField } from '../components/DateField';
import { Modal } from '../components/Modal';
import { ReagentChart } from '../components/ReagentChart';
import { ReagentToolIcon } from '../components/ReagentToolIcon';
import { confirmDialog, infoDialog } from '../state/dialog-store';
import { printHtmlToPdf } from '../lib/export';
import type { ReagentComparisonResult, ReagentComparisonView } from '../../shared/qc-api';

// App cũ dùng ĐÚNG HAI formatter khác nhau trên trang này, đối chiếu trực
// tiếp kết quả hiển thị:
//   • phần THỐNG KÊ/tiêu chí (`rcFmt` → `pres.report.formatNumber`) bỏ số 0
//     dư: "R² = 1", "6%", "139.2 / 140.592";
//   • cột tính sẵn của hàng cặp mẫu (`deps.fmt(c.avg, 3)`) giữ nguyên số 0:
//     "130.650", "-1.300".
// Trộn 2 chỗ này là lệch hàng loạt dòng chữ, nên giữ riêng.
const fmt = (value: unknown, decimals = 2): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return String(Number(n.toFixed(decimals)));
};
const fmtFixed = (value: unknown, decimals = 3): string => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : '–';
};
/** Port `formatReagentTStatistic()` app cũ. */
const fmtT = (value: unknown): string => {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(4)).toString() : (n > 0 ? '+∞' : '−∞');
};
const equation = (slope: number, intercept: number) =>
  `y = ${fmt(slope, 4)}x ${intercept >= 0 ? '+' : '−'} ${fmt(Math.abs(intercept), 4)}`;

/** Nhãn 1 phép so sánh trong ô chọn — đúng dạng app cũ: "<hóa chất> — <lô
 * cũ>→<lô mới>". */
function comparisonLabel(row: ReagentComparisonView): string {
  const lots = [row.lot_old, row.lot_new].filter(Boolean).join('→');
  return lots ? `${row.reagent} — ${lots}` : row.reagent;
}

const MIN_PAIRS = 5;

/** Port `resultVerdict()` app cũ — 3 mức kết luận, nguyên văn. */
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
    cls: 'no', icon: '✕', title: 'Kết luận: Hai lô hóa chất có khác biệt',
    desc: 'Độ chệch (%Bias) vượt giới hạn cho phép. Không đưa lô mới vào sử dụng cho mẫu bệnh nhân; tiến hành điều tra, xử lý theo quy trình.',
  };
}

function StatRow({ label, value }: { label: string; value: unknown }) {
  return <div className="rc-stat-row"><span>{label}</span><b>{String(value)}</b></div>;
}

function StatsPanel({ result }: { result: ReagentComparisonResult | null }) {
  return (
    <div className="panel rc-stats-panel">
      <h2 className="panel-title">Kết quả thống kê</h2>
      {!result ? (
        <div className="empty">Nhập tối thiểu {MIN_PAIRS} cặp giá trị hợp lệ để xem thống kê mô tả; khuyến nghị ≥20 cặp cho sàng lọc phần mềm.</div>
      ) : (
        <>
          <div className="rc-stat-kpis">
            <div className="rc-stat-card">
              <div className="rc-stat-label">Hệ số tương quan (Pearson r)</div>
              <div className="rc-stat-value">{fmt(result.r, 4)}</div>
              <div className="rc-stat-sub">R² = {fmt(result.fit.r2, 4)}</div>
            </div>
            <div className="rc-stat-card">
              <div className="rc-stat-label">%Bias</div>
              <div className={`rc-stat-value ${result.passBias ? 'ok' : 'bad'}`}>{fmt(result.bias, 3)}%</div>
              <div className="rc-stat-sub">Mong muốn &lt; {fmt(result.biasT, 3)}%</div>
            </div>
            <div className="rc-stat-card">
              <div className="rc-stat-label">P (hai phía / two-tail)</div>
              <div className="rc-stat-value">{fmt(result.p2, 4)}</div>
              <div className="rc-stat-sub">α = {fmt(result.alpha, 4)}</div>
            </div>
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
        </>
      )}
    </div>
  );
}

function CriteriaPanel({ result }: { result: ReagentComparisonResult | null }) {
  if (!result) return null;
  // 6 tiêu chí, đúng thứ tự + câu chữ app cũ. `decision` = tiêu chí QUYẾT
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
      <div>
        {criteria.map(([ok, decision, title, why]) => {
          const cls = decision ? (ok ? 'pass' : 'fail') : (ok ? 'info' : 'note');
          const text = decision ? (ok ? 'ĐẠT' : 'KHÔNG ĐẠT') : (ok ? 'TỐT' : 'LƯU Ý');
          return (
            <div className="rc-crit-item" key={title}>
              <span className={`rc-crit-badge ${cls}`}>{text}</span>
              <div className="rc-crit-text">{title}<div>{why}</div></div>
            </div>
          );
        })}
      </div>
      <div className={`rc-verdict ${verdict.cls}`}>
        <div className="rc-verdict-icon">{verdict.icon}</div>
        <div>
          <div className="rc-verdict-title">{verdict.title}</div>
          <div className="rc-verdict-desc">{verdict.desc}</div>
        </div>
      </div>
    </div>
  );
}

/** Modal "Chọn nhanh" người thực hiện/loại mẫu — port `rcOpenQuick()`/
 * `reagentQuickPickerModalHtml()` app cũ: danh sách giá trị đã lưu (CHUNG
 * cho toàn app, không theo từng phép so sánh) + ô thêm mới (Enter hoặc nút
 * "Thêm"), mỗi dòng có nút "Chọn" và nút xoá "✕". */
function QuickPickerModal({ type, onPick, onClose }: { type: 'operator' | 'sampleType'; onPick: (value: string) => void; onClose: () => void }) {
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const label = type === 'operator' ? 'người thực hiện' : 'loại mẫu';

  useEffect(() => { window.qcApi.listReagentQuickValues({ type }).then((r) => { if (r.ok) setItems(r.data); }); }, [type]);

  async function add() {
    const value = draft.trim();
    if (!value) return;
    const result = await window.qcApi.addReagentQuickValue({ type, value });
    if (result.ok) { setItems(result.data.items); setDraft(''); }
  }
  async function removeItem(index: number) {
    const result = await window.qcApi.removeReagentQuickValue({ type, index });
    if (result.ok) setItems(result.data.items);
  }

  return (
    <Modal title={`Chọn nhanh ${label}`} onClose={onClose}>
      {!items.length && <div className="empty">Chưa có {label} trong danh sách.</div>}
      {items.map((name, i) => (
        <div className="mrow" key={name}>
          <span><b>{name}</b></span>
          <span className="acts">
            <button type="button" className="btn teal sm" onClick={() => onPick(name)}>Chọn</button>
            <button type="button" className="x" title="Xóa" aria-label={`Xoá ${name}`} onClick={() => removeItem(i)}>✕</button>
          </span>
        </div>
      ))}
      <div className="rc-quick-add">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Thêm ${label} mới`}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="btn teal sm" onClick={add}>Thêm</button>
      </div>
    </Modal>
  );
}

function PickerModal({ comparisons, currentId, canCreate, onSelect, onClose, onCreate }: {
  comparisons: ReagentComparisonView[]; currentId: string; canCreate: boolean;
  onSelect: (id: string) => void; onClose: () => void; onCreate: (name: string, unit: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const needle = query.trim().toLowerCase();
  const rows = comparisons.filter((c) => !needle || comparisonLabel(c).toLowerCase().includes(needle));
  return (
    <Modal title="Chọn phép so sánh" onClose={onClose} width={620}>
      <div className="field">
        <label>Tìm theo hóa chất hoặc số lô</label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nhập để lọc..." />
      </div>
      <table>
        <thead><tr><th>Hóa chất</th><th>Lô cũ → mới</th><th>Ngày</th><th></th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>{c.reagent}</td>
              <td>{[c.lot_old, c.lot_new].filter(Boolean).join(' → ') || '—'}</td>
              <td>{c.date || '—'}</td>
              <td>{c.id === currentId ? <span className="tag ok">Đang xem</span> : <button className="btn ghost sm" onClick={() => onSelect(c.id)}>Chọn</button>}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4}><p className="empty-state">Không có phép so sánh phù hợp.</p></td></tr>}
        </tbody>
      </table>
      {canCreate && (
        <div className="field-row" style={{ marginTop: 'var(--space-sm)' }}>
          {(() => {
            const submit = () => { if (name.trim()) { onCreate(name.trim(), unit.trim()); setName(''); setUnit(''); } };
            const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
            return (
              <>
                <div className="field"><label>Tên hóa chất mới</label><input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} placeholder="VD: Glucose" /></div>
                <div className="field"><label>Đơn vị</label><input value={unit} onChange={(e) => setUnit(e.target.value)} onKeyDown={onEnter} placeholder="mmol/L" /></div>
                <button className="btn teal" disabled={!name.trim()} onClick={submit}>+ Tạo mới</button>
              </>
            );
          })()}
        </div>
      )}
    </Modal>
  );
}

export function ReagentPage() {
  const store = useReagentStore();
  const role = useAuthStore((s) => s.user)?.role;
  const writable = canWrite(role);
  const admin = isAdmin(role);
  const [currentId, setCurrentId] = useState('');
  const [picking, setPicking] = useState(false);
  const [quickType, setQuickType] = useState<'operator' | 'sampleType' | null>(null);
  const [rowsDraft, setRowsDraft] = useState<[string, string][]>([]);

  useEffect(() => { store.load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const current = useMemo(
    () => store.comparisons.find((c) => c.id === currentId) ?? store.comparisons[0] ?? null,
    [store.comparisons, currentId],
  );
  useEffect(() => { if (current) setRowsDraft(current.rows); }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) {
    return (
      <div>
        <PageHeader title="So sánh 2 lô hóa chất" subtitle="Sàng lọc định lượng · hồi quy mô tả · Bland-Altman · phê duyệt theo SOP" />
        <div className="panel"><p className="empty-state">Chưa có phép so sánh nào. Tạo mới để bắt đầu.</p></div>
      </div>
    );
  }

  const result = current.result;
  const meta = (data: Record<string, unknown>) => store.saveMetadata(current.id, data);
  const wp = { disabled: !writable };

  function updateCell(rowIndex: number, col: 0 | 1, value: string) {
    setRowsDraft((prev) => {
      const next = prev.map((r) => [...r] as [string, string]);
      next[rowIndex][col] = value;
      return next;
    });
  }
  const commitRows = (rows: [string, string][]) => { setRowsDraft(rows); store.saveRows(current.id, rows); };

  async function removeCurrent() {
    if (!(await confirmDialog(`Xóa phép so sánh "${current.reagent}"? Dữ liệu đã nhập sẽ mất.`, { title: 'Xóa phép so sánh', danger: true, confirmLabel: 'Xóa' }))) return;
    const r = await store.remove(current.id);
    if (!r.ok) await infoDialog(r.error.message, { type: 'warn' });
    else setCurrentId('');
  }

  /** In 1 phép so sánh hoặc báo cáo tổng hợp — dùng chung cơ chế
   * `printHtmlToPdf` của Giai đoạn C1. */
  async function printComparison(summary: boolean) {
    const rows = summary ? store.comparisons : [current];
    const body = rows.map((c) => {
      const r = c.result;
      return `<tr><td>${c.reagent}</td><td>${[c.lot_old, c.lot_new].filter(Boolean).join(' → ')}</td><td>${c.date || ''}</td>`
        + `<td>${r ? r.N : '—'}</td><td>${r ? fmt(r.bias, 3) + '%' : '—'}</td><td>${r ? fmt(r.r, 4) : '—'}</td>`
        + `<td>${r ? verdictOf(r).title.replace('Kết luận: ', '') : 'Chưa đủ dữ liệu'}</td></tr>`;
    }).join('');
    const title = summary ? 'So sánh hóa chất — báo cáo tổng hợp' : `So sánh hóa chất — ${current.reagent}`;
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font:13px system-ui,sans-serif;color:#163541;padding:18px}h1{font-size:17px}
      table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9d9e0;padding:5px 7px;text-align:left}
      th{background:#eef4f7;print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head>
      <body><h1>${title}</h1><table><thead><tr><th>Hóa chất</th><th>Lô cũ → mới</th><th>Ngày</th><th>n</th><th>%Bias</th><th>r</th><th>Kết luận</th></tr></thead>
      <tbody>${body}</tbody></table></body></html>`;
    const error = await printHtmlToPdf(html, summary ? 'so-sanh-hoa-chat-tong-hop.pdf' : `so-sanh-${current.reagent}.pdf`);
    if (error) await infoDialog(error, { type: 'warn' });
  }

  return (
    <div>
      <PageHeader title="So sánh 2 lô hóa chất" subtitle="Sàng lọc định lượng · hồi quy mô tả · Bland-Altman · phê duyệt theo SOP" />

      <div className="panel rc-toolbar-panel">
        <h2 className="panel-title">Thiết lập so sánh</h2>
        <div className="rc-toolbar">
          <div className="rc-toolbar-selcol">
            <label>Chọn hóa chất</label>
            <select id="rcSel" aria-label="Chọn hóa chất" value={current.id} onChange={(e) => setCurrentId(e.target.value)}>
              {store.comparisons.map((c) => <option key={c.id} value={c.id}>{comparisonLabel(c)}</option>)}
            </select>
          </div>
          {writable && (
            <div className="rc-toolbar-primary"><div>
              <button className="btn teal rc-add-btn" onClick={() => setPicking(true)}>+ Thêm</button>
              {admin && <button className="btn danger rc-delete-btn" onClick={removeCurrent}>Xóa</button>}
            </div></div>
          )}
          <div className="rc-toolbar-secondary">
            {writable && <button className="btn ghost rc-find-btn" onClick={() => setPicking(true)}>Tìm</button>}
            <button className="btn teal rc-report-btn" onClick={() => printComparison(false)}>In hóa chất này</button>
            <button className="btn teal rc-report-main" onClick={() => printComparison(true)}>Báo cáo tổng hợp</button>
          </div>
        </div>
      </div>

      <div className="rc-entry-grid" key={current.id}>
        <div className="panel rc-info-panel">
          <h2 className="panel-title">Thông tin đánh giá</h2>
          <div className="rc-info-grid">
            <div className="rc-field"><label>Tên hóa chất</label><input {...wp} defaultValue={current.reagent} placeholder="Tên hóa chất / xét nghiệm" onBlur={(e) => meta({ reagent: e.target.value })} /></div>
            <div className="rc-field"><label>Đơn vị</label><input {...wp} defaultValue={current.unit} placeholder="mmol/L..." onBlur={(e) => meta({ unit: e.target.value })} /></div>
            <div className="rc-field"><label>Số lô cũ</label><input {...wp} aria-label="Số lô cũ" defaultValue={current.lot_old} onBlur={(e) => meta({ lotOld: e.target.value })} /></div>
            <div className="rc-field"><label>Số lô mới</label><input {...wp} aria-label="Số lô mới" defaultValue={current.lot_new} onBlur={(e) => meta({ lotNew: e.target.value })} /></div>
            <div className="rc-field rc-date-field">
              <label>Ngày thực hiện</label>
              <DateField value={current.date} disabled={!writable} onChange={(v) => meta({ date: v })} />
            </div>
            <div className="rc-field">
              <label>Người thực hiện</label>
              <div className="rc-quick-field">
                {/* `key` bắt ô nhập remount khi giá trị đổi từ modal "Chọn nhanh"
                    — ô này KHÔNG kiểm soát (defaultValue), React chỉ đọc
                    defaultValue lúc mount đầu, không tự cập nhật lại sau đó. */}
                <input {...wp} key={current.operator} defaultValue={current.operator} placeholder="Họ tên" onBlur={(e) => meta({ operator: e.target.value })} />
                <button type="button" className="rc-icon-btn" disabled={!writable} onClick={() => setQuickType('operator')} title="Chọn nhanh người thực hiện" aria-label="Chọn nhanh người thực hiện"><ReagentToolIcon type="user" /></button>
              </div>
            </div>
            <div className="rc-field">
              <label>Loại mẫu</label>
              <div className="rc-quick-field">
                <input {...wp} key={current.sample_type} defaultValue={current.sample_type} placeholder="Loại mẫu" onBlur={(e) => meta({ sampleType: e.target.value })} />
                <button type="button" className="rc-icon-btn" disabled={!writable} onClick={() => setQuickType('sampleType')} title="Chọn nhanh loại mẫu" aria-label="Chọn nhanh loại mẫu"><ReagentToolIcon type="sample" /></button>
              </div>
            </div>
            <div className="rc-field"><label>Bias mong muốn (%)</label><input {...wp} aria-label="Bias mong muốn (%)" type="number" step="any" defaultValue={current.bias_target ?? 6} onBlur={(e) => meta({ biasTarget: Number(e.target.value) })} /></div>
            <div className="rc-field"><label>Mức ý nghĩa (α, alpha)</label><input {...wp} aria-label="Mức ý nghĩa (alpha)" type="number" step="any" defaultValue={current.alpha ?? 0.05} onBlur={(e) => meta({ alpha: Number(e.target.value) })} /></div>
            <div className="rc-field rc-coverage-cell">
              <label className="rc-coverage-check">
                <input {...wp} type="checkbox" defaultChecked={!!current.coverage_confirmed} onChange={(e) => meta({ coverageConfirmed: e.target.checked })} />
                <span>Mẫu đã bao phủ khoảng đo và/hoặc điểm quyết định lâm sàng theo SOP</span>
              </label>
            </div>
          </div>
        </div>

        <div className="panel rc-pair-panel">
          <h2 className="panel-title">Dữ liệu đo bắt cặp</h2>
          <div className="rc-pair-wrap">
            <div className="rc-pair-head">
              <div>Mẫu</div>
              <div>Lô cũ: {current.lot_old || '—'}</div>
              <div>Lô mới: {current.lot_new || '—'}</div>
              <div>Trung bình</div>
              <div>Hiệu số (cũ − mới)</div>
              <div></div>
            </div>
            {rowsDraft.map((row, i) => {
              const o = Number(row[0]);
              const nv = Number(row[1]);
              const both = Number.isFinite(o) && Number.isFinite(nv) && row[0] !== '' && row[1] !== '';
              const dif = both ? o - nv : null;
              return (
                <div className="rc-pair-row" data-rc-row={i} key={`${rowsDraft.length}-${i}`}>
                  <div className="rc-idx">{i + 1}</div>
                  <input {...wp} type="number" step="any" placeholder="–" value={row[0]} onChange={(e) => updateCell(i, 0, e.target.value)} onBlur={() => store.saveRows(current.id, rowsDraft)} />
                  <input {...wp} type="number" step="any" placeholder="–" value={row[1]} onChange={(e) => updateCell(i, 1, e.target.value)} onBlur={() => store.saveRows(current.id, rowsDraft)} />
                  <div className="rc-calc avg">{both ? fmtFixed((o + nv) / 2) : '–'}</div>
                  <div className={`rc-calc dif${dif != null && dif < 0 ? ' neg' : ''}`}>{dif != null ? fmtFixed(dif) : '–'}</div>
                  {writable
                    ? <button className="x" title="Xóa dòng" onClick={() => commitRows(rowsDraft.filter((_, j) => j !== i))}>✕</button>
                    : <span></span>}
                </div>
              );
            })}
          </div>
          {writable && (
            <div className="rc-pair-actions">
              <button className="btn ghost sm" onClick={() => commitRows([...rowsDraft, ['', '']])}>+ Thêm mẫu</button>{' '}
              <button className="btn ghost sm" onClick={async () => { if (await confirmDialog('Xóa toàn bộ dữ liệu đã nhập của phép so sánh này?', { danger: true, confirmLabel: 'Xóa' })) commitRows([['', ''], ['', ''], ['', ''], ['', ''], ['', '']]); }}>Xóa dữ liệu</button>
            </div>
          )}
          <div className="hint" style={{ margin: '8px 16px 16px' }}>
            Nhập tối thiểu {MIN_PAIRS} cặp để tính mô tả; để phần mềm đánh dấu “đạt sàng lọc” cần ≥20 cặp hợp lệ, bao phủ khoảng đo/điểm quyết định lâm sàng và %bias trong giới hạn SOP. Không dùng p-value để tự chấp nhận lô.
          </div>
        </div>
      </div>

      <StatsPanel result={result} />
      <CriteriaPanel result={result} />

      <div className="panel rc-chart-panel">
        <h2 className="panel-title">Biểu đồ</h2>
        <div className="rc-charts">
          <div className="rc-chart-box">
            <h3>Biểu đồ tương quan</h3>
            <p>Lô cũ (trục X) so với Lô mới (trục Y)</p>
            {result && <ReagentChart mode="scatter" result={result} />}
            <div className="rc-chart-legend"><span><i className="reg"></i>Đường hồi quy</span><span><i className="ideal"></i>Đường lý tưởng y = x</span><span>Lô cũ ({current.lot_old || '—'})</span><span>Lô mới ({current.lot_new || '—'})</span></div>
          </div>
          <div className="rc-chart-box">
            <h3>Biểu đồ Bland-Altman</h3>
            <p>Hiệu số (cũ − mới) so với giá trị trung bình</p>
            {result && <ReagentChart mode="bland" result={result} />}
            <div className="rc-chart-legend"><span><i className="bias"></i>Bias trung bình</span><span><i className="limit"></i>±1.96 SD</span>
              <span>Trung bình (cũ + mới)/2</span>
              {result && <><span>Bias {fmt(result.md, 3)}</span><span>+1.96SD {fmt(result.loaUpper, 3)}</span><span>−1.96SD {fmt(result.loaLower, 3)}</span></>}</div>
          </div>
        </div>
      </div>

      {picking && (
        <PickerModal
          comparisons={store.comparisons} currentId={current.id} canCreate={writable}
          onSelect={(id) => { setCurrentId(id); setPicking(false); }}
          onClose={() => setPicking(false)}
          onCreate={async (name, unit) => {
            const r = await store.create(name, unit);
            if (!r.ok) { await infoDialog(r.error.message, { type: 'warn' }); return; }
            setCurrentId(r.data.id); setPicking(false);
          }}
        />
      )}
      {quickType && (
        <QuickPickerModal type={quickType} onClose={() => setQuickType(null)}
          onPick={(value) => { meta(quickType === 'operator' ? { operator: value } : { sampleType: value }); setQuickType(null); }} />
      )}
    </div>
  );
}
