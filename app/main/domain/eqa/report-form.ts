// Mô hình trình bày dùng chung cho phiếu trên màn hình, PDF và Word.
// Chỉ dùng kết luận và tín hiệu main đã trả; không suy nguyên nhân hay tự ký.
import type { EqaReportReview, EqaReportView, EqaReviewAssessment, EqaReviewDraft } from '../../../shared/qc-api';
import { EQA_CLASS_LABEL } from './evaluation';

export const EQA_PAPER_LIMITS = { conclusion: 500, communication: 250, warningNote: 250, carReference: 80 } as const;
export const EQA_ASSESSMENT_LABELS = { pending: 'Chưa kết luận', appropriate: 'Phù hợp', not_appropriate: 'Không phù hợp' } as const;
export const EQA_CAR_LABELS = { pending: 'Chưa ghi nhận đề xuất CAR', not_required: 'Không đề xuất CAR', proposed: 'Đề xuất CAR', recorded: 'Đã ghi nhận hồ sơ CAR / NCE' } as const;
const plain = (text: string | undefined) => (text || '').replace(/\s+/g, ' ').trim();
function eqaPaperDate(value: string): string {
  if (value.includes('T') && Number.isFinite(Date.parse(value))) return new Date(value).toLocaleDateString('vi-VN');
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : 'Chưa ghi nhận';
}
export interface EqaPaperStage { conclusion: string; assessment: EqaReviewAssessment; reviewer: string; date: string; signed: boolean }
function stage(review: EqaReportReview | undefined, draft?: EqaReviewDraft): EqaPaperStage {
  if (draft) return { conclusion: plain(draft.conclusion) || 'Chưa nhập nhận xét.', assessment: draft.assessment || 'pending', reviewer: 'Bản nháp chưa ký', date: '—', signed: false };
  return { conclusion: plain(review?.conclusion) || 'Chưa ghi nhận kết luận trên dữ liệu hiện hành.',
    assessment: review?.assessment || 'pending', reviewer: review?.actor_name || 'Chưa ký xem xét',
    date: review ? eqaPaperDate(review.decided_at) : '—', signed: !!review };
}

export function eqaPaperModel(report: EqaReportView, drafts: readonly EqaReviewDraft[] = []) {
  const current = report.reviews.filter((r) => r.current);
  const preliminary = current.find((r) => r.kind === 'preliminary_review');
  const analysis = current.find((r) => r.kind === (report.scope.roundId ? 'analysis_review' : 'system_review'));
  const latest = current[0];
  const preliminaryDraft = drafts.find((d) => d.kind === 'preliminary_review');
  const analysisDraft = drafts.find((d) => d.kind === (report.scope.roundId ? 'analysis_review' : 'system_review'));
  const activeDraft = drafts.at(-1);
  const receipt = activeDraft ? activeDraft.receivedDate : current.find((r) => r.received_date)?.received_date || '';
  const rows = report.rounds.flatMap((r) => r.results);
  const instruments = [...new Set(rows.map((r) => r.instrument_name))];
  const chainSignal = rows.some((r) => r.trend?.unsuccessful || r.trend?.signals.some((s) => s !== 'reject'));
  const enough = rows.length > 0 && rows.every((r) => r.trend?.enough);
  const t = report.totals;
  const warning = activeDraft ? activeDraft.warningNote : current.find((r) => r.warning_note)?.warning_note || '';
  const exceptions = rows.filter((r) => r.class !== 'ok');
  const named = exceptions.slice(0, 2).map((r) => `${r.test_name}${instruments.length > 1 ? ` / ${r.instrument_name}` : ''}${r.sample ? ` / ${r.sample}` : ''}: z=${r.z_official} (${EQA_CLASS_LABEL[r.class]})`).join('; ');
  // Chỉ liệt kê ngắn các ngoại lệ; phiếu luôn ghi rõ khi còn kết quả khác.
  const attention = !exceptions.length ? 'Không có kết quả cảnh báo hoặc không chấp nhận theo nhà cung cấp.'
    : named.length <= 200 ? `${named}${exceptions.length > 2 ? `; còn ${exceptions.length - 2} kết quả khác cần rà soát.` : '.'}`
    : `${exceptions.length} kết quả cần rà soát. Đối chiếu chi tiết theo mã báo cáo gốc và dữ liệu tại Tổng quan.`;
  return {
    title: report.scope.roundId ? 'PHIẾU XEM XÉT KẾT QUẢ NGOẠI KIỂM' : 'PHIẾU XEM XÉT HỆ THỐNG NGOẠI KIỂM',
    period: report.scope.roundId ? `${report.rounds[0]?.round.round || '—'} / ${report.scope.year}` : `${report.rounds.length} đợt / ${report.scope.year}`,
    instruments: report.scope.instrumentId ? instruments[0] || 'Chưa có kết quả' : `Tất cả máy (${instruments.length})${instruments.length === 1 ? ` · ${instruments[0]}` : ''}`,
    reportCode: report.scope.roundId ? report.rounds[0]?.round.report_code || 'Chưa ghi nhận' : `${report.rounds.length} báo cáo đợt`,
    reportDate: report.scope.roundId ? eqaPaperDate(report.rounds[0]?.round.report_date || '') : `Năm ${report.scope.year}`,
    receivedDate: eqaPaperDate(receipt),
    totals: `${t.total} kết quả: ${t.ok} chấp nhận, ${t.warn} cảnh báo, ${t.rej} không chấp nhận.`,
    attention,
    trend: chainSignal ? 'Có tín hiệu chuỗi cần xác minh; đối chiếu diễn biến tại Tổng quan.' : enough ? 'Không ghi nhận tín hiệu chuỗi trong phạm vi xem xét.' : 'Chưa đủ số đợt để kết luận xu hướng.',
    coverage: report.scope.roundId ? '' : `${report.coverage.missing.length} xét nghiệm đang hoạt động chưa có ngoại kiểm trong cửa sổ 12 tháng; phương pháp thay thế lưu trong hồ sơ xem xét.`,
    preliminary: stage(preliminary, preliminaryDraft), analysis: stage(analysis, analysisDraft), warning: plain(warning),
    communication: plain(activeDraft ? activeDraft.communication : latest?.communication) || 'Chưa ghi nhận nội dung truyền đạt.',
    communicationDate: eqaPaperDate((activeDraft ? activeDraft.communicationDate : latest?.communication_date) || ''),
    carLabel: EQA_CAR_LABELS[(activeDraft ? activeDraft.carDecision : latest?.car_decision) || 'pending'], carReference: (activeDraft ? activeDraft.carReference : latest?.car_reference) || '—',
    requiresInvestigation: report.requires_investigation,
    nextReviewDate: (activeDraft ? activeDraft.nextReviewDate : latest?.next_review_date) ? eqaPaperDate((activeDraft ? activeDraft.nextReviewDate : latest?.next_review_date)!) : '',
    isDraft: drafts.length > 0,
    canExport: [preliminaryDraft ? undefined : preliminary, analysisDraft ? undefined : analysis].filter((r): r is EqaReportReview => !!r).every((r) =>
      plain(r.conclusion).length <= EQA_PAPER_LIMITS.conclusion && plain(r.communication).length <= EQA_PAPER_LIMITS.communication
      && plain(r.warning_note).length <= EQA_PAPER_LIMITS.warningNote && (r.car_reference || '').length <= EQA_PAPER_LIMITS.carReference)
      && drafts.every((d) => plain(d.conclusion).length <= EQA_PAPER_LIMITS.conclusion && plain(d.communication).length <= EQA_PAPER_LIMITS.communication
        && plain(d.warningNote).length <= EQA_PAPER_LIMITS.warningNote && (d.carReference || '').length <= EQA_PAPER_LIMITS.carReference),
  };
}

export function assertCompactEqaPaper(report: EqaReportView, drafts: readonly EqaReviewDraft[] = []): void {
  if (!eqaPaperModel(report, drafts).canExport) throw new Error('Nội dung quá dài cho phiếu một trang. Rút gọn bản nháp hoặc ghi một lần xem xét mới ngắn gọn; hồ sơ cũ vẫn được giữ nguyên trong lịch sử.');
}
