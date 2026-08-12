export type BrandProfile = { brandTitle: string; brandSub: string; logoText: string; logoData: string };

export function createLabProfileService(cleanText: (value: unknown, limit?: number) => string, brandProfile: (value: Record<string, unknown>) => BrandProfile) {
  const updateLab = (current: Record<string, unknown> | null | undefined, input: Record<string, unknown>) => ({
    ...(current || {}),
    name: cleanText(input.name),
    dept: cleanText(input.dept),
    address: cleanText(input.address, 5000),
  });
  const updateBrand = (current: Record<string, unknown> | null | undefined, input: Record<string, unknown>) => ({
    ...(current || {}),
    ...brandProfile({
      brandTitle: input.brandTitle || 'QC Lab',
      brandSub: input.brandSub || 'Nội kiểm xét nghiệm',
      logoText: input.logoText || 'QC',
      logoData: current && current.logoData,
    }),
  });
  const updateLogo = (current: Record<string, unknown> | null | undefined, logoData: unknown) => ({ ...(current || {}), logoData: String(logoData || '') });
  const clearLogo = (current: Record<string, unknown> | null | undefined) => updateLogo(current, '');
  return { updateLab, updateBrand, updateLogo, clearLogo };
}
