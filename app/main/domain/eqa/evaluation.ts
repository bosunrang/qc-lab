// Đánh giá kết quả ngoại kiểm định lượng (docs/EQA-PLAN-2026-10-28.md).
//
// Hàm thuần, không phụ thuộc SQLite: điểm z, xếp loại theo ISO 13528, đối
// chiếu z do nhà cung cấp báo và so sánh nhóm đồng đẳng. Main gọi các hàm này
// khi xem trước và khi ghi; renderer chỉ trình bày kết quả đã tính.

/** Ngưỡng đánh giá theo ISO 13528:2022 mục 9.4.2 (z 2/3). */
export interface EqaConfig { zWarn: number; zReject: number }
export const EQA_DEFAULT_CONFIG: EqaConfig = { zWarn: 2, zReject: 3 };

/** Sai lệch cho phép khi so z của app với z nhà cung cấp: nhà cung cấp làm
 * tròn z tới 2 chữ số (sai số ≤ 0,005), cộng thêm làm tròn X và σp. */
export const EQA_PROVIDER_Z_TOLERANCE = 0.02;

export type EqaClass = 'ok' | 'warn' | 'rej';
/** `match` khớp; `swapped` trùng độ lớn nhưng ngược dấu (kết quả và giá trị
 * ấn định bị đọc đổi chỗ, lỗi chặn khi nhập); `mismatch` lệch khác; `none`
 * không có z nhà cung cấp hoặc cả hai gần 0 nên không phân biệt được chiều. */
export type EqaProviderCheck = 'match' | 'swapped' | 'mismatch' | 'none';

export const EQA_CLASS_LABEL: Readonly<Record<EqaClass, string>> = { ok: 'Chấp nhận', warn: 'Cảnh báo', rej: 'Không chấp nhận' };
export const EQA_PROVIDER_CHECK_LABEL: Readonly<Record<EqaProviderCheck, string>> = {
  match: 'Khớp nhà cung cấp', swapped: 'Ngược dấu nhà cung cấp', mismatch: 'Lệch nhà cung cấp', none: 'Không đối chiếu',
};

/** Ba cấp nhóm so sánh trong báo cáo của nhà cung cấp. */
export const EQA_PEER_LEVELS = ['all', 'method', 'instrument'] as const;
export type EqaPeerLevel = typeof EQA_PEER_LEVELS[number];
export const EQA_PEER_LABEL: Readonly<Record<EqaPeerLevel, string>> = { all: 'Tất cả phương pháp', method: 'Cùng phương pháp', instrument: 'Cùng thiết bị' };
export interface EqaPeerStats { mean: number | null; sd: number | null; cv: number | null; n: number | null }
export type EqaPeer = Partial<Record<EqaPeerLevel, EqaPeerStats>>;

/** z = (x − X) / σp (ISO 13528:2022). `null` khi thiếu số hoặc σp ≤ 0. */
export function eqaZ(result: number | null, assigned: number | null, sigmaP: number | null): number | null {
  if (result === null || assigned === null || sigmaP === null || !(sigmaP > 0)) return null;
  const z = (result - assigned) / sigmaP;
  return Number.isFinite(z) ? z : null;
}

/** % lệch so với giá trị ấn định; `null` khi X = 0. */
export function eqaPct(result: number | null, assigned: number | null): number | null {
  if (result === null || assigned === null || assigned === 0) return null;
  const pct = (result - assigned) / Math.abs(assigned) * 100;
  return Number.isFinite(pct) ? pct : null;
}

/** |z| ≤ 2,0 chấp nhận; 2,0 < |z| < 3,0 cảnh báo; |z| ≥ 3,0 không chấp nhận.
 * So sánh trên z làm tròn 2 chữ số như báo cáo, để z = 2,004 không thành
 * cảnh báo chỉ vì phần thập phân không hiển thị. */
export function eqaClass(z: number, config: EqaConfig = EQA_DEFAULT_CONFIG): EqaClass {
  const a = Math.round(Math.abs(z) * 100) / 100;
  if (a >= config.zReject) return 'rej';
  return a > config.zWarn ? 'warn' : 'ok';
}

/** Hai số trên báo cáo bằng nhau (bỏ qua sai số dấu phẩy động). */
export function eqaSameValue(a: number | null, b: number | null): boolean {
  return a !== null && b !== null && Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-6);
}

/** Nhóm so sánh có trung bình trùng giá trị ấn định; ưu tiên nhóm hẹp nhất
 * khi nhiều nhóm trùng. `null` khi không nhóm nào trùng. */
export function eqaAssignedLevel(peer: EqaPeer, assigned: number | null): EqaPeerLevel | null {
  return (['instrument', 'method', 'all'] as const).find((level) => eqaSameValue(peer[level]?.mean ?? null, assigned)) ?? null;
}

export function eqaProviderCheck(z: number | null, zProvider: number | null, tolerance = EQA_PROVIDER_Z_TOLERANCE): EqaProviderCheck {
  if (z === null || zProvider === null) return 'none';
  if (Math.abs(z - zProvider) <= tolerance) return 'match';
  if (Math.abs(z + zProvider) <= tolerance) return Math.abs(zProvider) > tolerance ? 'swapped' : 'none';
  return 'mismatch';
}

export interface EqaPeerComparison { level: EqaPeerLevel; mean: number; sd: number | null; sdi: number | null; pct: number | null; cv: number | null; n: number | null }

/** SDI và % lệch của kết quả PXN so với trung bình từng nhóm đồng đẳng. */
export function eqaPeerComparison(result: number, peer: EqaPeer): EqaPeerComparison[] {
  return EQA_PEER_LEVELS.flatMap((level) => {
    const stats = peer[level];
    if (!stats || stats.mean === null) return [];
    const sdi = stats.sd && stats.sd > 0 ? (result - stats.mean) / stats.sd : null;
    const pct = stats.mean !== 0 ? (result - stats.mean) / Math.abs(stats.mean) * 100 : null;
    return [{ level, mean: stats.mean, sd: stats.sd, sdi, pct, cv: stats.cv, n: stats.n }];
  });
}

export interface EqaCounts { total: number; ok: number; warn: number; rej: number; acceptPct: number | null }

/** Đếm theo xếp loại. Tỷ lệ chấp nhận chỉ là chỉ số tổng hợp của đợt/máy,
 * không phải tiêu chí đạt/không đạt (EQA-REVIEW N-06: đánh giá theo từng xét
 * nghiệm qua các đợt). */
export function eqaCounts(classes: readonly EqaClass[]): EqaCounts {
  const ok = classes.filter((c) => c === 'ok').length, warn = classes.filter((c) => c === 'warn').length, rej = classes.filter((c) => c === 'rej').length;
  return { total: classes.length, ok, warn, rej, acceptPct: classes.length ? ok / classes.length * 100 : null };
}

/** Bỏ dấu tiếng Việt và viết thường, giữ nguyên các ký tự khác. */
export function eqaFold(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

/** Bỏ dấu, chữ thường, chỉ giữ chữ và số — để so mã thông số/máy của chương
 * trình với danh mục mà không phụ thuộc cách viết. */
export function eqaNormalize(value: unknown): string {
  return eqaFold(value).replace(/[^a-z0-9]+/g, '');
}

/** Các từ của một mã thông số: "ALT(GPT)" → alt, gpt. */
function tokensOf(value: unknown): string[] {
  return eqaFold(value).split(/[^a-z0-9]+/).filter(Boolean);
}

export interface EqaCatalogTest {
  id: string; name: string; display_name: string; standard_name: string; abbreviation: string; aliases: readonly string[];
  instrument_id: string; instrument_name: string; instrument_model: string; active: boolean;
}

/** Gợi ý xét nghiệm cho một cặp mã thông số × tên máy của chương trình. Chỉ
 * là gợi ý: người dùng xác nhận ánh xạ trước khi ghi. */
export function eqaSuggestTests(code: string, instrument: string, tests: readonly EqaCatalogTest[]): string[] {
  const codeKeys = new Set([eqaNormalize(code), ...tokensOf(code)].filter(Boolean));
  const device = eqaNormalize(instrument);
  const deviceMatch = (test: EqaCatalogTest) => {
    const names = [test.instrument_name, test.instrument_model].map(eqaNormalize).filter(Boolean);
    return !!device && names.some((name) => name === device || name.includes(device) || device.includes(name));
  };
  const nameMatch = (test: EqaCatalogTest) => [test.abbreviation, test.name, test.display_name, test.standard_name, ...test.aliases]
    .map(eqaNormalize).filter(Boolean).some((key) => codeKeys.has(key));
  return tests.filter((test) => test.active && nameMatch(test) && deviceMatch(test)).map((test) => test.id);
}

/** "ĐỢT 02" → 2; dùng để xếp thứ tự các đợt trong năm. */
export function eqaRoundNumber(round: string): number {
  const match = String(round ?? '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}
