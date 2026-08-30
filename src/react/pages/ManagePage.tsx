import { useState, useEffect } from 'react';
import { useAppStore } from '../state/kernel';
import { manageModel, headOnlyHtml, manageSearchSet, setTargetPanel, setTargetGroup, setHistoryTest, type ManageTab, type ManageToolbar } from '../bridge/manageBridge';

function Head() {
  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: headOnlyHtml('Cấu hình chung', 'Quản lý máy, Panel QC, lô QC, Mean/SD và luật QC') }} />;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty"><div className="empty-title">{title}</div><div>{description}</div></div>;
}

function SearchInput({ query, placeholder }: { query: string; placeholder: string }) {
  const [value, setValue] = useState(query);
  useEffect(() => { setValue(query); }, [query]);
  return <input id="manageSearch" placeholder={placeholder} value={value} onChange={e => { setValue(e.target.value); manageSearchSet(e.target.value); }} />;
}

function Toolbar({ toolbar, query, searchPlaceholder }: { toolbar: ManageToolbar; query: string; searchPlaceholder: string }) {
  return (
    <div className="rcfg-toolbar">
      <div><h2>{toolbar.title}</h2>{toolbar.subtitle ? <p>{toolbar.subtitle}</p> : null}</div>
      <div className="rcfg-tools">
        <SearchInput query={query} placeholder={searchPlaceholder} />
        {toolbar.action ? <button className="btn teal" data-action={toolbar.action.action} data-args={toolbar.action.args ? JSON.stringify(toolbar.action.args) : undefined}>{'＋ ' + (toolbar.actionLabel || '')}</button> : null}
      </div>
    </div>
  );
}

function ShellNav({ tabs, active }: { tabs: ManageTab[]; active: string }) {
  return (
    <aside className="config-shell-nav" aria-label="Danh mục cấu hình">
      <div className="rcfg-title">CẤU HÌNH CHUNG</div>
      {tabs.map(item => (
        <button key={item.id} className={active === item.id ? 'on' : ''} data-action="setManageTab" data-args={JSON.stringify([item.id])}>
          <b>{item.label}</b><small>{item.count}</small>
        </button>
      ))}
    </aside>
  );
}

/* ===== Máy xét nghiệm ===== */
function InstrumentRow({ row }: { row: any }) {
  return (
    <tr>
      <td><b>{row.name}</b><div className="hint">{row.section || 'Chưa phân khoa'}</div></td>
      <td>{row.manufacturer || '—'}</td>
      <td>{row.serial || '—'}</td>
      <td className="num">{row.assayCount}</td>
      <td><span className={`tag ${row.active ? 'ok' : 'none'}`}>{row.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></td>
      <td><div className="manage-actions">
        <button className="btn ghost sm" data-action="openConfigInstrument" data-args={JSON.stringify([row.id])}>Sửa</button>
        <button className="btn danger sm" data-action="deleteConfigInstrument" data-args={JSON.stringify([row.id])}>Xóa</button>
      </div></td>
    </tr>
  );
}
function InstrumentsTab({ body }: { body: any }) {
  return (
    <div className="panel rcfg-list">
      {body.rows.length ? (
        <table className="instrument-table">
          <thead><tr><th>Máy xét nghiệm</th><th>Nhà sản xuất</th><th>Số sê-ri</th><th className="num">Xét nghiệm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>{body.rows.map((row: any) => <InstrumentRow row={row} key={row.id} />)}</tbody>
        </table>
      ) : <EmptyState title="Chưa có máy xét nghiệm" description="Thêm máy trước khi cấu hình xét nghiệm." />}
    </div>
  );
}

/* ===== Danh mục xét nghiệm ===== */
function AssayRow({ row }: { row: any }) {
  return (
    <tr>
      <td className="num">{row.index}</td>
      <td><b>{row.name}</b><div className="hint">{row.method || 'Chưa nhập phương pháp'} · {row.unit || 'Chưa có đơn vị'}</div></td>
      <td>{row.instrument}<div className="hint">{row.section || 'Chưa gán khoa/khu vực'}</div></td>
      <td>{row.reagent || '—'}</td>
      <td>{row.tea ? `${row.tea}%` : '—'}</td>
      <td><span className={`tag ${row.closed ? 'none' : 'ok'}`}>{row.closed ? 'Ngưng dùng' : 'Đang dùng'}</span></td>
      <td><div className="manage-actions">
        <button className="btn ghost sm" data-action="openConfigAssay" data-args={JSON.stringify([row.id])}>Sửa</button>
        <button className="btn danger sm" data-action="delTest" data-args={JSON.stringify([row.id])}>Xóa</button>
      </div></td>
    </tr>
  );
}
function AssaysTab({ body }: { body: any }) {
  return (
    <div className="panel rcfg-list">
      {body.rows.length ? (
        <table className="assay-table">
          <thead><tr><th className="num">STT</th><th>Tên xét nghiệm</th><th>Máy xét nghiệm</th><th>Hóa chất</th><th>TEa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>{body.rows.map((row: any) => <AssayRow row={row} key={row.id} />)}</tbody>
        </table>
      ) : <EmptyState title="Chưa có xét nghiệm" description="Tạo xét nghiệm trước, sau đó gán lô và Mean/SD ở các thẻ cấu hình tương ứng." />}
    </div>
  );
}

/* ===== Panel QC ===== */
function PanelRow({ row }: { row: any }) {
  return (
    <tr>
      <td><b>{row.name}</b></td>
      <td>{row.instrument}</td>
      <td>{row.tests.length ? row.tests.map((t: any) => <span className="pill" key={t.id}>{t.label}</span>) : '—'}</td>
      <td className="num">{row.testCount}</td>
      <td><span className={`tag ${row.active ? 'ok' : 'none'}`}>{row.active ? 'Đang dùng' : 'Tạm ngưng'}</span></td>
      <td><div className="manage-actions">
        <button className="btn ghost sm" data-action="openConfigPanel" data-args={JSON.stringify([row.id])}>Sửa</button>
        <button className="btn danger sm" data-action="deleteConfigPanel" data-args={JSON.stringify([row.id])}>Xóa</button>
      </div></td>
    </tr>
  );
}
function PanelsTab({ body }: { body: any }) {
  return (
    <div className="panel rcfg-list">
      {body.rows.length ? (
        <table className="panel-qc-table">
          <thead><tr><th>Tên panel</th><th>Máy xét nghiệm</th><th>Xét nghiệm trong panel</th><th className="num">Số vị trí</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>{body.rows.map((row: any) => <PanelRow row={row} key={row.id} />)}</tbody>
        </table>
      ) : <EmptyState title="Chưa có Panel QC" description="Tạo Panel QC trước, sau đó nhập Mean/SD theo nhóm lô trong thẻ Mean/SD." />}
    </div>
  );
}

/* ===== Lô & Nhóm QC ===== */
function LotRow({ row }: { row: any }) {
  const hint = row.description || row.program;
  return (
    <tr>
      <td><b>{row.lotNo}</b>{hint ? <div className="hint">{hint}</div> : null}</td>
      <td><span className="pill">M{row.level}</span></td>
      <td>{row.expiry || '—'}</td>
      <td><span className={`tag ${row.status.cls}`}>{row.status.text}</span></td>
      <td className="num">{row.used}</td>
      <td><div className="lot-row-actions">
        <button className="btn ghost sm" data-action="openConfigLot" data-args={JSON.stringify([row.id])}>Sửa</button>
        <button className="btn danger sm" data-action="deleteConfigLot" data-args={JSON.stringify([row.id])}>Xóa</button>
      </div></td>
    </tr>
  );
}
function LotGroupCard({ group }: { group: any }) {
  const toggleAction = group.toggle ? (group.toggle.command === 'activate' ? 'activateLotGroup' : 'toggleLotGroupStatus') : null;
  return (
    <div className={`lot-group-card${group.archived ? ' lot-opt-depleted' : ''}`}>
      <div className="lot-group-card-h">
        <div><b>{group.name}</b><small>{group.note || 'Nhóm lô để gán Mean/SD theo Panel'}</small></div>
        <span className={`tag ${group.status.cls}`}>{group.status.text}</span>
      </div>
      <div className="lot-group-chipline">
        {group.lots.length ? group.lots.map((l: any, i: number) => <span className="pill" key={i}>{l.lotNo} · M{l.level}</span>) : <span className="hint">Chưa chọn lô</span>}
      </div>
      <div className="lot-group-actions">
        <button className="btn ghost sm" data-action="openConfigGroup" data-args={JSON.stringify([group.id])}>Sửa nhóm</button>
        <button className="btn ghost sm" data-action="openTargetMatrix" data-args={JSON.stringify(['', group.id])}>Mean/SD</button>
        {group.toggle ? <button className={`btn ${group.toggle.variant}`} data-action={toggleAction} data-args={JSON.stringify([group.id])}>{group.toggle.label}</button> : null}
        <button className="btn danger sm" data-action="deleteConfigGroup" data-args={JSON.stringify([group.id])}>Xóa</button>
      </div>
    </div>
  );
}
function LotsTab({ body }: { body: any }) {
  return (
    <div className="lot-config-grid">
      <div className="panel rcfg-list lot-config-left">
        <div className="rcfg-panel-h"><h3>Lô QC</h3><button className="btn teal sm" data-action="openConfigLot">Thêm lô QC</button></div>
        {body.lotRows.length ? (
          <table className="lot-table">
            <thead><tr><th>Số lô</th><th>Mức</th><th>Hạn dùng</th><th>Trạng thái</th><th className="num">Gán</th><th>Thao tác</th></tr></thead>
            <tbody>{body.lotRows.map((row: any) => <LotRow row={row} key={row.id} />)}</tbody>
          </table>
        ) : <EmptyState title="Chưa có lô QC" description="Tạo từng lô QC độc lập, sau đó nhập Mean/SD cho Panel QC." />}
      </div>
      <div className="panel rcfg-list lot-config-right">
        <div className="rcfg-panel-h"><h3>Nhóm lô QC</h3><button className="btn teal sm" data-action="openConfigGroup">Thêm nhóm lô</button></div>
        {body.groupCards.length ? (
          <div className="lot-group-list">{body.groupCards.map((group: any) => <LotGroupCard group={group} key={group.id} />)}</div>
        ) : <EmptyState title="Chưa có nhóm lô" description="Chọn các lô QC đã tạo để ghép thành một nhóm, ví dụ 1101/1102." />}
      </div>
    </div>
  );
}

/* ===== Chuyển tiếp lô QC ===== */
function TransitionRow({ row }: { row: any }) {
  return (
    <tr>
      <td><b>{row.panel}</b></td>
      <td><div><b>{row.fromLot}</b></div><div className="hint">→ {row.toLot}</div></td>
      <td>{row.startDate || '—'}</td>
      <td>
        <span className={`tag ${row.status.cls}`}>{row.status.text}</span>
        {row.movedLotNo ? <div className="hint">Đã chuyển tiếp qua lô {row.movedLotNo}</div> : null}
        {row.approvalText ? <div className="hint">Duyệt: {row.approvalText}</div> : null}
      </td>
      <td><div className="manage-actions">
        <button className="btn ghost sm" data-action="openLotTransitionV2" data-args={JSON.stringify([row.id])}>Sửa</button>
        <button className="btn danger sm" data-action="deleteLotTransition" data-args={JSON.stringify([row.id])}>Xóa</button>
      </div></td>
    </tr>
  );
}
function TransitionsTab({ body }: { body: any }) {
  return (
    <div className="panel rcfg-list transition-list">
      {body.rows.length ? (
        <table className="transition-table">
          <thead><tr><th>Panel QC</th><th>Chuyển lô</th><th>Bắt đầu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>{body.rows.map((row: any) => <TransitionRow row={row} key={row.id} />)}</tbody>
        </table>
      ) : <EmptyState title="Chưa có hồ sơ chuyển lô" description="Tạo hồ sơ để theo dõi chuyển từ lô cũ sang lô mới." />}
    </div>
  );
}

/* ===== Lịch sử dữ liệu QC ===== */
function HistoryRow({ row }: { row: any }) {
  return (
    <tr>
      <td><span className="pill">M{row.level}</span></td>
      <td><b>{row.lot || '—'}</b><div className="hint">{row.group}</div></td>
      <td className="num">{row.mean}</td>
      <td className="num">{row.low}</td>
      <td className="num">{row.high}</td>
      <td className="num">{row.sd}</td>
      <td>{row.period}</td>
      <td><span className={`tag ${row.source === 'lab' ? 'warn' : 'ok'}`}>{row.source === 'lab' ? 'PXN' : 'NSX'}</span></td>
      <td className="num">{row.pointCount}</td>
      <td><button className="btn ghost sm" data-action="openQcHistoryDetail" data-args={JSON.stringify([row.testId, row.level, row.lot || ''])}>Chi tiết</button></td>
    </tr>
  );
}
function HistorySelect({ selectedTestId, options }: { selectedTestId: string; options: { id: string; label: string }[] }) {
  const [value, setValue] = useState(selectedTestId);
  useEffect(() => { setValue(selectedTestId); }, [selectedTestId]);
  return (
    <select value={value} onChange={e => { setValue(e.target.value); setHistoryTest(e.target.value); }}>
      {options.map(o => <option value={o.id} key={o.id}>{o.label}</option>)}
    </select>
  );
}
function HistoryTab({ body }: { body: any }) {
  if (!body.options) return <div className="panel"><EmptyState title={body.empty.title} description={body.empty.description} /></div>;
  return (
    <div className="panel target-matrix-panel">
      <div className="target-selector history-selector">
        <div><label>Xét nghiệm</label><HistorySelect selectedTestId={body.selectedTestId} options={body.options} /></div>
        <div className="target-lot-info"><b>{body.rowCount}</b><span>mốc lô/Mean-SD</span></div>
        <div className="target-lot-info"><b>{body.pointCount}</b><span>điểm QC đã nhập</span></div>
      </div>
      <div className="rcfg-list">
        {body.rows.length ? (
          <table className="history-table">
            <thead><tr><th>Mức</th><th>Lô QC / Nhóm lô</th><th className="num">Mean</th><th className="num">Giới hạn dưới</th><th className="num">Giới hạn trên</th><th className="num">SD</th><th>Hiệu lực</th><th>Nguồn</th><th className="num">Điểm QC</th><th></th></tr></thead>
            <tbody>{body.rows.map((row: any, i: number) => <HistoryRow row={row} key={i} />)}</tbody>
          </table>
        ) : <EmptyState title={body.tableEmpty.title} description={body.tableEmpty.description} />}
      </div>
    </div>
  );
}

/* ===== Bảng TEa tham chiếu ===== */
const TEA_STATUS: Record<string, { cls: string; label: string }> = { default: { cls: 'none', label: 'Mặc định' }, override: { cls: 'warn', label: 'Đã sửa' }, lab: { cls: 'ok', label: 'TEa PXN' }, custom: { cls: 'ok', label: 'Tự thêm' } };
function TeaRefRow({ row }: { row: any }) {
  const status = TEA_STATUS[row.kind] || TEA_STATUS.default;
  return (
    <tr>
      <td><b title={row.namingTitle}>{row.displayName}</b></td>
      <td>{row.unit}</td>
      <td>{row.section}</td>
      <td><input className="tea-ref-value" disabled={!row.canManage} type="number" step="any" defaultValue={row.clia} data-action="teaRefEdit" data-args={JSON.stringify([row.analyteId, 'clia'])} data-action-on="change" /></td>
      <td><input className="tea-ref-value" disabled={!row.canManage} type="number" step="any" defaultValue={row.ricos} data-action="teaRefEdit" data-args={JSON.stringify([row.analyteId, 'ricos'])} data-action-on="change" /></td>
      <td><div className="tea-lab-cell">
        {row.lab != null ? <b>{Number(row.lab).toFixed(2)}%</b> : null}
        {row.rowActions.labProfile !== 'none' ? <button className="btn ghost sm" data-action="teaLabProfileOpen" data-args={JSON.stringify([row.analyteId])}>{row.rowActions.labProfile === 'add' ? 'Thêm hồ sơ' : 'Xem hồ sơ'}</button> : null}
      </div></td>
      <td><div className="tea-ref-status">
        <span className={`tag ${status.cls}`}>{status.label}</span>
        {row.rowActions.action === 'restore' ? <button className="btn ghost sm" title="Khôi phục giá trị mặc định" data-action="teaRefRemove" data-args={JSON.stringify([row.analyteId])}>Khôi phục</button> : null}
        {row.rowActions.action === 'remove' ? <button className="x" title="Xóa xét nghiệm tự thêm" data-action="teaRefRemove" data-args={JSON.stringify([row.analyteId])}>✕</button> : null}
      </div></td>
    </tr>
  );
}
function TeaSourceRegistry({ items }: { items: any[] }) {
  return (
    <div className="tea-source-registry">
      {items.map((item, i) => (
        <div className={`tea-source-card ${item.status}`} key={i}>
          <div><b>{item.label}</b><span className={`tag ${item.tagClass}`}>{item.statusLabel}</span></div>
          <p>{item.version}{item.effectiveDate ? ` · hiệu lực ${item.effectiveDate}` : ''} · rà soát {item.reviewedDate}</p>
          <a href={item.url} target="_blank" rel="noopener">Mở nguồn chính thức</a>
        </div>
      ))}
    </div>
  );
}
function TeaRefsTab({ body }: { body: any }) {
  return (
    <>
      <TeaSourceRegistry items={body.sourceItems} />
      <div className="panel rcfg-list tea-ref-panel">
        {body.rows.length ? (
          <table className="tea-ref-table">
            <thead><tr><th>Xét nghiệm</th><th>Đơn vị</th><th>Nhóm</th><th>TEa CLIA %</th><th>TEa Ricos %</th><th>TEa chuẩn hóa %</th><th>Trạng thái</th></tr></thead>
            <tbody>{body.rows.map((row: any) => <TeaRefRow row={{ ...row, canManage: body.canManage }} key={row.analyteId} />)}</tbody>
          </table>
        ) : <EmptyState title={body.empty.title} description={body.empty.description} />}
      </div>
    </>
  );
}

/* ===== Mean/SD theo nhóm lô QC =====
   4 ô số + checkbox mỗi dòng KHÔNG điều khiển (defaultValue/defaultChecked) — giữ nguyên
   data-action="syncTargetRange"/"toggleTargetRow" cũ. syncTargetRange()/toggleTargetRow()/
   targetCheckAll() (manage-tests-actions-controller.ts) chỉ đọc/ghi trực tiếp DOM của CHÍNH
   dòng đó (querySelector trong .target-row), KHÔNG gọi rerender() — nên React không bao giờ
   vẽ lại các input này trong lúc gõ, và giá trị gõ dở không bị bảng điều khiển này ghi đè.
   readTargetMatrixPicks() lúc "Lưu Mean/SD mức này" cũng đọc thẳng DOM, giống hệt trước. */
function TargetRow({ row }: { row: any }) {
  const statusTag = row.status === 'retired'
    ? <b className="tag rej">{row.retiredTo ? `Đã chuyển tiếp qua lô ${row.retiredTo}` : 'Đã chuyển tiếp'}</b>
    : row.status === 'linked' ? <b className="tag ok">Đã gán</b>
      : row.status === 'planned' ? <b className="tag warn">Dự kiến</b>
        : row.status === 'other' ? <b className="tag warn">Đang dùng {row.otherLot || 'lô khác'}</b>
          : <b className="tag none">Chưa gán</b>;
  return (
    <div className={`target-row${row.locked ? ' target-row-locked' : ''}`} data-test={row.testId} data-lot={row.lotId} data-locked={row.locked ? '1' : undefined}>
      <label className="lot-assay-check"><input className="tm-use" type="checkbox" defaultChecked={row.checked} disabled={row.locked} data-action="toggleTargetRow" data-action-on="change" /><span></span></label>
      <div className="lot-assay-name"><b>{row.name}</b><small>{row.unit || 'Chưa có đơn vị'}</small></div>
      <input className="tm-mean" type="number" step="any" defaultValue={row.mean} placeholder="Trung bình" data-action="syncTargetRange" data-args='["target"]' data-action-on="input" disabled={row.disabled} />
      <input className="tm-low" type="number" step="any" defaultValue={row.low} placeholder="Giới hạn dưới" data-action="syncTargetRange" data-args='["limits"]' data-action-on="input" disabled={row.disabled} />
      <input className="tm-high" type="number" step="any" defaultValue={row.high} placeholder="Giới hạn trên" data-action="syncTargetRange" data-args='["limits"]' data-action-on="input" disabled={row.disabled} />
      <input className="tm-sd" type="number" step="any" defaultValue={row.sd} placeholder="Độ lệch chuẩn" data-action="syncTargetRange" data-args='["target"]' data-action-on="input" disabled={row.disabled} />
      <span>{statusTag}</span>
    </div>
  );
}
function TargetPanelSelect({ panelId, panels }: { panelId: string; panels: { id: string; label: string }[] }) {
  const [value, setValue] = useState(panelId);
  useEffect(() => { setValue(panelId); }, [panelId]);
  return (
    <select value={value} onChange={e => { setValue(e.target.value); setTargetPanel(e.target.value); }}>
      {panels.length ? panels.map(p => <option value={p.id} key={p.id}>{p.label}</option>) : <option value="">Chưa có panel</option>}
    </select>
  );
}
function TargetGroupSelect({ groupId, groups }: { groupId: string; groups: { id: string; label: string }[] }) {
  const [value, setValue] = useState(groupId);
  useEffect(() => { setValue(groupId); }, [groupId]);
  return (
    <select value={value} onChange={e => { setValue(e.target.value); setTargetGroup(e.target.value); }}>
      {groups.length ? groups.map(g => <option value={g.id} key={g.id}>{g.label}</option>) : <option value="">Không tìm thấy nhóm lô QC phù hợp</option>}
    </select>
  );
}
function TargetsTab({ body }: { body: any }) {
  if (!body.panels) return <div className="panel"><EmptyState title={body.empty.title} description={body.empty.description} /></div>;
  return (
    <div className="panel target-matrix-panel">
      <div className="target-selector">
        <div><label>Panel QC</label><TargetPanelSelect panelId={body.panelId} panels={body.panels} /></div>
        <div><label>Nhóm lô QC</label><TargetGroupSelect groupId={body.groupId} groups={body.groups} /></div>
      </div>
      {body.stats ? (
        <div className="target-summary">
          <span className="ok"><b>{body.stats.linked}</b> đã gán mức này</span>
          <span className={body.stats.other ? 'warn' : 'none'}><b>{body.stats.other}</b> đang dùng lô khác</span>
          <span className={body.stats.empty ? 'warn' : 'none'}><b>{body.stats.empty}</b> chưa gán lô</span>
          <span className={body.stats.missing ? 'warn' : 'ok'}><b>{body.stats.missing}</b> thiếu Mean/SD</span>
        </div>
      ) : null}
      {body.rows.length ? (
        <>
          <div className="target-level-toolbar">
            <div><b>Mức {body.level}</b><span className="target-level-lot">{body.levelLotNos.join(' / ')}</span></div>
            <div className="dayseg">{body.levels.map((level: number) => <button key={level} className={String(level) === String(body.level) ? 'on' : ''} data-action="setTargetLevel" data-args={`[${level}]`}>Mức {level}</button>)}</div>
          </div>
          <div className="target-table">
            <div className="target-head"><span>Dùng</span><span>Xét nghiệm</span><span>Trung bình mục tiêu</span><span>Giới hạn dưới</span><span>Giới hạn trên</span><span>Độ lệch chuẩn</span><span>Trạng thái</span></div>
            {body.rows.map((row: any) => <TargetRow row={row} key={`${row.testId}:${row.lotId}`} />)}
          </div>
          <div className="modal-f target-actions">
            <button className="btn ghost" data-action="targetCheckAll" data-args="[false]">Bỏ chọn tất cả</button>
            <button className="btn ghost" data-action="targetCheckAll" data-args="[true]">Chọn tất cả</button>
            <button className="btn teal" data-action="saveTargetMatrix">Lưu Mean/SD mức này</button>
          </div>
        </>
      ) : <EmptyState title={body.empty.title} description={body.empty.description} />}
    </div>
  );
}

const TAB_COMPONENTS: Record<string, (props: { body: any }) => any> = {
  instruments: InstrumentsTab, assays: AssaysTab, panels: PanelsTab, lots: LotsTab,
  transitions: TransitionsTab, history: HistoryTab, tearefs: TeaRefsTab, targets: TargetsTab,
};

export function ManagePage() {
  useAppStore();
  const model = manageModel();
  const TabBody = TAB_COMPONENTS[model.tab];
  return (
    <>
      <Head />
      <div className="config-shell">
        <ShellNav tabs={model.tabs} active={model.tab} />
        <section className="config-shell-main">
          <Toolbar toolbar={model.body.toolbar} query={model.query} searchPlaceholder={model.searchPlaceholder} />
          <TabBody body={model.body} />
        </section>
      </div>
    </>
  );
}
