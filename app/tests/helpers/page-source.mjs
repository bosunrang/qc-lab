// Mã nguồn một trang gồm `pages/<Tên>Page.tsx` và các khối con ở thư mục
// `pages/<thư mục>/` (Nhập QC, Westgard, Sigma tách từ 2026-09-26). Test đọc
// mã bằng regex đọc gộp cả hai, để việc chuyển một đoạn mã sang tệp con không
// làm mất kiểm tra.
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const PAGES = new URL('../../renderer/pages/', import.meta.url);

export function readPageSources(pageFile, subdir) {
  const parts = [readFileSync(new URL(pageFile, PAGES), 'utf8')];
  const dir = new URL(`${subdir}/`, PAGES);
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).sort()) {
      if (/\.tsx?$/.test(name)) parts.push(readFileSync(new URL(name, dir), 'utf8'));
    }
  }
  return parts.join('\n');
}

export const readEntryPageSources = () => readPageSources('EntryPage.tsx', 'entry');
export const readWestgardPageSources = () => readPageSources('WestgardPage.tsx', 'westgard');
export const readSigmaPageSources = () => readPageSources('SigmaPage.tsx', 'sigma');
