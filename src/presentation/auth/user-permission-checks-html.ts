export type UserPermissionPage = { idHtml: string; titleHtml: string; allowed: boolean; selected: boolean };

export function userPermissionChecksHtml(groupIdHtml: string, pages: UserPermissionPage[]) {
  const rows=pages.map(page=>`<label class="${page.allowed?'':'disabled'}"><input type="checkbox" value="${page.idHtml}" ${page.selected?'checked':''} ${!page.allowed?'disabled':''}><span>${page.titleHtml}</span></label>`).join('');
  return `<div id="${groupIdHtml}" class="user-perm-grid">${rows}</div>`;
}
