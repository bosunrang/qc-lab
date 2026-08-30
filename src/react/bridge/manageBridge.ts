import { createElement } from 'react';
import { getKernel } from '../state/kernel';
import { openReactModal } from '../dialogs/modal-store';
import { InstrumentModal } from '../modals/InstrumentModal';
import { LotModal } from '../modals/LotModal';

export type ManageTab = { id: string; label: string; count: string | number };
export type ManageToolbar = { title: string; subtitle?: string; action?: { action: string; args?: unknown[] } | null; actionLabel?: string };
export type ManageModel = {
  tab: string;
  tabs: ManageTab[];
  query: string;
  searchPlaceholder: string;
  body: any;
};

export const manageModel = (): ManageModel => getKernel().manage.manageModel();
export const headOnlyHtml = (title: string, subtitle: string): string => getKernel().pres.headOnly(title, subtitle);
export const dateBoxHtml = (id: string, value: string, cls: string, attrs: string): string => getKernel().pres.dateBox(id, value, cls, attrs);
export const manageSearchSet = (value: string): void => getKernel().manage.manageSearchSet(value);
export const setTargetPanel = (id: string): void => getKernel().manage.setTargetPanel(id);
export const setTargetGroup = (id: string): void => getKernel().manage.setTargetGroup(id);
export const setHistoryTest = (id: string): void => getKernel().manage.setHistoryTest(id);
export const setManageTab = (id: string): void => getKernel().manage.setManageTab(id);
export const openConfigInstrument = (id?: string): void => {
  const model = getKernel().manage.openConfigInstrumentModel(id);
  openReactModal(() => createElement(InstrumentModal, model));
};
export const deleteConfigInstrument = (id: string): void => getKernel().manage.deleteConfigInstrument(id);
export const openConfigAssay = (id?: string): void => getKernel().manage.openConfigAssay(id);
export const delTest = (id: string): void => getKernel().manage.delTest(id);
export const openConfigPanel = (id?: string): void => getKernel().manage.openConfigPanel(id);
export const deleteConfigPanel = (id: string): void => getKernel().manage.deleteConfigPanel(id);
export const openConfigLot = (id?: string): void => {
  const model = getKernel().manage.openConfigLotModel(id);
  openReactModal(() => createElement(LotModal, model));
};
export const deleteConfigLot = (id: string): void => getKernel().manage.deleteConfigLot(id);
export const openConfigGroup = (id?: string): void => getKernel().manage.openConfigGroup(id);
export const openTargetMatrix = (panelId: string, groupId: string): void => getKernel().manage.openTargetMatrix(panelId, groupId);
export const activateLotGroup = (id: string): void => getKernel().manage.activateLotGroup(id);
export const toggleLotGroupStatus = (id: string): void => getKernel().manage.toggleLotGroupStatus(id);
export const deleteConfigGroup = (id: string): void => getKernel().manage.deleteConfigGroup(id);
export const openLotTransitionV2 = (id?: string): void => getKernel().manage.openLotTransitionV2(id);
export const deleteLotTransition = (id: string): void => getKernel().manage.deleteLotTransition(id);
export const openQcHistoryDetail = (testId: string, level: unknown, lot: string): void => getKernel().manage.openQcHistoryDetail(testId, level, lot);
export const teaRefEdit = (analyteId: string, field: string, val: unknown): void => getKernel().manage.teaRefEdit(analyteId, field, val);
export const teaLabProfileOpen = (analyteId: string): void => getKernel().manage.teaLabProfileOpen(analyteId);
export const teaRefRemove = (analyteId: string): void => getKernel().manage.teaRefRemove(analyteId);
export const teaRefOpenAdd = (): void => getKernel().manage.teaRefOpenAdd();
export const toggleTargetRow = (el: HTMLInputElement): void => { getKernel().manage.toggleTargetRow.call(el); };
export const syncTargetRange = (el: HTMLInputElement, source: string): void => { getKernel().manage.syncTargetRange.call(el, source); };
export const setTargetLevel = (level: number): void => getKernel().manage.setTargetLevel(level);
export const targetCheckAll = (checked: boolean): void => getKernel().manage.targetCheckAll(checked);
export const saveTargetMatrix = (): void => getKernel().manage.saveTargetMatrix();
