type EntryTreeAssayInput = { active: boolean; testId: string; search: string; visible: boolean; pickAction: string; name: string; state: string; stateLabel: string };

type EntryTreeAssayDependencies = { escape: (value: unknown) => string };

export function createEntryTreeAssayHtml(deps: EntryTreeAssayDependencies) {
  return (input: EntryTreeAssayInput) => `<div class="tnode tn-config ${input.active ? 'on' : ''}" data-tree-role="assay" data-test-id="${deps.escape(input.testId)}" data-search="${deps.escape(input.search)}" role="treeitem" tabindex="0" aria-current="${input.active}" style="${input.visible ? '' : 'display:none'}" onclick="${deps.escape(input.pickAction)}" onkeydown="entryTreeKey(event)"><span class="config-name">${deps.escape(input.name)}</span><span class="state ${deps.escape(input.state === 'none' ? '' : input.state)}">${deps.escape(input.stateLabel)}</span></div>`;
}
