function escapeAttribute(value: unknown) {
  return String(value??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export function actionStaffOptionsHtml(names: string[]) {
  return names.map(name=>`<option value="${escapeAttribute(name)}"></option>`).join('');
}
