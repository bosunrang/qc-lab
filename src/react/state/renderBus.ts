let version = 0;
const listeners = new Set<() => void>();

export const renderBus = {
  notify: () => { version++; listeners.forEach(listener => listener()); },
  subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
  getSnapshot: () => version,
};
