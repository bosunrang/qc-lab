import { getKernel } from '../state/kernel';

/* Component dùng chung cho tiêu đề của 10/11 trang (trừ Dashboard, có
   dashboardHeadHtml() riêng — xem ghi chú Giai đoạn 5 trong kế hoạch kiến
   trúc) — thay cho headOnlyHtml()+topUserBox() cũ (dangerouslySetInnerHTML).
   React tự escape mọi text nội suy nên không cần esc()/escapeAttr() thủ
   công như bản HTML cũ. Avatar/Đăng xuất gọi thẳng onClick/onKeyDown thay
   vì data-action="openAvatarModal"/"logout" cổ điển. */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const user = getKernel().pres.currentUser();
  const openAvatar = () => getKernel().pres.openAvatarModal();
  return (
    <div className="head">
      <div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
      <div className="head-actions">
        {user ? (
          <div className="top-user">
            <div
              className="avatar"
              role="button"
              tabIndex={0}
              aria-label="Đổi ảnh đại diện"
              onClick={openAvatar}
              onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); openAvatar(); } }}
            >
              {user.avatar ? <img src={user.avatar} alt="" /> : (String(user.name || user.username || 'U').trim().charAt(0).toUpperCase() || 'U')}
            </div>
            <div className="meta">
              <div className="name">{user.name || user.username}</div>
              <div className="role">{getKernel().pres.roleLabel(user.role)}</div>
            </div>
            <button type="button" onClick={() => getKernel().pres.logout()} title="Đăng xuất">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 5v14" /></svg>
              Đăng xuất
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
