export function targetSwitchAssayNames(names: Array<string|undefined|null>) {
  return [...new Set(names.filter(Boolean))].join(', ');
}
