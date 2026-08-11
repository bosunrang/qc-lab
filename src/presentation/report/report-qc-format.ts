type Value = Record<string, any>;

export function createReportQcFormat(deps: {
  testValue?: (test: Value, value: unknown) => string;
  testStat?: (test: Value, value: unknown) => string;
  pointValue?: (point: Value, test: Value) => string;
  format: (value: unknown, decimals?: number) => string;
}) {
  const value = (test: Value, raw: unknown) => deps.testValue ? deps.testValue(test, raw) : deps.format(raw, 3);
  const stat = (test: Value, raw: unknown) => deps.testStat ? deps.testStat(test, raw) : deps.format(raw, 3);
  const point = (item: Value, test: Value) => deps.pointValue ? deps.pointValue(item, test) : deps.format(item?.val, Math.max(2, Number(item?.valueDecimals) || 0));
  return Object.freeze({ value, stat, point });
}
