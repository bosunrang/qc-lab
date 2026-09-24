// Phần dùng chung của 8 tab "Cấu hình chung". Tách ra 2026-09-03 khi
// ManagePage.tsx đã lên 1121 dòng gồm 6 tab trong cùng một file — mỗi tab giờ
// một file, file này giữ đúng những gì NHIỀU tab cùng dùng.
import type { ReactNode } from 'react';
import { daysToExpiry } from '../../view-models/dashboard-view-model';
import { WG_RULES } from '../../../main/domain/westgard-rules';

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


export const WESTGARD_RULES = WG_RULES;

export function parseRuleConfig(json: string): Record<string, string> {
  try { const parsed = JSON.parse(json); return parsed && typeof parsed === 'object' ? parsed : {}; } catch { return {}; }
}


export function lotStatus(lot: { depleted?: 0 | 1; exp?: string }, toLotNo?: string): { text: string; cls: string } {
  if (lot.depleted) return { text: toLotNo ? `Đã chuyển tiếp qua lô ${toLotNo}` : 'Đã chuyển tiếp', cls: 'rej' };
  const days = daysToExpiry(lot.exp || '');
  if (days == null) return { text: 'Chưa có HSD', cls: 'none' };
  if (days < 0) return { text: 'Hết hạn', cls: 'rej' };
  if (days <= 30) return { text: `Còn ${days} ngày`, cls: 'warn' };
  return { text: 'Đang hoạt động', cls: 'ok' };
}

/** Hàng 2 ô trong modal — hệ thống dùng `.grid2` dùng chung (gap 10px, 1 cột ở
 * ≤760px), không phải lưới riêng từng modal. */
export function FieldRow({ children }: { children: ReactNode }) { return <div className="grid2">{children}</div>; }

/** Trạng thái trống dùng cho các thẻ Cấu hình chung. Mỗi thẻ chỉ truyền nội
 * dung nghiệp vụ; cấu trúc DOM và style căn giữa được giữ đồng nhất. */
export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty"><div className="empty-title">{title}</div><div>{children}</div></div>;
}


