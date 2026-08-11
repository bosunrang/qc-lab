type Level = { level: unknown; lot?: string };

export function createDashboardLevelPillHtml(deps: { escape: (value: unknown) => string; format: (value: unknown) => string }) {
  return (input: { level: Level; today: boolean; targetOk: boolean; cv?: number | null }) => {
    const className = `dash-level-pill ${input.today ? 'done' : ''}${input.targetOk ? '' : ' missing-target'}`;
    const title = input.targetOk ? '' : ' title="Chưa có Mean/SD hợp lệ — không đánh giá Westgard"';
    const lot = input.level.lot ? ` · ${deps.escape(input.level.lot)}` : '';
    const cv = input.cv == null ? '' : ` · CV ${deps.format(input.cv)}%`;
    return `<span class="${className}"${title}>M${input.level.level}${lot}${cv}${input.targetOk ? '' : ' · thiếu Mean/SD'}</span>`;
  };
}
