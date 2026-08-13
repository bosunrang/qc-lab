export function createManageLotGroupWorkflow(deps: { removal: (state: any, input: { id: unknown }) => any; removalDialog: (name: unknown) => any }) {
  return Object.freeze({removal:deps.removal,removalDialog:deps.removalDialog});
}
export function manageLotGroupRemovalDialog(name: unknown) {
  return {kicker:'Thao tác không thể hoàn tác',title:'Xóa nhóm lô',message:`Xóa nhóm lô ${name}?`,detail:'Các lô QC bên trong vẫn được giữ nguyên.',confirmLabel:'Xóa nhóm lô',cancelLabel:'Hủy'};
}
