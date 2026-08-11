export function qcCusumConfig(test: Record<string, any> | null | undefined) {
  const config = test?.cusum;
  return {
    on: !!config?.on,
    k: Number.isFinite(Number(config?.k)) && Number(config?.k) > 0 ? Number(config?.k) : 0.5,
    h: Number.isFinite(Number(config?.h)) && Number(config?.h) > 0 ? Number(config?.h) : 4,
  };
}
