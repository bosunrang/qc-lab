export function targetRowState(linked: unknown, assigned: boolean, planned: unknown, depleted: boolean) {
  const locked = !!depleted;
  const checked = locked ? false : !!linked || !assigned;
  return {
    locked,
    checked,
    disabled: locked || !checked,
    status: locked ? 'retired' : linked ? 'linked' : planned ? 'planned' : assigned ? 'other' : 'empty',
  };
}
