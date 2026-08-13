type EntryDayStatusInput = { hasPoint: boolean; level: 'ok' | 'warn' | 'rej' | string };

export function entryDayStatusHtml(input: EntryDayStatusInput) {
  if (!input.hasPoint) return '—';
  if (input.level === 'rej') return '<span class="tag rej">R</span>';
  if (input.level === 'warn') return '<span class="tag warn">W(A)</span>';
  return '<span class="tag ok">A</span>';
}
