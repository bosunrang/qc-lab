import { getKernel } from '../state/kernel';

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
