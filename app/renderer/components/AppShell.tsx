// Khung Clinical Precision: brand, ba nhóm điều hướng và footer vận hành nằm
// trong sidebar tối. PageHeader được từng route dựng ở đầu nội dung để
// sticky theo đúng vùng cuộn của trang, còn AppShell chỉ sở hữu navigation.
//
// Ẩn/hiện mục điều hướng theo vai trò CHỈ LÀ HIỂN THỊ. Bảng vai trò theo
// trang không còn ở đây — đã gom về lib/permissions.ts (PAGE_DEFS) để
// sidebar và route dùng CÙNG một bảng; chặn truy cập thật theo route nằm ở
// router.tsx, chặn ghi thật nằm ở main. Quyền theo từng người dùng
// (`pagePerms`) được tính cùng bảng đó qua `canUserAccessPage()`.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { PageErrorBoundary } from './ErrorBoundary';
import { useAuthStore } from '../store/auth-store';
import { useSettingsStore } from '../store/settings-store';
import { canUserAccessPage, pageById, type PageDef } from '../lib/permissions';
import { ToastHost } from './ToastHost';
import { DatePickerPopup } from './DatePickerPopup';
import { NavIcon } from './NavIcon';
import { SoftwareLicenseFooter } from './SoftwareLicenseExpiry';
import { BrandIdentity } from './BrandIdentity';

// Cấu trúc nhóm điều hướng; nhãn/route/vai trò đọc từ PAGE_DEFS, không khai lại.
const NAV_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Theo dõi', ids: ['dash', 'entry', 'westgard', 'sigma'] },
  { label: 'Vận hành', ids: ['reagent', 'eqa', 'actions', 'report'] },
  { label: 'Quản trị', ids: ['manage', 'users', 'audit', 'settings'] },
];

const COLLAPSE_KEY = 'qclab-nav-collapsed';

/** Ở cửa sổ hẹp, `app.css` TỰ thu sidebar về dạng chỉ icon bằng CSS
 * (`@media(max-width:1050px)` ẩn `.nav-label`), trong khi cờ `collapsed`
 * chỉ biết người dùng có bấm nút thu gọn hay không. Theo dõi đúng truy vấn
 * đó để mục điều hướng vẫn có `title`/`aria-label` khi chữ bị ẩn —
 * `display:none` cũng gỡ chữ khỏi cây truy cập, link sẽ không còn tên. Giữ
 * ngưỡng này trùng với `app.css`. */
const NAV_ICON_ONLY_QUERY = '(max-width: 1050px)';

function subscribeNavIconOnly(onChange: () => void) {
  const query = window.matchMedia(NAV_ICON_ONLY_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function navIconOnlyByViewport(): boolean {
  return window.matchMedia(NAV_ICON_ONLY_QUERY).matches;
}

function RuntimeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h.01M8 15h.01M12 9h4M12 15h4" /></svg>;
}

/** Dòng trạng thái ở chân thanh điều hướng. Phiên bản do Vite thay từ
 * `package.json` trong cả preview lẫn gói cài, không viết cứng. */
const RUNTIME_LABEL = `Cổng 3200 · V${import.meta.env.VITE_APP_VERSION}`;

export function AppShell() {
  const { user } = useAuthStore(useShallow((s) => ({ user: s.user })));
  const { profile, load } = useSettingsStore(useShallow((s) => ({ profile: s.profile, load: s.load })));
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; } });

  // Chỉ còn icon khi người dùng thu gọn HOẶC cửa sổ hẹp tự thu gọn bằng CSS.
  const iconOnly = useSyncExternalStore(subscribeNavIconOnly, navIconOnlyByViewport) || collapsed;

  useEffect(() => { load(); }, [load]);

  // Vùng nội dung là khung cuộn chung của mọi trang: đổi trang thì đưa về đầu,
  // nếu không trang mới mở ngay ở vị trí cuộn của trang trước (đánh giá
  // 09/11/2026). Chỉ theo đường dẫn, nên đổi tham số trên cùng một trang (bộ
  // lọc, xét nghiệm đang chọn) vẫn giữ vị trí.
  const mainRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }

  const toggleLabel = collapsed ? 'Mở thanh điều hướng' : 'Thu gọn thanh điều hướng';

  return (
    <div className={`app-shell${collapsed ? ' nav-collapsed' : ''}`}>
      <aside aria-label="Điều hướng ứng dụng">
        <div className="brand-row">
          <div className="brand">
            <BrandIdentity
              title={profile?.brand_title}
              subtitle={profile?.brand_sub}
              logoText={profile?.logo_text}
              logoData={profile?.logo_data}
              showCopy={!collapsed}
            />
            <button type="button" className="nav-toggle" title={toggleLabel} aria-label={toggleLabel}
              aria-expanded={!collapsed} aria-controls="primary-navigation" onClick={toggleCollapsed}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          </div>
        </div>
        <nav id="primary-navigation" className={iconOnly ? 'nav-icon-only' : undefined} aria-label="Điều hướng chính">
          {NAV_GROUPS.map((group) => {
            const items = group.ids.map(pageById).filter((page): page is PageDef => !!page && canUserAccessPage(page.id, user));
            if (!items.length) return null;
            return (
              <div key={group.label}>
                {!collapsed && <div className="nav-group">{group.label}</div>}
                {items.map((item) => (
                  <NavLink key={item.path} to={item.path} title={iconOnly ? item.label : undefined} aria-label={iconOnly ? item.label : undefined} className={({ isActive }) => (isActive ? 'active' : '')}>
                    <span className="ic" aria-hidden="true"><NavIcon id={item.id} /></span>
                    {!collapsed && <span className="nav-label">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer" role="status" aria-live="polite" title={iconOnly ? `Máy chủ cục bộ · ${RUNTIME_LABEL}` : undefined}>
          <div className="sidebar-runtime">
            <span className="sidebar-runtime-icon"><RuntimeIcon /></span>
            <div className="sidebar-runtime-copy">
              <b>Máy chủ cục bộ</b>
              <span>{RUNTIME_LABEL}</span>
            </div>
          </div>
          <SoftwareLicenseFooter compact={iconOnly} />
        </div>
      </aside>
      <main ref={mainRef} tabIndex={-1}>
        {/* Lỗi hiển thị của một trang chỉ thay vùng nội dung; đổi trang thì
            tự bỏ trạng thái lỗi. */}
        <PageErrorBoundary resetKey={pathname}>
          <Outlet />
        </PageErrorBoundary>
      </main>
      <ToastHost />
      <DatePickerPopup />
    </div>
  );
}


