import { getKernel } from '../state/kernel';

export type UserRow = {
  id: string;
  name: string;
  username: string;
  initials: string;
  role: string;
  active: boolean;
  current: boolean;
};

export const usersList = (): UserRow[] => getKernel().users.usersModel();
export const roleLabel = (role: string): string => getKernel().pres.roleLabel(role);
export const roleSelectOptionsHtml = (selected: string): string => getKernel().pres.roleSelectOptions(selected);
export const userPermChecksHtml = (pageIds: string[], groupId: string, role: string): string => getKernel().users.userPermChecks(pageIds, groupId, role);
export const rolePageIds = (role: string): string[] => getKernel().pres.rolePageIds(role);
export const headOnlyHtml = (title: string, subtitle: string): string => getKernel().pres.headOnly(title, subtitle);
