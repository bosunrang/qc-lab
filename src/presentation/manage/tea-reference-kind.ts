export type TeaReferenceKind = 'default' | 'override' | 'lab' | 'custom';

export function teaReferenceKind(isDefault: boolean, externallyChanged: boolean, hasLabValue: boolean): TeaReferenceKind {
  if (!isDefault) return 'custom';
  if (externallyChanged) return 'override';
  if (hasLabValue) return 'lab';
  return 'default';
}
