type Round = { lab?: unknown; target?: unknown };

export function createSigmaBiasService(deps: { stats: (values: number[]) => { sd?: number } }) {
  const stats = (rounds: Round[]) => {
    const valid = (rounds || []).map(round => {
      const lab = Number.parseFloat(String(round.lab ?? '')), target = Number.parseFloat(String(round.target ?? ''));
      return Number.isFinite(lab) && Number.isFinite(target) && target !== 0 ? { lab, target, bias: (lab - target) / Math.abs(target) * 100 } : null;
    }).filter((round): round is { lab: number; target: number; bias: number } => !!round);
    if (!valid.length) return { valid, signedMean: null, rms: null };
    const signedMean = valid.reduce((sum, round) => sum + round.bias, 0) / valid.length;
    const rms = valid.length === 1 ? valid[0].bias : Math.sqrt(valid.reduce((sum, round) => sum + round.bias * round.bias, 0) / valid.length);
    return { valid, signedMean, rms };
  };
  const referenceUncertainty = (rounds: Round[]) => {
    const biases = stats(rounds).valid.map(round => round.bias);
    if (biases.length < 2) return null;
    const sd = deps.stats(biases).sd;
    return Number.isFinite(sd) ? Number(sd) / Math.sqrt(biases.length) : null;
  };
  const applyToPeriods = (periods: Record<string, any>[], periodIds: string[], level: number, bias: number, rounds: Round[], batchId: string) => {
    let applied = 0;
    (periods || []).forEach(period => {
      if (!(periodIds || []).includes(period.id)) return;
      period.lv = period.lv || {}; const data = period.lv[level] = period.lv[level] || {};
      data.biasEqa = Number(bias); data.biasEqaMethod = 'rms'; data.eqaRounds = (rounds || []).map(round => ({ lab: round.lab, target: round.target })); data.eqaBatchId = batchId; applied++;
    });
    return applied;
  };
  const roundsKey = (rounds: Round[]) => JSON.stringify((rounds || []).map(round => ({ lab: Number(round.lab), target: Number(round.target) })).filter(round => Number.isFinite(round.lab) && Number.isFinite(round.target) && round.target !== 0));
  const linkedPeriodIds = (periods: Record<string, any>[], entryId: string, level: number) => {
    const source = (periods || []).find(period => period.id === entryId), data = source?.lv?.[level]; if (!data) return [entryId];
    if (data.eqaBatchId) return (periods || []).filter(period => period.lv?.[level]?.eqaBatchId === data.eqaBatchId).map(period => period.id);
    const key = data.biasEqaMethod === 'rms' ? roundsKey(data.eqaRounds) : ''; if (!key || key === '[]') return [entryId];
    const linked = (periods || []).filter(period => { const item = period.lv?.[level]; return item && item.biasEqaMethod === 'rms' && roundsKey(item.eqaRounds) === key && Number(item.biasEqa) === Number(data.biasEqa); }).map(period => period.id);
    return linked.length ? linked : [entryId];
  };
  return Object.freeze({ stats, referenceUncertainty, applyToPeriods, roundsKey, linkedPeriodIds });
}

export type SigmaBiasService = ReturnType<typeof createSigmaBiasService>;
