export function createTargetMatrixCommand(deps: { apply: (input: any) => any; panelLabel: (panels: any[], panelId: string) => string }) {
  return Object.freeze({execute(input: any) { const result=deps.apply(input); return {result,auditDetail:`${deps.panelLabel(input.panels||[],input.panelId||'')} · ${input.group.name} · ${result.count} dòng${input.mode==='planned'?' (dự kiến)':''}`}; }});
}
