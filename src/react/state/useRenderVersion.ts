import { useSyncExternalStore } from 'react';
import { renderBus } from './renderBus';

export function useRenderVersion() {
  return useSyncExternalStore(renderBus.subscribe, renderBus.getSnapshot);
}
