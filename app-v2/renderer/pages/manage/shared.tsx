// Phần dùng chung của 8 tab "Cấu hình chung". Tách ra 2026-09-03 khi
// ManagePage.tsx đã lên 1121 dòng gồm 6 tab trong cùng một file — mỗi tab giờ
// một file, file này giữ đúng những gì NHIỀU tab cùng dùng.
import type { ReactNode } from 'react';
import { daysToExpiry } from '../../view-models/dashboard-view-model';

export type TabId = 'instruments' | 'tests' | 'panels' | 'lots' | 'targets' | 'transitions' | 'history' | 'tearefs';

export const TABS: { id: TabId; label: string }[] = [
  { id: 'instruments', label: 'Máy xét nghiệm' },
  { id: 'tests', label: 'Danh mục xét nghiệm' },
  { id: 'panels', label: 'Panel QC' },
  { id: 'lots', label: 'Lô & Nhóm QC' },
  { id: 'targets', label: 'Mean/SD' },
  { id: 'transitions', label: 'Chuyển tiếp lô' },
  { id: 'history', label: 'Lịch sử dữ liệu' },
  { id: 'tearefs', label: 'Bảng TEa tham chiếu' },
];

export const WESTGARD_RULES = ['1-2s', '1-3s', '2-2s', 'R4s', '3-1s', '4-1s', '6x', '8x', '9x', '10x', '12x', '7T', '2of3-2s'];

export function parseRuleConfig(json: string): Record<string, string> {
  try { const parsed = JSON.parse(json); return parsed && typeof parsed === 'object' ? parsed : {}; } catch { return {}; }
}

/** Port `createManageLotStatus()` app cũ — cùng ngưỡng 30 ngày, cùng chữ,
 * cùng lớp màu. Đây là trạng thái HIỂN THỊ của lô, tính từ hạn dùng chứ
 * không phải cột `active` trong DB. */
export function lotStatus(lot: { depleted?: 0 | 1; exp?: string }, toLotNo?: string): { text: string; cls: string } {
  // Port `label()`/`transitionToNo()` app cũ: "Đã chuyển tiếp" một mình
  // không nói lô cũ đi ĐÂU — ghi rõ số lô mới nếu tra được (hồ sơ chuyển
  // tiếp đã 'accepted'), người dùng không phải mở tab "Chuyển tiếp lô" để
  // biết. Không tra được (hồ sơ chưa có/đã bị xoá) thì giữ nguyên câu cũ.
  if (lot.depleted) return { text: toLotNo ? `Đã chuyển tiếp qua lô ${toLotNo}` : 'Đã chuyển tiếp', cls: 'rej' };
  const days = daysToExpiry(lot.exp || '');
  if (days == null) return { text: 'Chưa có HSD', cls: 'none' };
  if (days < 0) return { text: 'Hết hạn', cls: 'rej' };
  if (days <= 30) return { text: `Còn ${days} ngày`, cls: 'warn' };
  return { text: 'Đang hoạt động', cls: 'ok' };
}

/** Hàng 2 ô trong modal — app cũ dùng `.grid2` dùng chung (gap 10px, 1 cột ở
 * ≤760px), không phải lưới riêng từng modal. */
export function FieldRow({ children }: { children: ReactNode }) { return <div className="grid2">{children}</div>; }

/** Trạng thái trống dùng cho các thẻ Cấu hình chung. Mỗi thẻ chỉ truyền nội
 * dung nghiệp vụ; cấu trúc DOM và style căn giữa được giữ đồng nhất. */
export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty"><div className="empty-title">{title}</div><div>{children}</div></div>;
}
