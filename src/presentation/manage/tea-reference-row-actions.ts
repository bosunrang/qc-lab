export type TeaReferenceRowAction = 'restore' | 'remove' | 'none';
export type TeaLabProfileAction = 'add' | 'view' | 'none';

export function teaReferenceRowActions(kind: string, canManage: boolean, hasLabValue: boolean) {
  return {
    action: !canManage ? 'none' : kind === 'override' ? 'restore' : kind === 'custom' ? 'remove' : 'none' as TeaReferenceRowAction,
    labProfile: canManage ? hasLabValue ? 'view' : 'add' : 'none' as TeaLabProfileAction,
  };
}
