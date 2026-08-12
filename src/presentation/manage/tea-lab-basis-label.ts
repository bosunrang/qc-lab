export function teaLabBasisLabel(sources: ReadonlyArray<readonly [string, string]>, source: string) {
  return sources.find(item => item[0] === source)?.[1] || '';
}
