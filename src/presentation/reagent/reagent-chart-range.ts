export function reagentChartRange(values: readonly number[], paddingRatio = 0.08): [number, number] {
  const minimum = values.reduce((current, value) => value < current ? value : current, values[0]);
  const maximum = values.reduce((current, value) => value > current ? value : current, values[0]);
  const spread = (maximum - minimum) || Math.abs(maximum) || 1, padding = spread * paddingRatio;
  return [minimum - padding, maximum + padding];
}

export const reagentChartPresentation = Object.freeze({ range: reagentChartRange });
