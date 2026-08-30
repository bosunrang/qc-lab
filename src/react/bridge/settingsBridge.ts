import { createElement } from 'react';
import { getKernel } from '../state/kernel';
import { openReactModal } from '../dialogs/modal-store';
import { LisQueueModal } from '../modals/LisQueueModal';

export type SettingsModel = {
  lab: { name: string; dept: string; address: string };
  brand: { title: string; subtitle: string; markText: string; logo: string };
  backup: { statusText: string; capacityText: string };
  firebase: { labCode: string; email: string; config: string; locked: boolean; dataPath: string };
  lis: { url: string; token: string; enabled: boolean; status: string; statusText: string };
  firebaseRulesText: string;
};

export const settingsModel = (): SettingsModel => getKernel().settings.settingsModel();
export const headOnlyHtml = (title: string, subtitle: string): string => getKernel().pres.headOnly(title, subtitle);
export const firebaseGuideHtml = (): string => getKernel().pres.settingsFirebaseGuideHtml();
export const saveLab = (): void => { getKernel().settings.saveLab(); };
export const saveBrand = (): void => { getKernel().settings.saveBrand(); };
export const pickLogo = (e: unknown): void => { getKernel().settings.pickLogo(e); };
export const clearLogo = (): void => getKernel().settings.clearLogo();
export const exportData = (): void => { getKernel().settings.exportData(); };
export const importData = (e: unknown): void => { getKernel().settings.importData(e); };
export const verifyBackupFile = (e: unknown): void => { getKernel().settings.verifyBackupFile(e); };
export const checkStorageUsage = (): void => { getKernel().settings.checkStorageUsage(); };
export const resetAllData = (): void => { getKernel().settings.resetAllData(); };
export const saveFb = (): void => { getKernel().settings.saveFb(); };
export const clearFb = (): void => { getKernel().settings.clearFb(); };
export const lisGatewaySaveSettings = (): void => { getKernel().settings.lisGatewaySaveSettings(); };
export const lisOpenQueueModal = async (): Promise<void> => {
  const ok = await getKernel().settings.lisOpenQueueModal();
  if (ok) openReactModal(() => createElement(LisQueueModal));
};
export const copyFirebaseRules = (): void => { getKernel().settings.copyFirebaseRules(); };
