export function createPointWorkflowService(deps: {
  isCancelled: (action: Record<string, any>) => boolean;
  isRecorded: (action: Record<string, any>) => boolean;
  status: (action: Record<string, any>) => Record<string, any>;
}) {
  const real = (actions: Record<string, any>[]) => actions.filter(action => !deps.isCancelled(action) && deps.isRecorded(action));
  const complete = (actions: Record<string, any>[]) => real(actions).some(action => deps.status(action).complete);
  const summary = (actions: Record<string, any>[]) => {
    if (!actions.length || !real(actions).length) return { cls: 'rej', label: 'Chưa ghi khắc phục' };
    const records = real(actions), done = records.find(action => deps.status(action).complete);
    return done ? { cls: 'ok', label: deps.status(done).label } : deps.status(records[records.length - 1]);
  };
  return Object.freeze({ real, complete, summary });
}
