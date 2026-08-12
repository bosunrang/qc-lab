export function teaReferenceNamingTitle(values: { standardName?: string; abbreviation?: string; matrix?: string }) {
  return [values.standardName && `Tên chuẩn: ${values.standardName}`, values.abbreviation && `Viết tắt: ${values.abbreviation}`, values.matrix && `Loại mẫu: ${values.matrix}`].filter(Boolean).join(' · ');
}
