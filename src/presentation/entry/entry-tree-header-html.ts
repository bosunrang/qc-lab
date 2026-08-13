type EntryTreeHeaderInput = { toggleButtonHtml: string; search: string; machineOptionsHtml: string };

type EntryTreeHeaderDependencies = { escape: (value: unknown) => string };

export function createEntryTreeHeaderHtml(deps: EntryTreeHeaderDependencies) {
  return (input: EntryTreeHeaderInput) => `<div class="entry-tree-head"><h4 role="heading" aria-level="2">Danh mục nội kiểm</h4>${input.toggleButtonHtml}</div><div class="tree-tools"><input id="entrySearch" aria-label="Tìm xét nghiệm, máy hoặc lô" placeholder="Tìm test, máy hoặc lô..." value="${deps.escape(input.search)}" oninput="entryFilter(this.value)"><select aria-label="Lọc theo máy xét nghiệm" onchange="entrySetMachine(this.value)">${input.machineOptionsHtml}</select></div>`;
}
