// Nơi giữ refresh token của phiên Firebase (GV6): một tệp trong thư mục dữ liệu
// của app, mã hoá bằng `safeStorage` (DPAPI trên Windows) như khoá CA của LAN.
// Nằm NGOÀI CSDL nên không đi vào bản sao lưu, gói đẩy lên đám mây hay máy trạm.
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import type { KeyProtector } from '../lan/tls-store';

/** Đọc/ghi một chuỗi bí mật; `null` = chưa có hoặc xoá. */
export interface FirebaseSecretStore { read(): string | null; write(value: string | null): void }

export function fileSecretStore(filePath: string, protector: KeyProtector): FirebaseSecretStore {
  return {
    read() {
      if (!existsSync(filePath)) return null;
      // Tệp hỏng hoặc mã hoá ở máy/tài khoản Windows khác: coi như chưa có,
      // người dùng kết nối lại bằng mật khẩu.
      try { return protector.decrypt(readFileSync(filePath)).toString('utf8'); } catch { return null; }
    },
    write(value) {
      if (value == null) { rmSync(filePath, { force: true }); return; }
      const temp = `${filePath}.tmp`;
      writeFileSync(temp, protector.encrypt(Buffer.from(value, 'utf8')));
      renameSync(temp, filePath);
    },
  };
}
