export const ENTRY_TREE_COLLAPSE_STORAGE_KEY = 'qclab_entry_tree_collapsed';

export function readEntryTreeCollapsed(read: () => string | null) {
  try { return read() === '1'; } catch { return false; }
}

export function writeEntryTreeCollapsed(collapsed: boolean) {
  return collapsed ? '1' : '0';
}
