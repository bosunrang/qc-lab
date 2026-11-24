// Số liệu gợi ý cho bước "Xác minh kỹ thuật IQC" (D-18, D-20), tính từ dữ
// liệu QC mà app đã có — đánh giá giao diện 09/11/2026: trước đây người dùng
// phải gõ tay đơn vị, TEa, nguồn TEa, Bias ổn định, Bias lúc sự cố, SD, nguồn
// SD, độ phân tán và cỡ mẫu, trong khi chính app đang dùng các số đó để đánh
// giá Westgard và Sigma.
//
// Chỉ là GỢI Ý điền sẵn vào form: người dùng vẫn xem lại, sửa và bấm ghi; cổng
// `validateNceTechnicalAssessment()` không đổi. Mọi đại lượng dùng đơn vị %
// so với Mean đích (Bias% = (giá trị − Mean)/Mean × 100, SD tính thành CV%),
// để TEa%, Bias% và CV% cùng đơn vị như công thức ΔSEcrit, SEobs, ΔREcrit.
//
// Định nghĩa:
// - Giai đoạn ổn định: tối đa `STABLE_POINTS` điểm gần nhất của đúng mức + lô,
//   thuộc lần chạy được chấp nhận trước lần đầu của chuỗi vi phạm (D-22).
// - Bias ổn định: trung bình Bias% của giai đoạn ổn định.
// - Bias lúc sự cố: trung bình Bias% các điểm từ lần đầu chuỗi vi phạm tới
//   lần khởi đầu.
// - SD: CV% quan sát của giai đoạn ổn định khi đủ 20 điểm (CLSI C24); thiếu
//   thì dùng CV% của Mean/SD đích lúc sự cố và ghi rõ nguồn.
// - Độ phân tán quan sát: SD của Bias% các điểm sự cố khi có ≥ 2 điểm; một
//   điểm thì |Bias lúc sự cố − Bias ổn định|.
import type { NceTechnicalPrefillView } from '../../../shared/qc-api';

export type { NceTechnicalPrefillView };

export const STABLE_POINTS = 20;

export interface PrefillPoint { val: number; mean: number | null; sd: number | null }

const round = (value: number, digits = 3) => Number(value.toFixed(digits));

function biasPercent(point: PrefillPoint): number | null {
  if (point.mean == null || !Number.isFinite(point.mean) || point.mean === 0 || !Number.isFinite(point.val)) return null;
  return (point.val - point.mean) / Math.abs(point.mean) * 100;
}

function average(values: readonly number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function sampleSd(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const mean = average(values)!;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

export function computeTechnicalPrefill(input: {
  level: number; lot: string;
  /** Điểm của giai đoạn ổn định, cũ → mới (hàm tự lấy `STABLE_POINTS` điểm cuối). */
  stable: readonly PrefillPoint[];
  /** Điểm từ lần đầu chuỗi vi phạm tới lần khởi đầu. */
  incident: readonly PrefillPoint[];
  /** Mean/SD đích của mức lúc sự cố (điểm khởi đầu). */
  target: { mean: number | null; sd: number | null };
  tea: number | null; teaSource: string;
}): NceTechnicalPrefillView {
  const notes: string[] = [];
  const stablePoints = input.stable.slice(-STABLE_POINTS);
  const stableBiases = stablePoints.map(biasPercent).filter((value): value is number => value != null);
  const incidentBiases = input.incident.map(biasPercent).filter((value): value is number => value != null);
  const stableBias = average(stableBiases);
  const incidentBias = average(incidentBiases);

  let sd: number | null = null, sdSource = '';
  const observedCv = stableBiases.length >= STABLE_POINTS ? sampleSd(stableBiases) : null;
  if (observedCv != null && observedCv > 0) {
    sd = observedCv;
    sdSource = `CV% quan sát của ${stableBiases.length} điểm được chấp nhận trước sự cố (mức ${input.level}, lô ${input.lot})`;
  } else if (input.target.mean != null && input.target.sd != null && input.target.mean !== 0 && input.target.sd > 0) {
    sd = input.target.sd / Math.abs(input.target.mean) * 100;
    sdSource = `CV% của Mean/SD đích mức ${input.level}, lô ${input.lot} (Mean ${input.target.mean}, SD ${input.target.sd})`;
    notes.push(`Chưa đủ ${STABLE_POINTS} điểm ổn định trước sự cố (có ${stableBiases.length}) nên SD lấy theo Mean/SD đích.`);
  } else {
    notes.push('Chưa có Mean/SD đích hợp lệ để tính SD.');
  }

  const incidentSd = sampleSd(incidentBiases);
  const observedDispersion = incidentSd != null ? incidentSd
    : incidentBias != null && stableBias != null ? Math.abs(incidentBias - stableBias) : null;
  if (stableBias == null) notes.push('Chưa có điểm được chấp nhận trước sự cố để tính Bias ổn định.');
  if (input.tea == null) notes.push('Xét nghiệm chưa có TEa vận hành (Bảng TEa tham chiếu hoặc nguồn TEa ở Six Sigma).');

  return {
    level: input.level, lot: input.lot, unit: '%',
    tea: input.tea, teaSource: input.tea == null ? '' : input.teaSource,
    stableBias: stableBias == null ? null : round(stableBias),
    incidentBias: incidentBias == null ? null : round(incidentBias),
    sd: sd == null ? null : round(sd),
    sdSource,
    observedDispersion: observedDispersion == null ? null : round(observedDispersion),
    sampleCount: stableBiases.length >= 2 ? stableBiases.length : null,
    incidentCount: incidentBiases.length,
    notes,
  };
}
