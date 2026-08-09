type Value = Record<string, any>;

export function createSigmaBiasWorkflowService(deps: {
  stats: (rounds: Value[]) => Value;
  apply: (records: Value[], periodIds: string[], level: number, bias: number, rounds: Value[], batchId: string) => number;
  createId: () => string;
}) {
  const apply = (records: Value[], periodIds: string[], level: number, rounds: Value[]) => {
    const stats = deps.stats(rounds || []);
    if (!stats.valid.length) return { status: 'invalid-rounds', applied: 0 };
    if (!(periodIds || []).length) return { status: 'missing-periods', applied: 0 };
    const validRounds = stats.valid.map((round: Value) => ({ lab: round.lab, target: round.target }));
    const applied = deps.apply(records, periodIds, level, stats.rms, validRounds, deps.createId());
    return { status: applied ? 'applied' : 'no-matching-periods', applied, bias: stats.rms, rounds: validRounds };
  };
  return Object.freeze({ apply });
}
export type SigmaBiasWorkflowService = ReturnType<typeof createSigmaBiasWorkflowService>;
