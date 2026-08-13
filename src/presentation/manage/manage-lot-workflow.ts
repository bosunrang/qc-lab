export function createManageLotWorkflow(deps: { removal: (state: any, input: { id: unknown; switchesLot: any }) => any; removalDialog: (lotNo: unknown) => any }) {
  return Object.freeze({removal:deps.removal,removalDialog:deps.removalDialog});
}
export function manageLotRemovalDialog(lotNo: unknown) {
  return {kicker:'Thao tác không thể hoàn tác',title:'Xóa lô QC',message:`Xóa lô QC ${lotNo}?`,confirmLabel:'Xóa lô QC',cancelLabel:'Hủy'};
}
