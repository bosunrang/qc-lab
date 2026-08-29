export function createRouterDispatchController(deps: {
  document: Document;
  window: { scrollTo: (x: number, y: number) => void };
  canAccessPage: (id: string) => boolean;
  firstAccessPage: () => string;
  page: () => string;
  setPage: (id: string) => void;
  nav: () => void;
  requestFrame: (work: () => void) => unknown;
  resetStatusMemo: () => void;
  pageMap: () => Record<string, () => string>;
  afterRender: (page: string) => void;
  entryQ: () => string;
  entryFilter: (value: string) => void;
  isReactPage: (id: string) => boolean;
  mountReactPage: (id: string, container: HTMLElement) => void;
  unmountReactPageIfMounted: () => void;
  notifyReactStore: () => void;
}) {
  const resetMainScroll = () => {
    const m = deps.document.querySelector('main');
    if (m) (m as HTMLElement).scrollTop = 0;
    deps.window.scrollTo(0, 0);
  };
  const render = () => {
    deps.resetStatusMemo();
    if (!deps.canAccessPage(deps.page())) deps.setPage(deps.firstAccessPage());
    const m = deps.document.getElementById('main');
    if (!m) return;
    const id = deps.page();
    if (deps.isReactPage(id)) { deps.mountReactPage(id, m); return; }
    deps.unmountReactPageIfMounted();
    const map = deps.pageMap();
    // 'dash' (Tổng quan) không còn nằm trong pageMap() — nó luôn được isReactPage()
    // bắt ở nhánh trên. Dự phòng cho id lạ lùi về 'entry' thay vì 'dash'.
    m.innerHTML = (map[id] || map.entry)();
  };
  /* Trang 'dash' (Tổng quan) đã chuyển sang React (xem isReactPage/mountReactPage
     ở trên) — component tự đọc lại ô tìm kiếm lúc mount, không cần dòng gọi
     dashTestFilter() kiểu DOM cũ ở đây nữa (xem src/react/pages/DashboardPage.tsx). */
  const restoreRouteFilters = () => {
    if (deps.page() === 'entry' && deps.entryQ()) deps.entryFilter(deps.entryQ());
  };
  /* render() gán lại #main.innerHTML nên scrollTop của <main> về 0 mỗi lần. Khi vẽ
     lại CÙNG một trang (vd Firebase dội bản đồng bộ về gọi rerender(), hoặc sau một
     thao tác sửa dữ liệu), giữ nguyên vị trí cuộn để trang không "nhảy" về đầu —
     trước đây trang Sigma bị giật do save() lúc render kéo theo rerender. Đổi trang
     đi qua go(), vốn tự gọi resetMainScroll() SAU rerender() nên vẫn reset đúng. */
  const rerender = () => {
    const m = deps.document.getElementById('main'), keepScroll = m ? m.scrollTop : 0;
    render();
    deps.afterRender(deps.page());
    restoreRouteFilters();
    if (m && keepScroll) m.scrollTop = keepScroll;
    deps.notifyReactStore();
  };
  const go = (p: string) => {
    if (!deps.canAccessPage(p)) return;
    deps.setPage(p);
    deps.nav();
    rerender();
    resetMainScroll();
    deps.requestFrame(() => { const main = deps.document.getElementById('main'); if (main) (main as HTMLElement).focus({ preventScroll: true }); });
  };
  return { go, resetMainScroll, render, restoreRouteFilters, rerender };
}
