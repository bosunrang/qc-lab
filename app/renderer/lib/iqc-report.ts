// Dữ liệu và trang in nội kiểm. Chỉ nhóm/lọc để trình bày; Z, luật và kết
// luận lấy nguyên từ main, không đánh giá lại Westgard trong renderer.
import type { NceRecordRow, ReportPointRow } from '../../shared/qc-api';
import type { QcMultiLevelSeries } from '../components/QcChart';
import { compareQcPointOrder } from '../../main/domain/sort-order';
import { ERROR_CLASS_LABEL } from '../../main/domain/westgard-rules';
import { NCE_SOURCE_LABEL, NCE_STATUS_LABEL, NCE_TIER_LABEL } from '../../main/domain/nce/labels';
import { vnDate } from './format';
import { DOCUMENT_CSS, documentHeader, escapeHtml as esc, signatureBlock, type PrintIdentity } from './print-document';

// Tệp dữ liệu giữ cột mức/lô trên từng dòng; bản in chia bảng theo mức.
export const POINT_HEADERS = ['Ngày', 'Mức', 'Lô', 'Lần chạy', 'Giá trị', 'Người thực hiện', 'Trạng thái'];
export const NCE_HEADERS = ['Mã NCE', 'Ngày phát hiện', 'Nguồn', 'Mô tả', 'Loại sai số', 'Tầng xử lý', 'Hạn xử lý', 'Trạng thái'];
const DETAIL_HEADERS = ['Ngày', 'Lô', 'Lần chạy', 'Giá trị', 'Z', 'Kết luận Westgard', 'Người thực hiện', 'Trạng thái dữ liệu'];
const VERDICTS = { ok: 'Đạt', warn: 'Cảnh báo', rej: 'Loại bỏ', none: 'Chưa đánh giá' };

export function pointRow(p: ReportPointRow): (string | number)[] {
  return [vnDate(p.date), p.level, p.lot || '—', p.run_id, p.val, p.operator_name || '—', p.voided ? `Đã huỷ: ${p.void_reason}` : 'Hợp lệ'];
}

export function nceRow(r: NceRecordRow): string[] {
  return [r.nce_id || '—', vnDate(r.detected_at), NCE_SOURCE_LABEL[r.source] || r.source, r.description || '—',
    ERROR_CLASS_LABEL[r.error_class] ?? ERROR_CLASS_LABEL[''], NCE_TIER_LABEL[r.tier] || '—',
    r.due_date ? vnDate(r.due_date) : '—', NCE_STATUS_LABEL[r.status] || r.status];
}

/** Giữ mọi dòng, kể cả đã huỷ; sắp ngày/lần chạy tự nhiên trong từng mức. */
export function iqcLevelGroups(points: readonly ReportPointRow[], from = '', to = '') {
  const groups = new Map<number, ReportPointRow[]>();
  for (const point of points) {
    if ((from && point.date < from) || (to && point.date > to)) continue;
    const group = groups.get(point.level) ?? [];
    group.push(point);
    groups.set(point.level, group);
  }
  return [...groups].sort(([a], [b]) => a - b).map(([level, rows]) => ({ level, points: rows.sort(compareQcPointOrder) }));
}

/** Tách mức/lô để không nối hai lô khác nhau thành một đường QC. */
export function iqcChartSeries(points: readonly ReportPointRow[], from = '', to = ''): QcMultiLevelSeries[] {
  const series: QcMultiLevelSeries[] = [];
  for (const group of iqcLevelGroups(points, from, to)) {
    const lots = new Map<string, QcMultiLevelSeries>();
    for (const point of group.points) {
      if (point.voided || point.verdict === 'none' || point.z === null || !Number.isFinite(point.z)) continue;
      let item = lots.get(point.lot);
      if (!item) {
        item = { level: group.level, lot: point.lot, label: `Mức ${group.level} · ${point.lot || 'Chưa rõ lô'}`, points: [] };
        lots.set(point.lot, item);
      }
      item.points.push({ date: point.date, runId: point.run_id, val: point.val, z: point.z,
        verdict: point.verdict, rules: point.rules, accepted: point.accepted, runRejectedBy: point.run_rejected_by });
    }
    series.push(...lots.values());
  }
  return series;
}

function verdictText(point: ReportPointRow): string {
  if (point.voided) return '—';
  const rules = point.rules.length ? ` · ${point.rules.join(', ')}` : '';
  const excluded = !point.accepted && point.verdict !== 'rej' && point.run_rejected_by.length
    ? ` · Lần chạy bị loại ở ${point.run_rejected_by.map((level) => `Mức ${level}`).join(', ')}` : '';
  return `${VERDICTS[point.verdict]}${rules}${excluded}`;
}

export function buildIqcPrintHtml(input: {
  identity: PrintIdentity; label: string; from: string; to: string;
  points: readonly ReportPointRow[]; nce: NceRecordRow[] | null; charts: readonly string[];
}): string {
  const { identity, label, from, to, nce } = input;
  const groups = iqcLevelGroups(input.points, from, to);
  const points = groups.flatMap((group) => group.points);
  const unevaluated = points.filter((point) => !point.voided && (point.verdict === 'none' || point.z === null || !Number.isFinite(point.z))).length;
  const charts = input.charts.filter((png) => png.startsWith('data:image/png;base64,'));
  const graph = charts.length ? charts.map((png) => `<figure class="lj"><img src="${esc(png)}" alt="Biểu đồ Levey-Jennings tổng hợp trong khoảng ngày báo cáo"></figure>`).join('')
    : '<p class="meta">Không có điểm QC còn hiệu lực và đủ Mean/SD để vẽ biểu đồ trong khoảng ngày này.</p>';
  const legend = charts.length ? '<p class="chart-note">Các mức quy về Z-score trên cùng trục. Tròn: đạt · tam giác: cảnh báo · vuông: loại bỏ theo luật Westgard · hình rỗng: lần chạy bị loại, không vào thống kê. Điểm đã huỷ chỉ lưu ở bảng chi tiết.</p>' : '';
  const details = groups.length ? groups.map((group) => {
    const voided = group.points.filter((point) => point.voided).length;
    const rows = group.points.map((point) => {
      const z = !point.voided && point.z !== null && Number.isFinite(point.z) ? point.z.toFixed(2) : '—';
      const cells = [vnDate(point.date), point.lot || '—', point.run_id || '—', point.val, z, verdictText(point), point.operator_name || '—', point.voided ? `Đã huỷ: ${point.void_reason}` : 'Còn hiệu lực'];
      return `<tr${point.voided ? ' class="voided"' : ''}>${cells.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`;
    }).join('');
    // Nhãn mức nằm trong thead để được lặp lại khi bảng sang trang mới.
    return `<section class="iqc-level" data-qc-level="${group.level}"><table><colgroup><col style="width:9%"><col style="width:8%"><col style="width:14%"><col style="width:7%"><col style="width:6%"><col style="width:22%"><col style="width:14%"><col style="width:20%"></colgroup><thead><tr><th class="level-heading" colspan="${DETAIL_HEADERS.length}"><h2>Mức ${group.level}</h2><span>${group.points.length - voided} điểm còn hiệu lực${voided ? ` · ${voided} điểm đã huỷ` : ''}</span></th></tr><tr>${DETAIL_HEADERS.map((header) => `<th scope="col">${header}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></section>`;
  }).join('') : '<p class="meta">Không có dữ liệu QC trong khoảng ngày đã chọn.</p>';
  const appendix = nce ? `<section class="iqc-appendix${nce.length ? ' has-records' : ''}"><h2>Phụ lục NCE</h2>${nce.length
    ? `<table><thead><tr>${NCE_HEADERS.map((header) => `<th scope="col">${esc(header)}</th>`).join('')}</tr></thead><tbody>${nce.map((row) => `<tr>${nceRow(row).map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    : '<p class="meta">Không có hồ sơ khắc phục nào trong khoảng ngày này.</p>'}</section>` : '';
  const range = `Khoảng thời gian: ${from ? vnDate(from) : '(không giới hạn)'} — ${to ? vnDate(to) : '(không giới hạn)'}`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo nội kiểm</title><style>
  @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font:10px Arial,sans-serif;color:#183843;margin:0}
  h2{font-size:12px;color:#215968;margin:16px 0 6px;break-after:avoid}p.meta{color:#506674;margin:8px 0}
  table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #c9d9d6;padding:4px 6px;text-align:center;vertical-align:middle;overflow-wrap:anywhere}
  th{background:#e9f1f2;print-color-adjust:exact;-webkit-print-color-adjust:exact}thead{display:table-header-group}tr{break-inside:avoid}
  .iqc-level{margin-top:14px}.iqc-level th.level-heading{background:#f4f7f8;padding:7px 8px;text-align:left}.level-heading h2{display:inline;margin:0 14px 0 0}.level-heading span{font-weight:400;color:#506674}
  .iqc-level tbody td:nth-child(4),.iqc-level tbody td:nth-child(5){white-space:nowrap}
  tr.voided td{color:#888;text-decoration:line-through}tr.voided td:last-child{text-decoration:none}
  figure.lj{margin:0 0 8px;break-inside:avoid}figure.lj img{display:block;width:100%;height:auto}.chart-note{font-size:9px;color:#506674;margin:4px 0 10px;line-height:1.5}
  .iqc-appendix.has-records{break-before:page}.iqc-appendix h2{margin-top:16px}
  ${DOCUMENT_CSS}</style></head><body>${documentHeader(identity, 'Báo cáo nội kiểm', label, [range])}
  ${graph}${legend}${unevaluated ? `<p class="meta">Có ${unevaluated} điểm chưa đủ dữ liệu đánh giá, không vẽ trên biểu đồ; xem bảng chi tiết.</p>` : ''}
  ${details}${appendix}${signatureBlock()}</body></html>`;
}
