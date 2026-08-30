import { useState, useEffect, Fragment } from 'react';
import { useAppStore } from '../state/kernel';
import { PageHeader } from '../components/PageHeader';
import { DateField } from '../components/DateField';
import {
  sigmaModel, icoDownloadHtml, sgRefresh,
  sgPickTest, sgPart, sgSetTeaSource, goManageTargets, sgOpenAddTest, sgRemoveTracked, sgSetTea, sgSetTeaMeta,
  sgSelectPeriod, sgCell, sgPullCV, exportSigmaPeriodXLSX, printSigmaPeriod, sgDelPeriod, sgOpenBias,
  sgAddPeriod, exportSigmaPeriodsXLSX, printSigmaPeriods,
  type SigmaModel, type SigmaPeriod, type SigmaLevelCell,
} from '../bridge/sigmaBridge';

type NonEmptyModel = Extract<SigmaModel, { empty: false }>;
type NormalModel = Extract<NonEmptyModel, { noLevels: false }>;

function Head({ subtitle }: { subtitle: string }) {
  return <PageHeader title="Six Sigma & Sai số" subtitle={subtitle} />;
}

function TrashIcon() {
  return (
    <svg className="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
    </svg>
  );
}
function PrintIcon() {
  return (
    <svg className="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6z" />
    </svg>
  );
}
function CalcIcon() {
  return (
    <svg className="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x={4} y={2} width={16} height={20} rx={2} /><line x1={8} y1={6} x2={16} y2={6} />
      <circle cx={8} cy={12} r={0.6} fill="currentColor" stroke="none" /><circle cx={12} cy={12} r={0.6} fill="currentColor" stroke="none" /><circle cx={16} cy={12} r={0.6} fill="currentColor" stroke="none" />
      <circle cx={8} cy={16} r={0.6} fill="currentColor" stroke="none" /><circle cx={12} cy={16} r={0.6} fill="currentColor" stroke="none" /><circle cx={16} cy={16} r={0.6} fill="currentColor" stroke="none" />
    </svg>
  );
}

function EmptyPanel({ isAdmin, hasCatalogTests }: { isAdmin: boolean; hasCatalogTests: boolean }) {
  const message = isAdmin ? (hasCatalogTests ? 'Bấm "+ Thêm xét nghiệm" để chọn từ danh mục đã khai báo trong Cấu hình chung.' : 'Chưa có xét nghiệm trong Cấu hình chung. Hãy khai báo xét nghiệm trước rồi quay lại Six Sigma.') : 'Liên hệ quản trị viên để thêm xét nghiệm từ Cấu hình chung.';
  return (
    <div className="panel"><div className="empty">
      <div className="empty-title">Chưa có xét nghiệm nào trong Sigma</div>
      <div>{message}</div>
      {isAdmin ? <div className="empty-actions"><button className="btn teal" onClick={sgOpenAddTest}>+ Thêm xét nghiệm</button></div> : null}
    </div></div>
  );
}

function TestPicker({ testId, tests }: { testId: string; tests: { id: string; label: string }[] }) {
  const [value, setValue] = useState(testId);
  useEffect(() => { setValue(testId); }, [testId]);
  return (
    <div className="sg-test-picker">
      <label>Chọn xét nghiệm</label>
      <select id="sgTestSelect" aria-label="Chọn xét nghiệm" value={value} onChange={e => { setValue(e.target.value); sgPickTest(e.target.value); }}>
        {tests.map(t => <option value={t.id} key={t.id}>{t.label}</option>)}
      </select>
    </div>
  );
}

function TestActions({ isAdmin, testId }: { isAdmin: boolean; testId: string }) {
  if (!isAdmin) return null;
  return (
    <div className="sg-inline-btns">
      <label>&nbsp;</label>
      <div className="sg-inline-btns-row">
        <button className="btn teal" onClick={sgOpenAddTest}>+ Thêm</button>
        <button className="btn danger" onClick={() => sgRemoveTracked(testId)}><TrashIcon />Xóa</button>
      </div>
    </div>
  );
}

function TeaControl({ tea, canWrite }: { tea: NormalModel['tea']; canWrite: boolean }) {
  if (tea.source === 'eflm') {
    return <><label>TEa% EFLM</label><input type="number" step="any" aria-label="TEa% EFLM" title="Nhập TEa% đã tra từ EFLM Database" defaultValue={tea.controlValue} disabled={!canWrite} onBlur={e => sgSetTea(e.target.value)} /></>;
  }
  const label = tea.source === 'clia' ? 'Tiêu chí CLIA' : 'TEa% tham chiếu';
  return <><label>{label}</label><input type="text" aria-label={label} defaultValue={tea.controlValue} disabled /></>;
}

function EflmBox({ eflm, canWrite }: { eflm: NonNullable<NormalModel['tea']['eflm']>; canWrite: boolean }) {
  const ro = !canWrite;
  return (
    <div className="sg-eflm-box">
      <div><label>Analyte trên EFLM</label><input disabled={ro} defaultValue={eflm.analyte} placeholder="VD: Glucose" onBlur={e => sgSetTeaMeta('eflmAnalyte', e.target.value)} /></div>
      <div><label>Mức APS</label><select disabled={ro} defaultValue={eflm.aps} onChange={e => sgSetTeaMeta('eflmAps', e.target.value)}>
        {['minimum', 'desirable', 'optimum'].map(v => <option value={v} key={v}>{v}</option>)}
      </select></div>
      <div><label>Ngày tra cứu</label><DateField id="sgEflmLookupDate" value={eflm.lookupDate} className="manage-date" disabled={ro} onChange={v => sgSetTeaMeta('eflmLookupDate', v)} /></div>
      <div><label>Link/tài liệu EFLM</label><input disabled={ro} defaultValue={eflm.ref} placeholder="biologicalvariation.eu / bản in PDF" onBlur={e => sgSetTeaMeta('eflmRef', e.target.value)} /></div>
    </div>
  );
}

function AnalysisSetup({ model }: { model: NormalModel }) {
  return (
    <div className="panel">
      <h2 className="sg-setup-heading panel-title">Thiết lập phân tích</h2>
      <div className="row-flex sg-control-row">
        <TestPicker testId={model.testId} tests={model.tests} />
        <TestActions isAdmin={model.isAdmin} testId={model.testId} />
      </div>
      <div className="sg-setup-fields">
        <div><label>Tên xét nghiệm</label><input value={model.testName} aria-label="Tên xét nghiệm" readOnly /></div>
        <div><label>Đơn vị</label><input value={model.unit} aria-label="Đơn vị" readOnly /></div>
        <div><label>Thiết bị</label><input value={model.instrument} readOnly placeholder="Bấm để chọn / quản lý thiết bị" /></div>
        <div className="sg-tea-source">
          <label>Nguồn TEa</label>
          <select aria-label="Nguồn TEa" disabled={!model.canWrite} defaultValue={model.tea.source} onChange={e => sgSetTeaSource(e.target.value)}>
            {model.tea.options.map(o => <option value={o.value} key={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="sg-tea-input"><TeaControl tea={model.tea} canWrite={model.canWrite} /></div>
      </div>
      {model.tea.eflm ? <EflmBox eflm={model.tea.eflm} canWrite={model.canWrite} /> : null}
      <div className="hint sg-sigma-input-note">
        {model.tea.hint} Mỗi mức dùng <b>CV từ IQC</b> và <b>Bias từ EQA/EQC</b>; nhiều vòng EQA được tổng hợp bằng <b>RMS</b> để tránh triệt tiêu dấu. Dữ liệu IQC không được dùng để tính Bias. Quy tắc thận trọng của phần mềm: &lt;20 điểm chỉ hiển thị ước tính, 20–29 điểm là tạm thời, ≥30 điểm mới dùng để gợi ý QC. DPMO/Yield chỉ là quy đổi tham khảo với dịch 1,5σ.
      </div>
    </div>
  );
}

/* sgPart() không gọi rerender() khi đổi thành công (chỉ sgRefreshSoon()) —
   select vẫn hiện đúng giá trị vừa chọn qua hành vi mặc định của trình duyệt,
   không cần React can thiệp. Khi bị TỪ CHỐI (trùng kỳ), sgPart() gọi
   rerender() sau khi đóng hộp thoại, nhưng month/year vẫn giữ nguyên giá trị
   CŨ — thử value= có điều khiển thật (không state cục bộ) đã KHÔNG khôi phục
   được DOM (xác nhận trực tiếp trong trình duyệt: notify() chạy, model đúng,
   nhưng select vẫn hiện giá trị vừa bị từ chối) vì React so sánh prop mới với
   giá trị NÓ nhớ đã set lần trước (không đổi), không so với giá trị DOM thật
   sự đang hiển thị. Ép remount bằng key={renderVersion} (đếm tăng mỗi lần
   rerender(), từ useAppStore() ở SigmaPage) buộc React dựng lại select
   với defaultValue mới mỗi lần rerender() chạy — đúng chi phí của bản cổ điển
   (dựng lại toàn bộ HTML mỗi lần rerender()), chỉ áp cho 2 select nhỏ này. */
function PeriodMonthYearSelect({ eid, month, year, years }: { eid: string; month: number; year: number; years: number[] }) {
  return (
    <div className="sg-period-controls">
      <select className="sg-period-month" aria-label="Tháng của kỳ" defaultValue={month} onChange={e => sgPart(eid, 'm', e.target.value)}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(x => <option value={x} key={x}>{String(x).padStart(2, '0')}</option>)}
      </select>
      <select className="sg-period-year" aria-label="Năm của kỳ" defaultValue={year} onChange={e => sgPart(eid, 'y', e.target.value)}>
        {years.map(x => <option value={x} key={x}>{x}</option>)}
      </select>
    </div>
  );
}

function LevelCell({ eid, level, cell, canWrite }: { eid: string; level: string | number; cell: SigmaLevelCell; canWrite: boolean }) {
  const r = cell.result;
  const tagStyle = r ? ({ '--sg-color': r.color, color: r.color } as any) : undefined;
  return (
    <>
      <td className="sg-group-start"><div className="sg-cell-stack">
        <input className="sg-number" disabled={!canWrite} type="number" step="any" defaultValue={cell.cv} placeholder="CV%" onChange={e => sgCell(eid, level, 'cv', e.target.value)} />
        {cell.cvMeta ? <div className="sg-cell-meta sg-cv-meta" title={cell.cvMeta.title}>{cell.cvMeta.text}</div> : null}
      </div></td>
      <td><div className="sg-cell-stack">
        <input className="sg-number" disabled={!canWrite} type="number" step="any" defaultValue={cell.bias} placeholder="Bias%" onChange={e => sgCell(eid, level, 'biasEqa', e.target.value)} />
        <div className="sg-cell-meta sg-cell-meta-empty" aria-hidden="true">&nbsp;</div>
      </div></td>
      <td className="sg-result-cell" title={r ? r.title : 'Nhập CV và Bias'}><div className="sg-cell-stack">
        <span id={`sg_${eid}_${level}`} className={`tag ${r ? 'sg-zone ' + (r.classifiable ? (Number(r.sigma) >= 3 ? 'ok' : 'rej') : 'none') : ''}`} style={tagStyle}>{r ? (r.classifiable ? '' : '≈') + r.sigma : '—'}</span>
        <div className="sg-cell-meta" style={r ? { color: r.color } : undefined}>{r ? r.label : 'Chưa đủ dữ liệu'}</div>
      </div></td>
    </>
  );
}

function PeriodRow({ row, levels, canWrite, isAdmin, version }: { row: SigmaPeriod; levels: (string | number)[]; canWrite: boolean; isAdmin: boolean; version: number }) {
  return (
    <tr data-sg-period-id={row.id} className={`sg-period-row${row.selected ? ' sg-period-selected' : ''}`} tabIndex={0} aria-selected={row.selected ? 'true' : 'false'} aria-label={`Chọn kỳ ${row.periodLabel} để xem tình trạng`}
      onClick={e => { if ((e.target as HTMLElement).closest('button, input, select')) return; sgSelectPeriod(row.id); }}
      onKeyDown={e => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sgSelectPeriod(row.id); } }}>
      <td className="sg-period-cell"><div className="sg-period-select-wrap"><PeriodMonthYearSelect eid={row.id} month={row.month} year={row.year} years={row.years} key={version} /></div></td>
      {row.levelCells.map(cell => <LevelCell eid={row.id} level={cell.level} cell={cell} canWrite={canWrite} key={cell.level} />)}
      <td className="sg-row-action sg-action-col"><div className="sg-row-action-buttons">
        {canWrite ? <button className="btn ghost sm sg-row-cv" title={`Chọn CV IQC theo lô lịch sử cho kỳ ${row.periodLabel}`} onClick={() => sgPullCV(row.id)}>Nạp CV lô</button> : null}
        <button className="btn ghost sm sg-row-export" title={`Xuất Excel riêng kỳ ${row.periodLabel}`} onClick={() => exportSigmaPeriodXLSX(row.id)} dangerouslySetInnerHTML={{ __html: icoDownloadHtml() + 'Excel' }} />
        <button className="btn ghost sm sg-row-print" title={`Tạo bản in PDF/HTML riêng kỳ ${row.periodLabel}`} onClick={() => printSigmaPeriod(row.id)}><PrintIcon />In PDF</button>
        {isAdmin ? <button className="btn danger sm sg-row-delete" title={`Xóa kỳ ${row.periodLabel}`} onClick={() => sgDelPeriod(row.id)}>Xóa</button> : null}
      </div></td>
    </tr>
  );
}

function PeriodTable({ model, version }: { model: NormalModel; version: number }) {
  const tableMin = 368 + model.levels.length * 295;
  const biasActions = model.canWrite ? model.biasButtons.map(b => (
    <button key={b.level} className="btn ghost sm" disabled={!b.enabled} title={b.title} onClick={b.enabled ? () => sgOpenBias(b.periodId!, b.level) : undefined}><CalcIcon />Bias EQA% Mức {b.level}</button>
  )) : null;
  return (
    <div className="panel">
      <div className="sg-data-head">
        <h2 className="panel-title">Số liệu theo kỳ</h2>
        <div className="sg-data-head-actions">
          {biasActions}
          {model.canAddPeriod ? <button className="btn teal sm" onClick={sgAddPeriod}>+ Thêm kỳ</button> : null}
        </div>
      </div>
      {model.periods.length ? (
        <div className="sg-simple-table-wrap">
          <table className="sg-simple-table" style={{ minWidth: tableMin }}>
            <colgroup><col style={{ width: 140 }} />{model.levels.flatMap((_, i) => [<col style={{ width: 100 }} key={`a${i}`} />, <col style={{ width: 100 }} key={`b${i}`} />, <col style={{ width: 95 }} key={`c${i}`} />])}<col style={{ width: 228 }} /></colgroup>
            <thead>
              <tr><th rowSpan={2}>Kỳ / Năm</th>{model.levels.map(l => <th colSpan={3} className="sg-group-start" key={l}>Mức {l}</th>)}<th rowSpan={2} className="sg-action-col">Thao tác</th></tr>
              <tr>{model.levels.map(l => <Fragment key={l}>
                <th className="sg-group-start">CV IQC%</th><th>Bias EQA%</th><th>Sigma</th>
              </Fragment>)}</tr>
            </thead>
            <tbody>{model.periods.map(row => <PeriodRow row={row} levels={model.levels} canWrite={model.canWrite} isAdmin={model.isAdmin} version={version} key={row.id} />)}</tbody>
          </table>
        </div>
      ) : <div className="empty" style={{ margin: '14px 16px 10px' }}>Chưa có kỳ nào.</div>}
      {model.combinedExport ? (
        <div className="sg-data-foot">
          <button className="btn teal sg-combined-export" title="Xuất báo cáo Excel tổng hợp để so sánh Sigma giữa các kỳ" onClick={exportSigmaPeriodsXLSX} dangerouslySetInnerHTML={{ __html: icoDownloadHtml() + 'Xuất Excel' }} />
          <button className="btn teal sg-combined-print" title="Tạo bản in PDF/HTML tổng hợp để so sánh Sigma giữa các kỳ" onClick={printSigmaPeriods}><PrintIcon />Xuất PDF</button>
        </div>
      ) : null}
    </div>
  );
}

export function SigmaPage() {
  const version = useAppStore();
  const model = sigmaModel();

  useEffect(() => {
    if (!model.empty && !model.noLevels) sgRefresh();
  });

  if (model.empty) {
    return <><Head subtitle="" /><EmptyPanel isAdmin={model.isAdmin} hasCatalogTests={model.hasCatalogTests} /></>;
  }

  if (model.noLevels) {
    return (
      <>
        <Head subtitle="Đánh giá hiệu năng phương pháp theo TEa, CV IQC và Bias EQA/EQC" />
        <div className="panel">
          <div className="row-flex sg-control-row">
            <TestPicker testId={model.testId} tests={model.tests} />
            <TestActions isAdmin={model.isAdmin} testId={model.testId} />
          </div>
          <div className="alert warn flow-control">
            {model.message}
            {model.isAdmin ? <> <button className="btn teal" onClick={goManageTargets}>Cấu hình Mean/SD</button></> : null}
          </div>
        </div>
      </>
    );
  }

  return (
    <div key={model.testId} style={{ display: 'contents' }}>
      <Head subtitle="Đánh giá hiệu năng phương pháp theo TEa, CV IQC và Bias EQA/EQC" />
      <div className="sg-top-grid">
        <AnalysisSetup model={model} />
        <div className="panel"><h2 className="sg-setup-heading panel-title">Tình trạng</h2><div id="sgStatus" /></div>
      </div>
      <PeriodTable model={model} version={version} />
      <details className="panel sg-collapse-panel">
        <summary className="sg-collapse-summary"><span role="heading" aria-level={2}>Thiết kế QC theo Sigma (OPSpecs)</span></summary>
        <div className="sg-collapse-body" id="sgFreq" />
      </details>
      <details className="panel sg-collapse-panel sg-mu-panel">
        <summary className="sg-collapse-summary"><span role="heading" aria-level={2}>Độ không đảm bảo đo (MU)</span></summary>
        <div id="sgMUAction" className="sg-data-head-actions" />
        <div id="sgMU" />
      </details>
      <div className="panel">
        <h2 className="panel-title">Biểu đồ Sigma & MDC</h2>
        <div className="sg-chart-grid">
          <div className="sg-chart-box"><h3>Xu hướng Sigma theo kỳ</h3><div className="chart-inner" id="sgTrend" /></div>
          <div className="sg-chart-box"><h3>Biểu đồ Quyết định Phương pháp (MDC)</h3><div className="hint">X = CV/TEA, Y = |BIAS|/TEA. Điểm to nhất là kỳ gần nhất.</div><div className="chart-inner" id="sgMDC" /></div>
        </div>
      </div>
    </div>
  );
}
