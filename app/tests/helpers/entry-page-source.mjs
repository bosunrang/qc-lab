// Mã nguồn trang Nhập QC gồm `pages/EntryPage.tsx` và các khối con ở
// `pages/entry/` (tách ngày 2026-09-26). Test đọc mã bằng regex đọc gộp cả
// hai, để việc chuyển một đoạn mã sang tệp con không làm mất kiểm tra.
import { readdirSync, readFileSync } from 'node:fs';

const PAGES = new URL('../../renderer/pages/', import.meta.url);

export function readEntryPageSources() {
  const entryDir = new URL('entry/', PAGES);
  const parts = [readFileSync(new URL('EntryPage.tsx', PAGES), 'utf8')];
  for (const name of readdirSync(entryDir).sort()) {
    if (/\.tsx?$/.test(name)) parts.push(readFileSync(new URL(name, entryDir), 'utf8'));
  }
  return parts.join('\n');
}
