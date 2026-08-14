export type RangeNceNoticeInput = { nceId: string; rule: string; cause: string };

export function rangeNceNoticeHtml(input: RangeNceNoticeInput) {
  return `<div class="alert warn flow-control"><b>Đang có hồ sơ NCE ${input.nceId} ghi nhận vi phạm hệ thống (${input.rule})</b><div>${input.cause||'Chưa ghi nguyên nhân trong hồ sơ.'}</div></div>`;
}
