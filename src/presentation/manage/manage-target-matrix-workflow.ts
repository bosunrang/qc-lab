export function createManageTargetMatrixWorkflow() {
  return Object.freeze({
    lockedBackfillDialog: (count: number, periods: string) => ({kicker:'Cập nhật hàng loạt',title:'Điền lô/Mean-SD cho điểm QC đã khóa kỳ',message:`Lưu Mean/SD này sẽ điền số lô/Mean-SD hiện hành vào ${count} điểm QC trước đó chưa ghi lô, thuộc kỳ đã khóa (${periods}).`,detail:'Giá trị đo và ngày của từng điểm không đổi — chỉ điền thêm nhãn số lô/Mean-SD còn thiếu.',confirmLabel:'Vẫn lưu',cancelLabel:'Hủy',danger:false}),
    reauth: (switching: boolean) => switching ? {title:'Xác thực chuyển lô',message:'Nhập lại mật khẩu trước khi lưu hoặc áp dụng Mean/SD cho nhóm lô mới.'} : {title:'Xác thực Mean/SD',message:'Nhập lại mật khẩu trước khi lưu Mean/SD cho lô QC.'},
    switchSummary: (count: number, names: string, lockedCount: number, periods: string) => ({count,names,lockNote:lockedCount?`${lockedCount} điểm QC thuộc kỳ đã khóa (${periods}) sẽ được điền số lô/Mean-SD hiện hành.`:''}),
  });
}
