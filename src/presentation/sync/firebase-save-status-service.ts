export type FirebaseSaveStatusService = Readonly<{ mark: (label: string, detail?: string) => void }>;

export function createFirebaseSaveStatusService(find: (id: string) => any): FirebaseSaveStatusService {
  const mark = (label: string, detail = ''): void => {
    const element = find('saveStatus');
    if (element) element.innerHTML = `Lưu trữ: <b>${label}</b>${detail ? `<br>${detail}` : ''}`;
  };
  return Object.freeze({ mark });
}
