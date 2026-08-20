type EntryTreeHeaderInput = { collapseButtonHtml: string; query: unknown; machineOptionsHtml: string };
type EntryTreeMachineInput = { key: unknown; open: boolean; label: unknown; toggleKey: string };
type EntryTreeGroupInput = { key: unknown; open: boolean; parentOpen: boolean; search: unknown; name: unknown; stateClass: string; stateText: unknown; toggleKey: string };
type EntryTreeAssayInput = { testId: unknown; search: unknown; selected: boolean; visible: boolean; level: number; name: unknown; stateClass: string; stateText: unknown };

export function createEntryTreeHeaderHtml(deps: { escapeAttribute: (value: unknown) => string }) {
  return (input: EntryTreeHeaderInput) => `<div class="entry-tree-head"><h4 role="heading" aria-level="2">Danh mục nội kiểm</h4>${input.collapseButtonHtml}</div><div class="tree-tools"><input id="entrySearch" aria-label="Tìm xét nghiệm, máy hoặc lô" placeholder="Tìm test, máy hoặc lô..." value="${deps.escapeAttribute(input.query)}" data-action="entryFilter" data-action-on="input"><select aria-label="Lọc theo máy xét nghiệm" data-action="entrySetMachine" data-action-on="change">${input.machineOptionsHtml}</select></div>`;
}

export function createEntryTreeItemHtml(deps: { escape: (value: unknown) => string; escapeAttribute: (value: unknown) => string }) {
  const caret = (open: boolean) => open ? '−' : '+';
  return Object.freeze({
    empty: () => '<div class="tree-empty" role="presentation">Không có xét nghiệm phù hợp.</div>',
    machine: (input: EntryTreeMachineInput) => `<div class="tnode tn-machine" data-tree-role="machine" data-key="${deps.escapeAttribute(input.key)}" role="treeitem" tabindex="0" aria-expanded="${input.open}" data-action="treeToggle" data-args="${deps.escapeAttribute(JSON.stringify([input.toggleKey]))}" data-keydown-action="entryTreeKey"><span class="caret" aria-hidden="true">${caret(input.open)}</span>${deps.escape(input.label)}</div>`,
    group: (input: EntryTreeGroupInput) => `<div class="tnode tn-test ${input.open ? 'open' : ''}" data-tree-role="group" data-key="${deps.escapeAttribute(input.key)}" data-search="${deps.escapeAttribute(input.search)}" role="treeitem" tabindex="0" aria-expanded="${input.open}" style="${input.parentOpen ? '' : 'display:none'}" data-action="treeToggle" data-args="${deps.escapeAttribute(JSON.stringify([input.toggleKey]))}" data-keydown-action="entryTreeKey"><span class="caret" aria-hidden="true">${caret(input.open)}</span>${deps.escape(input.name)}<span class="state ${input.stateClass}">${deps.escape(input.stateText)}</span></div>`,
    assay: (input: EntryTreeAssayInput) => `<div class="tnode tn-config ${input.selected ? 'on' : ''}" data-tree-role="assay" data-test-id="${deps.escapeAttribute(input.testId)}" data-search="${deps.escapeAttribute(input.search)}" role="treeitem" tabindex="0" aria-current="${input.selected ? 'true' : 'false'}" style="${input.visible ? '' : 'display:none'}" data-action="entryPick" data-args="${deps.escapeAttribute(JSON.stringify([input.testId, input.level]))}" data-keydown-action="entryTreeKey"><span class="config-name">${deps.escape(input.name)}</span><span class="state ${input.stateClass}">${deps.escape(input.stateText)}</span></div>`,
  });
}
