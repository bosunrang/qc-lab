type EntryTreeToggleButtonInput = { iconHtml: string; collapsed: boolean };

type EntryTreeToggleButtonDependencies = { button: (label: string, action: string, variant: string, title: string, options: unknown) => string };

export function createEntryTreeToggleButtonHtml(deps: EntryTreeToggleButtonDependencies) {
  return (input: EntryTreeToggleButtonInput) => {
    const title = input.collapsed ? 'Hiện danh mục nội kiểm' : 'Ẩn danh mục nội kiểm';
    const variant = input.collapsed ? 'teal icon entry-tree-expand' : 'ghost icon entry-tree-toggle';
    return deps.button(input.iconHtml, 'toggleEntryTree()', variant, title, { attrs: { 'aria-label': title, 'aria-controls': 'entryTreePanel', 'aria-expanded': String(!input.collapsed) } });
  };
}
