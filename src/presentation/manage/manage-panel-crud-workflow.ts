export function createManagePanelCrudWorkflow(deps: { formState: (id: unknown) => any; removal: (state: any, input: { id: unknown }) => any; removalDialog: (name: unknown) => any }) {
  return Object.freeze({
    open: (state: any, id: unknown) => !state.tests.length ? {blocked:'assays'} : !state.instruments.length ? {blocked:'instruments'} : {form:deps.formState(id)},
    saveAudit: (result: any) => ({action:result.created?'Thêm Panel QC':'Cập nhật Panel QC',detail:`${result.record.name} · ${result.record.testIds.length} xét nghiệm`}),
    removal: deps.removal,
    removalDialog: deps.removalDialog,
  });
}
