export type FirebaseCloudStatusPresentation = Readonly<{ set: (text: unknown, connected: boolean) => void }>;

export function createFirebaseCloudStatusPresentation(find: (id: string) => any): FirebaseCloudStatusPresentation {
  const set = (text: unknown, connected: boolean): void => {
    const element = find('cloudStatus');
    if (!element) return;
    const safe = String(text ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]!));
    element.className = `cloud ${connected ? 'connected' : 'offline'}`;
    element.innerHTML = connected ? `<b>Đang kết nối</b><small>${safe}</small>` : safe;
  };
  return Object.freeze({ set });
}
