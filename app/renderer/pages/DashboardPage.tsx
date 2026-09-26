// Tổng quan Clinical Precision. Phần TÍNH TOÁN nằm ở
// `view-models/dashboard-view-model.ts` (đọc ghi chú
// đầu file đó: báo động theo ĐIỂM CUỐI, 1 dòng cho mỗi MỨC, % hoàn tất theo
// XÉT NGHIỆM) — file này chỉ dựng JSX.
import { useEffect, useMemo, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SUMMARY_TABLES } from '../lib/useCatalog';
import { Link, useNavigate } from 'react-router-dom';
import { useDashboardStore, type OverdueAction } from '../store/dashboard-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { useSettingsStore } from '../store/settings-store';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import {
  buildDashboardViewModel, normalizeDashboardSearch, levelTargetOk, dashboardTestRank,
  type DashboardStatus, type DashboardTestItem, type DashboardAlertItem,
} from '../view-models/dashboard-view-model';
import { useAuthStore } from '../store/auth-store';
import { isAdmin } from '../lib/permissions';

// Kiểu read-model đã gắn sẵn hồ sơ NCE của store (`OverdueAction` = NceRecord
// + `testName` đã join) — `ReturnType<typeof f>` trần sẽ suy generic về đúng
// ràng buộc `NceRecord` và làm mất `testName`.
type Model = ReturnType<typeof buildDashboardViewModel<OverdueAction>>;

const STATUS_TABS: ReadonlyArray<readonly ['all' | 'missing' | DashboardStatus, string]> = [
  ['all', 'Tất cả'], ['missing', 'Chưa QC'], ['rej', 'Loại bỏ'], ['warn', 'Cảnh báo'], ['ok', 'Đạt'],
];

function todayIso(): string {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Ngày ISO → `dd/mm/yyyy`; trống thì hiện "—". */
function dateText(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || '—';
}

/** Giá trị điểm QC theo số thập phân của xét nghiệm. */
function pointValue(val: number, decimalPlaces: number): string {
  return val.toFixed(decimalPlaces);
}

/** Số làm tròn 2 chữ số thập phân. */
function num2(value: number): string {
  return value.toFixed(2);
}

function WestgardTag({ status }: { status: DashboardStatus }) {
  if (status === 'rej') return <span className="tag rej">Loại bỏ</span>;
  if (status === 'warn') return <span className="tag warn">Cảnh báo</span>;
  return <span className="tag ok">Đạt</span>;
}

function TodayTag({ count, total }: { count: number; total: number }) {
  if (count >= total && total) return <span className="tag ok">Đủ hôm nay</span>;
  if (count) return <span className="tag warn">{count}/{total} mức</span>;
  return <span className="tag none">Chưa QC</span>;
}

function ShiftItem({ tone, title, meta, action }: { tone: 'rej' | 'warn'; title: ReactNode; meta: ReactNode; action: ReactNode }) {
  return (
    <div className={`shift-item ${tone}`}>
      <div><b>{title}</b><div className="meta">{meta}</div></div>
      {action}
    </div>
  );
}

/** Nhãn + meta của 1 mức đang báo động — dùng chung cho nhóm "loại bỏ" và
 * nhóm "cảnh báo", để hai nhóm cùng một cặp title/meta. */
function alertMeta(item: DashboardAlertItem) {
  return <>{dateText(item.point.date)} · {pointValue(item.point.val, item.test.decimalPlaces)} {item.test.unit || ''} · {item.rules.join(', ') || '—'}</>;
}

function FollowupPanel({ model }: { model: Model }) {
  const navigate = useNavigate();
  const urgent = model.urgent.slice(0, 5), watch = model.watch.slice(0, 4);
  const overdue = model.overdueActions.slice(0, 4), noTarget = model.noTarget.slice(0, 4);
  if (!urgent.length && !watch.length && !overdue.length && !noTarget.length) {
    return <div className="alert ok">Không có điểm bị loại/cảnh báo cần xử lý ngay.</div>;
  }
  return (
    <div className="dash-list">
      {urgent.map((item) => (
        <ShiftItem key={`u${item.key}`} tone="rej"
          title={<>{item.test.testName} · M{item.level.level}</>}
          meta={alertMeta(item)}
          action={<button className="btn ghost sm" onClick={() => navigate('/entry', { state: { testId: item.test.testId, level: item.level.level } })}>Xem</button>} />
      ))}
      {overdue.map((record) => (
        <ShiftItem key={`o${record.id}`} tone="rej"
          title={<>{record.nce_id || 'Hồ sơ khắc phục'} · {record.testName || record.rule || 'Sự cố'}</>}
          meta={<>{record.overdueLabel} · hạn {dateText(record.due_date)} · phụ trách {record.owner || '—'}</>}
          action={<button className="btn ghost sm" onClick={() => navigate('/actions', { state: { recordId: record.id } })}>Tiếp tục hồ sơ</button>} />
      ))}
      {noTarget.map((item) => (
        <ShiftItem key={`m${item.key}`} tone="warn"
          title={<>{item.test.testName} · M{item.level.level}</>}
          meta="Chưa có Mean/SD hợp lệ — điểm QC mức này không được đánh giá Westgard"
          action={<button className="btn ghost sm" onClick={() => navigate('/manage', { state: { tab: 'targets' } })}>Gán Mean/SD</button>} />
      ))}
      {watch.map((item) => (
        <ShiftItem key={`w${item.key}`} tone="warn"
          title={<>{item.test.testName} · M{item.level.level}</>}
          meta={alertMeta(item)}
          action={<button className="btn ghost sm" onClick={() => navigate('/entry', { state: { testId: item.test.testId, level: item.level.level } })}>Xem</button>} />
      ))}
    </div>
  );
}

function ExpiringLots({ model }: { model: Model }) {
  const rows = model.expiringLots.slice(0, 5);
  if (!rows.length) return <div className="hint">Không có lô sắp hết hạn trong 30 ngày.</div>;
  return <>{rows.map((item) => {
    const expired = item.days < 0, state = expired ? 'rej' : 'warn';
    const meta = item.count > 1 ? `${item.count} xét nghiệm · ` : '';
    const remaining = expired ? `Hết hạn ${-item.days} ngày` : `Còn ${item.days} ngày`;
    return (
      <div className={`shift-item ${state}`} key={item.key}>
        <div><b>Lô {item.lot || '?'} · M{item.level}</b><div className="meta">{meta}{remaining}</div></div>
        <span className={`tag ${state}`}>{expired ? 'Hết hạn' : 'Sắp hết'}</span>
      </div>
    );
  })}</>;
}

function LevelPill({ level }: { level: DashboardTestItem['levels'][number] }) {
  const targetOk = levelTargetOk(level);
  return (
    // Thiếu Mean/SD là cảnh báo và thắng trạng thái "đã nhập hôm nay", đúng
    // thứ tự ưu tiên của hai lớp cũ `.done`/`.missing-target`.
    <span className={`tag ${!targetOk ? 'warn' : level.todayPointCount ? 'ok' : 'none'}`}
      title={targetOk ? undefined : 'Chưa có Mean/SD hợp lệ — không đánh giá Westgard'}>
      M{level.level}{level.lot ? ` · ${level.lot}` : ''}{level.cv != null ? ` · CV ${num2(level.cv)}%` : ''}{targetOk ? '' : ' · thiếu Mean/SD'}
    </span>
  );
}

function TestRow({ test }: { test: DashboardTestItem }) {
  const navigate = useNavigate();
  return (
    <tr className={test.status}>
      <td><div className="dash-test-name">{test.testName}</div><div className="dash-test-sub">{test.instrumentName || 'Chưa gán máy'}</div></td>
      <td><div className="dash-level-list">{test.levels.map((level) => <LevelPill key={level.level} level={level} />)}</div></td>
      <td><TodayTag count={test.todayCount} total={test.levels.length} /></td>
      <td className="num"><b>{test.totalPoints}</b></td>
      <td><WestgardTag status={test.status} /></td>
      <td><span className="dash-latest">{test.latest ? <>{dateText(test.latest.date)} · M{test.latest.level} · {pointValue(test.latest.val, test.decimalPlaces)}</> : 'Chưa có điểm'}</span></td>
      <td><button className="btn ghost sm" onClick={() => navigate('/entry', { state: { testId: test.testId, level: test.levels[0]?.level } })}>Xem QC</button></td>
    </tr>
  );
}

function TestsPanel({ model }: { model: Model }) {
  const { query, status, setQuery, setStatus } = useDashboardStore(useShallow((s) => ({ query: s.query, status: s.status, setQuery: s.setQuery, setStatus: s.setStatus })));
  const admin = isAdmin(useAuthStore((state) => state.user)?.role);
  const visible = useMemo(() => {
    const normalized = normalizeDashboardSearch(query);
    return model.tests.filter(test => (status === 'all' || (status === 'missing' ? test.missingToday : test.status === status)) && (!normalized || test.search.includes(normalized)))
      .sort((a, b) => dashboardTestRank(a) - dashboardTestRank(b) || a.testName.localeCompare(b.testName, 'vi'));
  }, [model.tests, query, status]);
  if (!model.tests.length) {
    return <div className="panel"><EmptyState title="Chưa có xét nghiệm đang vận hành" action={admin && <Link className="btn teal" to="/manage" state={{ tab: 'targets' }}>Cấu hình Mean/SD</Link>}>Cần đưa xét nghiệm vào Panel QC, ghép Nhóm lô QC và gán Mean/SD trước khi theo dõi.</EmptyState></div>;
  }
  return <div className="panel"><div className="dash-test-toolbar"><h2 className="panel-title">Danh sách xét nghiệm</h2></div><div className="dash-test-filterbar">
    <div className="dash-test-tabs">{STATUS_TABS.map(([key, label]) => { const count = key === 'all' ? model.tests.length : model.tests.filter(test => key === 'missing' ? test.missingToday : test.status === key).length; return <button type="button" key={key} className={status === key ? 'on' : ''} onClick={() => setStatus(key)}>{label}<b className="count">{count}</b></button>; })}</div>
    <div className="dash-test-search"><input type="search" placeholder="Tìm xét nghiệm, máy, lô..." value={query} onChange={event => setQuery(event.target.value)} aria-label="Tìm xét nghiệm" /><span>{visible.length}/{model.tests.length}</span></div>
  </div>{visible.length ? <div className="dash-test-list"><table className="dash-test-table"><colgroup><col className="dash-col-test" /><col className="dash-col-levels" /><col className="dash-col-today" /><col className="dash-col-points" /><col className="dash-col-westgard" /><col className="dash-col-latest" /><col className="dash-col-actions" /></colgroup><thead><tr><th>Xét nghiệm</th><th>Mức QC / lô</th><th>QC hôm nay</th><th className="num">Tổng điểm</th><th>Westgard</th><th>Gần nhất</th><th><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{visible.map(test => <TestRow test={test} key={test.testId} />)}</tbody></table></div> : <div className="dash-test-empty" role="status"><span className="dash-test-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4 4" /></svg></span><div><b>Không tìm thấy xét nghiệm phù hợp</b></div></div>}</div>;
}

function LoadingView({ subtitle }: { subtitle: string }) {
  return <><PageHeader title="Tổng quan" subtitle={subtitle} /><div className="dash-hero"><div className="dash-status"><div className="eyebrow">Đang chuẩn bị dữ liệu</div><h2>Phân tích Westgard chạy nền</h2><p>Bạn có thể tiếp tục sử dụng ứng dụng. Tổng quan sẽ tự cập nhật khi phân tích hoàn tất.</p><div className="dash-loading-bar"><span /></div></div><div className="dash-kpis">{['Xét nghiệm', 'Điểm QC', 'Đang xử lý', 'Giao diện'].map(label => <div className="dash-kpi" key={label}><div className="k">{label}</div><div className="v">—</div></div>)}</div></div></>;
}

export function DashboardPage() {
  const { testSummaries, overdueActions, lots, loading, error, load } = useDashboardStore(useShallow((s) => ({ testSummaries: s.testSummaries, overdueActions: s.overdueActions, lots: s.lots, loading: s.loading, error: s.error, load: s.load })));
  const { profile, load: loadProfile } = useSettingsStore(useShallow((s) => ({ profile: s.profile, load: s.load })));
  useEffect(() => { load(); loadProfile(); }, [load, loadProfile]);
  // Liệt kê đúng các bảng mà Tổng quan hiển thị hoặc dùng để đánh giá
  // Westgard (Mean/SD, lô, nhóm lô, Panel, luật chung trong `app_meta`, mốc
  // khắc phục trong `actions`). Không nghe `activity`: bảng đó đổi sau MỌI
  // thao tác ghi, kể cả đổi ảnh đại diện, và mỗi lần nạp lại là một lượt tính
  // Westgard cho mọi xét nghiệm trên máy chính.
  useStoreInvalidation(SUMMARY_TABLES, undefined, load);
  const subtitle = (profile?.name || 'Khoa Xét nghiệm') + (profile?.dept ? ` · ${profile.dept}` : '');
  if (error) return <><PageHeader title="Tổng quan" subtitle={subtitle} /><div className="panel"><EmptyState title="Không tải được Tổng quan" action={<button type="button" className="btn teal" onClick={() => { void load(); }}>Thử lại</button>}>Dữ liệu đã lưu không bị ảnh hưởng. Nội dung lỗi: {error}</EmptyState></div></>;
  if (loading) return <LoadingView subtitle={subtitle} />;
  const today = todayIso(), model = buildDashboardViewModel(testSummaries, lots, overdueActions, today);
  // Kẹp 0..100 trước khi vẽ thanh tiến độ.
  const safePercent = Math.max(0, Math.min(100, Number.isFinite(model.kpi.completionPercent) ? model.kpi.completionPercent : 0));
  return <><PageHeader title="Tổng quan" subtitle={subtitle} /><div className="dash-hero"><div className="dash-status"><div className="eyebrow">Trạng thái trực ca · {dateText(today)}</div><h2>{model.mood}</h2><p>{model.moodText}</p><div className="dash-progress"><span style={{ width: `${safePercent}%` }} /></div><div className="hint flow-item">{model.kpi.completeTests}/{model.tests.length || 0} xét nghiệm đã đủ QC hôm nay · {safePercent}% hoàn tất</div></div><div className="dash-kpis">{[
    ['Xét nghiệm', model.tests.length, ''], ['Điểm QC', model.kpi.totalPoints, ''], ['Vi phạm', model.kpi.rejected, 'danger'], ['QC hôm nay', model.kpi.todayPoints, 'teal'],
  ].map(([label, value, tone]) => <div className="dash-kpi" key={String(label)}><div className="k">{label}</div><div className={`v ${tone}`}>{value}</div></div>)}</div></div><div className="dash-main"><div className="panel"><h2 className="panel-title">Cần xử lý / Theo dõi</h2><FollowupPanel model={model} /></div><div className="panel"><h2 className="panel-title">Lô &amp; hạn dùng</h2><div className="dash-list"><ExpiringLots model={model} /></div></div></div><TestsPanel model={model} /></>;
}


