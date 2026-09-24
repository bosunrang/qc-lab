/**
 * Mã lần chạy phải là khóa CHUNG của các mức QC trong cùng đợt chạy.
 * Không lấy `runs.length + 1` riêng cho từng ô: một mức bị nhập thiếu sẽ
 * khiến R4s/2-2s liên mức không còn ghép được với những mức còn lại.
 */
export function nextSharedRunId(date: string, currentLevelRunIds: readonly string[], allLevelRunIds: readonly string[]): string {
  const prefix = `${date}-`;
  const ordinalOf = (runId: string): number | null => {
    const suffix = String(runId).slice(prefix.length);
    return String(runId).startsWith(prefix) && /^\d+$/.test(suffix) && Number(suffix) > 0 ? Number(suffix) : null;
  };
  const occupied = new Set(currentLevelRunIds);
  const max = allLevelRunIds.reduce((current, runId) => Math.max(current, ordinalOf(runId) || 0), 0);
  // Ưu tiên lấp lần chạy đang còn thiếu tại mức này, rồi mới tạo đợt mới.
  for (let ordinal = 1; ordinal <= max + 1; ordinal++) {
    const candidate = `${prefix}${ordinal}`;
    if (!occupied.has(candidate)) return candidate;
  }
  return `${prefix}${max + 1}`;
}


