/**
 * Địa chỉ IPv4 nhân viên dùng để mở QC Lab từ máy khác trong cùng mạng.
 * Không đưa loopback vào: 127.0.0.1 trên máy nhân viên trỏ về CHÍNH máy đó.
 */
export interface LanNetworkAddress { family: string; address: string; internal: boolean }
export type LanNetworkInterfaces = Record<string, readonly LanNetworkAddress[] | undefined>;

export function lanIpv4(interfaces: LanNetworkInterfaces): string[] {
  const addresses = Object.values(interfaces)
    .flatMap((items) => items || [])
    .filter((item) => item.family === 'IPv4' && !item.internal && item.address)
    .map((item) => item.address);
  return [...new Set(addresses)];
}
