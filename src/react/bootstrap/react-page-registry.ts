import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';

export type ReactPageFactory = () => ReactNode;

export function createReactPageRegistry(pages: Record<string, ReactPageFactory>) {
  let mountedId: string | null = null;
  let root: Root | null = null;

  const isReactPage = (id: string) => Object.prototype.hasOwnProperty.call(pages, id);

  const unmountReactPageIfMounted = () => {
    if (!root) return;
    root.unmount();
    root = null;
    mountedId = null;
  };

  const mountReactPage = (id: string, container: HTMLElement) => {
    const factory = pages[id];
    if (!factory) return;
    if (mountedId !== id || !root) {
      unmountReactPageIfMounted();
      root = createRoot(container);
      mountedId = id;
    }
    root.render(factory());
  };

  return { isReactPage, mountReactPage, unmountReactPageIfMounted };
}
