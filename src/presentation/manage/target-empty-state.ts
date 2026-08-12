export type TargetEmptyState = { title: string; description: string };

export function targetEmptyState(allAssayCount: number, levelLotNos: string[], depletedLotNos: string[], level: string): TargetEmptyState {
  if (!allAssayCount) return { title: 'Panel chưa có xét nghiệm', description: 'Sửa Panel QC và chọn các xét nghiệm thành viên trước.' };
  if (levelLotNos.length && depletedLotNos.length === levelLotNos.length) {
    return {
      title: `Lô mức ${level} đã hết QC`,
      description: `Lô ${depletedLotNos.join(', ')} (Mức ${level}) trong nhóm này đã hết QC nên không nhập Mean/SD được. Hãy chọn nhóm lô khác ở ô “Nhóm lô QC” phía trên, hoặc tạo lô mới rồi lập hồ sơ chuyển tiếp lô.`,
    };
  }
  return { title: 'Không tìm thấy xét nghiệm', description: 'Thử tìm theo tên xét nghiệm, máy, khoa, đơn vị hoặc lô QC.' };
}
