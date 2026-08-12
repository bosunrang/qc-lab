export function teaReferenceLabValueHtml(value: unknown, formatNumber: (value: unknown, decimals: number) => string) {
  return value == null ? '' : `<b>${formatNumber(value, 2)}%</b>`;
}
