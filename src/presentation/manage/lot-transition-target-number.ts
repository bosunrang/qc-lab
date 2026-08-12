type Transition = { fromLotId?: string; toLotId?: string };
type Lot = { id?: string; lotNo?: string };

export function lotTransitionTargetNumber(transitions: Transition[], lots: Lot[], lotId: string, switchesLot: (transition: Transition) => boolean) {
  const transition = transitions.find(item => item.fromLotId === lotId && switchesLot(item));
  if (!transition) return '';
  return lots.find(lot => lot.id === transition.toLotId)?.lotNo || '';
}
