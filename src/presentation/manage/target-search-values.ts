type Assay = { name?: string; unit?: string; method?: string; reagent?: string; section?: string; instrumentId?: string; machine?: string };
type Lot = { lotNo?: string };

export function targetSearchValues(
  assay: Assay,
  groupName: string | undefined,
  lots: Lot[],
  displayName: (assay: Assay) => string,
  instrumentName: (id: string | undefined, fallback: string | undefined) => string,
) {
  return [assay.name, displayName(assay), assay.unit, assay.method, assay.reagent, assay.section, instrumentName(assay.instrumentId, assay.machine), groupName, ...lots.map(lot => lot.lotNo)];
}
