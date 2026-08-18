export function createLiveRowFilter(deps: { document: Document; searchText: (value: unknown) => string }) {
  const setSearchCount = (id: string, visible: number, total: number) => {
    const el = deps.document.getElementById(id);
    if (el) el.textContent = visible + '/' + total;
  };
  const showSearchEmpty = (id: string, on: boolean) => {
    const el = deps.document.getElementById(id) as HTMLElement | null;
    if (el) el.style.display = on ? '' : 'none';
  };
  const replaceSelectItems = (select: HTMLSelectElement | null, items: { value: unknown; label: unknown }[], emptyText?: string) => {
    if (!select) return;
    const selected = select.value, options = (items || []).map(item => {
      const o = deps.document.createElement('option');
      o.value = String(item.value ?? '');
      o.textContent = String(item.label ?? '');
      return o;
    });
    if (!options.length) {
      const o = deps.document.createElement('option');
      o.value = '';
      o.textContent = emptyText || 'Không có dữ liệu';
      options.push(o);
    }
    select.replaceChildren(...options);
    select.disabled = !(items && items.length);
    if ((items || []).some(item => String(item.value) === String(selected))) select.value = selected;
  };
  const liveRowFilter = (selector: string, q: unknown, opts: { countId?: string; emptyId?: string } = {}) => {
    const query = deps.searchText(q);
    let visible = 0, total = 0;
    deps.document.querySelectorAll<HTMLElement>(selector).forEach(el => {
      total++;
      const ok = !query || String(el.dataset.search || '').includes(query);
      el.style.display = ok ? '' : 'none';
      if (ok) visible++;
    });
    if (opts.countId) setSearchCount(opts.countId, visible, total);
    if (opts.emptyId) showSearchEmpty(opts.emptyId, visible === 0);
    return { visible, total };
  };
  const scheduleSearchRender = (owner: any, apply: () => void, focusId?: string, delay = 180) => {
    clearTimeout(owner.searchTimer);
    owner.searchTimer = setTimeout(() => {
      apply();
      if (focusId) {
        const e = deps.document.getElementById(focusId) as (HTMLInputElement & HTMLTextAreaElement) | null;
        if (e) {
          e.focus({ preventScroll: true });
          try { e.setSelectionRange(e.value.length, e.value.length); } catch { /* not a text-selectable input */ }
        }
      }
    }, delay);
  };
  return { setSearchCount, showSearchEmpty, replaceSelectItems, liveRowFilter, scheduleSearchRender };
}
