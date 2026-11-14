import { useSoftwareStore } from '../store/software-store';
import { presentLicenseExpiry } from '../lib/license-expiry';

// Boundary nạp lại trạng thái xác thực mỗi phút và khi thay giấy phép.
// Hai vị trí hiển thị chỉ theo dõi store, không mở thêm IPC hoặc SSE.
export function SoftwareLicenseFooter({ compact }: { compact: boolean }) {
  const license = useSoftwareStore((state) => state.license);
  const expiry = presentLicenseExpiry(license);
  if (!expiry) return null;
  if (compact) return <span className="sidebar-license-compact" role="img" aria-label={expiry.label} title={`${expiry.label}. ${expiry.detail}`}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
  </span>;
  return <div className="sidebar-license-expiry" title={expiry.detail}>{expiry.label}</div>;
}

export function SoftwareLicenseExpiryNotice() {
  const license = useSoftwareStore((state) => state.license);
  const expiry = presentLicenseExpiry(license);
  if (!expiry?.notice) return null;
  return <div className="alert warn license-expiry-notice" role="status" aria-live="polite">{expiry.notice}</div>;
}
