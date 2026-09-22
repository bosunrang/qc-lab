// Khung Clinical Precision: brand, ba nhóm điều hướng và footer vận hành nằm
// trong sidebar tối. PageHeader được từng route dựng ở đầu nội dung để
// sticky theo đúng vùng cuộn của trang, còn AppShell chỉ sở hữu navigation.
//
// Ẩn/hiện mục điều hướng theo vai trò CHỈ LÀ HIỂN THỊ. Bảng vai trò theo
// trang không còn ở đây — đã gom về lib/permissions.ts (PAGE_DEFS) để
// sidebar và route dùng CÙNG một bảng; chặn truy cập thật theo route nằm ở
// router.tsx, chặn ghi thật nằm ở main/ipc/shared.ts. `pagePerms` tuỳ biến
// theo từng người dùng vẫn chưa làm (Giai đoạn A2/D3.1).
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { useSettingsStore } from '../store/settings-store';
import { canUserAccessPage, pageById, type PageDef } from '../lib/permissions';
import { DialogHost } from './DialogHost';
import { DatePickerPopup } from './DatePickerPopup';
import { NavIcon } from './NavIcon';

// Cấu trúc nhóm điều hướng; nhãn/route/vai trò đọc từ PAGE_DEFS, không khai lại.
const NAV_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Theo dõi', ids: ['dash', 'entry', 'westgard', 'sigma'] },
  { label: 'Vận hành', ids: ['reagent', 'actions', 'report'] },
  { label: 'Quản trị', ids: ['manage', 'users', 'audit', 'settings'] },
];

const COLLAPSE_KEY = 'qclab-v2-nav-collapsed';

function RuntimeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h.01M8 15h.01M12 9h4M12 15h4" /></svg>;
}

export function AppShell() {
  const { user } = useAuthStore();
  const { profile, load } = useSettingsStore();
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; } });

  useEffect(() => { load(); }, [load]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }

  const brandTitle = profile?.brand_title || 'QC Lab';
  const brandSub = profile?.brand_sub || 'Nội kiểm xét nghiệm';
  const brandMarkText = (profile?.logo_text || 'QC').slice(0, 4);
  const toggleLabel = collapsed ? 'Mở thanh điều hướng' : 'Thu gọn thanh điều hướng';

  return (
    <div className={`app-shell${collapsed ? ' nav-collapsed' : ''}`}>
      <aside aria-label="Điều hướng ứng dụng">
        <div className="brand-row">
          <div className="brand">
            <div className="brand-mark">{profile?.logo_data ? <img src={profile.logo_data} alt="" /> : brandMarkText}</div>
            {!collapsed && <div className="brand-copy"><div>{brandTitle}</div><small>{brandSub}</small></div>}
          </div>
          <button type="button" className="nav-toggle" title={toggleLabel} aria-label={toggleLabel} onClick={toggleCollapsed}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
        </div>
        <nav aria-label="Điều hướng chính">
          {NAV_GROUPS.map((group) => {
            const items = group.ids.map(pageById).filter((page): page is PageDef => !!page && canUserAccessPage(page.id, user));
            if (!items.length) return null;
            return (
              <div key={group.label}>
                {!collapsed && <div className="nav-group">{group.label}</div>}
                {items.map((item) => (
                  <NavLink key={item.path} to={item.path} title={collapsed ? item.label : undefined} className={({ isActive }) => (isActive ? 'active' : '')}>
                    <span className="ic" aria-hidden="true"><NavIcon id={item.id} /></span>
                    {!collapsed && <span className="nav-label">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer" role="status" aria-live="polite" title={collapsed ? 'Máy chủ cục bộ · Cổng 3200 · V1.0.1' : undefined}>
          <div className="sidebar-runtime">
            <span className="sidebar-runtime-icon"><RuntimeIcon /></span>
            <div className="sidebar-runtime-copy">
              <b>Máy chủ cục bộ</b>
              <span>Cổng 3200 · V1.0.1</span>
            </div>
          </div>
        </div>
      </aside>
      <main tabIndex={-1}>
        <Outlet />
      </main>
      <DialogHost />
      <DatePickerPopup />
    </div>
  );
}
