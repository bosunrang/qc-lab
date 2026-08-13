type EntryTreeGroupInput = { key: string; open: boolean; visible: boolean; search: string; name: string; state: string; stateLabel: string; toggleAction: string };

type EntryTreeGroupDependencies = { escape: (value: unknown) => string };

export function createEntryTreeGroupHtml(deps: EntryTreeGroupDependencies) {
  return (input: EntryTreeGroupInput) => `<div class="tnode tn-test ${input.open ? 'open' : ''}" data-tree-role="group" data-key="${deps.escape(input.key)}" data-search="${deps.escape(input.search)}" role="treeitem" tabindex="0" aria-expanded="${input.open}" style="${input.visible ? '' : 'display:none'}" onclick="${deps.escape(input.toggleAction)}" onkeydown="entryTreeKey(event)"><span class="caret" aria-hidden="true">${input.open ? '−' : '+'}</span>${deps.escape(input.name)}<span class="state ${deps.escape(input.state === 'none' ? '' : input.state)}">${deps.escape(input.stateLabel)}</span></div>`;
}
