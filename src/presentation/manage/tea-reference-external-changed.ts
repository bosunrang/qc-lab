type TeaReference = { unit?: unknown; clia?: unknown; ricos?: unknown; section?: unknown; cliaRule?: unknown; cliaAbsolute?: unknown; cliaAbsoluteUnit?: unknown };
type DefaultReference = readonly [unknown, unknown, unknown, unknown, unknown];

export function teaReferenceExternalChanged(row: TeaReference | undefined, base: DefaultReference | undefined) {
  return !!(row && base && (
    row.unit !== base[1]
    || row.clia !== base[2]
    || row.ricos !== base[3]
    || row.section !== base[4]
    || ['cliaRule', 'cliaAbsolute', 'cliaAbsoluteUnit'].some(field => row[field as keyof TeaReference] != null && row[field as keyof TeaReference] !== '')
  ));
}
