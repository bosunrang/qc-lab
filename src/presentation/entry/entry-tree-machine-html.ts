type EntryTreeMachineInput = { key: string; open: boolean; name: string; toggleAction: string };

type EntryTreeMachineDependencies = { escape: (value: unknown) => string };

export function createEntryTreeMachineHtml(deps: EntryTreeMachineDependencies) {
  return (input: EntryTreeMachineInput) => `<div class="tnode tn-machine" data-tree-role="machine" data-key="${deps.escape(input.key)}" role="treeitem" tabindex="0" aria-expanded="${input.open}" onclick="${deps.escape(input.toggleAction)}" onkeydown="entryTreeKey(event)"><span class="caret" aria-hidden="true">${input.open ? '−' : '+'}</span>${deps.escape(input.name)}</div>`;
}
