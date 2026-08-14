export type ActionSelectOption = [string, string];
export type ActionSelectInput = { id: string; label: string; options: ActionSelectOption[]; current: unknown; extra?: string };

function escapeAttribute(value: unknown) {
  return String(value??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function escapeHtml(value: unknown) {
  return escapeAttribute(value).replace(/'/g,'&#39;');
}

export function actionSelectHtml(input: ActionSelectInput) {
  const current=input.current==null?'':String(input.current);
  const options=input.options.some(option=>option[0]===current)||!current ? input.options : [...input.options,[current,current] as ActionSelectOption];
  const optionsHtml=options.map(([value,text])=>`<option value="${escapeAttribute(value)}" ${value===current?'selected':''}>${escapeHtml(text)}</option>`).join('');
  return `<select id="${escapeAttribute(input.id)}" aria-label="${escapeAttribute(input.label)}" ${input.extra||''}>${optionsHtml}</select>`;
}
