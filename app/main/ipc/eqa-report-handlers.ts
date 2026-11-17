// Phiếu xem xét ngoại kiểm: chụp đúng số liệu lúc ký, giữ mọi lần xem xét.
import type { Db } from '../db/sqlite-like';
import type { EqaCoverageAlternative, EqaReportReview, EqaReportScope, EqaReportView, EqaReviewDraft, EqaReviewKind, EqaRoundRow, EqaRoundView } from '../../shared/qc-api';
import { hasUserCapability, parseUserCapabilities } from '../domain/capabilities';
import { isoLocalDate } from '../domain/local-date';
import { cleanId, uid } from '../domain/text-utils';
import { sha256Hex } from '../domain/sha256';
import { eqaCounts } from '../domain/eqa/evaluation';
import { EQA_PAPER_LIMITS } from '../domain/eqa/report-form';
import { nowIso, requireWrite, type IpcResult } from './shared';
import { writeCommand } from './write-command';

const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const validDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const fail = (code: string, message: string): IpcResult<EqaReportView> => ({ ok: false, error: { code, message } });
const kinds: readonly EqaReviewKind[] = ['preliminary_review', 'analysis_review', 'system_review'];
const SOURCE_TYPES = ['import', 'append', 'reimport'];
type SourcePayload = { instrumentIds?: string[]; reportCode?: string; reportDate?: string; sourceName?: string };
const sourcePayload = (d: { payload_json: string }): SourcePayload => { try { return JSON.parse(d.payload_json) as SourcePayload; } catch { return {}; } };
/** Lần nhập có chạm tới máy này không. Lần nhập cũ chưa ghi danh sách máy được
 * coi là có, để không bỏ sót nguồn của hồ sơ trước khi sửa (17/11/2026). */
const touches = (d: { payload_json: string }, instrumentId: string) => {
  const ids = sourcePayload(d).instrumentIds;
  return !Array.isArray(ids) || ids.includes(instrumentId);
};
type ReviewDecision = { id: string; type: EqaReviewKind; payload_json: string; actor_name: string; decided_at: string };
type ReviewPayload = { scope: EqaReportScope; fingerprint: string; draft: EqaReviewDraft; snapshot?: EqaReportView };
const sameScope = (a: EqaReportScope, b: EqaReportScope) => a.programId === b.programId && a.year === b.year
  && (a.roundId || '') === (b.roundId || '') && (a.instrumentId || '') === (b.instrumentId || '');
function reviewView(d: ReviewDecision, p: ReviewPayload, fingerprint: string): EqaReportReview {
  return { id: d.id, kind: d.type, conclusion: p.draft.conclusion, communication: p.draft.communication, warning_note: p.draft.warningNote,
    received_date: p.draft.receivedDate, next_review_date: p.draft.nextReviewDate, actor_name: d.actor_name, decided_at: d.decided_at,
    fingerprint: p.fingerprint, current: p.fingerprint === fingerprint, alternatives: p.draft.alternatives || [],
    assessment: p.draft.assessment || 'pending', car_decision: p.draft.carDecision || 'pending', car_reference: p.draft.carReference || '', communication_date: p.draft.communicationDate || '' };
}

export function createEqaReportHandlers(db: Db, list: () => EqaRoundRow[], get: (id: unknown) => EqaRoundView | null) {
  function scopeOf(raw: unknown): EqaReportScope {
    const input = object(raw);
    if (typeof input.programId !== 'string' || !Number.isInteger(input.year) || Number(input.year) < 2000 || Number(input.year) > 2100
      || (input.roundId !== undefined && typeof input.roundId !== 'string')
      || (input.instrumentId !== undefined && typeof input.instrumentId !== 'string')) throw new Error('Phạm vi báo cáo ngoại kiểm không hợp lệ.');
    if ((input.roundId && !cleanId(input.roundId)) || (input.instrumentId && !cleanId(input.instrumentId))) throw new Error('Mã đợt hoặc máy xét nghiệm không hợp lệ.');
    return { programId: cleanId(input.programId), year: Number(input.year), ...(input.roundId ? { roundId: cleanId(input.roundId) } : {}),
      ...(input.instrumentId ? { instrumentId: cleanId(input.instrumentId) } : {}) };
  }

  function getEqaReport(raw: unknown, reviewId?: unknown): EqaReportView {
    const scope = scopeOf(raw);
    if (reviewId !== undefined) {
      const id = typeof reviewId === 'string' ? cleanId(reviewId) : '';
      if (!id) throw new Error('Mã phiếu xem xét không hợp lệ.');
      const decision = db.prepare(`SELECT d.* FROM eqa_decisions d JOIN eqa_rounds r ON r.id=d.round_id
        WHERE d.id=? AND r.program_id=? AND r.year=? AND d.type IN ('preliminary_review','analysis_review','system_review')`)
        .get(id, scope.programId, scope.year) as ReviewDecision | undefined;
      if (!decision) throw new Error('Không tìm thấy phiếu xem xét trong phạm vi đang chọn.');
      let payload: ReviewPayload;
      try { payload = JSON.parse(decision.payload_json) as ReviewPayload; }
      catch { throw new Error('Không đọc được phiếu xem xét đã lưu.'); }
      if (!payload.scope || !sameScope(payload.scope, scope)) throw new Error('Phiếu xem xét không thuộc phạm vi đang chọn.');
      const saved = payload.snapshot;
      if (!saved?.scope || !sameScope(saved.scope, scope) || saved.fingerprint !== payload.fingerprint
        || !Array.isArray(saved.rounds) || !Array.isArray(saved.reviews) || !saved.totals || !saved.coverage) throw new Error('Phiếu này chưa lưu đầy đủ số liệu tại thời điểm ký để xem lại biểu mẫu.');
      // Ảnh chụp được lưu trước khi thêm quyết định ký: ghép đúng chữ ký vừa chọn,
      // giữ các lần xem xét đã tồn tại lúc đó và không lấy số liệu hiện tại thay thế.
      return { ...saved, reviews: [reviewView(decision, payload, saved.fingerprint),
        ...saved.reviews.filter((r) => r.id !== id).map((r) => ({ ...r, current: r.fingerprint === saved.fingerprint }))] };
    }
    const program = db.prepare('SELECT name FROM eqa_programs WHERE id=?').get(scope.programId) as { name: string } | undefined;
    if (!program) throw new Error('Không tìm thấy chương trình ngoại kiểm.');
    if (scope.instrumentId && !db.prepare('SELECT id FROM instruments WHERE id=?').get(scope.instrumentId)) throw new Error('Không tìm thấy máy xét nghiệm.');
    let rounds = list().filter((r) => r.program_id === scope.programId && r.year === scope.year && r.status === 'open' && (!scope.roundId || r.id === scope.roundId))
      .sort((a, b) => a.round_no - b.round_no).map((r) => get(r.id)!);
    if (scope.roundId && rounds.length !== 1) throw new Error('Đợt báo cáo đã bị huỷ hoặc không thuộc phạm vi đang chọn.');
    // Lọc tại main để bản xem trước, hồ sơ ký và tệp xuất cùng một phạm vi máy.
    // Phiếu một máy lấy mã/ngày báo cáo và tệp nguồn của chính máy đó: nhập máy
    // khác sau không đổi phiếu đã ký của máy này.
    if (scope.instrumentId) rounds = rounds.map((view) => {
      const instrumentId = scope.instrumentId!;
      const decisions = view.decisions.filter((d) => !SOURCE_TYPES.includes(d.type) || touches(d, instrumentId));
      const own = view.decisions.find((d) => SOURCE_TYPES.includes(d.type) && Array.isArray(sourcePayload(d).instrumentIds) && sourcePayload(d).instrumentIds!.includes(instrumentId));
      const source = own ? sourcePayload(own) : null;
      const results = view.results.filter((r) => r.instrument_id === scope.instrumentId);
      const count = eqaCounts(results.map((r) => r.class));
      const instruments = view.instruments.filter((i) => i.instrument_id === scope.instrumentId);
      return { ...view, results, instruments, decisions, round: { ...view.round,
        ...(source ? { report_code: source.reportCode ?? view.round.report_code, report_date: source.reportDate ?? view.round.report_date, source_name: source.sourceName ?? view.round.source_name } : {}),
        total: count.total, ok: count.ok, warn: count.warn, rej: count.rej, accept_pct: count.acceptPct,
        instruments: instruments.map((i) => i.instrument_name), by_instrument: instruments,
        missing_instruments: view.round.missing_instruments.filter((i) => i.instrument_id === scope.instrumentId) } };
    }).filter((r) => !!scope.roundId || r.results.length > 0);
    const rows = rounds.flatMap((r) => r.results);
    const counts = eqaCounts(rows.map((r) => r.class));
    const tests = new Map<string, EqaReportView['tests'][number]>();
    for (const r of rows) {
      const item = tests.get(r.test_id) ?? { test_id: r.test_id, test_name: r.test_name, instrument_name: r.instrument_name, total: 0, ok: 0, warn: 0, rej: 0 };
      item.total++; item[r.class]++; tests.set(r.test_id, item);
    }
    // Bao phủ xét toàn bộ chương trình, tránh báo thiếu khi xét nghiệm đã tham gia nơi khác.
    const today = isoLocalDate();
    const end = `${scope.year}-12-31` < today ? `${scope.year}-12-31` : today;
    const from = new Date(`${end}T00:00:00Z`);
    from.setUTCFullYear(from.getUTCFullYear() - 1);
    from.setUTCDate(from.getUTCDate() + 1);
    const start = from.toISOString().slice(0, 10);
    const missing = db.prepare(`SELECT t.id AS test_id, COALESCE(NULLIF(t.display_name,''),t.name) AS test_name, i.name AS instrument_name
      FROM tests t JOIN instruments i ON i.id=t.instrument_id WHERE t.active<>0 AND i.active<>0 AND (?='' OR i.id=?) AND NOT EXISTS (
        SELECT 1 FROM eqa_results e JOIN eqa_rounds r ON r.id=e.round_id AND r.version=e.version
        WHERE e.test_id=t.id AND r.status='open' AND COALESCE(NULLIF(r.report_date,''),substr(r.created_at,1,10)) BETWEEN ? AND ?)
      ORDER BY i.name,t.name,t.id`).all(scope.instrumentId || '', scope.instrumentId || '', start, end) as EqaReportView['coverage']['missing'];
    const coverage = { start_date: start, end_date: end, missing };
    // Ngày tra cứu tự chuyển sang hôm sau không làm mất hiệu lực chữ ký.
    // Bao phủ chỉ là căn cứ của xem xét hệ thống, không phải xem xét một đợt.
    // Bỏ các trường dẫn xuất không thuộc số liệu của đợt: `trend.enough` đổi khi
    // chương trình đủ số đợt tối thiểu, TEa đổi theo cấu hình danh mục (N-05 chỉ
    // là thông tin nội bộ). Giữ tín hiệu chuỗi vì nó quyết định việc điều tra.
    // Mã dòng và số phiên bản đợt đổi mỗi lần bổ sung máy khác dù số liệu của
    // phạm vi đã ký không đổi, nên cũng không đưa vào dấu vân tay.
    const stable = (r: EqaReportView['rounds'][number]['results'][number]) => ({ ...r, id: undefined, tea_pct: undefined, within_tea: undefined,
      trend: r.trend ? { signals: r.trend.signals, unsuccessful: r.trend.unsuccessful, j: r.trend.j } : null });
    const snapshot = { scope, rounds: rounds.map(({ round, results, config, decisions }) => ({ round: { ...round, version: undefined, row_version: undefined, updated_at: undefined, missing_instruments: undefined }, results: results.map(stable), config,
      sources: decisions.filter((d) => ['import', 'append', 'reimport'].includes(d.type)).map((d) => d.payload_json) })), coverage: scope.roundId ? undefined : { missing: coverage.missing } };
    const fingerprint = sha256Hex(JSON.stringify(snapshot));
    const decisions = db.prepare(`SELECT d.* FROM eqa_decisions d JOIN eqa_rounds r ON r.id=d.round_id
      WHERE r.program_id=? AND r.year=? AND d.type IN ('preliminary_review','analysis_review','system_review') ORDER BY d.decided_at DESC,d.rowid DESC`)
      .all(scope.programId, scope.year) as ReviewDecision[];
    const reviews: EqaReportView['reviews'] = [];
    for (const d of decisions) {
      try {
        const p = JSON.parse(d.payload_json) as ReviewPayload;
        if (!sameScope(p.scope, scope)) continue;
        reviews.push(reviewView(d, p, fingerprint));
      } catch { /* Hồ sơ cũ không có cấu trúc xem xét này vẫn giữ nguyên trong lịch sử đợt. */ }
    }
    return { scope, program_name: program.name, fingerprint, rounds, totals: { total: counts.total, ok: counts.ok, warn: counts.warn, rej: counts.rej, accept_pct: counts.acceptPct },
      tests: [...tests.values()], requires_investigation: rows.some((r) => r.class === 'rej' || r.trend?.unsuccessful || r.trend?.signals.some((s) => s !== 'reject')),
      coverage, reviews };
  }

  const reviewEqaReport = writeCommand(db, 'reviewEqaReport', (actor) => {
    const denied = requireWrite(actor);
    if (denied) return denied;
    const user = db.prepare('SELECT capabilities_json FROM users WHERE id=? AND active<>0').get(actor.userId) as { capabilities_json: string } | undefined;
    return hasUserCapability({ role: actor.role, capabilities: parseUserCapabilities(user?.capabilities_json) }, 'nce.approve') ? null
      : { ok: false, error: { code: 'forbidden', message: 'Cần quyền duyệt hồ sơ (nce.approve) để ký xem xét ngoại kiểm.' } };
  }, (w, raw: unknown): IpcResult<EqaReportView> => {
    const data = object(object(raw).data);
    let report: EqaReportView;
    try { report = getEqaReport(data.scope); } catch (e) { return fail('scope', e instanceof Error ? e.message : 'Phạm vi báo cáo không hợp lệ.'); }
    if (!report.totals.total) return fail('empty', 'Chưa có kết quả ngoại kiểm trong phạm vi đã chọn để xem xét.');
    if (typeof data.expectedFingerprint !== 'string' || data.expectedFingerprint !== report.fingerprint) return fail('stale', 'Dữ liệu đã thay đổi. Tải lại báo cáo trước khi ký.');
    if (!kinds.includes(data.kind as EqaReviewKind) || (!!report.scope.roundId === (data.kind === 'system_review'))) return fail('kind', 'Loại xem xét không phù hợp với phạm vi báo cáo.');
    for (const [key, label] of [['conclusion', 'kết luận'], ['communication', 'nội dung truyền đạt cho nhân viên']] as const) {
      if (typeof data[key] !== 'string' || data[key].trim().length < 10 || data[key].length > EQA_PAPER_LIMITS[key]) return fail(key, `Ghi ${label} từ 10 đến ${EQA_PAPER_LIMITS[key]} ký tự để phiếu gọn một trang.`);
    }
    if (typeof data.warningNote !== 'string' || data.warningNote.length > EQA_PAPER_LIMITS.warningNote || (report.totals.warn > 0 && data.warningNote.trim().length < 10)) return fail('warningNote', 'Ghi nhận cách xử lý cảnh báo, hoặc lý do không điều tra (10–250 ký tự).');
    if (data.assessment !== undefined && !['pending', 'appropriate', 'not_appropriate'].includes(String(data.assessment))) return fail('assessment', 'Chọn kết luận đánh giá hợp lệ.');
    if (data.carDecision !== undefined && !['pending', 'not_required', 'proposed', 'recorded'].includes(String(data.carDecision))) return fail('carDecision', 'Chọn đề xuất CAR hợp lệ.');
    if (data.carReference !== undefined && (typeof data.carReference !== 'string' || data.carReference.length > EQA_PAPER_LIMITS.carReference)) return fail('carReference', 'Mã hồ sơ CAR / NCE không quá 80 ký tự.');
    if (data.carDecision === 'recorded' && (typeof data.carReference !== 'string' || data.carReference.trim().length < 3)) return fail('carReference', 'Ghi mã hồ sơ CAR / NCE đã lập.');
    if (data.carDecision === 'not_required' && report.requires_investigation) return fail('carDecision', 'Có kết quả hoặc tín hiệu bắt buộc điều tra; cần đề xuất hoặc ghi nhận hồ sơ CAR / NCE.');
    if (data.communicationDate !== undefined && data.communicationDate !== '' && (!validDate(data.communicationDate) || data.communicationDate > isoLocalDate())) return fail('communicationDate', 'Ngày truyền đạt phải hợp lệ, không sau hôm nay.');
    if (report.scope.roundId && (!validDate(data.receivedDate) || data.receivedDate > isoLocalDate())) return fail('receivedDate', 'Chọn ngày nhận báo cáo hợp lệ, không sau hôm nay.');
    if (data.nextReviewDate !== '' && (!validDate(data.nextReviewDate) || data.nextReviewDate <= isoLocalDate())) return fail('nextReviewDate', 'Ngày hẹn xem xét tiếp phải sau hôm nay.');
    if (data.kind === 'system_review' && !data.nextReviewDate) return fail('nextReviewDate', 'Chọn ngày hẹn xem xét hệ thống tiếp theo.');
    if (data.kind === 'analysis_review' && !report.reviews.some((r) => r.kind === 'preliminary_review' && r.current)) return fail('preliminary', 'Cần ký xem xét sơ khởi trên dữ liệu hiện hành trước khi ký phân tích.');
    const alternatives: EqaCoverageAlternative[] = [];
    if (data.kind === 'system_review') {
      if (!Array.isArray(data.alternatives)) return fail('alternatives', 'Ghi phương pháp thay thế cho các xét nghiệm chưa được bao phủ ngoại kiểm.');
      for (const test of report.coverage.missing) {
        const alt = data.alternatives.map(object).find((a) => a.testId === test.test_id);
        if (!alt || !['method', 'reason', 'result'].every((k) => typeof alt[k] === 'string' && (alt[k] as string).trim().length >= 3 && (alt[k] as string).length <= 2000)) return fail(`alternative-${test.test_id}`, `Ghi phương pháp, lý do và kết quả thay thế cho ${test.test_name} (${test.instrument_name}).`);
        alternatives.push({ testId: test.test_id, method: String(alt.method).trim(), reason: String(alt.reason).trim(), result: String(alt.result).trim() });
      }
    }
    const draft: EqaReviewDraft = { scope: report.scope, expectedFingerprint: report.fingerprint, kind: data.kind as EqaReviewKind,
      conclusion: String(data.conclusion).trim(), communication: String(data.communication).trim(), warningNote: data.warningNote.trim(),
      receivedDate: report.scope.roundId ? String(data.receivedDate) : '', nextReviewDate: String(data.nextReviewDate), alternatives,
      assessment: data.assessment as EqaReviewDraft['assessment'] || 'pending', carDecision: data.carDecision as EqaReviewDraft['carDecision'] || 'pending',
      carReference: typeof data.carReference === 'string' ? data.carReference.trim() : '', communicationDate: typeof data.communicationDate === 'string' ? data.communicationDate : '' };
    w.commit((tx) => {
      // Ảnh chụp là căn cứ của chữ ký, không bị thay bằng dữ liệu của lần nhập sau.
      db.prepare(`INSERT INTO eqa_decisions(id,round_id,type,payload_json,actor_user_id,actor_name,decided_at) VALUES (?,?,?,?,?,?,?)`)
        .run(uid(), report.rounds[0].round.id, draft.kind, JSON.stringify({ scope: report.scope, fingerprint: report.fingerprint, draft, snapshot: report }), w.actor.userId, w.actor.name || w.actor.username, nowIso());
      tx.audit('Xem xét báo cáo ngoại kiểm', `${report.program_name} · ${report.scope.year} · ${draft.kind}: ${draft.conclusion}`, report.program_name);
      tx.changed(['eqa_decisions', 'eqa_rounds']);
    });
    return { ok: true, data: getEqaReport(report.scope) };
  });
  return { getEqaReport, reviewEqaReport };
}
