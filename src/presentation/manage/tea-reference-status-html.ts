const STATUS: Record<string, { cls: string; label: string }> = Object.freeze({ default: { cls: 'none', label: 'Mặc định' }, override: { cls: 'warn', label: 'Đã sửa' }, lab: { cls: 'ok', label: 'TEa PXN' }, custom: { cls: 'ok', label: 'Tự thêm' } });

export function teaReferenceStatusHtml(kind: string) {
  const status = STATUS[kind] || STATUS.default;
  return `<span class="tag ${status.cls}">${status.label}</span>`;
}
