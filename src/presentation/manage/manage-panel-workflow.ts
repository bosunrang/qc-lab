export function createManagePanelWorkflow(deps: { removal: (state: any, input: { id: unknown }) => any; removalDialog: (name: unknown) => any }) {
  return Object.freeze({removal:deps.removal,removalDialog:deps.removalDialog});
}
export function managePanelRemovalDialog(name: unknown) {
  return {kicker:'Thao tác không thể hoàn tác',title:'Xóa Panel QC',message:`Xóa Panel QC ${name}?`,detail:'Các xét nghiệm vẫn được giữ nguyên.',confirmLabel:'Xóa Panel QC',cancelLabel:'Hủy'};
}
