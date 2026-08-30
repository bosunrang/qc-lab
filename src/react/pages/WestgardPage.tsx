import { useState, useEffect } from 'react';
import { useAppStore } from '../state/kernel';
import { PageHeader } from '../components/PageHeader';
import {
  westgardModel, emptyStateHtml, afterRender, ruleGuideRows, wgFilterTests, wgFilterArchivedTests,
  goManageTargets, dashboardGoEntryFollowup, openConfigAssay, wgSetViewMode, wgSetChartMode, exportWestgardXLSX, printWestgard,
  wgSet, wgReset, wgLoadMoreRows, wgTogglePrevLot, wgSelectTest, wgSetArchivedTest, wgSetArchivedGroup,
  type WestgardModel, type WestgardBlock, type WestgardCurrentModel, type WestgardArchivedModel,
} from '../bridge/westgardBridge';

type NonEmptyModel = Extract<WestgardModel, { empty: false }>;

function Head({ subtitle }: { subtitle: string }) {
  return <PageHeader title="Phân tích Westgard" subtitle={subtitle} />;
}

function DownloadIcon() {
  return (
    <svg className="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1={12} y1={15} x2={12} y2={3} />
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
function RefArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', flexShrink: 0 }} aria-hidden="true">
      <path d="M4 4v7a4 4 0 0 0 4 4h12" /><path d="M15 10l5 5-5 5" />
    </svg>
  );
}

function EmptyPanel({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="panel" dangerouslySetInnerHTML={{ __html: emptyStateHtml('Chưa có xét nghiệm đang vận hành', 'Cần đưa xét nghiệm vào Panel QC, ghép Nhóm lô QC và gán Mean/SD trước khi phân tích Westgard.', isAdmin ? '<button class="btn teal" data-action="goManageTargets">Cấu hình Mean/SD</button>' : '') }} />
  );
}

function ViewModeTabs({ mode, archivedCount }: { mode: string; archivedCount: number }) {
  if (!archivedCount) return null;
  return (
    <div className="dayseg wg-view-mode">
      <button className={mode === 'current' ? 'on' : ''} onClick={() => wgSetViewMode('current')}>Xét nghiệm đang vận hành</button>
      <button className={mode === 'archived' ? 'on' : ''} onClick={() => wgSetViewMode('archived')}>Nhóm lô đã dừng/lưu trữ ({archivedCount})</button>
    </div>
  );
}

function ChartModeTabs({ mode }: { mode: string }) {
  return (
    <div className="dayseg wg-view-mode">
      <button className={mode === 'lj' ? 'on' : ''} onClick={() => wgSetChartMode('lj')}>Levey-Jennings</button>
      <button className={mode === 'cusum' ? 'on' : ''} onClick={() => wgSetChartMode('cusum')}>Xu hướng CUSUM</button>
    </div>
  );
}

function TestSearchInput({ id, query, placeholder, onSet }: { id: string; query: string; placeholder: string; onSet: (v: string) => void }) {
  const [value, setValue] = useState(query);
  useEffect(() => { setValue(query); }, [query]);
  return <input id={id} type="search" placeholder={placeholder} value={value} onChange={e => { setValue(e.target.value); onSet(e.target.value); }} />;
}

function ExportActions({ chartMode }: { chartMode: string }) {
  if (chartMode !== 'lj') return null;
  return (
    <div><label>&nbsp;</label><div className="wg-export-actions">
      <button className="btn teal wg-excel-btn" title="Xuất Excel biểu đồ Levey-Jennings, các vi phạm và điểm bằng chứng đang xem" onClick={exportWestgardXLSX}><DownloadIcon />Xuất Excel</button>
      <button className="btn teal wg-print-btn" title="Tạo bản in PDF/HTML biểu đồ Levey-Jennings và các vi phạm đang xem" onClick={printWestgard}><PrintIcon />In PDF</button>
    </div></div>
  );
}

function RuleToggles({ registry, canWrite, version }: { registry: { id: string; on: boolean }[]; canWrite: boolean; version: number }) {
  return (
    <div className="flow-note" key={version}>
      {registry.map(r => (
        <span className="wg-rule-item" key={r.id}>
          <label><input type="checkbox" defaultChecked={r.on} disabled={!canWrite} onChange={e => wgSet(r.id, e.target.checked)} /> <span className="pill">{r.id}</span></label>
        </span>
      ))}
      {canWrite ? <div className="wg-rule-reset"><button className="btn ghost sm" onClick={wgReset}>Khôi phục mặc định</button></div> : null}
    </div>
  );
}

function RuleGuide() {
  const rows = ruleGuideRows();
  return (
    <details className="wg-guide">
      <summary>Hướng dẫn nhanh luật Westgard</summary>
      <div className="alert info" style={{ margin: '10px 12px 18px' }}>
        <span>Ký hiệu <RefArrowIcon /> trong bảng là điểm lịch sử cấu thành quy tắc. Điểm này chỉ là bằng chứng; trạng thái cảnh báo/loại được gắn cho lần chạy phát hiện hiện tại, không đổi hồi tố kết luận cũ.</span>
      </div>
      <div className="chart-scroll" tabIndex={0}>
        <table>
          <thead><tr><th>Luật</th><th>Điều kiện</th><th>Kết luận</th><th>Gợi ý xử lý</th></tr></thead>
          <tbody>{rows.map(rule => (
            <tr key={rule.id}><td>{rule.id}</td><td>{rule.desc}</td><td>{rule.alert ? <span className="warn">Cảnh báo</span> : <span className="rej">Loại bỏ</span>}</td><td>{rule.fix}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </details>
  );
}

function TargetWarning({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="alert warn wg-target-warning">
      Mức này <b>chưa có Mean/SD hợp lệ</b> — các điểm QC không được đánh giá Westgard; bảng dưới chỉ liệt kê giá trị, không có kết luận Đạt/Cảnh báo/Loại bỏ. {isAdmin ? <button className="btn teal sm" onClick={goManageTargets}>Cấu hình Mean/SD</button> : null}
    </div>
  );
}

function RowsControlRow({ rowsControl, rowKey }: { rowsControl: NonNullable<Extract<WestgardBlock, { kind: 'points' }>['rowsControl']>; rowKey: string }) {
  return (
    <div className="wg-row-window">
      <span>Đang hiển thị {rowsControl.shownCount}/{rowsControl.total} điểm{rowsControl.suffix}</span>
      <button className="btn ghost sm" onClick={() => wgLoadMoreRows(rowKey, rowsControl.next)}>{rowsControl.label}</button>
    </div>
  );
}

function PointsTable({ rows }: { rows: Extract<WestgardBlock, { kind: 'points' }>['rows'] }) {
  return (
    <table className="wg-table">
      <thead><tr><th>#</th><th>Ngày</th><th className="num">Giá trị</th><th className="num">Z</th><th>Kết luận</th><th>Luật / bằng chứng</th><th>Loại sai số</th></tr></thead>
      <tbody>{rows.map(row => {
        const rulePills = row.rules.length ? row.rules.map(rule => <span className="pill" key={rule}>{rule}</span>)
          : row.supportRules.length ? row.supportRules.map(rule => <span className="pill" title="Điểm lịch sử cấu thành quy tắc, không bị loại hồi tố" key={rule}><RefArrowIcon /> {rule}</span>) : '—';
        const evidence = row.rules.length && row.supportRules.length ? (
          <div className="hint flow-tight">Bằng chứng: {row.supportRules.map(rule => <span className="pill" title="Điểm lịch sử cấu thành quy tắc, không bị loại hồi tố" key={rule}><RefArrowIcon /> {rule}</span>)}</div>
        ) : null;
        return (
          <tr key={row.index}>
            <td>{row.index}</td><td>{row.date}</td><td className="num">{row.value}</td><td className="num">{row.z}</td>
            <td><span className={`tag ${row.verdictClass}`}>{row.verdictLabel}</span></td>
            <td>{rulePills}{evidence}</td>
            <td className="hint">{row.errorType === '—' ? '—' : <div className="wg-error-type"><b>{row.errorType}</b>{row.errorDesc ? <small>{row.errorDesc}</small> : null}</div>}</td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}

function LevelHeading({ block }: { block: WestgardBlock }) {
  return (
    <h3>
      <span className="wg-level-title"><span>Mức {block.level}</span><span className="wg-lot-name">{block.lotLabel}</span></span>
      <span className="wg-level-meta">
        {block.badgeText ? <span className="tag rej">{block.badgeText}</span> : null}
        <span>Mean {block.meanText}</span><span>SD {block.sdText}</span><span>{block.pointCount} điểm</span>
        {block.prevToggle ? <button className="btn ghost sm wg-prev-toggle" onClick={() => wgTogglePrevLot(block.prevToggle!.level)}>{block.prevToggle.label}</button> : null}
      </span>
    </h3>
  );
}

function LevelBlock({ block, isAdmin }: { block: WestgardBlock; isAdmin: boolean }) {
  const isLotBlock = block.badgeText != null;
  const panelClass = isLotBlock ? 'panel wg-prev-lot' : 'panel';
  if (block.kind === 'empty') {
    return (
      <div className={panelClass}>
        <LevelHeading block={block} />
        <div className="empty">
          <div className="empty-title">{block.emptyTitle}</div>
          <div>{block.emptyMessage}</div>
          {block.emptyActionArgs ? <div className="empty-actions"><button className="btn teal" onClick={() => dashboardGoEntryFollowup(block.emptyActionArgs![0], block.emptyActionArgs![1])}>Nhập QC</button></div> : null}
        </div>
      </div>
    );
  }
  return (
    <div className={panelClass}>
      <LevelHeading block={block} />
      {'targetOk' in block && !block.targetOk ? <TargetWarning isAdmin={isAdmin} /> : null}
      {block.rowsControl ? <RowsControlRow rowsControl={block.rowsControl} rowKey={block.key} /> : null}
      <PointsTable rows={block.rows} />
    </div>
  );
}

function MultiChart({ className, dataAttrs }: { className: string; dataAttrs: Record<string, string> }) {
  return (
    <div className="panel">
      <h2 className="panel-title">Levey-Jennings tổng hợp</h2>
      <div className="hint wg-panel-intro">Biểu đồ quy đổi các mức QC về Z-score để so sánh trên cùng trục; kết luận Đạt/Cảnh báo/Loại bỏ được tính theo bộ luật Westgard đang bật cho xét nghiệm. Bật "Xem lô cũ" ở mức tương ứng để thêm đường của lô đã chuyển tiếp.</div>
      <div className="chart-scroll" tabIndex={0}><canvas className={className} {...dataAttrs} width={1400} height={430} /></div>
    </div>
  );
}

function CurrentSetup({ model, isAdmin, canWrite, archivedCount, version }: { model: WestgardCurrentModel; isAdmin: boolean; canWrite: boolean; archivedCount: number; version: number }) {
  const hasExportActions = model.chartMode === 'lj';
  return (
    <div className="panel">
      <h2 className="panel-title">Thiết lập phân tích</h2>
      <ViewModeTabs mode="current" archivedCount={archivedCount} />
      <div className={`wg-test-picker${hasExportActions ? ' wg-test-picker-3' : ''}`}>
        <div><label>Tìm nhanh</label><TestSearchInput id="wgTestSearch" query={model.query} placeholder="Tên xét nghiệm, LOT hoặc máy..." onSet={wgFilterTests} /></div>
        <div>
          <label>Chọn xét nghiệm <span id="wgTestCount" className="hint">({model.matchedCount}/{model.totalCount})</span></label>
          <select id="wgTestSelect" aria-label="Chọn xét nghiệm" key={model.selectedTestId} disabled={!model.matchedCount} defaultValue={model.selectedTestId} onChange={e => wgSelectTest(e.target.value)}>
            {model.tests.length ? model.tests.map(t => <option value={t.id} key={t.id}>{t.label}</option>) : <option value="">Không tìm thấy xét nghiệm phù hợp</option>}
          </select>
        </div>
        <ExportActions chartMode={model.chartMode} />
      </div>
      <div className="wg-rules"><b style={{ fontSize: 'var(--type-meta)' }}>Cấu hình chung của luật</b><RuleToggles registry={model.ruleRegistry} canWrite={canWrite} version={version} /></div>
      <RuleGuide />
      <ChartModeTabs mode={model.chartMode} />
    </div>
  );
}

function CusumLevel({ testId, level }: { testId: string; level: WestgardCurrentModel['cusum']['levels'][number] }) {
  return (
    <div className="panel">
      <h3>
        <span className="wg-level-title"><span>Mức {level.level}</span><span className="wg-lot-name">Lô {level.lot || '?'}</span></span>
      </h3>
      {!level.pointCount ? (
        <div className="empty"><div className="empty-title">Chưa có dữ liệu</div><div>LOT đang dùng chưa có điểm QC.</div></div>
      ) : (
        <>
          <div className="hint wg-panel-intro">Đường CUSUM+ (teal)/CUSUM− (xanh tím) cộng dồn độ lệch z-score qua từng điểm; vượt vạch đứt ±h là dấu hiệu trôi/shift kéo dài. Đường xám mờ là trung bình động 5 điểm, chỉ để tham khảo hình dạng xu hướng.</div>
          <div className="chart-scroll" tabIndex={0}><canvas className="cusumChart" data-test={testId} data-level={level.level} width={1400} height={430} /></div>
        </>
      )}
    </div>
  );
}

function CusumPage({ cusum, canWrite }: { cusum: WestgardCurrentModel['cusum']; canWrite: boolean }) {
  if (!cusum.on) {
    return (
      <div className="panel"><div className="empty">
        <div className="empty-title">Chưa bật CUSUM cho xét nghiệm này</div>
        <div>Bật trong cấu hình xét nghiệm để xem biểu đồ xu hướng CUSUM.</div>
        {canWrite ? <div className="empty-actions"><button className="btn teal" onClick={() => openConfigAssay(cusum.testId)}>Mở cấu hình xét nghiệm</button></div> : null}
      </div></div>
    );
  }
  if (!cusum.levels.length) {
    return <div className="panel"><div className="empty"><div className="empty-title">Chưa có mức QC đang vận hành</div><div>Cần Panel QC, Nhóm lô QC và Mean/SD hợp lệ trước khi vẽ CUSUM.</div></div></div>;
  }
  return <>{cusum.levels.map(level => <CusumLevel testId={cusum.testId} level={level} key={level.level} />)}</>;
}

function CurrentView({ model, isAdmin, canWrite, archivedCount, version }: { model: WestgardCurrentModel; isAdmin: boolean; canWrite: boolean; archivedCount: number; version: number }) {
  return (
    <div key={model.selectedTestId} style={{ display: 'contents' }}>
      <CurrentSetup model={model} isAdmin={isAdmin} canWrite={canWrite} archivedCount={archivedCount} version={version} />
      {model.chartMode === 'cusum' ? <CusumPage cusum={model.cusum} canWrite={canWrite} /> : (
        <>
          {model.showMultiChart ? <MultiChart className="wgLJMulti" dataAttrs={{ 'data-test': model.multiChartTestId }} /> : null}
          {model.levels.map(block => <LevelBlock block={block} isAdmin={isAdmin} key={block.level} />)}
        </>
      )}
    </div>
  );
}

function ArchivedSetup({ model, archivedCount }: { model: WestgardArchivedModel; archivedCount: number }) {
  return (
    <div className="panel">
      <h2 className="panel-title">Thiết lập phân tích</h2>
      <ViewModeTabs mode="archived" archivedCount={archivedCount} />
      <div className="wg-test-picker wg-test-picker-3">
        <div><label>Tìm nhanh</label><TestSearchInput id="wgArchivedTestSearch" query={model.query} placeholder="Tên xét nghiệm, máy hoặc số lô..." onSet={wgFilterArchivedTests} /></div>
        {!model.empty ? (
          <div>
            <label>Chọn xét nghiệm <span className="hint">({model.tests.length}/{model.totalCount})</span></label>
            <select key={model.selectedTestId} defaultValue={model.selectedTestId} onChange={e => wgSetArchivedTest(e.target.value)}>
              {model.tests.map(t => <option value={t.id} key={t.id}>{t.label}</option>)}
            </select>
          </div>
        ) : null}
        <div>
          <label>Nhóm lô đã dừng/lưu trữ <span className="hint">({model.groups.length}/{model.groups.length})</span></label>
          <select key={model.selectedGroupId} defaultValue={model.selectedGroupId} onChange={e => wgSetArchivedGroup(e.target.value)}>
            {model.groups.map(g => <option value={g.id} key={g.id}>{g.label}</option>)}
          </select>
        </div>
      </div>
      {!model.empty ? <div className="hint flow-item">Đánh giá dưới đây dùng bộ luật Westgard đang bật hiện nay, không phải cấu hình luật tại thời điểm nhóm lô này còn hoạt động.</div> : null}
    </div>
  );
}

function ArchivedView({ model, isAdmin, archivedCount }: { model: WestgardArchivedModel; isAdmin: boolean; archivedCount: number }) {
  if (model.empty) {
    return (
      <div key={model.selectedGroupId} style={{ display: 'contents' }}>
        <ArchivedSetup model={model} archivedCount={archivedCount} />
        <div className="panel" dangerouslySetInnerHTML={{ __html: emptyStateHtml('Không tìm thấy xét nghiệm nào', 'Nhóm lô này không gắn với xét nghiệm/mức nào có Mean/SD hợp lệ.') }} />
      </div>
    );
  }
  return (
    <div key={`${model.selectedGroupId}:${model.selectedTestId}`} style={{ display: 'contents' }}>
      <ArchivedSetup model={model} archivedCount={archivedCount} />
      {model.showMultiChart ? <MultiChart className="wgLJMultiArchived" dataAttrs={{ 'data-group': model.multiChartGroupId, 'data-test': model.multiChartTestId }} /> : null}
      {model.blocks.map((block, i) => <LevelBlock block={block} isAdmin={isAdmin} key={i} />)}
    </div>
  );
}

export function WestgardPage() {
  const version = useAppStore();
  const model = westgardModel();

  useEffect(() => {
    afterRender('westgard');
  });

  if (model.empty) {
    return <><Head subtitle="" /><EmptyPanel isAdmin={model.isAdmin} /></>;
  }

  return (
    <>
      <Head subtitle={model.viewMode === 'archived' ? 'Xem lại Westgard theo nhóm lô đã dừng/lưu trữ' : 'Đối chiếu luật theo mức QC, lô và lần chạy'} />
      {model.viewMode === 'archived' && model.archived
        ? <ArchivedView model={model.archived} isAdmin={model.isAdmin} archivedCount={model.archivedCount} />
        : model.current ? <CurrentView model={model.current} isAdmin={model.isAdmin} canWrite={model.canWrite} archivedCount={model.archivedCount} version={version} /> : null}
    </>
  );
}
