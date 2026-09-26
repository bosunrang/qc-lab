// Ghi log ra tệp trong thư mục dữ liệu của app, chỉ lưu tại máy (kế hoạch
// kiến trúc G.2). Mỗi dòng là một JSON `{ ts, level, source, message, detail }`
// để đọc bằng mắt được mà vẫn lọc được bằng công cụ. Xoay vòng theo cỡ tệp:
// `qclab.log` đầy thì đổi thành `qclab.1.log`, tệp cũ nhất bị bỏ.
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { LogEntry } from './log-sink';

export const LOG_FILE_NAME = 'qclab.log';

export interface FileLoggerOptions {
  dir: string;
  /** Cỡ tối đa của một tệp, byte. Mặc định 1 MB. */
  maxBytes?: number;
  /** Số tệp giữ lại, kể cả tệp đang ghi. Mặc định 5. */
  maxFiles?: number;
  now?: () => Date;
}

export function createFileLogger(options: FileLoggerOptions) {
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  const maxFiles = Math.max(1, options.maxFiles ?? 5);
  const now = options.now ?? (() => new Date());
  const current = join(options.dir, LOG_FILE_NAME);
  const rotated = (index: number) => join(options.dir, `qclab.${index}.log`);
  mkdirSync(options.dir, { recursive: true });

  function sizeOf(path: string): number {
    try { return statSync(path).size; } catch { return 0; }
  }

  function rotate(): void {
    const oldest = rotated(maxFiles - 1);
    if (maxFiles === 1) { if (existsSync(current)) unlinkSync(current); return; }
    if (existsSync(oldest)) unlinkSync(oldest);
    for (let index = maxFiles - 2; index >= 1; index--) {
      if (existsSync(rotated(index))) renameSync(rotated(index), rotated(index + 1));
    }
    if (existsSync(current)) renameSync(current, rotated(1));
  }

  function write(entry: LogEntry): void {
    const line = JSON.stringify({ ts: now().toISOString(), ...entry }) + '\n';
    const bytes = Buffer.byteLength(line);
    const size = sizeOf(current);
    if (size > 0 && size + bytes > maxBytes) rotate();
    appendFileSync(current, line, 'utf8');
  }

  return { write, dir: options.dir, file: current };
}

export type FileLogger = ReturnType<typeof createFileLogger>;
