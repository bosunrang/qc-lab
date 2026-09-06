// Giai đoạn C4 (docs/APP-V2-PLAN.md) — di trú dữ liệu từ backup app CŨ
// (định dạng `'qclab-backup'`, object lồng nhau: `tests[]`, `data{testId:
// [points]}`, `qcLots[]`, ...) sang schema SQLite quan hệ của app-v2. KHÁC
// C3 (round-trip trong CÙNG 1 định dạng): đây là ÁNH XẠ giữa 2 hình dạng dữ
// liệu khác nhau — rủi ro cao hơn, không thể tái dùng nguyên `backup.ts`.
//
// Nguyên tắc: hàm THUẦN (không đụng DB), nhận state đã parse của app cũ, trả
// về `Record<tableName, row[]>` sẵn sàng nạp qua `table-io.ts`'s
// `restoreAllTables()` — CÙNG một transaction "xoá hết rồi nạp lại" đã dùng
// cho phục hồi backup C3, không viết lại lần hai.
//
// Phạm vi CỐ Ý: ánh xạ đủ để dùng lại NGAY dữ liệu vận hành thật (máy, xét
// nghiệm, mức QC + lịch sử Mean/SD, lô/nhóm lô, Panel QC, chuyển tiếp lô,
// toàn bộ điểm QC, người dùng — GIỮ NGUYÊN mật khẩu vì cùng thuật toán
// PBKDF2-SHA256 + cùng định dạng chuỗi lưu, nhật ký hoạt động — GIỮ NGUYÊN
// chuỗi hash tamper-evident vì `audit-chain.ts` dùng ĐÚNG thuật toán/payload
// của bản cũ, khoá kỳ báo cáo, bảng TEa tham chiếu, so sánh hoá chất, Sigma).
// KHÔNG cố "làm sạch lại" dữ liệu như `sanitizeBackup()` bản cũ làm — dữ
// liệu backup xuất từ 1 app đang chạy đã đi qua `ensureShape()` liên tục nên
// coi là đã hợp lệ, chỉ phòng thủ chống thiếu trường (`|| ''`/`|| null`).
//
// Hồ sơ NCE (`actions[]`) là phần LỆCH HÌNH DẠNG nhiều nhất: app-v2's NCE
// (xem nce-validation.ts) là bản RÚT GỌN (chưa có protocol-v3 FMEA đầy đủ
// như bản cũ — containment/qcMaterial/instrument/reagent/calibration/
// lotToLot status, risk S/O/D...). Ánh xạ các trường CÓ tương ứng trực tiếp
// vào cột thật + `detail_json`'s 4 trường app-v2 UI đọc được
// (correction/investigation/causeCategory/causeDescription), đồng thời giữ
// NGUYÊN VẸN bản ghi gốc dưới `detail_json.legacy` — không mất dữ liệu dù
// UI hiện tại chưa hiển thị hết, để lần sau app-v2's NCE UI được làm đầy đủ
// hơn (protocol-v3) có thể đọc lại từ đó mà không cần di trú lại lần nữa.
import { createHash } from 'node:crypto';
import { SCHEMA_VERSION } from '../db/schema';
import { cleanId, cleanText, finiteNumber } from './text-utils';

export const LEGACY_BACKUP_FORMAT = 'qclab-backup';

export type LegacyState = Record<string, any>;

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

/** Parse + xác thực 1 file backup app CŨ (`{format:'qclab-backup', ...,
 * checksum, data:{...}}`) — checksum = SHA-256 hex của `JSON.stringify(data)`,
 * ĐÚNG thuật toán app cũ dùng (`crypto.subtle.digest('SHA-256',...)` trong
 * trình duyệt, tương đương `createHash('sha256')` ở Node với cùng input). */
export function parseLegacyBackupEnvelope(raw: unknown): ValidationResult<{ data: LegacyState; meta: Record<string, unknown> }> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, code: 'invalid-shape', message: 'File backup không đúng định dạng object.' };
  }
  const env = raw as Record<string, unknown>;
  if (env.format !== LEGACY_BACKUP_FORMAT) {
    return { ok: false, code: 'wrong-format', message: `File này không phải backup app CŨ (format='${LEGACY_BACKUP_FORMAT}'). Nếu đây là backup app-v2 ('qclab-v2-backup'), dùng mục "Sao lưu & phục hồi" thay vì "Di trú dữ liệu từ app cũ".` };
  }
  if (!env.data || typeof env.data !== 'object' || Array.isArray(env.data)) {
    return { ok: false, code: 'missing-data', message: 'File backup thiếu dữ liệu (data).' };
  }
  if (env.checksum) {
    const actual = createHash('sha256').update(JSON.stringify(env.data), 'utf8').digest('hex');
    if (actual !== env.checksum) {
      return { ok: false, code: 'checksum-mismatch', message: 'Checksum SHA-256 không khớp — file có thể đã hỏng hoặc bị sửa đổi.' };
    }
  }
  return { ok: true, data: { data: env.data as LegacyState, meta: env } };
}

function bool01(v: unknown, def = true): 0 | 1 { return (v === false ? false : v === true ? true : def) ? 1 : 0; }
function arr<T = any>(v: unknown): T[] { return Array.isArray(v) ? v : []; }
function obj(v: unknown): Record<string, any> { return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {}; }

export interface MigrationSummary {
  instruments: number; tests: number; qcLots: number; lotGroups: number; qcPanels: number;
  lotTransitions: number; qcPoints: number; users: number; activity: number; actions: number;
  reagentTests: number; periodLocks: number; teaRefs: number; sigmaPeriods: number;
}

export interface MappedTables {
  app_meta: Record<string, unknown>[];
  lab: Record<string, unknown>[];
  instruments: Record<string, unknown>[];
  lot_groups: Record<string, unknown>[];
  qc_lots: Record<string, unknown>[];
  qc_panels: Record<string, unknown>[];
  qc_panel_tests: Record<string, unknown>[];
  lot_transitions: Record<string, unknown>[];
  tests: Record<string, unknown>[];
  test_levels: Record<string, unknown>[];
  qc_points: Record<string, unknown>[];
  sigma_data: Record<string, unknown>[];
  users: Record<string, unknown>[];
  activity: Record<string, unknown>[];
  actions: Record<string, unknown>[];
  reagent_tests: Record<string, unknown>[];
  period_locks: Record<string, unknown>[];
  tea_refs: Record<string, unknown>[];
}

/** Ánh xạ THUẦN — trả về đúng hình dạng cột SQLite của app-v2 cho từng bảng,
 * sẵn sàng nạp qua `restoreAllTables()`. Không đụng DB, dễ test. */
export function mapLegacyStateToTables(legacy: LegacyState): MappedTables {
  const lab = obj(legacy.lab);
  const instrumentSectionById = new Map<string, string>();
  arr(legacy.instruments).forEach((x) => instrumentSectionById.set(cleanId(x.id), cleanText(x.section)));

  const instruments = arr(legacy.instruments).map((x) => ({
    id: cleanId(x.id), name: cleanText(x.name), manufacturer: cleanText(x.manufacturer),
    model: cleanText(x.model), serial: cleanText(x.serial), section: cleanText(x.section),
    active: bool01(x.active),
  })).filter((x) => x.id && x.name);

  const lot_groups = arr(legacy.lotGroups).map((x) => ({
    id: cleanId(x.id), name: cleanText(x.name), manufacturer: cleanText(x.manufacturer),
    material: cleanText(x.material), catalog: cleanText(x.catalog), note: cleanText(x.note, 4000),
    active: bool01(x.active), status: x.active === false ? 'stopped' : 'active', stopped_at: '',
  })).filter((x) => x.id && x.name);

  const qc_lots = arr(legacy.qcLots).map((x) => ({
    id: cleanId(x.id), group_id: cleanId(x.groupId) || null, lot_no: cleanText(x.lotNo),
    level: Math.round(finiteNumber(x.level, 1)), description: cleanText(x.description),
    supplier: cleanText(x.supplier), program: cleanText(x.program), exp: cleanText(x.exp, 20),
    opened: cleanText(x.opened, 20), active: bool01(x.active), depleted: x.depleted === true ? 1 : 0,
    note: cleanText(x.note, 4000),
  })).filter((x) => x.id && x.lot_no);

  const qc_panels = arr(legacy.qcPanels).map((x) => ({
    id: cleanId(x.id), name: cleanText(x.name), instrument_id: cleanId(x.instrumentId),
    note: cleanText(x.note, 4000), active: bool01(x.active),
  })).filter((x) => x.id && x.name);
  const qc_panel_tests: Record<string, unknown>[] = [];
  arr(legacy.qcPanels).forEach((x) => {
    const panelId = cleanId(x.id);
    if (!panelId) return;
    arr(x.testIds).forEach((tid) => { const testId = cleanId(tid); if (testId) qc_panel_tests.push({ panel_id: panelId, test_id: testId }); });
  });

  const lot_transitions = arr(legacy.lotTransitions).map((x) => ({
    id: cleanId(x.id), panel_id: cleanId(x.panelId), from_lot_id: cleanId(x.fromLotId),
    to_lot_id: cleanId(x.toLotId), start_date: cleanText(x.startDate, 20),
    status: ['planned', 'active', 'accepted', 'rejected'].includes(x.status) ? x.status : 'planned',
    criteria_json: x.criteria ? JSON.stringify({ legacyCriteria: cleanText(x.criteria, 4000) }) : '{}',
    conclusion: cleanText(x.conclusion, 4000), approved_at: cleanText(x.approvedAt, 40),
    approved_by: cleanText(x.approvedBy, 120), note: cleanText(x.note, 4000),
  })).filter((x) => x.id && x.panel_id && x.from_lot_id && x.to_lot_id);

  const tests = arr(legacy.tests).map((t) => ({
    id: cleanId(t.id), analyte_id: cleanId(t.analyteId), name: cleanText(t.name),
    display_name: cleanText(t.displayName, 160), standard_name: cleanText(t.standardName, 160),
    abbreviation: cleanText(t.abbreviation, 40), aliases_json: JSON.stringify(arr(t.aliases).map((v) => cleanText(v, 120)).filter(Boolean)),
    matrix: cleanText(t.matrix, 80), unit: cleanText(t.unit),
    decimal_places: t.decimalPlaces != null && Number.isInteger(Number(t.decimalPlaces)) ? Math.min(6, Math.max(0, Number(t.decimalPlaces))) : 2,
    instrument_id: cleanId(t.instrumentId),
    // App cũ không có "section" theo TỪNG xét nghiệm (chỉ có ở máy) — app-v2
    // thêm trường này để tự điền Khoa/Khu vực; suy từ section của máy đang
    // gắn, 1 lần khi di trú (khớp đúng hành vi auto-fill hiện có của app-v2
    // khi đổi máy — configAssayInstrumentChanged).
    section: instrumentSectionById.get(cleanId(t.instrumentId)) || '',
    method: cleanText(t.method, 200), reagent: cleanText(t.reagent, 200),
    tea: Math.max(0, finiteNumber(t.tea, 0)), tea_source: cleanText(t.teaSource, 200),
    tea_ref_key: '', // chưa suy được key khớp bảng tea_refs — cần rà soát thủ công sau di trú (ghi ở docs/APP-V2-PLAN.md)
    active: bool01(t.active),
    rule_actions_json: JSON.stringify(obj(t.ruleActions)), rule_scopes_json: JSON.stringify(obj(t.ruleScopes)),
    cusum_on: t.cusum && t.cusum.on ? 1 : 0,
    cusum_k: Math.max(0, finiteNumber(t.cusum && t.cusum.k, 0.5)), cusum_h: Math.max(0, finiteNumber(t.cusum && t.cusum.h, 4)),
  })).filter((x) => x.id && x.name);

  const test_levels: Record<string, unknown>[] = [];
  arr(legacy.tests).forEach((t) => {
    const testId = cleanId(t.id);
    if (!testId) return;
    arr(t.levels).forEach((l) => {
      const level = Math.round(finiteNumber(l.level, 1));
      const currentLotId = cleanId(l.qcLotId) || null;
      // app cũ tự bao gồm 1 mốc CHO LÔ ĐANG DÙNG trong meanSdHistory (khác
      // app-v2, chỉ chốt giá trị CŨ) — soi đúng mốc đó lấy effectiveFrom
      // thật thay vì để trống, tránh cột "Hiệu lực" hiện "Không giới hạn"
      // ngay sau khi di trú dù dữ liệu gốc có ngày rõ ràng.
      const currentHistoryEntry = currentLotId
        ? arr(l.meanSdHistory).find((h) => cleanId(h.qcLotId) === currentLotId)
        : undefined;
      test_levels.push({
        id: `${testId}:${level}`, test_id: testId, level,
        qc_lot_id: cleanId(l.qcLotId) || null,
        mean: l.mean == null ? null : finiteNumber(l.mean, null as unknown as number),
        sd: l.sd == null ? null : finiteNumber(l.sd, null as unknown as number),
        low: l.low == null ? null : finiteNumber(l.low, null as unknown as number),
        high: l.high == null ? null : finiteNumber(l.high, null as unknown as number),
        range_k: finiteNumber(l.rangeK, 2),
        mfg_mean: l.mfgMean == null ? null : finiteNumber(l.mfgMean, null as unknown as number),
        mfg_sd: l.mfgSd == null ? null : finiteNumber(l.mfgSd, null as unknown as number),
        applied: l.applied === 'lab' ? 'lab' : 'mfg',
        mean_sd_history_json: JSON.stringify(arr(l.meanSdHistory).map((h) => ({
          id: cleanId(h.id) || undefined, qcLotId: cleanId(h.qcLotId), lot: cleanText(h.lot),
          mean: finiteNumber(h.mean, 0), sd: Math.max(0, finiteNumber(h.sd, 0)),
          low: h.low == null ? null : finiteNumber(h.low, 0), high: h.high == null ? null : finiteNumber(h.high, 0),
          effectiveFrom: cleanText(h.effectiveFrom, 20), effectiveTo: cleanText(h.effectiveTo, 20),
          source: h.source === 'lab' ? 'lab' : 'mfg', note: cleanText(h.note, 4000),
        }))),
        mean_sd_effective_from: currentHistoryEntry ? cleanText(currentHistoryEntry.effectiveFrom, 20) : '',
      });
    });
  });

  const qc_points: Record<string, unknown>[] = [];
  Object.entries(obj(legacy.data)).forEach(([testId, rows]) => {
    const tid = cleanId(testId);
    if (!tid) return;
    arr(rows).forEach((p) => {
      const id = cleanId(p.id);
      const date = cleanText(p.date, 20);
      const val = Number(p.val);
      if (!id || !date || !Number.isFinite(val)) return;
      qc_points.push({
        id, test_id: tid, level: Math.round(finiteNumber(p.level, 1)), date,
        run_id: cleanText(p.runId, 120), lot: cleanText(p.lot), val,
        value_decimals: Number.isInteger(p.valueDecimals) ? p.valueDecimals : 2,
        qc_mean: p.qcMean ? finiteNumber(p.qcMean, null as unknown as number) : null,
        qc_sd: p.qcSd ? finiteNumber(p.qcSd, null as unknown as number) : null,
        note: cleanText(p.note, 4000), operator_id: cleanId(p.operatorId),
        operator_username: cleanText(p.operatorUsername, 80).trim().toLowerCase(),
        operator_name: cleanText(p.operatorName, 120), operator_code: cleanText(p.operatorCode, 12).toUpperCase(),
        voided: p.voided ? 1 : 0, void_reason: cleanText(p.voidReason, 4000),
        void_kind: ['data-entry', 'analytical', 'other'].includes(p.voidKind) ? p.voidKind : '',
        void_requires_rerun: p.voidRequiresRerun ? 1 : 0,
        voided_at: cleanText(p.voidedAt, 40), voided_by: cleanText(p.voidedBy, 120),
      });
    });
  });

  const sigma_data: Record<string, unknown>[] = [];
  Object.entries(obj(legacy.sigmaData)).forEach(([testId, rows]) => {
    const tid = cleanId(testId);
    if (!tid) return;
    arr(rows).forEach((e) => {
      const period = cleanText(e.period, 7);
      if (!period) return;
      sigma_data.push({
        id: cleanId(e.id) || `${tid}_${period}`, test_id: tid, period,
        tea: e.tea ? finiteNumber(e.tea, null as unknown as number) : null,
        tea_source: cleanText(e.teaSource, 200), tea_label: cleanText(e.teaLabel, 160),
        tea_reference: cleanText(e.teaReference, 4000), tea_captured_at: cleanText(e.teaCapturedAt, 40),
        lv_json: JSON.stringify(obj(e.lv)),
      });
    });
  });

  const users = arr(legacy.users).map((u) => ({
    id: cleanId(u.id), username: cleanText(u.username, 80).trim().toLowerCase(), name: cleanText(u.name),
    initials: cleanText(u.initials, 12).toUpperCase(), external_code: cleanText(u.externalCode, 40),
    role: ['admin', 'technician', 'viewer'].includes(u.role) ? u.role : 'viewer',
    page_perms_json: Array.isArray(u.pagePerms) ? JSON.stringify(u.pagePerms.map(cleanId).filter(Boolean)) : null,
    // Giữ NGUYÊN passHash — cùng thuật toán PBKDF2-SHA256 + cùng định dạng
    // chuỗi lưu `pbkdf2$<iter>$<salt>$<hash>` giữa 2 app (xem CLAUDE.md
    // "Module roles" → users-auth.js) nên mật khẩu cũ vẫn đăng nhập được
    // ngay sau di trú, không cần đặt lại.
    pass_hash: cleanText(u.passHash, 500), active: bool01(u.active),
    must_change_password: u.mustChangePassword ? 1 : 0,
    // KHÔNG qua cleanText() (có giới hạn độ dài, sẽ cắt cụt giữa 1 data URL
    // base64 làm hỏng ảnh) — app cũ cũng resize avatar về canvas 160×160
    // trước khi lưu (`avatar-modal-controller.ts`) nên chuỗi vốn đã nhỏ.
    avatar: typeof u.avatar === 'string' && u.avatar.startsWith('data:image/') ? u.avatar : '',
  })).filter((x) => x.id && x.username && x.pass_hash);

  // Nhật ký hoạt động — GIỮ NGUYÊN chuỗi hash tamper-evident: `audit-chain.ts`
  // dùng ĐÚNG thuật toán (auditCanonical/sha256(prevHash+'|'+canonical(payload)))
  // và ĐÚNG tên trường payload (id,seq,ts,user,username,userId,role,type,
  // detail,target,clientId) với bản cũ — verifyAuditChain() vẫn xác nhận
  // đúng chuỗi sau khi đổi tên cột sang snake_case, KHÔNG cần relink lại.
  const activity = arr(legacy.activity).map((a) => ({
    id: cleanId(a.id), seq: Math.round(finiteNumber(a.seq, 0)), ts: cleanText(a.ts, 40),
    user: cleanText(a.user), username: cleanText(a.username, 80), user_id: cleanId(a.userId),
    role: ['admin', 'technician', 'viewer'].includes(a.role) ? a.role : 'viewer',
    type: cleanText(a.type), detail: cleanText(a.detail, 4000), target: cleanText(a.target),
    client_id: cleanText(a.clientId, 80), prev_hash: cleanText(a.prevHash, 80), hash: cleanText(a.hash, 80),
  })).filter((x) => x.id);

  // Hồ sơ NCE — xem chú thích đầu file: chỉ những trường app-v2 hiện dùng
  // được ánh xạ vào cột thật/4 trường detail_json hiển thị được; TOÀN BỘ bản
  // ghi gốc giữ nguyên dưới `detail_json.legacy` để không mất dữ liệu.
  const actions = arr(legacy.actions).map((a) => {
    const createdAt = cleanText(a.createdAt, 40) || cleanText(a.date, 20);
    const detail = {
      correction: cleanText(a.action, 4000) || cleanText(a.correction, 4000),
      investigation: a.cause ? `Nguyên nhân (ghi nhận ở bản cũ): ${cleanText(a.cause, 2000)}` : '',
      causeCategory: ['SE', 'RE'].includes(a.causeCategory) ? a.causeCategory : '',
      causeDescription: cleanText(a.cause, 2000),
      ...(a.releaseStatus ? { releaseDecision: a.releaseStatus === 'released' ? 'released' : 'held', releaseNote: cleanText(a.releaseNote, 2000), releaseDecidedBy: cleanText(a.releaseBy, 120), releaseDecidedAt: cleanText(a.releaseDate, 40) } : {}),
      effectivenessNote: cleanText(a.effectivenessNote, 2000),
      residualRisk: cleanText(a.residualRiskBasis, 2000),
      legacy: a,
    };
    return {
      id: cleanId(a.id), date: cleanText(a.date, 20), created_at: createdAt || new Date(0).toISOString(),
      updated_at: cleanText(a.updatedAt, 40) || createdAt || new Date(0).toISOString(),
      created_by_user_id: cleanId(a.createdByUserId), created_by_username: cleanText(a.createdByUsername, 80),
      test_id: cleanId(a.testId) || null, level: a.level != null && a.level !== '' ? Math.round(finiteNumber(a.level, 0)) : null,
      lot: cleanText(a.lot), point_id: cleanId(a.pointId) || null, rule: cleanText(a.rule),
      error_type: cleanText(a.errorType), qc_verdict: ['warn', 'rej', 'invalid'].includes(a.qcVerdict) ? a.qcVerdict : '',
      nce_id: cleanText(a.nceId, 40), parent_nce_id: cleanText(a.parentNceId, 40), follow_up_nce_id: cleanText(a.followUpNceId, 40),
      protocol_version: [1, 2, 3].includes(Number(a.protocolVersion)) ? Number(a.protocolVersion) : 1,
      approval_status: ['pending', 'approved', 'returned'].includes(a.approvalStatus) ? a.approvalStatus : 'pending',
      effectiveness_status: ['pending', 'effective', 'ineffective'].includes(a.effectivenessStatus) ? a.effectivenessStatus : 'pending',
      record_status: a.recordStatus === 'cancelled' ? 'cancelled' : 'active',
      risk_level: ['low', 'medium', 'high', 'critical'].includes(a.riskLevel) ? a.riskLevel : (['low', 'medium', 'high', 'critical'].includes(a.residualRiskLevel) ? a.residualRiskLevel : ''),
      due_date: cleanText(a.dueDate, 20), action_completed_date: cleanText(a.actionCompletedDate, 20),
      detail_json: JSON.stringify(detail),
    };
  }).filter((x) => x.id);

  const reagent_tests = arr(legacy.reagentTests).map((d) => {
    const t = obj(d.test);
    return {
      id: cleanId(d.id), reagent: cleanText(t.reagent), lot_old: cleanText(t.lotOld), lot_new: cleanText(t.lotNew),
      date: cleanText(t.date, 20), operator: cleanText(t.operator), sample_type: cleanText(t.sampleType),
      unit: cleanText(t.unit), bias_target: t.biasTarget != null ? finiteNumber(t.biasTarget, null as unknown as number) : null,
      alpha: t.alpha != null ? finiteNumber(t.alpha, null as unknown as number) : null,
      coverage_confirmed: t.coverageConfirmed ? 1 : 0, extra_json: '{}',
      rows_json: JSON.stringify(arr(d.rows).map((r: any) => [Number(r && r[0]), Number(r && r[1])])),
    };
  }).filter((x) => x.id);

  const period_locks = arr(legacy.periodLocks).map((x) => ({
    id: cleanId(x.id) || `lock_${cleanText(x.ym, 7)}`, ym: cleanText(x.ym, 7), locked_at: cleanText(x.lockedAt, 40),
    locked_by: cleanText(x.lockedBy, 120), note: cleanText(x.note, 4000),
  })).filter((x) => x.ym);

  const tea_refs = arr(legacy.teaRefs).map((x) => {
    const sources = obj(x.sources);
    return {
      id: cleanId(x.id), analyte_id: cleanId(x.analyteId), name: cleanText(x.name, 120),
      display_name: cleanText(x.displayName, 160), standard_name: cleanText(x.standardName, 160),
      abbreviation: cleanText(x.abbreviation, 40), aliases_json: JSON.stringify(arr(x.aliases).map((v) => cleanText(v, 120)).filter(Boolean)),
      matrix: cleanText(x.matrix, 80), unit: cleanText(x.unit, 40), section: cleanText(x.section, 80),
      clia: x.clia != null ? finiteNumber(x.clia, null as unknown as number) : null,
      ricos: x.ricos != null ? finiteNumber(x.ricos, null as unknown as number) : null,
      lab: x.lab != null ? finiteNumber(x.lab, null as unknown as number) : null,
      lab_source: cleanText(x.labSource, 40), lab_prepared_by: cleanText(x.labPreparedBy, 120),
      lab_next_review_date: cleanText(x.labNextReviewDate, 20),
      clia_rule: ['percent', 'absolute', 'greater-of'].includes(x.cliaRule) ? x.cliaRule : '',
      clia_absolute: x.cliaAbsolute != null ? finiteNumber(x.cliaAbsolute, null as unknown as number) : null,
      clia_absolute_unit: cleanText(x.cliaAbsoluteUnit, 40),
      sources_json: JSON.stringify({ clia: obj(sources.clia), ricos: obj(sources.ricos), lab: obj(sources.lab) }),
    };
  }).filter((x) => x.id && x.name);

  // Neo chuỗi hash: nếu log app cũ đã từng lưu trữ/xoay vòng (activityAnchor
  // khác rỗng), hàng ĐẦU TIÊN còn sống trong `activity` không bắt đầu từ
  // prevHash='' — phải mang đúng anchor đó sang `app_meta` (app-v2 đã có sẵn
  // CÙNG cơ chế cho tính năng lưu trữ của B8), nếu không `verifyAuditChain()`
  // sẽ báo sai chuỗi ngay hàng đầu tiên sau di trú.
  const app_meta = [
    { key: 'schemaVersion', value: String(SCHEMA_VERSION) },
    ...(legacy.activityAnchor ? [{ key: 'activityAnchor', value: cleanText(legacy.activityAnchor, 80) }] : []),
  ];

  return {
    app_meta,
    lab: [{
      id: 1, name: cleanText(lab.name), dept: cleanText(lab.dept), address: cleanText(lab.address, 4000),
      brand_title: cleanText(lab.brandTitle, 80) || 'QC Lab', brand_sub: cleanText(lab.brandSub, 120) || 'Nội kiểm xét nghiệm',
      logo_text: cleanText(lab.logoText, 8).slice(0, 4) || 'QC', logo_data: cleanText(lab.logoData, 120000),
    }],
    instruments, lot_groups, qc_lots, qc_panels, qc_panel_tests, lot_transitions, tests, test_levels,
    qc_points, sigma_data, users, activity, actions, reagent_tests, period_locks, tea_refs,
  };
}

export function summarizeMappedTables(m: MappedTables): MigrationSummary {
  return {
    instruments: m.instruments.length, tests: m.tests.length, qcLots: m.qc_lots.length,
    lotGroups: m.lot_groups.length, qcPanels: m.qc_panels.length, lotTransitions: m.lot_transitions.length,
    qcPoints: m.qc_points.length, users: m.users.length, activity: m.activity.length,
    actions: m.actions.length, reagentTests: m.reagent_tests.length, periodLocks: m.period_locks.length,
    teaRefs: m.tea_refs.length, sigmaPeriods: m.sigma_data.length,
  };
}
