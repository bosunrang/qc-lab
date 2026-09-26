// IPC handler cho "Cấu hình chung". Renderer KHÔNG bao giờ chạm SQLite trực
// tiếp — chỉ gọi các hàm named ở đây qua bảng thao tác IPC. Mỗi thao tác ghi
// chạy trong 1 transaction + ghi 1 dòng audit.
//
// Tệp này chỉ ghép ba nhóm handler theo miền (tách ngày 2026-09-26, kế hoạch
// kiến trúc C.1; trước đó là một tệp 1.350 dòng gồm khoảng 8 miền):
// - `config-catalog-handlers.ts`: máy, xét nghiệm, mức QC, phạm vi luật, Panel QC;
// - `config-lot-handlers.ts`: lô, nhóm lô, Mean/SD dự kiến, chuyển tiếp lô;
// - `config-tea-handlers.ts`: bảng TEa tham chiếu.
import type { Db } from '../db/sqlite-like';
import { createCatalogConfigHandlers } from './config-catalog-handlers';
import { createLotConfigHandlers } from './config-lot-handlers';
import { createTeaRefHandlers } from './config-tea-handlers';

export function createConfigHandlers(db: Db) {
  return {
    ...createCatalogConfigHandlers(db),
    ...createLotConfigHandlers(db),
    ...createTeaRefHandlers(db),
  };
}

export type ConfigHandlers = ReturnType<typeof createConfigHandlers>;
