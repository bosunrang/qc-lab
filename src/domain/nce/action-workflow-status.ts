export type ActionWorkflowStatusDeps = {
  isCancelled: (action: Record<string, any>) => boolean;
  isRecorded: (action: Record<string, any>) => boolean;
  rerunStatus: (action: Record<string, any>) => Record<string, any>;
  approvalStatus: (action: Record<string, any>) => string;
  protocolStatus: (action: Record<string, any>) => Record<string, any>;
  effectivenessStatus: (action: Record<string, any>) => Record<string, any>;
};

export function createActionWorkflowStatus(deps: ActionWorkflowStatusDeps) {
  return (action: Record<string, any> | null | undefined) => {
    if (!action) return { complete: false, cls: 'rej', label: 'Chưa ghi khắc phục', rerun: { needed: false, ok: false, label: 'Chưa ghi khắc phục', cls: 'rej', point: null } };
    if (deps.isCancelled(action)) return { complete: false, cancelled: true, cls: 'none', label: 'Đã hủy hồ sơ', stage: 'cancelled', rerun: { needed: false, ok: false, label: 'Hồ sơ đã hủy', cls: 'none', point: null }, protocol: deps.protocolStatus(action), effectiveness: deps.effectivenessStatus(action) };
    if (!deps.isRecorded(action)) return { complete: false, cls: 'rej', label: 'Chưa ghi khắc phục', rerun: { needed: false, ok: false, label: 'Chưa ghi khắc phục', cls: 'rej', point: null } };
    const rerun = deps.rerunStatus(action), approval = deps.approvalStatus(action), protocol = deps.protocolStatus(action), effectiveness = deps.effectivenessStatus(action);
    let stage = 'investigating', label = 'Đang điều tra', cls = 'warn';
    if (protocol.complete && rerun.needed && !rerun.ok) { stage = 'rerun'; label = rerun.label; }
    else if (protocol.complete && effectiveness.required && !effectiveness.complete) { stage = 'effectiveness'; label = effectiveness.label; cls = effectiveness.cls; }
    else if (protocol.complete && (!rerun.needed || rerun.ok) && effectiveness.complete && approval === 'returned') { stage = 'returned'; label = 'Trả lại để bổ sung'; cls = 'rej'; }
    else if (protocol.complete && (!rerun.needed || rerun.ok) && effectiveness.complete && approval !== 'approved') { stage = 'approval'; label = 'Chờ duyệt'; }
    else if (protocol.complete && (!rerun.needed || rerun.ok) && effectiveness.complete && approval === 'approved') { stage = 'closed'; label = 'Đã khép vòng'; cls = 'ok'; }
    return { complete: stage === 'closed', cls, label, stage, rerun, protocol, effectiveness };
  };
}

export type ActionWorkflowStatus = ReturnType<typeof createActionWorkflowStatus>;
