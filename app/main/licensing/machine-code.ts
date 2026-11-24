import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { hostname, platform, arch } from 'node:os';

/** Không lưu hay gửi MachineGuid ra ngoài. Mã công khai chỉ là dấu băm đã
 * gắn với sản phẩm; cài lại ứng dụng vẫn nhận cùng mã trên cùng Windows. */
export function machineCodeFromIdentity(identity: string): string {
  const hash = createHash('sha256').update(`vn.qclab.desktop:machine:v1:${identity.trim().toLowerCase()}`).digest('hex').slice(0, 32).toUpperCase();
  return `QC-${hash.match(/.{8}/g)!.join('-')}`;
}

export function readMachineCode(): string {
  if (platform() !== 'win32') return machineCodeFromIdentity(`${platform()}:${arch()}:${hostname()}`);
  const result = execFileSync('reg.exe', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'],
    { encoding: 'utf8', windowsHide: true, timeout: 5000 });
  const identity = result.match(/MachineGuid\s+REG_SZ\s+([0-9a-f-]{36})/i)?.[1];
  if (!identity) throw new Error('Không đọc được định danh Windows để tạo mã máy.');
  return machineCodeFromIdentity(`win32:${identity}`);
}
