// Tổng quan nhiều đợt × nhiều máy của trang Phân tích ngoại kiểm. Hàm thuần;
// main gọi khi dựng danh sách đợt, renderer chỉ trình bày.

export interface EqaRoundPresence {
  id: string; programId: string; year: number; status: string;
  /** Máy có kết quả ở phiên bản hiện hành của đợt. */
  instrumentIds: readonly string[];
  /** Máy đã khai cho đợt trong lịch ngoại kiểm, nếu có. Khi có thì đây là danh
   * sách "cần có" chắc chắn, thay cho phần suy từ các đợt khác. */
  expectedIds?: readonly string[];
}

/** Máy chưa có báo cáo ở từng đợt đang dùng (id đợt → id máy).
 *
 * Mỗi file PDF là một máy (E-12), nên một đợt dễ thiếu báo cáo của một máy mà
 * không ai thấy. Máy "cần có" là máy đã có kết quả ở bất kỳ đợt đang dùng nào
 * của cùng chương trình và năm. Không chỉ xét các đợt trước: người dùng có thể
 * nhập đợt muộn trước đợt sớm. Đợt đã huỷ không tính và không bị báo thiếu.
 * Đợt đã khai máy trong lịch (`expectedIds`) thì so với đúng danh sách đó, nên
 * đợt đầu năm cũng phát hiện được máy thiếu và máy cố ý bỏ ra không bị báo. */
export function eqaMissingInstruments(rounds: readonly EqaRoundPresence[]): Map<string, string[]> {
  const open = rounds.filter((r) => r.status === 'open');
  const expected = new Map<string, Set<string>>();
  for (const r of open) {
    const key = `${r.programId}\u0000${r.year}`;
    const set = expected.get(key) ?? new Set<string>();
    for (const id of r.instrumentIds) set.add(id);
    expected.set(key, set);
  }
  const out = new Map<string, string[]>();
  for (const r of open) {
    const present = new Set(r.instrumentIds);
    const want = r.expectedIds?.length ? r.expectedIds : [...(expected.get(`${r.programId}\u0000${r.year}`) ?? [])];
    const missing = want.filter((id) => !present.has(id));
    if (missing.length) out.set(r.id, missing);
  }
  return out;
}
