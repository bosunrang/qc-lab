// Tổng quan nhiều đợt × nhiều máy của trang Phân tích ngoại kiểm. Hàm thuần;
// main gọi khi dựng danh sách đợt, renderer chỉ trình bày.

export interface EqaRoundPresence {
  id: string; programId: string; year: number; status: string;
  /** Máy có kết quả ở phiên bản hiện hành của đợt. */
  instrumentIds: readonly string[];
}

/** Máy chưa có báo cáo ở từng đợt đang dùng (id đợt → id máy).
 *
 * Mỗi file PDF là một máy (E-12), nên một đợt dễ thiếu báo cáo của một máy mà
 * không ai thấy. Máy "cần có" là máy đã có kết quả ở bất kỳ đợt đang dùng nào
 * của cùng chương trình và năm. Không chỉ xét các đợt trước: người dùng có thể
 * nhập đợt muộn trước đợt sớm. Đợt đã huỷ không tính và không bị báo thiếu. */
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
    const missing = [...(expected.get(`${r.programId}\u0000${r.year}`) ?? [])].filter((id) => !present.has(id));
    if (missing.length) out.set(r.id, missing);
  }
  return out;
}
