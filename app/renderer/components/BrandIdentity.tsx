interface BrandIdentityProps {
  title?: string;
  subtitle?: string;
  logoText?: string;
  logoData?: string;
  showCopy?: boolean;
}

export function BrandIdentity({ title, subtitle, logoText, logoData, showCopy = true }: BrandIdentityProps) {
  return (
    <>
      <div className="brand-mark">{logoData ? <img src={logoData} alt="" /> : (logoText || 'QC').slice(0, 4)}</div>
      {showCopy && (
        <div className="brand-copy">
          <div>{title || 'QC Lab'}</div>
          <small>{subtitle || 'Nội kiểm xét nghiệm'}</small>
        </div>
      )}
    </>
  );
}
