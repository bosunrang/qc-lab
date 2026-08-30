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
  afterRender: (page: string) => void;
  entryQ: () => string;
  entryFilter: (value: string) => void;
  isReactPage: (id: string) => boolean;
  mountReactPage: (id: string, container: HTMLElement) => void;
  notifyReactStore: () => void;
  pushUrl: (id: string) => void;
}) {
  const resetMainScroll = () => {
    const m = deps.document.querySelector('main');
    if (m) (m as HTMLElement).scrollTop = 0;
    deps.window.scrollTo(0, 0);
  };
  /* Mọi trang hợp lệ (xem router-page-policy.ts's ROUTER_PAGE_DEFS) đều đã chuyển
     sang React (Entry — trang cuối cùng — xong 2026-08-30) nên isReactPage() luôn
     đúng cho một id thật; nhánh HTML cổ điển (pageMap()/unmountReactPageIfMounted())
     đã bị xoá cùng lúc. Chỉ còn dự phòng cho một id LẠ (ví dụ RouterUIState.page bị
     hỏng dữ liệu) — lùi về 'dash' thay vì crash vào mountReactPage(id) với id không
     tồn tại trong registry (mountReactPage tự no-op khi factory không có, xem
     react-page-registry.ts, nhưng khi đó #main sẽ trống trơn không có gì hiển thị). */
  const render = () => {
    deps.resetStatusMemo();
    if (!deps.canAccessPage(deps.page())) deps.setPage(deps.firstAccessPage());
    const m = deps.document.getElementById('main');
    if (!m) return;
    const id = deps.page();
    deps.mountReactPage(deps.isReactPage(id) ? id : 'dash', m);
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
  /* activate() là phần chung giữa go() (điều hướng từ trong app — bấm nút/
     nav sidebar) và goFromHistory() (điều hướng do trình duyệt tự gây ra —
     bấm nút Back/Forward, tức sự kiện popstate): cả hai đều phải setPage/
     vẽ lại/focus #main giống hệt nhau, chỉ khác ở việc CÓ đẩy thêm một mục
     lịch sử mới (pushUrl) hay không — popstate nghĩa là trình duyệt ĐÃ tự
     thay đổi lịch sử rồi, gọi pushUrl lần nữa sẽ tạo một mục lịch sử thừa,
     làm nút Back phải bấm hai lần mới lùi được một trang. */
  const activate = (p: string) => {
    deps.setPage(p);
    deps.nav();
    rerender();
    resetMainScroll();
    deps.requestFrame(() => { const main = deps.document.getElementById('main'); if (main) (main as HTMLElement).focus({ preventScroll: true }); });
  };
  const go = (p: string) => {
    if (!deps.canAccessPage(p)) return;
    deps.pushUrl(p);
    activate(p);
  };
  const goFromHistory = (p: string) => {
    if (!deps.canAccessPage(p)) return;
    activate(p);
  };
  return { go, goFromHistory, resetMainScroll, render, restoreRouteFilters, rerender };
}
