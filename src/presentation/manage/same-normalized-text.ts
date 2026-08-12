export function createSameNormalizedText(deps: { normalize: (value: unknown) => string }) {
  return (left: unknown, right: unknown) => deps.normalize(left) === deps.normalize(right);
}
