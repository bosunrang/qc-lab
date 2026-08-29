import { useEffect } from 'react';
import {
  entryModel, headOnlyHtml, emptyStateHtml, dateBoxHtml, afterRender, entryFocusPendingSheet,
  type EntryModel, type EntryTreeNode, type EntrySheetRow, type EntrySheetCellModel, type EntryRunSlot,
  type EntryLjPanelItem, type EntryTableCard, type EntryVoidedRow, type EntryRangeSummary,
} from '../bridge/entryBridge';

function Head() {
  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: headOnlyHtml('Nhập QC', 'Ghi nhận kết quả theo ngày, mức QC và lô đang vận hành') }} />;
}

function TreeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x={3} y={4} width={18} height={16} rx={2} /><line x1={9} y1={4} x2={9} y2={20} />
    </svg>
  );
}

function EmptyPanel({ model }: { model: Extract<EntryModel, { empty: true }> }) {
  const actionHtml = model.canAdd
    ? model.addTarget === 'manage'
      ? '<button class="btn teal" data-action="go" data-args=\'["manage"]\'>Thêm xét nghiệm</button>'
      : '<button class="btn teal" data-action="goManageTargets">Cấu hình Mean/SD</button>'
    : '';
  return (
    <>
      <Head />
      <div className="panel" dangerouslySetInnerHTML={{ __html: emptyStateHtml(model.title, model.message, actionHtml) }} />
    </>
  );
}

/* ---------------- Cây xét nghiệm ---------------- */

function TreeNodeView({ node }: { node: EntryTreeNode }) {
  if (node.kind === 'empty') return <div className="tree-empty" role="presentation">Không có xét nghiệm phù hợp.</div>;
  if (node.kind === 'machine') {
    return (
      <div className="tnode tn-machine" data-tree-role="machine" data-key={node.key} role="treeitem" tabIndex={0} aria-expanded={node.open} data-action="treeToggle" data-args={JSON.stringify([node.key])} data-keydown-action="entryTreeKey">
        <span className="caret" aria-hidden="true">{node.open ? '−' : '+'}</span>{node.label}
      </div>
    );
  }
  if (node.kind === 'group') {
    return (
      <div className={`tnode tn-test ${node.open ? 'open' : ''}`} data-tree-role="group" data-key={node.key} data-search={node.search} role="treeitem" tabIndex={0} aria-expanded={node.open} style={node.parentOpen ? undefined : { display: 'none' }} data-action="treeToggle" data-args={JSON.stringify([node.key])} data-keydown-action="entryTreeKey">
        <span className="caret" aria-hidden="true">{node.open ? '−' : '+'}</span>{node.name}<span className={`state ${node.stateClass}`}>{node.stateText}</span>
      </div>
    );
  }
  return (
    <div className={`tnode tn-config ${node.selected ? 'on' : ''}`} data-tree-role="assay" data-test-id={node.testId} data-search={node.search} role="treeitem" tabIndex={0} aria-current={node.selected ? 'true' : 'false'} style={node.visible ? undefined : { display: 'none' }} data-action="entryPick" data-args={JSON.stringify([node.testId, node.level])} data-keydown-action="entryTreeKey">
      <span className="config-name">{node.name}</span><span className={`state ${node.stateClass}`}>{node.stateText}</span>
    </div>
  );
}

function TreePanel({ model }: { model: Extract<EntryModel, { empty: false }> }) {
  return (
    <div className="tree" id="entryTreePanel">
      <div className="entry-tree-head">
        <h4 role="heading" aria-level={2}>Danh mục nội kiểm</h4>
        <button type="button" className="btn ghost icon entry-tree-toggle" title="Ẩn danh mục nội kiểm" aria-label="Ẩn danh mục nội kiểm" aria-controls="entryTreePanel" aria-expanded="true" data-action="toggleEntryTree"><TreeIcon /></button>
      </div>
      <div className="tree-tools">
        <input id="entrySearch" aria-label="Tìm xét nghiệm, máy hoặc lô" placeholder="Tìm test, máy hoặc lô..." defaultValue={model.query} data-action="entryFilter" data-action-on="input" />
        <select aria-label="Lọc theo máy xét nghiệm" defaultValue={model.selectedMachine} data-action="entrySetMachine" data-action-on="change">
          {model.machineOptions.map(o => <option value={o.value} key={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div role="tree" aria-label="Danh mục nội kiểm">
        {model.treeNodes.map((node, i) => <TreeNodeView node={node} key={i} />)}
      </div>
    </div>
  );
}

/* ---------------- Bảng nhập QC (worksheet) ---------------- */

function RunSlotView({ slot }: { slot: EntryRunSlot }) {
  if (slot.kind === 'empty') {
    if (!slot.editable) return <div className="qc-run-slot muted"><b>—</b></div>;
    return (
      <div className="qc-run-slot">
        <input className="qc-inline-input empty" type="text" inputMode="decimal" autoComplete="off" placeholder="--" title={slot.title} aria-label={slot.ariaLabel} aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter"
          data-focus-date={slot.date} data-focus-run={slot.runNo} data-focus-level={slot.levelIndex} data-keydown-action="entrySheetKey"
          data-action="entrySheetRunChanged" data-args={JSON.stringify(slot.actionArgs)} data-action-on="change" />
      </div>
    );
  }
  return (
    <div className={`qc-run-slot${slot.previousLot ? ' prev-lot-slot' : ''}`}>
      <b className={`qc-value-chip ${slot.valueClass}`} title={slot.title}>{slot.valueText}</b>
      <small>{slot.zText} · {slot.previousLot ? `Lô ${slot.previousLotName}` : slot.verdictText}</small>
    </div>
  );
}

function SheetCellView({ cell }: { cell: EntrySheetCellModel }) {
  return (
    <td className={`num qc-run-cell${cell.parallel ? ' qc-parallel-cell' : ''}`}>
      <div className={`qc-run-grid${cell.hasAddButton ? ' has-add-btn' : ''}`}>
        {cell.runs.map((slot, i) => <RunSlotView slot={slot} key={i} />)}
      </div>
      {cell.addRun ? <button type="button" className="qc-add-run-btn" title="Thêm lần chạy bổ sung" data-action="entryUnlockExtraRun" data-args={JSON.stringify(cell.addRun.actionArgs)}><span className="qc-add-run-icon">+</span><span className="qc-add-run-label">Thêm</span></button> : null}
    </td>
  );
}

function SheetDayNote({ testId, date, note }: { testId: string; date: string; note: EntrySheetRow['note'] }) {
  if (note.kind === 'none') return <>—</>;
  if (note.kind === 'readonly') return <>{note.text || '—'}</>;
  return <textarea className="qc-note-input" rows={1} placeholder={note.placeholder} defaultValue={note.value} data-action="entryDateNoteSave" data-args={JSON.stringify([testId, date])} data-action-on="change" />;
}

function SheetRowView({ row, testId }: { row: EntrySheetRow; testId: string }) {
  return (
    <tr className={row.rowClass} data-date={row.date}>
      <td><span>{row.dayOfMonth}</span>{row.today ? <b>Hôm nay</b> : null}</td>
      {row.cells.map((cell, i) => <SheetCellView cell={cell} key={i} />)}
      <td className="qc-staff-cell">{row.staff.length ? row.staff.map((s, i) => (
        <span key={s.code}>{i > 0 ? <span className="qc-staff-sep">/</span> : null}<span className="qc-staff" title={s.name || s.code}>{s.code}</span></span>
      )) : '—'}</td>
      <td>{row.warningRules || '—'}</td>
      <td>{row.rejectRules || '—'}</td>
      <td>{row.status === 'none' ? '—' : row.status === 'rej' ? <span className="tag rej">R</span> : row.status === 'warn' ? <span className="tag warn">W(A)</span> : <span className="tag ok">A</span>}</td>
      <td><SheetDayNote testId={testId} date={row.date} note={row.note} /></td>
    </tr>
  );
}

function Worksheet({ model }: { model: Extract<EntryModel, { empty: false }> }) {
  const ws = model.worksheet;
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearNow = new Date(ws.currentIsoMonth + '-01T00:00:00').getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => yearNow - 5 + i);
  return (
    <div className="panel qc-sheet-panel">
      <div className="qc-sheet-heading">
        <div className="qc-sheet-title"><span>Bảng nhập QC</span><strong>{ws.testName}</strong><small>Lô {ws.lotLabel}</small></div>
        <div className="qc-month-area"><div className="qc-month-picker">
          <select aria-label="Chọn tháng" key={`m-${ws.sheetYear}-${ws.sheetMonthNo}`} defaultValue={ws.sheetMonthNo} data-action="entrySetSheetPart" data-args='["month"]' data-action-on="change">
            {monthOptions.map(m => <option value={m} key={m}>Tháng {m}</option>)}
          </select>
          <select aria-label="Chọn năm" key={`y-${ws.sheetYear}-${ws.sheetMonthNo}`} defaultValue={ws.sheetYear} data-action="entrySetSheetPart" data-args='["year"]' data-action-on="change">
            {yearOptions.map(y => <option value={y} key={y}>{y}</option>)}
          </select>
          <button type="button" className="btn ghost sm qc-current-month" data-action="entrySetSheetMonth" data-args={JSON.stringify([ws.currentIsoMonth])}>Tháng hiện tại</button>
          <button type="button" className="btn teal sm qc-today-jump" data-action="entryGoToday">Tới hôm nay</button>
        </div></div>
      </div>
      <div className="qc-sheet-wrap" role="region" aria-label="Bảng nhập QC theo tháng" tabIndex={0}>
        <table className="qc-sheet">
          <thead><tr>
            <th>Ngày</th>
            {ws.levelHeads.map((lh, i) => (
              <th className="qc-level-head" tabIndex={0} data-qc-tooltip={lh.tooltip} aria-label={`Mức ${lh.level}, lô ${lh.lot || '?'}. ${lh.tooltip}`} key={i}>
                Mức {lh.level} · Lô {lh.lot || '?'}{lh.parallel ? <span className="qc-parallel-label">Song song</span> : null}
              </th>
            ))}
            <th>NV thực hiện</th><th>Vi phạm cảnh báo</th><th>Vi phạm loại bỏ</th><th>Chấp nhận</th><th>Ghi chú</th>
          </tr></thead>
          <tbody>
            {ws.rows.length ? ws.rows.map(row => <SheetRowView row={row} testId={model.testId} key={row.date} />)
              : <tr><td colSpan={6 + ws.columnCount} className="empty-cell">Chưa có điểm nào trong khoảng này.</td></tr>}
          </tbody>
        </table>
      </div>
      <div id="entryMsg" role="status" aria-live="polite" style={{ margin: '12px 16px 16px' }} dangerouslySetInnerHTML={{ __html: ws.message }} />
    </div>
  );
}

/* ---------------- Biểu đồ Levey-Jennings ---------------- */

function LjAction({ action }: { action: EntryLjPanelItem['action'] }) {
  if (action.kind === 'hint') return <span className="hint">{action.text}</span>;
  if (action.kind === 'showCurrent') return <button type="button" className="btn teal sm" data-action="entryShowCurrentLot" data-args={JSON.stringify([action.level])}>Xem lô mới</button>;
  return <button type="button" className="btn ghost sm" data-action="entryShowPrevLot" data-args={JSON.stringify([action.level, action.lot])}>Xem lô cũ</button>;
}

function LjMini({ item }: { item: EntryLjPanelItem }) {
  const lot = item.lot || '?';
  return (
    <div className={`lj-mini ${item.on ? 'on' : ''}${item.parallel ? ' lj-mini-parallel' : ''}`} data-action="entryFocusLevel" data-args={JSON.stringify([item.level])} data-keydown-action="entryFocusLevel" data-keydown-args={JSON.stringify([item.level])} data-keydown-keys='["Enter"," "]' role="button" tabIndex={0} aria-label={`Chọn mức ${item.level}, lô ${lot}, ${item.pointCount} điểm${item.parallel ? ', lô chạy song song' : ''}`}>
      <div className="lj-mini-h">
        <b>Mức {item.level} · {item.previousLot ? 'Lô cũ' : 'Lô'} {lot}{item.parallel ? <span className="qc-parallel-label">Song song</span> : null}<span className="lj-point-count">{item.pointCount} điểm</span></b>
        <LjAction action={item.action} />
      </div>
      <div className="lj-qc-strip" tabIndex={0}>{item.metrics.map((m, i) => (
        <div className={`lj-qc-stat${m.control ? ' control' : ''}`} key={i}><span className="k">{m.label}</span><span className="v">{m.value}</span></div>
      ))}</div>
      <div className="chart-scroll" tabIndex={0}><canvas className="entryLJStack" data-render-scale={2} data-test={item.testId} data-level={item.level} data-lot={item.lot} data-mean={item.mean} data-sd={item.sd} data-start={item.start} data-end={item.end} width={1400} height={380} /></div>
    </div>
  );
}

function LeveyPanel({ model }: { model: Extract<EntryModel, { empty: false }> }) {
  const lj = model.ljPanel;
  return (
    <div className="panel">
      <div className="lj-toolbar">
        <h2 className="panel-title">Biểu đồ Levey-Jennings</h2>
        <div className="lj-filter">
          <label className="lj-date-field"><span className="hint">Từ ngày</span><span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: dateBoxHtml('entryStartDate', lj.startDate, '', 'data-action="entrySetStart" data-action-on="change"') }} /></label>
          <label className="lj-date-field"><span className="hint">Đến ngày</span><span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: dateBoxHtml('entryEndDate', lj.endDate, '', 'data-action="entrySetEnd" data-action-on="change"') }} /></label>
          <div className="dayseg">{lj.dayPresetOptions.map(o => (
            <button type="button" className={o.on ? 'on' : ''} data-action="entrySetDays" data-args={JSON.stringify([o.days])} key={o.days}>{o.days} ngày</button>
          ))}</div>
        </div>
      </div>
      <div className="hint lj-range">Khoảng xem: {lj.rangeText}</div>
      <div className="lj-stack">{lj.stack.map((item, i) => <LjMini item={item} key={i} />)}</div>
      <div className="legend">
        <span><span className="dot" style={{ background: '#0e8f8f' }} /> Trong ±2SD</span>
        <span><span className="dot" style={{ background: '#dd8b1f' }} /> Cảnh báo 2–3SD</span>
        <span><span className="dot" style={{ background: '#c5221f' }} /> Loại bỏ ngoài 3SD</span>
      </div>
    </div>
  );
}

/* ---------------- Điểm trong khoảng xem ---------------- */

function TableRowView({ row, testId }: { row: EntryTableCard['rows'][number]; testId: string }) {
  const cls = row.rejected ? 'qc-point-rej' : row.warning ? 'qc-point-warn' : undefined;
  return (
    <tr className={cls} data-qc-point-id={row.pointId} tabIndex={-1}>
      <td>{row.dateText}</td><td className="num"><b>{row.valueText}</b></td><td className="num">{row.zText}</td>
      <td><span className={`tag ${row.verdictLevel}`}>{row.verdictText}</span></td>
      <td>{row.rules.length ? row.rules.map(r => <span className="pill" key={r}>{r}</span>) : '—'}</td>
      <td className="qc-row-actions">{row.canVoid ? <button type="button" className="btn danger sm" title="Hủy điểm QC có ghi lý do" data-action="voidQcPoint" data-args={JSON.stringify([testId, row.pointId])}>Hủy</button> : null}</td>
    </tr>
  );
}

function TableCardView({ card, testId }: { card: EntryTableCard; testId: string }) {
  return (
    <div className={`qc-table-card${card.parallel ? ' qc-parallel-card' : ''}`} role="region" aria-label={`Điểm QC mức ${card.level}, lô ${card.lot}${card.parallel ? ', lô chạy song song' : ''}`} tabIndex={0}>
      <h4><span>Mức {card.level} · {card.previousLot ? 'Lô cũ' : 'Lô'} {card.lot}{card.parallel ? <span className="qc-parallel-label">Song song</span> : null}<span className="hint qc-table-count">{card.pointCount} điểm trong khoảng</span></span></h4>
      <div className="qc-cumulative" title={`Tính từ đầu LOT đến ${card.cumulative.endDateText}`}>
        <div><span>N tích lũy</span><b>{card.cumulative.count}</b></div>
        <div><span>Mean tích lũy</span><b>{card.cumulative.mean}</b></div>
        <div><span>SD tích lũy</span><b>{card.cumulative.sd}</b></div>
        <div><span>CV tích lũy</span><b>{card.cumulative.cv}</b></div>
      </div>
      {card.rows.length ? (
        <>
          <table>
            <thead><tr><th>Ngày</th><th className="num">Giá trị</th><th className="num">Z</th><th>Kết luận</th><th>Luật</th><th>Thao tác</th></tr></thead>
            <tbody>{card.rows.map(row => <TableRowView row={row} testId={testId} key={row.pointId} />)}</tbody>
          </table>
          {card.rowControl ? (
            <div className="table-window-note">
              {card.rowControl.limited ? `Đang hiển thị ${card.rowControl.shown}/${card.rowControl.total} điểm gần nhất. ` : `Đang hiển thị toàn bộ ${card.rowControl.total} điểm. `}
              <button type="button" className="btn ghost sm" data-action="entryToggleRows" data-args={JSON.stringify([card.rowControl.tableKey])}>{card.rowControl.limited ? 'Hiện toàn bộ' : 'Thu gọn'}</button>
            </div>
          ) : null}
        </>
      ) : <div className="empty qc-table-empty">Chưa có điểm nào trong khoảng này.</div>}
    </div>
  );
}

function VoidedBox({ rows }: { rows: EntryVoidedRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="qc-voided-box">
      <h4>Điểm đã hủy trong khoảng</h4>
      <table className="qc-voided-table">
        <thead><tr><th>Ngày</th><th>Mức / lô</th><th className="num">Giá trị</th><th>Lần chạy</th><th>Người hủy</th><th>Lý do</th></tr></thead>
        <tbody>{rows.map(row => (
          <tr data-qc-point-id={row.pointId} tabIndex={-1} key={row.pointId}>
            <td>{row.dateText}</td><td>{row.levelLotText}</td><td className="num">{row.valueText}</td><td>{row.runId}</td><td>{row.voidedBy}</td><td>{row.reason}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function PointsInViewPanel({ model }: { model: Extract<EntryModel, { empty: false }> }) {
  const p = model.pointsInView;
  return (
    <details className="panel entry-secondary-panel qc-points-panel" open={p.open} data-toggle-action="entryDetailToggled" data-toggle-args='["points"]'>
      <summary className="entry-secondary-summary"><span>Điểm trong khoảng xem</span><small>Tra cứu chi tiết, luật vi phạm và điểm đã hủy</small></summary>
      <div className="entry-secondary-body">
        <div className="hint qc-cumulative-note">Thống kê tích lũy tính từ đầu LOT đến {p.endDateText}; bảng bên dưới hiển thị từ {p.startDateText} đến {p.endDateText}.</div>
        <div className="qc-table-grid">{p.tableCards.map((card, i) => <TableCardView card={card} testId={model.testId} key={i} />)}</div>
        <VoidedBox rows={p.voidedRows} />
      </div>
    </details>
  );
}

/* ---------------- Thống kê toàn bộ & dải kiểm soát ---------------- */

function RangeSummaryPanel({ r }: { r: EntryRangeSummary }) {
  const detail = r.eligible
    ? ` Đủ điều kiện lập dải mới (${r.resultCount} kết quả / ${r.dayCount} ngày độc lập). Dải đề xuất: Mean=${r.proposedMean} SD=${r.proposedSd} CV=${r.proposedCv}%.`
    : ` Cần ≥20 kết quả trên ≥20 ngày độc lập, không có điểm vi phạm/cảnh báo chưa xử lý — hiện ${r.resultCount} kết quả / ${r.dayCount} ngày.`;
  return (
    <details className="panel entry-secondary-panel range-summary-panel" open={r.open} data-toggle-action="entryDetailToggled" data-toggle-args='["range"]'>
      <summary className="entry-secondary-summary"><span>Thống kê toàn bộ &amp; Dải kiểm soát</span><small>{r.summary}</small></summary>
      <div className="entry-secondary-body">
        <div className="range-band-note">
          <div className="range-band-label">Dải đang dùng:</div>
          <div className="range-band-source">{r.source}</div>
          <div className="range-band-body">· Mean={r.mean} SD={r.sd}.{detail}</div>
        </div>
        {(r.eligible || r.canRevert) ? (
          <div style={{ margin: '8px 14px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {r.eligible ? <button type="button" className="btn teal sm" title="Xem điều kiện, dải đề xuất và phê duyệt" data-action="openRangeWorkflow" data-args={JSON.stringify([r.testId, r.level])}>Workflow dải QC</button> : null}
            {r.canRevert ? <button type="button" className="btn ghost icon" title="Về dải nhà sản xuất" data-action="revertRange" data-args={JSON.stringify([r.testId, r.level])}>↶</button> : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function EntryPage() {
  const model = entryModel();

  useEffect(() => {
    afterRender('entry');
    entryFocusPendingSheet();
  });

  if (model.empty) return <EmptyPanel model={model} />;

  return (
    <>
      <Head />
      <div className={`entrygrid${model.treeCollapsed ? ' tree-collapsed' : ''}`}>
        <button type="button" className="btn teal icon entry-tree-expand" title="Hiện danh mục nội kiểm" aria-label="Hiện danh mục nội kiểm" aria-controls="entryTreePanel" aria-expanded="false" data-action="toggleEntryTree"><TreeIcon /></button>
        <TreePanel model={model} />
        <div className="entry-main" key={model.testId}>
          <Worksheet model={model} />
          <LeveyPanel model={model} />
          <PointsInViewPanel model={model} />
          <RangeSummaryPanel r={model.rangeSummary} />
        </div>
      </div>
    </>
  );
}
