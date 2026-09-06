// Six Sigma — viết lại theo đúng bố cục app cũ (professional-sigma.css +
// SigmaPage.tsx cũ): panel "Thiết lập phân tích"/"Tình trạng" 2 cột, bảng kỳ
// có header 2 hàng (rowSpan/colSpan theo từng mức: CV%/Bias%/Sigma lặp lại
// mỗi mức), thẻ Sigma 5 bậc màu (sigmaZone), modal Bias% (RMS, cảnh báo lệch
// dấu) và modal MU (bảng 3 thành phần). Bộ chọn xét nghiệm CHỈ lấy từ Cấu
// hình chung — không tạo xét nghiệm trong Sigma (nguyên tắc đã chốt).
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useManageStore } from '../store/manage-store';
import { useSigmaStore, type SigmaLevelSaveInput } from '../store/sigma-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { useAuthStore } from '../store/auth-store';
import { canWrite, isAdmin } from '../lib/permissions';
import { Modal } from '../components/Modal';
import { CalcIcon } from '../components/BtnIcons';
import { RowActionButton } from '../components/RowActionButton';
import { PageHeader } from '../components/PageHeader';
import { SigmaTrendChart, SigmaMdcChart } from '../components/SigmaCharts';
import { exportTableXlsx, printHtmlToPdf } from '../lib/export';
import { confirmDialog, infoDialog } from '../state/dialog-store';
import type { SigmaLevelResult, SigmaPeriodView, TeaRef } from '../../shared/qc-api';

// Khớp TEa theo tên: EXACT trước, rồi longest-prefix — cùng nguyên tắc
// sgRef() bản cũ (vd "CK-MB" không thừa hưởng "CK").
function resolveTeaRef(testName: string, refs: TeaRef[]): TeaRef | null {
  const exact = refs.find((r) => r.name.toLowerCase() === testName.toLowerCase());
  if (exact) return exact;
  const prefixMatches = refs.filter((r) => testName.toLowerCase().startsWith(r.name.toLowerCase()));
  if (!prefixMatches.length) return null;
  return prefixMatches.reduce((best, r) => (r.name.length > best.name.length ? r : best));
}

function rmsOf(values: number[]): number {
  if (!values.length) return 0;
  return Math.sqrt(values.reduce((s, v) => s + v * v, 0) / values.length);
}

/** Dải năm của select kỳ — 11 năm từ (năm nay − 5), cùng dải app cũ dùng. */
const PERIOD_YEARS = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);

/** 4 nguồn TEa của app cũ (`TEA_SOURCE_REGISTRY`), theo ĐÚNG thứ tự và câu
 * chữ hiển thị. GIỚI HẠN ĐÃ BIẾT: app-v2 chỉ tra được giá trị cho nguồn
 * "phòng xét nghiệm" (bảng `tea_refs`); 2 nguồn CLIA/Ricos cần
 * `TEA_ANALYTE_CATALOG` (hàng trăm analyte + `docs/tea-sources.md`) mà app-v2
 * cố ý chưa port từ Giai đoạn B1 — nên chúng hiện "chưa có" thay vì bịa số. */
const TEA_SOURCES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'lab', label: 'TEa chuẩn hóa của phòng xét nghiệm' },
  { value: 'eflm', label: 'EFLM - nhập từ database' },
  { value: 'clia', label: 'CLIA PT (CMS-3355-F)' },
  { value: 'ricos', label: 'Ricos / Westgard biological variation' },
];

/** `formatSigmaDpmo()` app cũ — dưới 10 giữ 2 chữ số, dưới 1000 làm tròn,
 * còn lại phân nhóm nghìn kiểu en-US. */
function formatDpmo(value: unknown): string {
  const dpmo = Number(value);
  if (!Number.isFinite(dpmo)) return '—';
  return dpmo < 10 ? dpmo.toFixed(2) : dpmo < 1000 ? dpmo.toFixed(0) : Math.round(dpmo).toLocaleString('en-US');
}

/** `vnPeriod()` app cũ: 2026-09 → "Kỳ 09/2026". */
function vnPeriod(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period || '');
  return m ? `Kỳ ${m[2]}/${m[1]}` : (period || '?');
}

/** Port `sgTips()` app cũ — thẻ khuyến nghị cải thiện, chỉ hiện khi Sigma
 * tính được và < 4. Chia nguyên nhân theo tỉ lệ `|bias| / (|bias| + 1.65·cv)`
 * (>0.6 do bias, <0.4 do CV, còn lại do cả hai) và liệt kê đúng danh sách
 * hành động của bản cũ. */
const BIAS_ACTS = [
  'Hiệu chuẩn lại; kiểm tra lô/hạn dùng của calibrator.',
  'Kiểm tra giá trị đích EQA (nhóm peer cùng phương pháp/máy).',
  'Thử lô thuốc thử mới và chạy lại sau hiệu chuẩn.',
];
const CV_ACTS = [
  'Bảo trì định kỳ thiết bị (đèn, bơm, hệ quang).',
  'Kiểm tra lô thuốc thử & vật liệu QC (bảo quản, hạn dùng, độ đồng nhất).',
  'Ổn định nhiệt độ phòng/điện áp; tránh rung động.',
  'Chuẩn hóa thao tác (pipet, thời gian ủ); giảm khác biệt giữa người làm.',
];

function ImprovementCard({ level, result, tea }: { level: number; result: SigmaLevelResult; tea: number | null }) {
  const sigma = result.sigma?.sigma;
  if (sigma == null || !Number.isFinite(sigma) || sigma >= 4) return null;
  const teaN = Number(tea ?? result.sigma?.tea ?? 0);
  const cv = Number(result.cv ?? 0);
  const bias = Math.abs(Number(result.biasEqa ?? 0));
  const fail = sigma < 3;
  const cvNeed = (teaN - bias) / 4;
  const biasNeed = teaN - 4 * cv;
  const share = bias + 1.65 * cv === 0 ? 0 : bias / (bias + 1.65 * cv);
  const driver = share > 0.6 ? 'độ chệch (bias) lớn' : share < 0.4 ? 'độ chụm (CV) lớn' : 'cả độ chệch lẫn độ chụm';
  const acts = share > 0.6 ? BIAS_ACTS : share < 0.4 ? CV_ACTS : [BIAS_ACTS[0], CV_ACTS[0], BIAS_ACTS[1], CV_ACTS[1]];
  const parts: string[] = [];
  if (cvNeed > 0) parts.push(`giảm CV ≤ ${cvNeed.toFixed(2)}% (hiện ${cv.toFixed(2)}%)`);
  if (biasNeed > 0) parts.push(`giảm |Bias| ≤ ${biasNeed.toFixed(2)}% (hiện ${bias.toFixed(2)}%)`);
  const zone = sigmaZone(sigma);
  return (
    <div className="alert sg-improvement-card" style={{ ['--sg-color' as never]: zone.c }}>
      <b>Khuyến nghị cải thiện — Mức {level}</b>
      <div className="sg-improvement-lead">
        {fail ? 'Phương pháp chưa đạt năng lực — cần khắc phục trước khi tin cậy kết quả.' : 'Hiệu năng cận biên — nên cải thiện để vượt 4σ.'} Nguyên nhân chủ yếu do {driver}.
      </div>
      <div className="sg-improvement-target">{parts.length ? `Để đạt ≥ 4σ: ${parts.join(' hoặc ')}.` : 'Độ chệch đã vượt mức cho phép — phải giảm bias trước.'}</div>
      <ul className="sg-improvement-list">
        {acts.map((a) => <li key={a}>{a}</li>)}
        {fail && <li>Tạm thời tăng QC tối đa; nếu không cải thiện, cân nhắc đổi thuốc thử/phương pháp/thiết bị.</li>}
      </ul>
    </div>
  );
}

/** 5 bậc màu Sigma — sao chép nguyên giá trị/ngưỡng từ `sigmaZone()` bản cũ
 * (src/domain/sigma/sigma-presentation.ts), không tự đặt lại thang màu. */
function sigmaZone(value: number | null | undefined): { c: string; label: string } {
  const sigma = Number(value);
  if (!Number.isFinite(sigma)) return { c: '#506674', label: '—' };
  if (sigma >= 6) return { c: '#13603f', label: 'Đẳng cấp thế giới' };
  if (sigma >= 5) return { c: '#2c7d5c', label: 'Xuất sắc' };
  if (sigma >= 4) return { c: '#3f9a55', label: 'Tốt' };
  if (sigma >= 3) return { c: '#dd8b1f', label: 'Cận biên' };
  return { c: '#c0362c', label: 'Không đạt' };
}

export function SigmaPage() {
  const { tests, teaRefs, levelsByTestId, loadTests, loadTeaRefs, loadLevels, instruments, loadInstruments} = useManageStore();
  const { periods, loadPeriods, savePeriod, removePeriod } = useSigmaStore();
  // Vai trò chỉ-xem: vẫn đọc được bảng kỳ/Sigma/MU, không sửa được (main
  // chặn bằng requireWrite ở sigma-handlers.savePeriod).
  const writable = canWrite(useAuthStore((s) => s.user)?.role);
  const [testId, setTestId] = useState('');
  /** Kỳ đang được CHỌN ĐỂ XEM trong panel "Tình trạng"/MU — app cũ cho bấm
   * vào bất kỳ hàng nào trong bảng kỳ để xem lại (`sgSelectPeriod`,
   * `ui().sgSelectedPeriods[testId]`), không phải luôn cố định vào kỳ mới
   * nhất. `null` = chưa chọn, rơi về kỳ mới nhất (`latestPeriod`). Reset khi
   * đổi xét nghiệm vì danh sách kỳ đổi hẳn sang tập khác. */
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  useEffect(() => { setSelectedPeriodId(null); }, [testId]);
  const [creating, setCreating] = useState(false);
  const [biasModal, setBiasModal] = useState<{ period: SigmaPeriodView; level: SigmaLevelResult } | null>(null);
  const [muModal, setMuModal] = useState<{ period: SigmaPeriodView; level: SigmaLevelResult } | null>(null);
  const [teaSource, setTeaSource] = useState('lab');
  const navigate = useNavigate();

  useEffect(() => { loadTests(); loadTeaRefs(); loadInstruments(); }, [loadTests, loadTeaRefs, loadInstruments]);
  // App cũ (`sigma-page-controller.ts`: `if (!ui().sgTest || !tests.find(...))
  // ui().sgTest = tests[0].id`) TỰ CHỌN xét nghiệm đầu tiên trong danh sách
  // theo dõi — mở trang là thấy ngay bảng kỳ. Bản app-v2 để rỗng nên chỉ
  // render vỏ, gate parity đo được 73 class thiếu chỉ vì lý do này (cùng lớp
  // với trang Nhập QC ở D3.5).
  useEffect(() => {
    if (!tests.length) return;
    if (testId && tests.some((t) => t.id === testId)) return;
    setTestId(tests[0].id);
  }, [tests, testId]);
  useEffect(() => { if (testId) { loadPeriods(testId); loadLevels(testId); } }, [testId, loadPeriods, loadLevels]);
  useStoreInvalidation(['sigma_data'], testId || undefined, () => { if (testId) loadPeriods(testId); });

  const test = tests.find((t) => t.id === testId);
  const suggestedTea = useMemo(() => (test ? resolveTeaRef(test.name, teaRefs) : null), [test, teaRefs]);
  const admin = isAdmin(useAuthStore((s) => s.user)?.role);
  const instrumentName = instruments.find((i) => i.id === test?.instrument_id)?.name || '';
  /** Giá trị TEa của từng nguồn — chỉ nguồn "phòng xét nghiệm" tra được từ
   * `tea_refs`; 2 nguồn còn lại chờ danh mục analyte tích hợp (xem
   * TEA_SOURCES). */
  const teaSourceValueText = (source: string): string => {
    if (source === 'lab') return suggestedTea?.lab != null ? `${Number(suggestedTea.lab).toFixed(2)}%` : 'chưa có';
    if (source === 'eflm') return 'chưa có';
    return 'chưa có';
  };
  const teaHint = `TEa đang dùng: ${teaSourceValueText(teaSource)} · nguồn ${TEA_SOURCES.find((s) => s.value === teaSource)?.label || '—'}.`;

  const operationalLevels = (levelsByTestId[testId] || []).map((l) => l.level).sort((a, b) => a - b);
  const tableLevels = operationalLevels.length ? operationalLevels : Array.from(new Set(periods.flatMap((p) => p.levels.map((lv) => lv.level)))).sort((a, b) => a - b);
  const latestPeriod = periods[periods.length - 1];
  const displayPeriod = periods.find((p) => p.id === selectedPeriodId) || latestPeriod;

  function levelsPayloadFrom(period: SigmaPeriodView, overrideLevel: number, patch: Partial<SigmaLevelSaveInput>): SigmaLevelSaveInput[] {
    return period.levels.map((lv) => lv.level === overrideLevel
      ? { level: lv.level, cv: lv.cv ?? undefined, biasEqa: lv.biasEqa ?? undefined, eqaRounds: lv.eqaRounds, uCal: lv.uCal ?? undefined, ...patch }
      : { level: lv.level, cv: lv.cv ?? undefined, biasEqa: lv.biasEqa ?? undefined, eqaRounds: lv.eqaRounds, uCal: lv.uCal ?? undefined });
  }

  /** Đổi tháng/năm của 1 kỳ: app-v2 khoá `id = testId:period` nên đổi kỳ là
   * lưu sang kỳ MỚI (`savePeriod`) rồi xoá kỳ cũ — khác app cũ (sửa tại chỗ
   * `entry.period`) vì bên đó id là uid rời, không mang kỳ trong id. */
  async function changePeriodPart(period: SigmaPeriodView, part: 'month' | 'year', value: string) {
    const year = part === 'year' ? String(Number(value)).padStart(4, '0') : period.period.slice(0, 4);
    const month = part === 'month' ? String(Number(value)).padStart(2, '0') : period.period.slice(5, 7);
    const next = `${year}-${month}`;
    if (next === period.period) return;
    if (periods.some((p) => p.period === next)) { await infoDialog(`Đã có kỳ Sigma ${next}. Hãy cập nhật kỳ hiện có.`, { type: 'warn' }); return; }
    const saved = await savePeriod(testId, next, period.tea ?? undefined, period.teaSource, levelsPayloadFrom(period, -1, {}));
    if (!saved.ok) { await infoDialog(saved.error.message, { type: 'warn' }); return; }
    await removePeriod(period.id, testId);
  }

  async function removePeriodRow(period: SigmaPeriodView) {
    if (!(await confirmDialog(`Xóa kỳ ${vnPeriod(period.period)}? Số liệu CV/Bias của kỳ này sẽ mất.`, { title: 'Xóa kỳ Six Sigma', danger: true, confirmLabel: 'Xóa' }))) return;
    const result = await removePeriod(period.id, testId);
    if (!result.ok) await infoDialog(result.error.message, { type: 'warn' });
  }

  /** Bảng xuất/in: 1 hàng cho mỗi (kỳ × mức) — cùng bộ cột với bảng trên
   * màn hình để người đọc file đối chiếu được. */
  const exportRows = (rows: SigmaPeriodView[]) => rows.flatMap((p) => p.levels.map((lv) => [
    vnPeriod(p.period), `Mức ${lv.level}`, lv.cv ?? '', lv.biasEqa ?? '', lv.sigma ? Number(lv.sigma.sigma.toFixed(2)) : '',
    lv.sigma ? formatDpmo(lv.sigma.dpmo) : '', lv.mu?.U != null ? Number(lv.mu.U.toFixed(4)) : '',
  ]));
  const EXPORT_HEADERS = ['Kỳ', 'Mức', 'CV IQC%', 'Bias EQA%', 'Sigma', 'DPMO', 'U (k=2)'];

  async function exportPeriod(period: SigmaPeriodView) {
    const error = await exportTableXlsx(`Sigma ${period.period}`, EXPORT_HEADERS, exportRows([period]), `sigma-${test?.name || 'xet-nghiem'}-${period.period}.xlsx`);
    if (error) await infoDialog(error, { type: 'warn' });
  }
  async function exportAllPeriods() {
    const error = await exportTableXlsx('Sigma tong hop', EXPORT_HEADERS, exportRows(periods), `sigma-${test?.name || 'xet-nghiem'}-tong-hop.xlsx`);
    if (error) await infoDialog(error, { type: 'warn' });
  }
  function printHtml(title: string, rows: SigmaPeriodView[]): string {
    const body = exportRows(rows).map((r) => `<tr>${r.map((c) => `<td>${String(c ?? '')}</td>`).join('')}</tr>`).join('');
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font:13px system-ui,sans-serif;color:#163541;padding:18px}h1{font-size:17px}
      table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9d9e0;padding:5px 7px;text-align:left}
      th{background:#eef4f7;print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head>
      <body><h1>${title}</h1><div>${test?.name || ''}</div>
      <table><thead><tr>${EXPORT_HEADERS.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  }
  async function printPeriod(period: SigmaPeriodView) {
    const error = await printHtmlToPdf(printHtml(`Six Sigma — ${vnPeriod(period.period)}`, [period]), `sigma-${period.period}.pdf`);
    if (error) await infoDialog(error, { type: 'warn' });
  }
  async function printAllPeriods() {
    const error = await printHtmlToPdf(printHtml('Six Sigma — tổng hợp các kỳ', periods), 'sigma-tong-hop.pdf');
    if (error) await infoDialog(error, { type: 'warn' });
  }

  async function commitCv(period: SigmaPeriodView, level: number, value: string) {
    await savePeriod(testId, period.period, period.tea ?? undefined, period.teaSource,
      levelsPayloadFrom(period, level, { cv: value === '' ? undefined : Number(value) }));
  }

  return (
    <div>
      <PageHeader title="Six Sigma & Sai số" subtitle="Đánh giá hiệu năng phương pháp theo TEa, CV IQC và Bias EQA/EQC" />
      <div className="sg-top-grid">
        <div className="panel">
          <h2 className="sg-setup-heading panel-title">Thiết lập phân tích</h2>
          <div className="row-flex sg-control-row">
            <div className="sg-test-picker">
              <label>Chọn xét nghiệm</label>
              <select id="sgTestSelect" aria-label="Chọn xét nghiệm" value={testId} onChange={(e) => setTestId(e.target.value)}>
                {tests.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            {admin && (
              <div className="sg-inline-btns">
                <label>&nbsp;</label>
                <div className="sg-inline-btns-row">
                  <button className="btn teal" onClick={() => navigate('/manage', { state: { tab: 'tests' } })}>+ Thêm</button>
                  <button className="btn danger" onClick={() => navigate('/manage', { state: { tab: 'tests' } })}>Xóa</button>
                </div>
              </div>
            )}
          </div>
          <div className="sg-setup-fields">
            <div><label>Tên xét nghiệm</label><input value={test?.name || ''} aria-label="Tên xét nghiệm" readOnly /></div>
            <div><label>Đơn vị</label><input value={test?.unit || ''} aria-label="Đơn vị" readOnly /></div>
            <div><label>Thiết bị</label><input value={instrumentName} readOnly placeholder="Bấm để chọn / quản lý thiết bị" /></div>
            <div className="sg-tea-source">
              <label>Nguồn TEa</label>
              <select aria-label="Nguồn TEa" disabled={!writable} value={teaSource} onChange={(e) => setTeaSource(e.target.value)}>
                {TEA_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label} · {teaSourceValueText(s.value)}</option>)}
              </select>
            </div>
            <div className="sg-tea-input">
              <label>{teaSource === 'clia' ? 'Tiêu chí CLIA' : 'TEa% tham chiếu'}</label>
              <input type="text" aria-label={teaSource === 'clia' ? 'Tiêu chí CLIA' : 'TEa% tham chiếu'} value={teaSourceValueText(teaSource)} disabled readOnly />
            </div>
          </div>
          <div className="hint sg-sigma-input-note">
            {teaHint} Mỗi mức dùng <b>CV từ IQC</b> và <b>Bias từ EQA/EQC</b>; nhiều vòng EQA được tổng hợp bằng <b>RMS</b> để tránh triệt tiêu dấu. Dữ liệu IQC không được dùng để tính Bias. Quy tắc thận trọng của phần mềm: &lt;20 điểm chỉ hiển thị ước tính, 20–29 điểm là tạm thời, ≥30 điểm mới dùng để gợi ý QC. DPMO/Yield chỉ là quy đổi tham khảo với dịch 1,5σ.
          </div>
        </div>
        <div className="panel">
          <h2 className="sg-setup-heading panel-title">Tình trạng</h2>
          {!displayPeriod
            ? <div className="hint">Chưa có kỳ Sigma. Hãy thêm kỳ để bắt đầu.</div>
            : (
              <>
                <div className="hint space-after-item">Kỳ đang xem: <b>{vnPeriod(displayPeriod.period)}</b> · {test?.name || ''} · TEa {displayPeriod.tea ?? '—'}%</div>
                <div id="sgStatus"><div className="sgcards">
                  {displayPeriod.levels.map((lv) => {
                    const zone = sigmaZone(lv.sigma?.sigma);
                    return (
                      <div className="sgbig" key={lv.level} style={{ background: zone.c }}>
                        <div className="lab">Mức {lv.level} — Sigma</div>
                        <div className="v">{lv.sigma ? lv.sigma.sigma.toFixed(2) : '—'}</div>
                        <div className="grade">{lv.sigma ? zone.label : ''}</div>
                        <div className="sub">
                          CV IQC {lv.cv != null ? lv.cv.toFixed(2) : '—'}% · Bias EQA/EQC{lv.eqaRounds && lv.eqaRounds.length > 1 ? ' (RMS)' : ''} {lv.biasEqa != null ? lv.biasEqa.toFixed(2) : '—'}%
                          <br />
                          {lv.sigma ? `DPMO ${formatDpmo(lv.sigma.dpmo)} · Yield ${lv.sigma.yieldPercent.toFixed(4)}%` : 'Chưa nhập CV hoặc Bias được chọn'}
                        </div>
                      </div>
                    );
                  })}
                </div></div>
                {displayPeriod.levels.map((lv) => <ImprovementCard key={lv.level} level={lv.level} result={lv} tea={displayPeriod.tea} />)}
              </>
            )}
        </div>
      </div>

      {testId && (
        <div className="panel">
          <div className="sg-data-head">
            <h2 className="panel-title">Số liệu theo kỳ</h2>
            <div className="sg-data-head-actions">
              {writable && displayPeriod?.levels.map((lv) => (
                <button key={lv.level} className="btn ghost sm" title={`Tính Bias% từ các vòng EQA/EQC cho mức ${lv.level}`}
                  onClick={() => setBiasModal({ period: displayPeriod, level: lv })}><CalcIcon />Bias EQA% Mức {lv.level}</button>
              ))}
              {writable && <button className="btn teal sm" onClick={() => setCreating(true)}>+ Thêm kỳ</button>}
            </div>
          </div>
          <div className="sg-simple-table-wrap">
            <table className="sg-simple-table">
              <thead>
                <tr>
                  <th rowSpan={2}>Kỳ / Năm</th>
                  {tableLevels.map((lv) => <th key={lv} colSpan={3} className="sg-group-start">Mức {lv}</th>)}
                  <th rowSpan={2} className="sg-action-col">Thao tác</th>
                </tr>
                <tr>
                  {tableLevels.map((lv) => (
                    <Fragment key={lv}>
                      <th className="sg-group-start">CV IQC%</th>
                      <th>Bias EQA%</th>
                      <th>Sigma</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id} className={`sg-period-row${p.id === displayPeriod?.id ? ' sg-period-selected' : ''}`}
                    tabIndex={0} aria-selected={p.id === displayPeriod?.id ? 'true' : 'false'} aria-label={`Chọn kỳ ${vnPeriod(p.period)} để xem tình trạng`}
                    onClick={(e) => { if ((e.target as HTMLElement).closest('button, input, select')) return; setSelectedPeriodId(p.id); }}
                    onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPeriodId(p.id); } }}>
                    <td className="sg-period-cell">
                      <div className="sg-period-select-wrap">
                        <div className="sg-period-controls">
                          <select className="sg-period-month" aria-label="Tháng của kỳ" disabled={!writable}
                            value={Number(p.period.slice(5, 7))} onChange={(e) => changePeriodPart(p, 'month', e.target.value)}>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((x) => <option key={x} value={x}>{String(x).padStart(2, '0')}</option>)}
                          </select>
                          <select className="sg-period-year" aria-label="Năm của kỳ" disabled={!writable}
                            value={Number(p.period.slice(0, 4))} onChange={(e) => changePeriodPart(p, 'year', e.target.value)}>
                            {PERIOD_YEARS.map((x) => <option key={x} value={x}>{x}</option>)}
                          </select>
                        </div>
                      </div>
                    </td>
                    {tableLevels.map((levelNum) => {
                      const lv = p.levels.find((x) => x.level === levelNum);
                      const zone = sigmaZone(lv?.sigma?.sigma);
                      return (
                        <Fragment key={levelNum}>
                          <td className="sg-group-start">
                            {lv
                              ? <div className="sg-cell-stack"><input className="sg-number" type="number" step="0.01" defaultValue={lv.cv ?? ''} disabled={!writable} onBlur={(e) => commitCv(p, levelNum, e.target.value)} /></div>
                              : '—'}
                          </td>
                          <td>
                            {lv ? (
                              <div className="sg-cell-stack">
                                <span>{lv.biasEqa != null ? lv.biasEqa.toFixed(2) : '—'}{lv.mixedSigns && <span className="badge warn" style={{ marginLeft: 4 }} title="Các vòng EQA lệch dấu nhau">±</span>}</span>
                                <button type="button" className="btn ghost sm" style={{ marginTop: 4 }} disabled={!writable} onClick={() => setBiasModal({ period: p, level: lv })}>Bias</button>
                                <div className="sg-cell-meta sg-cell-meta-empty" aria-hidden="true">&nbsp;</div>
                              </div>
                            ) : '—'}
                          </td>
                          <td className="sg-result-cell">
                            {lv ? (
                              <div className="sg-cell-stack">
                                <span className={`tag sg-zone ${lv.sigma ? (lv.sigma.sigma >= 3 ? 'ok' : 'rej') : 'none'}`} style={{ ['--sg-color' as never]: zone.c, color: zone.c, borderColor: zone.c }}>
                                  {lv.sigma ? lv.sigma.sigma.toFixed(2) : '—'}
                                </span>
                                <div className="sg-cell-meta" style={{ color: zone.c }}>{lv.sigma ? zone.label : 'Chưa đủ dữ liệu'}</div>
                                {lv.mu && <button type="button" className="btn ghost sm" style={{ marginTop: 4 }} disabled={!writable} onClick={() => setMuModal({ period: p, level: lv })}>MU {lv.mu.U.toFixed(2)}</button>}
                                {!lv.mu && <button type="button" className="btn ghost sm" style={{ marginTop: 4 }} disabled={!writable} onClick={() => setMuModal({ period: p, level: lv })}>MU</button>}
                              </div>
                            ) : '—'}
                          </td>
                        </Fragment>
                      );
                    })}
                    <td className="sg-row-action sg-action-col">
                      <div className="sg-row-action-buttons">
                        <button className="btn ghost sm sg-row-export" title={`Xuất Excel riêng kỳ ${vnPeriod(p.period)}`} onClick={() => exportPeriod(p)}>Excel</button>
                        <button className="btn ghost sm sg-row-print" title={`Tạo bản in PDF riêng kỳ ${vnPeriod(p.period)}`} onClick={() => printPeriod(p)}>In PDF</button>
                        {admin && <RowActionButton kind="delete" label={`Xóa kỳ ${vnPeriod(p.period)}`} className="sg-row-delete" onClick={() => removePeriodRow(p)} />}
                      </div>
                    </td>
                  </tr>
                ))}
                {!periods.length && <tr><td colSpan={1 + tableLevels.length * 3 + 1}><p className="empty-state">Chưa có kỳ đánh giá nào.</p></td></tr>}
              </tbody>
            </table>
          </div>
          {periods.length > 0 && (
            <div className="sg-data-foot">
              <button className="btn teal sg-combined-export" title="Xuất báo cáo Excel tổng hợp để so sánh Sigma giữa các kỳ" onClick={exportAllPeriods}>Xuất Excel</button>
              <button className="btn teal sg-combined-print" title="Tạo bản in PDF tổng hợp để so sánh Sigma giữa các kỳ" onClick={printAllPeriods}>Xuất PDF</button>
            </div>
          )}
        </div>
      )}

      {testId && displayPeriod && (
        <details className="panel sg-collapse-panel sg-mu-panel">
          <summary className="sg-collapse-summary"><span role="heading" aria-level={2}>Độ không đảm bảo đo (MU)</span></summary>
          <div className="sg-collapse-body">
            <div className="sg-mu-table-wrap">
              <table className="sg-mu-summary-table">
                <thead><tr><th>Mức</th><th className="num">u(Rw)</th><th className="num">u(bias)</th><th className="num">u(cal)</th><th className="num">u_c</th><th className="num">U (k=2)</th><th>Thành phần thiếu</th></tr></thead>
                <tbody>
                  {displayPeriod.levels.map((lv) => (
                    <tr key={lv.level}>
                      <td>Mức {lv.level}</td>
                      <td className="num">{lv.mu?.uRw != null ? lv.mu.uRw.toFixed(4) : '—'}</td>
                      <td className="num">{lv.mu?.uBias != null ? lv.mu.uBias.toFixed(4) : '—'}</td>
                      <td className="num">{lv.mu?.uCal != null ? lv.mu.uCal.toFixed(4) : '—'}</td>
                      <td className="num">{lv.mu?.uc != null ? lv.mu.uc.toFixed(4) : '—'}</td>
                      <td className="num">{lv.mu?.U != null ? lv.mu.U.toFixed(4) : '—'}</td>
                      <td>{lv.mu?.missing?.length ? lv.mu.missing.join(', ') : <span className="hint">Đủ thành phần</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}

      {testId && periods.length > 0 && (
        <div className="panel">
          <h2 className="panel-title">Biểu đồ Sigma &amp; MDC</h2>
          <div className="sg-chart-grid">
            <div className="sg-chart-box">
              <h3>Xu hướng Sigma theo kỳ</h3>
              <div className="chart-inner">
                <SigmaTrendChart periods={periods} />
                <div className="legend">
                  {tableLevels.map((lv) => <span key={lv}>Mức {lv}</span>)}
                  <span>Mốc 3σ (tối thiểu)</span><span>Mốc 6σ (đẳng cấp thế giới)</span>
                </div>
              </div>
            </div>
            <div className="sg-chart-box">
              <h3>Biểu đồ Quyết định Phương pháp (MDC)</h3>
              <div className="hint">X = CV/TEA, Y = |BIAS|/TEA. Điểm to nhất là kỳ gần nhất.</div>
              <div className="chart-inner"><SigmaMdcChart periods={periods} /></div>
            </div>
          </div>
        </div>
      )}

      {creating && test && (
        <NewPeriodModal
          test={test}
          suggestedTea={suggestedTea}
          onClose={() => setCreating(false)}
          onSubmit={async (period, tea, teaSource) => {
            const result = await savePeriod(testId, period, tea, teaSource, (operationalLevels.length ? operationalLevels : [1]).map((level) => ({ level })));
            if (result.ok) setCreating(false);
            return result;
          }}
        />
      )}

      {biasModal && (
        <BiasModal
          initialRounds={biasModal.level.eqaRounds}
          onClose={() => setBiasModal(null)}
          onSubmit={async (rounds) => {
            const result = await savePeriod(testId, biasModal.period.period, biasModal.period.tea ?? undefined, biasModal.period.teaSource,
              levelsPayloadFrom(biasModal.period, biasModal.level.level, { eqaRounds: rounds, biasEqa: undefined }));
            if (result.ok) setBiasModal(null);
            return result;
          }}
        />
      )}

      {muModal && (
        <MuModal
          level={muModal.level}
          onClose={() => setMuModal(null)}
          onSubmit={async (uCal, muBiasMode) => {
            const result = await savePeriod(testId, muModal.period.period, muModal.period.tea ?? undefined, muModal.period.teaSource,
              levelsPayloadFrom(muModal.period, muModal.level.level, { uCal, muBiasMode }));
            if (result.ok) setMuModal(null);
            return result;
          }}
        />
      )}
    </div>
  );
}

function NewPeriodModal({ test, suggestedTea, onClose, onSubmit }: {
  test: { name: string }; suggestedTea: TeaRef | null; onClose: () => void;
  onSubmit: (period: string, tea: number | undefined, teaSource: string | undefined) => Promise<{ ok: boolean; error?: { message: string } }>;
}) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [tea, setTea] = useState(suggestedTea ? String(suggestedTea.lab ?? '') : '');
  const [teaSource, setTeaSource] = useState(suggestedTea ? `Tự khớp: ${suggestedTea.name} (${suggestedTea.lab_source})` : '');
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const result = await onSubmit(period, tea === '' ? undefined : Number(tea), teaSource || undefined);
    if (!result.ok) setErr(result.error?.message || 'Lỗi không xác định.');
  }

  return (
    <Modal title={`Thêm kỳ đánh giá — ${test.name}`} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Lưu</button></>}>
      {err && <p className="field-error">{err}</p>}
      <div className="field"><label>Kỳ (YYYY-MM)</label><input value={period} onChange={(e) => setPeriod(e.target.value)} autoFocus /></div>
      <div className="field">
        <label>TEa (%) {suggestedTea && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— gợi ý tự động từ "{suggestedTea.name}", có thể sửa</span>}</label>
        <input type="number" step="0.01" value={tea} onChange={(e) => setTea(e.target.value)} />
      </div>
      <div className="field"><label>Nguồn TEa</label><input value={teaSource} onChange={(e) => setTeaSource(e.target.value)} /></div>
    </Modal>
  );
}

function BiasModal({ initialRounds, onClose, onSubmit }: {
  initialRounds: number[]; onClose: () => void;
  onSubmit: (rounds: number[]) => Promise<{ ok: boolean; error?: { message: string } }>;
}) {
  const [rounds, setRounds] = useState<string[]>(initialRounds.length ? initialRounds.map(String) : ['', '', '']);
  const [err, setErr] = useState<string | null>(null);
  const numericRounds = rounds.map(Number).filter((v) => Number.isFinite(v));
  const rms = rmsOf(numericRounds);
  const mean = numericRounds.length ? numericRounds.reduce((s, v) => s + v, 0) / numericRounds.length : 0;
  const mixedSigns = numericRounds.some((v) => v > 0) && numericRounds.some((v) => v < 0);

  async function submit() {
    if (!numericRounds.length) { setErr('Nhập ít nhất 1 vòng EQA/EQC.'); return; }
    const result = await onSubmit(numericRounds);
    if (!result.ok) setErr(result.error?.message || 'Lỗi không xác định.');
  }

  return (
    <Modal title="Tính Bias% từ EQA/EQC" onClose={onClose} className="sg-eqa-modal"
      footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Áp dụng Bias%</button></>}>
      {err && <p className="field-error">{err}</p>}
      <div className="sg-eqa-table-wrap">
        <table className="sg-eqa-table">
          <thead><tr><th>#</th><th>KQ PXN</th><th>Target EQA</th><th>Bias%</th><th></th></tr></thead>
          <tbody>
            {rounds.map((v, i) => {
              const bias = Number(v);
              return (
                <tr key={i}>
                  <td className="sg-eqa-index">{i + 1}</td>
                  <td><input type="number" step="0.01" value={v} onChange={(e) => setRounds((r) => r.map((x, j) => (j === i ? e.target.value : x)))} /></td>
                  <td colSpan={1}></td>
                  <td className="sg-eqa-bias" style={{ color: Number.isFinite(bias) ? (Math.abs(bias) > 10 ? 'var(--red)' : 'var(--teal)') : undefined }}>{Number.isFinite(bias) ? bias.toFixed(2) : '—'}</td>
                  <td><RowActionButton kind="delete" label={`Xóa vòng EQA ${i + 1}`} className="sg-eqa-del" onClick={() => setRounds((r) => r.filter((_, j) => j !== i))} disabled={rounds.length <= 1} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn ghost sm sg-eqa-add" onClick={() => setRounds((r) => [...r, ''])}>+ Thêm vòng</button>
      <div className={`sg-eqa-summary${numericRounds.length ? '' : ' is-empty'}`}>
        {numericRounds.length ? (
          <>
            <div><span>Số vòng hợp lệ</span><b>{numericRounds.length}</b></div>
            <div><span>Bias có dấu TB</span><b>{mean.toFixed(3)}</b></div>
            <div><span>Bias RMS dùng tính Sigma</span><b className="sg-eqa-average">{rms.toFixed(3)}</b></div>
            {mixedSigns && <div className="sg-eqa-warning">Bias đổi dấu giữa các vòng — RMS giúp tránh triệt tiêu.</div>}
          </>
        ) : <span className="sg-eqa-empty">Nhập ít nhất 1 vòng EQA/EQC hợp lệ.</span>}
      </div>
    </Modal>
  );
}

function MuModal({ level, onClose, onSubmit }: {
  level: SigmaLevelResult; onClose: () => void;
  onSubmit: (uCal: number | undefined, muBiasMode: 'include' | 'exclude') => Promise<{ ok: boolean; error?: { message: string } }>;
}) {
  const [uCal, setUCal] = useState(level.uCal != null ? String(level.uCal) : '');
  const [includeBias, setIncludeBias] = useState(level.mu?.includeBias !== false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const result = await onSubmit(uCal === '' ? undefined : Number(uCal), includeBias ? 'include' : 'exclude');
    if (!result.ok) setErr(result.error?.message || 'Lỗi không xác định.');
  }

  return (
    <Modal title="Ngân sách độ không đảm bảo đo (MU)" onClose={onClose} className="sg-eqa-modal sg-mu-modal"
      footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Áp dụng ngân sách MU</button></>}>
      {err && <p className="field-error">{err}</p>}
      <table className="data-table" style={{ marginBottom: 'var(--space-md)' }}>
        <thead><tr><th>Thành phần</th><th>Giá trị</th></tr></thead>
        <tbody>
          <tr><td>u(Rw) — từ CV%</td><td>{level.cv != null ? level.cv.toFixed(3) : <span className="badge warn">Chưa có</span>}</td></tr>
          <tr><td>u(bias)</td><td>{level.mu?.uBias != null ? level.mu.uBias.toFixed(3) : <span className="badge warn">Chưa có</span>}</td></tr>
          <tr><td>u(cal)</td><td>{level.mu?.uCal != null ? level.mu.uCal.toFixed(3) : <span className="badge warn">Chưa đánh giá</span>}</td></tr>
        </tbody>
      </table>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <input type="checkbox" checked={includeBias} onChange={(e) => setIncludeBias(e.target.checked)} /> Đưa u(bias) vào ngân sách
      </label>
      <div className="field"><label>u(cal) — từ CoA hiệu chuẩn (0 là kết luận hợp lệ, khác với bỏ trống)</label><input type="number" step="0.001" value={uCal} onChange={(e) => setUCal(e.target.value)} /></div>
      {level.mu && (
        <p style={{ marginTop: 'var(--space-md)' }}>
          u_c = {level.mu.uc.toFixed(3)} · U = {level.mu.U.toFixed(3)}
          {!level.mu.complete && <span className="field-error" style={{ display: 'block' }}>Thiếu: {level.mu.missing.join(', ')} — U hiện tại KHÔNG đầy đủ.</span>}
        </p>
      )}
    </Modal>
  );
}
