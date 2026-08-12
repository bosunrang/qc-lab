export function manageInstrumentName(instruments: Array<{ id: string; name?: string }>, id: string, fallback = '') {
  const instrument = instruments.find(item => item.id === id);
  return instrument?.name || fallback || 'Chưa gán máy';
}
