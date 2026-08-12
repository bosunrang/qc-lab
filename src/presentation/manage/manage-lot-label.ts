export function manageLotLabel(lots: Array<{ id: string; lotNo?: string; level?: number }>, id: string) {
  const lot = lots.find(item => item.id === id);
  return lot ? `${lot.lotNo} · Mức ${lot.level}` : 'Chưa chọn lô';
}
