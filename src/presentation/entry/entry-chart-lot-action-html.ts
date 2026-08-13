type EntryChartLotActionInput = { parallel: boolean; hasPreviousLots: boolean; showingPreviousLot: boolean; level: number; previousLot: string; applied: string };

type EntryChartLotActionDependencies = { button: (label: string, action: string, variant: string) => string; rangeSource: (input: { applied: string }) => string };

export function createEntryChartLotActionHtml(deps: EntryChartLotActionDependencies) {
  return (input: EntryChartLotActionInput) => input.parallel
    ? '<span class="hint">Đang đánh giá</span>'
    : input.hasPreviousLots
      ? input.showingPreviousLot
        ? deps.button('Xem lô mới', `event.stopPropagation();entryShowCurrentLot(${input.level})`, 'teal sm')
        : deps.button('Xem lô cũ', `event.stopPropagation();entryShowPrevLot(${input.level},'${input.previousLot}')`, 'ghost sm')
      : deps.rangeSource({ applied: input.applied });
}
