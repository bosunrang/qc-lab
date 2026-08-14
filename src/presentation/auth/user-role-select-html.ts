export function userRoleSelectHtml(optionsHtml: string) {
  return `<select id="editUserRole" aria-label="Vai trò" onchange="syncUserPermChecks('editUserPerms',this.value)">${optionsHtml}</select>`;
}
