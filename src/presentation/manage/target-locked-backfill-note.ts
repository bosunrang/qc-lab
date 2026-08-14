export type TargetLockedBackfillNoteInput = { count: number; periods: string[]; emphasize?: boolean };

export function targetLockedBackfillNote(input: TargetLockedBackfillNoteInput) {
  if(!input.count)return '';
  const count=input.emphasize?`<b>${input.count} điểm QC thuộc kỳ đã khóa (${input.periods.join(', ')})</b>`:`${input.count} điểm QC thuộc kỳ đã khóa (${input.periods.join(', ')})`;
  return `${input.emphasize?' ':''}${count} sẽ được điền số lô/Mean-SD hiện hành (điểm trước đó chưa ghi lô riêng).`;
}
