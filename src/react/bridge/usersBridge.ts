/* Cầu nối sang các global cổ điển (window.X) cho trang Người dùng — xem ghi
   chú đầu dashboardBridge.ts về lý do phải đọc window.X một cách LƯỜI. */

const w = () => window as any;

export type UserRow = {
  id: string;
  name: string;
  username: string;
  initials: string;
  role: string;
  active: boolean;
  current: boolean;
};

export const usersList = (): UserRow[] => w().usersModel();
export const roleLabel = (role: string): string => w().roleLabel(role);
export const roleSelectOptionsHtml = (selected: string): string => w().roleSelectOptions(selected);
export const userPermChecksHtml = (pageIds: string[], groupId: string, role: string): string => w().userPermChecks(pageIds, groupId, role);
export const rolePageIds = (role: string): string[] => w().rolePageIds(role);
export const headOnlyHtml = (title: string, subtitle: string): string => w().headOnly(title, subtitle);
