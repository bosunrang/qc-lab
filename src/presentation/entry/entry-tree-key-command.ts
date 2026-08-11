export type EntryTreeKeyCommand = 'toggle' | 'navigate' | null;

export function entryTreeKeyCommand(key: string, expanded: string | null): EntryTreeKeyCommand {
  if (key === 'Enter' || key === ' ') return 'toggle';
  if ((key === 'ArrowRight' && expanded === 'false') || (key === 'ArrowLeft' && expanded === 'true')) return 'toggle';
  return key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End' ? 'navigate' : null;
}
