const ENTRY_TREE_STATE_ORDER: Record<string, number> = { none: -1, ok: 0, warn: 1, rej: 2 };

export function entryTreeGroupState(states: readonly string[]) {
  let worst = 'none';
  states.forEach(state => {
    if ((ENTRY_TREE_STATE_ORDER[state] ?? -1) > ENTRY_TREE_STATE_ORDER[worst]) worst = state;
  });
  return worst;
}
