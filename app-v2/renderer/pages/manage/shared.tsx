// Phần dùng chung của 8 tab "Cấu hình chung". Tách ra 2026-09-03 khi
// ManagePage.tsx đã lên 1121 dòng gồm 6 tab trong cùng một file — mỗi tab giờ
// một file, file này giữ đúng những gì NHIỀU tab cùng dùng.
import type { ReactNode } from 'react';
import { daysToExpiry } from '../../view-models/dashboard-view-model';

export type TabId = 'instruments' | 'tests' | 'panels' | 'lots' | 'targets' | 'transitions' | 'history' | 'tearefs';

// Năm tab đầu tạo cấu hình (máy → xét nghiệm → Panel → lô → Mean/SD); ba tab
// sau phục vụ vận hành và tra cứu. Thứ tự này là thứ tự thao tác của người dùng.
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

// Icon chỉ là tín hiệu nhận diện nhanh cho thanh tab, nên dùng nét mảnh cùng
// hệ với icon điều hướng, không thêm một lớp "thẻ" hoặc màu riêng cho từng mục.
const TAB_ICON_PATHS: Record<TabId, ReactNode> = {
  instruments: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h6M7 12h10M7 16h4" /><circle cx="17" cy="8" r="1" /></>,
  tests: <><path d="M9 3h6M10 3v5l-4.8 8.3A3 3 0 0 0 7.8 21h8.4a3 3 0 0 0 2.6-4.7L14 8V3" /><path d="M7.5 16h9" /><path d="m10 12 1.5 1.5L14.5 10" /></>,
  panels: <><rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" /><rect x="14" y="14" width="7" height="7" rx="1.2" /></>,
  lots: <><path d="M7 3h10v5l3 3v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8l3-3Z" /><path d="M7 3v5h10V3M8 14h8M10 17h4" /></>,
  targets: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></>,
  transitions: <><path d="M4 7h13" /><path d="m14 3 4 4-4 4" /><path d="M20 17H7" /><path d="m10 13-4 4 4 4" /></>,
  history: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  tearefs: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22Z" /><path d="M7 7h2M15 7h2" /></>,
};

export function ConfigTabIcon({ id }: { id: TabId }) {
  return <svg className="config-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TAB_ICON_PATHS[id]}</svg>;
}

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
