export function qcLevelTargetValid(level: Record<string, any> | null | undefined): boolean {
  return !!level && Number.isFinite(Number(level.mean)) && Number.isFinite(Number(level.sd)) && Number(level.sd) > 0;
}
