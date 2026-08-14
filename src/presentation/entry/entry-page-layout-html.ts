type EntryPageLayoutInput = { pageHeadHtml: string; treeCollapsed: boolean; expandButtonHtml: string; treeHeadHtml: string; treeHtml: string; rightHtml: string };

export function entryPageLayoutHtml(input: EntryPageLayoutInput) {
  return `${input.pageHeadHtml}<div class="entrygrid${input.treeCollapsed ? ' tree-collapsed' : ''}">${input.expandButtonHtml}<div class="tree" id="entryTreePanel">${input.treeHeadHtml}<div role="tree" aria-label="Danh mục nội kiểm">${input.treeHtml}</div></div><div class="entry-main">${input.rightHtml}</div></div>`;
}
