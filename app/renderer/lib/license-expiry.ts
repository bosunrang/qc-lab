import type { SoftwareLicenseStatus } from '../../shared/qc-api';

const dateFormat = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
const DAY_MS = 24 * 60 * 60 * 1000;

function vietnamDate(time: number) {
  const parts = dateFormat.formatToParts(time);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  const year = part('year'), month = part('month'), day = part('day');
  return { display: `${day}/${month}/${year}`, day: Date.UTC(+year, +month - 1, +day) / DAY_MS };
}

/** Chỉ trình bày trạng thái đã được main xác minh; không quyết định quyền
 * sử dụng. Đếm ngày lịch Việt Nam, tránh làm tròn 7 ngày thành 8 ở cuối ngày. */
export function presentLicenseExpiry(license: Pick<SoftwareLicenseStatus, 'state' | 'expires_at'> | null, now = Date.now()) {
  if (license?.state !== 'active') return null;
  if (license.expires_at === null) return { label: 'Hạn dùng: Vĩnh viễn', detail: 'Giấy phép không giới hạn thời gian sử dụng.', daysLeft: null, notice: null };
  const expiry = Date.parse(license.expires_at);
  if (!Number.isFinite(expiry) || !Number.isFinite(now)) return null;
  const end = vietnamDate(expiry), daysLeft = Math.max(0, end.day - vietnamDate(now).day);
  const remaining = expiry <= now ? 'Giấy phép QC Lab đã hết hạn' : daysLeft === 0 ? 'Giấy phép QC Lab hết hạn hôm nay' : `Giấy phép QC Lab còn ${daysLeft} ngày sử dụng`;
  const detail = `${remaining} (${daysLeft > 0 ? 'hết hạn ' : ''}${end.display}).`;
  return {
    label: `Hạn dùng: ${end.display}`, detail, daysLeft,
    notice: daysLeft <= 7 ? `${detail} Liên hệ bên cấp phần mềm để gia hạn.` : null,
  };
}
