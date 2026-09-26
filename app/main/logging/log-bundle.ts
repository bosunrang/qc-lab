import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildZip, type ZipEntry } from './zip-writer';

/** Thông tin môi trường kèm gói log, để người nhận biết log từ máy nào. */
export interface LogBundleInfo { appVersion: string; electronVersion: string; exportedBy: string }

/**
 * Gom mọi tệp trong thư mục log (log xoay vòng và thư mục `crashes/`) cùng một
 * tệp `thong-tin.txt` thành một gói ZIP (kế hoạch kiến trúc G.2). Log đã được
 * che mật khẩu, token, khoá API ngay lúc ghi (`domain/log-redact.ts`), nên gói
 * không cần che lại. Không đưa CSDL vào gói: dữ liệu QC không rời máy theo
 * đường này.
 */
export function buildLogBundle(logDir: string, info: LogBundleInfo, now = new Date()): { zip: Buffer; files: number } {
  const entries: ZipEntry[] = [];
  const walk = (dir: string, prefix: string) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full, `${prefix}${name}/`);
      else if (stat.isFile()) entries.push({ name: `${prefix}${name}`, data: readFileSync(full), mtime: stat.mtime });
    }
  };
  walk(logDir, 'logs/');
  const files = entries.length;
  const lines = [
    'Gói log QC Lab',
    `Xuất lúc: ${now.toLocaleString('vi-VN')} (${now.toISOString()})`,
    `Người xuất: ${info.exportedBy}`,
    `Phiên bản app: ${info.appVersion}`,
    `Electron: ${info.electronVersion} · Node ${process.versions.node}`,
    `Hệ điều hành: ${os.type()} ${os.release()} (${os.arch()})`,
    `Số tệp log/crash: ${files}`,
    '',
    'Gói chỉ gồm tệp log và tệp crash của ứng dụng; không chứa CSDL, mật khẩu hay token.',
  ];
  entries.unshift({ name: 'thong-tin.txt', data: Buffer.from('﻿' + lines.join('\r\n') + '\r\n', 'utf8'), mtime: now });
  return { zip: buildZip(entries), files };
}
