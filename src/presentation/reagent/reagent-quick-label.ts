export function reagentQuickLabel(type: string): string { return type === 'sampleType' ? 'loại mẫu' : 'người thực hiện'; }
export const reagentQuickLabelPresentation = Object.freeze({ label: reagentQuickLabel });
