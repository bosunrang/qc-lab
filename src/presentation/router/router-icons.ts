const NAV_ICON_PATHS: Record<string, string> = {
  dash: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.3"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.3"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.3"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.3"/>',
  entry: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  westgard: '<path d="M4 3v18h17"/><path d="M7 7h13M7 12h13M7 17h13" opacity=".55"/><path d="m7 15 3-5 3 3 3-7 4 4"/><circle cx="7" cy="15" r=".8" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r=".8" fill="currentColor" stroke="none"/><circle cx="13" cy="13" r=".8" fill="currentColor" stroke="none"/><circle cx="16" cy="6" r=".8" fill="currentColor" stroke="none"/><circle cx="20" cy="10" r=".8" fill="currentColor" stroke="none"/>',
  sigma: '<path d="M16.5 5H8l5.2 7-5.2 7h8.5"/>',
  reagent: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  actions: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94Z"/>',
  report: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8.5 13h7"/><path d="M8.5 17h7"/>',
  manage: '<line x1="4.5" x2="4.5" y1="21" y2="14"/><line x1="4.5" x2="4.5" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="19.5" x2="19.5" y1="21" y2="16"/><line x1="19.5" x2="19.5" y1="12" y2="3"/><line x1="2.5" x2="6.5" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="17.5" x2="21.5" y1="16" y2="16"/>',
  users: '<path d="M16.5 21v-2a4 4 0 0 0-4-4h-5a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7.5" r="3.8"/><path d="M21.5 21v-2a4 4 0 0 0-3-3.87"/><path d="M15.5 3.13a4 4 0 0 1 0 7.75"/>',
  audit: '<rect x="8" y="2.5" width="8" height="3.7" rx="1"/><path d="M16 4.3h1.5a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V6.3a2 2 0 0 1 2-2H8"/><path d="M9 12.5h6"/><path d="M9 16.5h6"/>',
  settings: '<path d="M17.6 18.5H8.8a6.3 6.3 0 1 1 6-8.1h.7a4 4 0 1 1 0 8.1Z"/>',
};

export function icon(id: string) {
  const p = NAV_ICON_PATHS[id] || '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

export function icoDownload() {
  return '<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
}

export function icoPrint() {
  return '<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg>';
}
