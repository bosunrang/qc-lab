export function createUiPrimitives(deps: { currentUser: () => any; escape: (value: unknown) => string; escapeAttr: (value: unknown) => string; roleLabel: (role: string) => string }) {
  const btn = (label: string, onclick: string, cls = 'ghost sm', title = '', opts: { disabled?: boolean; attrs?: Record<string, unknown> } = {}) => {
    const { disabled = false, attrs = {} } = opts, attrStr = Object.entries(attrs).map(([k, v]) => ` ${k}="${deps.escapeAttr(v)}"`).join('');
    return `<button class="btn ${cls}"${disabled ? ' disabled' : ''} onclick="${onclick}"${title ? ` title="${deps.escapeAttr(title)}"` : ''}${attrStr}>${label}</button>`;
  };
  const emptyState = (title: string, body: string, actions = '') => `<div class="empty"><div class="empty-title">${title}</div><div>${body}</div>${actions ? `<div class="empty-actions">${actions}</div>` : ''}</div>`;
  const topUserBox = () => {
    const currentUser = deps.currentUser();
    if (!currentUser) return '';
    const name = currentUser.name || currentUser.username;
    const initial = deps.escape(String(name || 'U').trim().charAt(0).toUpperCase() || 'U');
    return `<div class="top-user"><div class="avatar">${initial}</div><div class="meta"><div class="name">${deps.escape(name)}</div><div class="role">${deps.roleLabel(currentUser.role)}</div></div><button onclick="logout()" title="Đăng xuất"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 5v14"/></svg>Đăng xuất</button></div>`;
  };
  const headOnly = (t: string, p: string, actions = '') => `<div class="head"><div><h1>${t}</h1>${p ? `<p>${p}</p>` : ''}</div><div class="head-actions">${actions}${topUserBox()}</div></div>`;
  return { btn, emptyState, topUserBox, headOnly };
}
