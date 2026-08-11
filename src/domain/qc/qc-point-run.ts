export function qcPointRunNumber(point: Record<string, any> | null | undefined): number {
  const match = /-(\d+)$/.exec(String(point?.runId || ''));
  return match ? parseInt(match[1], 10) : 1;
}
