export function teaPositiveNumber(value: unknown) {
  const number = Number(value);
  return String(value == null ? '' : value).trim() !== '' && Number.isFinite(number) && number > 0 ? number : null;
}
