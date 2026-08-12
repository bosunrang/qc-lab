export type BrandProfile = { brandTitle: string; brandSub: string; logoText: string; logoData: string };

export function createBrandProfile(cleanText: (value: unknown, limit: number) => string) {
  return (lab: Record<string, unknown> | null | undefined): BrandProfile => {
    const value = lab || {};
    return {
      brandTitle: cleanText(value.brandTitle || 'QC Lab', 80),
      brandSub: cleanText(value.brandSub || 'Nội kiểm xét nghiệm', 120),
      logoText: cleanText(value.logoText || 'QC', 8).slice(0, 4),
      logoData: cleanText(value.logoData || '', 120000),
    };
  };
}
