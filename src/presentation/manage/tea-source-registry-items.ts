type Source = { status?: string; label?: string; version?: string; effectiveDate?: string; reviewedDate?: string; url?: string };

export function teaSourceRegistryItems(registry: Record<string, Source>, formatDate: (date: string) => string) {
  return ['clia', 'ricos', 'eflm'].map(key => {
    const source = registry[key] || {};
    const status = source.status || '';
    return {
      status,
      label: source.label || '',
      statusLabel: status === 'retired' ? 'Nguồn cũ' : status === 'dynamic' ? 'Cập nhật liên tục' : 'Hiện hành',
      tagClass: status === 'retired' ? 'warn' : status === 'dynamic' ? 'ok' : 'none',
      version: source.version || '',
      effectiveDate: source.effectiveDate ? formatDate(source.effectiveDate) : '',
      reviewedDate: formatDate(source.reviewedDate || ''),
      url: source.url || '',
    };
  });
}
