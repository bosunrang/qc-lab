export function createManageTargetPickWorkflow(deps: { normalize: (input: any) => any }) {
  return Object.freeze({readRow: (input: { testId: unknown; lot: unknown; use: boolean; values: any }) => input.use ? {testId:input.testId,lot:input.lot,...deps.normalize(input.values)} : {testId:input.testId,lot:input.lot,use:false}});
}
