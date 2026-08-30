import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAppStore } from '../state/kernel';
import {
  dashboardModel, dashboardHeadHtml, testDisplayName, vnDate, fmtPointValue, fmt,
  dashTestSetStatus, setDashTestQuery, normalizeSearchText, levelTargetOk,
  type DashboardModel,
} from '../bridge/dashboardBridge';

const STATUS_TABS: ReadonlyArray<readonly [string, string]> = [
  ['all', 'Tất cả'], ['missing', 'Chưa QC'], ['rej', 'Loại bỏ'], ['warn', 'Cảnh báo'], ['ok', 'Đạt'],
];

function Head({ lab }: { lab: any }) {
  /* dashboardHeadHtml() dựng cả top-user/avatar (đã có modal riêng ở
     avatar-modal-controller.ts) — chưa cần port sang JSX cho bản thí điểm này,
     nên tái dùng nguyên HTML đã có. display:contents để div bọc ngoài không
     sinh thêm hộp trong layout flex của .head. */
  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: dashboardHeadHtml(lab) }} />;
}

function WestgardTag({ status }: { status: string }) {
  if (status === 'rej') return <span className="tag rej">Loại bỏ</span>;
  if (status === 'warn') return <span className="tag warn">Cảnh báo</span>;
  if (status === 'ok') return <span className="tag ok">Đạt</span>;
  return <span className="pill">chưa có</span>;
}

function TodayTag({ count, total }: { count: number; total: number }) {
  if (count >= total && total) return <span className="tag ok">Đủ hôm nay</span>;
  if (count) return <span className="tag warn">{count}/{total} mức</span>;
  return <span className="tag none">Chưa QC</span>;
}

function LevelPill({ item }: { item: any }) {
  const targetOk = levelTargetOk(item.l);
  const cv = item.st ? item.st.cv : null;
  const className = `dash-level-pill${item.todayLevel ? ' done' : ''}${targetOk ? '' : ' missing-target'}`;
  return (
    <span className={className} title={targetOk ? undefined : 'Chưa có Mean/SD hợp lệ — không đánh giá Westgard'}>
      M{String(item.l.level)}{item.l.lot ? ` · ${item.l.lot}` : ''}{cv != null ? ` · CV ${fmt(cv)}%` : ''}{targetOk ? '' : ' · thiếu Mean/SD'}
    </span>
  );
}

function ShiftItem({ tone, title, meta, action }: { tone: 'rej' | 'warn'; title: ReactNode; meta: ReactNode; action: ReactNode }) {
  return (
    <div className={`shift-item ${tone}`}>
      <div><b>{title}</b><div className="meta">{meta}</div></div>
      {action}
    </div>
  );
}

function FollowupPanel({ model }: { model: Extract<DashboardModel, { loading: false }> }) {
  const urgent = model.urgent.slice(0, 5);
  const watch = model.watch.slice(0, 4);
  const overdue = model.overdue.slice(0, 4);
  const noTarget = model.noTarget.slice(0, 4);
  const hasAny = urgent.length || overdue.length || noTarget.length || watch.length;
  if (!hasAny) return <div className="alert ok">Không có điểm bị loại/cảnh báo cần xử lý ngay.</div>;
  return (
    <div className="dash-list">
      {urgent.map((item: any, i: number) => (
        <ShiftItem key={`u${i}`} tone="rej"
          title={<>{testDisplayName(item.t)} · M{String(item.l.level)}</>}
          meta={<>{vnDate(item.p.date)} · {fmtPointValue(item.p, item.t)} {item.t.unit || ''} · {item.rules.join(', ') || '—'}</>}
          action={<button className="btn ghost sm" data-action="dashboardGoEntryFollowup" data-args={JSON.stringify([item.t.id, item.l.level])}>Xem</button>} />
      ))}
      {overdue.map((item: any) => {
        const test = model.stateTests.find((t: any) => t.id === item.action.testId);
        const title = test ? testDisplayName(test) : (item.action.rule || 'Sự cố');
        return (
          <ShiftItem key={`o${item.index}`} tone="rej"
            title={<>{item.action.nceId || 'Hồ sơ khắc phục'} · {title}</>}
            meta={<>{item.info.label} · hạn {vnDate(item.action.dueDate)} · phụ trách {item.action.by || '—'}</>}
            action={<button className="btn ghost sm" data-action="dashboardContinueAction" data-args={JSON.stringify([item.index])}>Tiếp tục hồ sơ</button>} />
        );
      })}
      {noTarget.map((item: any, i: number) => (
        <ShiftItem key={`m${i}`} tone="warn"
          title={<>{testDisplayName(item.t)} · M{String(item.l.level)}</>}
          meta="Chưa có Mean/SD hợp lệ — điểm QC mức này không được đánh giá Westgard"
          action={<button className="btn ghost sm" data-action="goManageTargets">Gán Mean/SD</button>} />
      ))}
      {watch.map((item: any, i: number) => (
        <ShiftItem key={`w${i}`} tone="warn"
          title={<>{testDisplayName(item.t)} · M{String(item.l.level)}</>}
          meta={<>{vnDate(item.p.date)} · {fmtPointValue(item.p, item.t)} {item.t.unit || ''} · {item.rules.join(', ') || '—'}</>}
          action={<button className="btn ghost sm" data-action="dashboardGoEntryFollowup" data-args={JSON.stringify([item.t.id, item.l.level])}>Xem</button>} />
      ))}
    </div>
  );
}

function ExpiringLots({ lots }: { lots: any[] }) {
  const rows = [...lots].sort((a, b) => a.d - b.d).slice(0, 5);
  if (!rows.length) return <div className="hint">Không có lô sắp hết hạn trong 30 ngày.</div>;
  return (
    <>
      {rows.map((item, i) => {
        const expired = item.d < 0;
        const state = expired ? 'rej' : 'warn';
        const meta = item.count > 1 ? `${item.count} xét nghiệm · ` : '';
        const remaining = expired ? `Hết hạn ${-item.d} ngày` : `Còn ${item.d} ngày`;
        return (
          <div className={`shift-item ${state}`} key={i}>
            <div><b>Lô {item.l.lot || '?'} · M{String(item.l.level)}</b><div className="meta">{meta}{remaining}</div></div>
            <span className={`tag ${state}`}>{expired ? 'Hết hạn' : 'Sắp hết'}</span>
          </div>
        );
      })}
    </>
  );
}

function TestRow({ item }: { item: any }) {
  const levels: any[] = item.levelData.map((x: any) => x.l);
  return (
    <tr className={item.s}>
      <td><div className="dash-test-name">{testDisplayName(item.t)}</div><div className="dash-test-sub">{item.t.machine || 'Chưa gán máy'}</div></td>
      <td><div className="dash-level-list">{item.levelData.map((x: any, i: number) => <LevelPill item={x} key={i} />)}</div></td>
      <td><TodayTag count={item.todayCount} total={levels.length} /></td>
      <td className="num"><b>{item.totalPoints}</b></td>
      <td><WestgardTag status={item.s} /></td>
      <td><span className="dash-latest">{item.latest ? <>{vnDate(item.latest.date)} · M{item.latest._level} · {fmtPointValue(item.latest, item.t)}</> : 'Chưa có điểm'}</span></td>
      <td><button className="btn ghost sm" data-action="dashViewTestInEntry" data-args={JSON.stringify([item.t.id, Number(levels[0].level)])}>Xem QC</button></td>
    </tr>
  );
}

function TestsPanel({ model }: { model: Extract<DashboardModel, { loading: false }> }) {
  const [query, setQuery] = useState(model.query || '');

  useEffect(() => { setDashTestQuery(query); }, [query]);

  const statusItems = useMemo(() => model.dashItems.filter((item: any) => {
    if (model.dashTestStatus === 'all') return true;
    if (model.dashTestStatus === 'missing') return item.missingToday;
    return item.s === model.dashTestStatus;
  }), [model.dashItems, model.dashTestStatus]);

  const visibleItems = useMemo(() => {
    const q = normalizeSearchText(query);
    if (!q) return statusItems;
    return statusItems.filter((item: any) => item.search.includes(q));
  }, [statusItems, query]);

  const sortedItems = useMemo(() => {
    const rank = (status: string, todayCount: number, levelCount: number) => {
      if (status === 'rej') return 0;
      if (status === 'warn') return 1;
      if (todayCount < levelCount) return 2;
      if (status === 'ok') return 3;
      return 4;
    };
    return [...visibleItems].sort((a: any, b: any) =>
      rank(a.s, a.todayCount, a.levelData.length) - rank(b.s, b.todayCount, b.levelData.length)
      || String(a.t.name || '').localeCompare(String(b.t.name || ''), 'vi'));
  }, [visibleItems]);

  if (!model.tests.length) {
    return (
      <div className="panel">
        <div className="empty">
          <div className="empty-title">Chưa có xét nghiệm đang vận hành</div>
          <div>Cần đưa xét nghiệm vào Panel QC, ghép Nhóm lô QC và gán Mean/SD trước khi theo dõi.</div>
          {model.isAdmin && <div className="empty-actions"><button className="btn teal" data-action="goManageTargets">Cấu hình Mean/SD</button></div>}
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="dash-test-toolbar"><h2 className="panel-title">Danh sách xét nghiệm</h2></div>
      <div className="dash-test-filterbar">
        <div className="dash-test-tabs">
          {STATUS_TABS.map(([key, label]) => {
            const count = key === 'all' ? model.dashItems.length : model.dashItems.filter((item: any) => key === 'missing' ? item.missingToday : item.s === key).length;
            return (
              <button key={key} className={model.dashTestStatus === key ? 'on' : ''} data-action="dashTestSetStatus" data-args={JSON.stringify([key])}>
                {label}<b>{count}</b>
              </button>
            );
          })}
        </div>
        <div className="dash-test-search">
          <input type="search" placeholder="Tìm xét nghiệm, máy, lô..." value={query} onChange={e => setQuery(e.target.value)} aria-label="Tìm xét nghiệm" />
          <span>{sortedItems.length}/{statusItems.length}</span>
        </div>
      </div>
      {sortedItems.length ? (
        <div className="dash-test-list">
          <table>
            <thead><tr><th>Xét nghiệm</th><th>Mức QC / lô</th><th>QC hôm nay</th><th className="num">Tổng điểm</th><th>Westgard</th><th>Gần nhất</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
            <tbody>{sortedItems.map((item: any) => <TestRow item={item} key={item.t.id} />)}</tbody>
          </table>
        </div>
      ) : <div className="dash-test-empty">Không tìm thấy xét nghiệm phù hợp.</div>}
    </div>
  );
}

function LoadingView({ model }: { model: Extract<DashboardModel, { loading: true }> }) {
  const points = model.tests.reduce((sum: number, t: any) => sum + (model.data[t.id] || []).length, 0);
  const kpis = [
    { label: 'Xét nghiệm', value: model.tests.length },
    { label: 'Điểm QC', value: points },
    { label: 'Đang xử lý', value: model.pending },
    { label: 'Giao diện', value: '✓', className: 'dash-ready-mark' },
  ];
  return (
    <>
      <Head lab={model.lab} />
      <div className="dash-hero dash-analysis-loading">
        <div className="dash-status">
          <div className="eyebrow">Đang chuẩn bị dữ liệu</div>
          <h2>Phân tích Westgard chạy nền</h2>
          <p>Bạn có thể tiếp tục sử dụng ứng dụng. Tổng quan sẽ tự cập nhật khi phân tích hoàn tất.</p>
          <div className="dash-loading-bar"><span /></div>
        </div>
        <div className="dash-kpis">
          {kpis.map(k => <div className="dash-kpi" key={k.label}><div className="k">{k.label}</div><div className={`v${k.className ? ` ${k.className}` : ''}`}>{k.value}</div></div>)}
        </div>
      </div>
      <div className="panel dash-loading-panel">
        <div className="dash-spinner" />
        <div><h2 className="panel-title">Đang tính trạng thái kiểm soát chất lượng</h2><p className="hint">Công việc nặng đã được chuyển khỏi luồng giao diện để thao tác không bị đóng băng.</p></div>
      </div>
    </>
  );
}

export function DashboardPage() {
  useAppStore();
  const model = dashboardModel();

  if (model.loading) return <LoadingView model={model} />;

  const kpiItems = [
    { label: 'Xét nghiệm', value: model.tests.length },
    { label: 'Điểm QC', value: model.kpi.totalPoints },
    { label: 'Vi phạm', value: model.kpi.rejected, color: 'var(--red)' },
    { label: 'QC hôm nay', value: model.kpi.todayPoints, color: 'var(--teal)' },
  ];
  const safePercent = Math.max(0, Math.min(100, Number.isFinite(model.kpi.completionPercent) ? model.kpi.completionPercent : 0));

  return (
    <>
      <Head lab={model.lab} />
      <div className="dash-hero">
        <div className="dash-status">
          <div className="eyebrow">Trạng thái trực ca · {model.todayText}</div>
          <h2>{model.mood}</h2>
          <p>{model.moodText}</p>
          <div className="dash-progress"><span style={{ width: `${safePercent}%` }} /></div>
          <div className="hint flow-item">{model.kpi.completeTests}/{model.tests.length || 0} xét nghiệm đã đủ QC hôm nay · {safePercent}% hoàn tất</div>
        </div>
        <div className="dash-kpis">
          {kpiItems.map(k => <div className="dash-kpi" key={k.label}><div className="k">{k.label}</div><div className="v" style={k.color ? { color: k.color } : undefined}>{k.value}</div></div>)}
        </div>
      </div>
      <div className="dash-main">
        <div className="panel"><h2 className="panel-title">Cần xử lý / Theo dõi</h2><FollowupPanel model={model} /></div>
        <div className="panel"><h2 className="panel-title">Lô &amp; hạn dùng</h2><div className="dash-list"><ExpiringLots lots={model.expiringLots} /></div></div>
      </div>
      <TestsPanel model={model} />
    </>
  );
}
