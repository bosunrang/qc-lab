export function userRoleSelectHtml(optionsHtml: string) {
  return `<select id="editUserRole" aria-label="Vai trò" data-action="syncUserPermChecks" data-args='["editUserPerms"]' data-action-on="change">${optionsHtml}</select>`;
}
