type EntryPageInput = {
  treeCollapsed: boolean;
  treeHeadHtml: string;
  treeHtml: string;
  rightHtml: string;
  treeToggleButtonHtml: string;
};

type EntryPageDependencies = { head: (title: string, subtitle: string) => string; };

export function createEntryPageHtml(deps: EntryPageDependencies) {
  return (input: EntryPageInput) => deps.head('Nhập QC', 'Ghi nhận kết quả theo ngày, mức QC và lô đang vận hành')
    + `<div class="entrygrid${input.treeCollapsed ? ' tree-collapsed' : ''}">${input.treeToggleButtonHtml}<div class="tree" id="entryTreePanel">${input.treeHeadHtml}<div role="tree" aria-label="Danh mục nội kiểm">${input.treeHtml}</div></div><div class="entry-main">${input.rightHtml}</div></div>`;
}
