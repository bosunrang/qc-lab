import { createElement } from 'react';
import { getKernel } from '../state/kernel';
import { openReactModal } from '../dialogs/modal-store';
import { UserPermissionsModal } from '../modals/UserPermissionsModal';

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
export const addUser = (): void => { getKernel().users.addUser(); };
export const syncUserPermChecks = (groupId: string, roleValue: string): void => getKernel().users.syncUserPermChecks(groupId, roleValue);
export const resetPass = (id: string): void => { getKernel().users.resetPass(id); };
export const openUserPerms = async (id: string): Promise<void> => {
  const model = await getKernel().users.openUserPerms(id);
  if (model) openReactModal(() => createElement(UserPermissionsModal, model));
};
export const toggleUser = (id: string): void => { getKernel().users.toggleUser(id); };
export const delUser = (id: string): void => { getKernel().users.delUser(id); };
