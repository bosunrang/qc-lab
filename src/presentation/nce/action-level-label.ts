export type ActionLevelLabelInput = { level?: string | number; lot?: string; mean?: number; sd?: number; applied?: string };

export function actionLevelLabel(input: ActionLevelLabelInput | null | undefined, formatValue: (value: number | undefined) => string, formatStat: (value: number | undefined) => string) {
  if(!input)return 'Mức ?';
  const lot=input.lot ? ` · Lô ${input.lot}` : ' · Chưa có lô';
  const range=` · Mean ${formatValue(input.mean)} · SD ${formatStat(input.sd)}`;
  const band=input.applied ? ` · ${input.applied==='lab'?'PXN':'NSX'}` : '';
  return `Mức ${input.level}${lot}${range}${band}`;
}
