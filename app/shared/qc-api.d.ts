// Hợp đồng IPC lộ ra qua preload.ts — dùng chung giữa main và renderer để
// renderer có type an toàn khi gọi window.qcApi.*
export interface LisGatewaySettings { enabled: boolean; url: string; token: string }
/** Kết quả kiểm tra một tệp backup trước khi phục hồi. `legacy` là tệp .json
 * xuất trước khi đổi sang định dạng SQLite. */
export interface BackupFileSummary {
  fileName: string; tables: number; rows: number; points: number;
  schemaVersion: number; createdAt: string; bytes: number; legacy: boolean;
}
export interface LisResolved {
  ok: boolean; code: string; reason?: string;
  qclabTestId?: string; level?: number; lot?: string; displayName?: string;
}
export interface LisMessage {
  messageId: string; analyzerId: string; testCode: string; qcLevel: string; qcLotCode?: string;
  value: number; unit?: string; measuredAt: string; runId?: string; operator?: string;
}
export interface LisQueueRecord {
  id: string; receivedAt: string; status: string; message: LisMessage; resolved: LisResolved;
}

export interface Instrument {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  serial: string;
  section: string;
  active: 0 | 1;
}

export interface Test {
  id: string;
  analyte_id: string;
  /** Danh sách cấu hình xét nghiệm–máy cùng một danh mục, chỉ có trên kết
   * quả saveTest khi form lưu nhiều máy. */
  assignment_ids?: string[];
  name: string;
  instrument_id: string;
  unit: string;
  decimal_places: number;
  tea: number;
  section: string;
  tea_source: string;
  tea_ref_key: string;
  eflm_analyte: string;
  eflm_aps: string;
  eflm_lookup_date: string;
  eflm_ref: string;
  eflm_tea?: number | null;
  method: string;
  reagent: string;
  cusum_on: 0 | 1;
  cusum_k: number;
  cusum_h: number;
  active: 0 | 1;
  rule_actions_json: string;
  rule_scopes_json: string;
}

export interface QcLot {
  id: string; group_id: string | null; lot_no: string; level: number; description: string;
  supplier: string; program: string; exp: string; opened: string; active: 0 | 1; depleted: 0 | 1; note: string;
}

export interface LotGroup {
  id: string; name: string; manufacturer: string; material: string; catalog: string; note: string;
  active: 0 | 1;
  /** '' = không có trạng thái tự đặt — "Đang hoạt động"/"Chưa dùng" suy từ
   * `inUse`, không lưu thành literal 'active'. */
  status: '' | 'stopped' | 'planned'; stopped_at: string; lotIds: string[];
  /** Có lô nào của nhóm đang được gán (`test_levels.qc_lot_id`) cho xét
   * nghiệm nào không — tính ở `listLotGroups()`, KHÔNG lưu trong DB. */
  inUse: boolean;
}

/** Mean/SD "Dự kiến": số đã nhập sẵn cho lô của một nhóm lô CHƯA dùng, chờ
 * tới khi bấm "Kích hoạt nhóm lô" mới áp vào `test_levels`. Bảng riêng
 * (`planned_targets`), không phải một mốc trong lịch sử Mean/SD. */
export interface PlannedTarget {
  id: string; test_id: string; level: number; qc_lot_id: string;
  mean: number | null; sd: number | null; low: number | null; high: number | null;
  saved_at: string; saved_by: string;
}

export interface QcPanel {
  id: string; name: string; instrument_id: string; note: string; active: 0 | 1; testIds: string[];
}

export interface LotTransition {
  id: string; panel_id: string; from_lot_id: string; to_lot_id: string; start_date: string;
  /** `accepted`/`rejected` (2026-09-03, sửa lại từ `concluded` — xem
   * config-handlers.ts): chỉ `accepted` mới thật sự áp Mean/SD ứng viên và
   * đánh dấu lô cũ hết dùng; `rejected` không đụng gì tới cấu hình. */
  status: 'planned' | 'active' | 'accepted' | 'rejected';
  /** Mean/SD ỨNG VIÊN cho lô mới, JSON của `{testId,level,mean,sd}[]` —
   * chốt lúc tạo/sửa hồ sơ (trạng thái 'planned'), chỉ ÁP DỤNG THẬT vào
   * `test_levels` khi hồ sơ được 'accepted'. Trước lúc đó lô CŨ vẫn là lô
   * đang vận hành chính thức — đúng nguyên tắc "song song 2 lô". */
  criteria_json: string; conclusion: string;
  approved_at: string; approved_by: string; note: string;
}

export interface TeaRef {
  id: string; name: string; unit: string; section: string; lab: number | null; lab_source: string;
  lab_prepared_by: string; lab_next_review_date: string; sources_json: string;
  /** `config:listTeaRefs` trả nguyên hàng `tea_refs`, nên 3 cột này cũng có
   * sẵn — khai đủ ở đây vì bảng TEa tham chiếu cần chúng: `analyte_id` khoá
   * theo analyte của danh mục tích hợp, `clia`/`ricos` là GHI ĐÈ của phòng
   * xét nghiệm lên giá trị mặc định (null = dùng mặc định). */
  analyte_id?: string; aliases_json?: string; clia?: number | null; ricos?: number | null;
  clia_rule?: 'percent' | 'absolute' | 'greater-of' | ''; clia_absolute?: number | null; clia_absolute_unit?: string;
}

export interface RuleScopeItem {
  id: string; scope: 'within' | 'across' | 'both'; scopeMin: number; desc: string;
  /** Chỉ các kênh engine thực sự hỗ trợ cho luật này. */
  allowedScopes: ReadonlyArray<'within' | 'across' | 'both'>;
  /** Giá trị mà ô "Phạm vi SOP khuyến nghị" thực sự rơi về, đã tính theo số
   * mức ĐANG VẬN HÀNH của chính xét nghiệm này (main tự đếm). */
  defaultScope: 'within' | 'across' | 'both';
  /** Giá trị mà ô "Theo cấu hình chung" thực sự rơi về. */
  defaultAction: 'inactive' | 'alert' | 'reject';
  /** Hành động HIỆU LỰC sau khi tính ghi đè riêng của xét nghiệm. */
  action: 'inactive' | 'alert' | 'reject';
}

export interface TestLevel {
  id: string;
  test_id: string;
  level: number;
  mean: number | null;
  sd: number | null;
  qc_lot_id: string | null;
  mean_sd_history_json: string;
  // 6 trường dưới đây bảng `test_levels` có sẵn và handler VẪN trả về
  // (`SELECT *`), chỉ là hợp đồng thiếu khai báo nên renderer không đọc được
  // an toàn kiểu — trang Nhập QC cần `applied` để hiện "dải đang dùng".
  low: number | null;
  high: number | null;
  range_k: number;
  mfg_mean: number | null;
  mfg_sd: number | null;
  applied: 'mfg' | 'lab';
  /** Ngày cấu hình Mean/SD ĐANG HOẠT ĐỘNG bắt đầu hiệu lực (YYYY-MM-DD),
   * đóng dấu mỗi lần lưu qua Bảng Mean/SD — xem schema.ts. '' = chưa từng
   * lưu qua các luồng đó. */
  mean_sd_effective_from: string;
  /** 1 = mức thuộc THIẾT KẾ QC ĐANG VẬN HÀNH (lô gắn vào còn thuộc nhóm lô
   * đang chạy), theo `main/db/operational-levels.ts`. Trường dẫn xuất, không
   * có cột tương ứng trong `test_levels`. Trang nào cần "số mức QC đang chạy"
   * (Six Sigma chọn bảng Westgard Sigma Rules) phải lọc theo cờ này thay vì
   * đếm cả danh sách. */
  operational: 0 | 1;
}

/** Dữ liệu form dùng camelCase/boolean; các interface phía trên là hàng đã
 * đọc từ SQLite nên giữ snake_case và cờ 0/1. Tách hai phía để renderer
 * không phải dùng Record<string, unknown> hoặc ép kiểu khi lưu cấu hình. */
export interface InstrumentDraft {
  name?: string; manufacturer?: string; model?: string; serial?: string; section?: string; active?: boolean;
}
export interface TestDraft {
  name?: string; instrumentId?: string; unit?: string; decimalPlaces?: number; tea?: number; section?: string;
  instrumentIds?: string[]; assignmentIds?: string[]; analyteId?: string; preserveExistingAssignments?: boolean;
  teaSource?: string; teaRefKey?: string; method?: string; reagent?: string;
  cusumOn?: boolean; cusumK?: number; cusumH?: number; active?: boolean;
}
export interface TestLevelDraft {
  level?: number; mean?: number | null; sd?: number | null; low?: number | null; high?: number | null; qcLotId?: string;
}
export interface QcLotDraft {
  groupId?: string; lotNo?: string; level?: number; description?: string; supplier?: string; program?: string;
  exp?: string; opened?: string; active?: boolean; depleted?: boolean; note?: string;
}
export interface LotGroupDraft {
  name?: string; manufacturer?: string; material?: string; catalog?: string; note?: string;
  active?: boolean; status?: '' | 'stopped' | 'planned'; lotIds: string[];
}
export interface QcPanelDraft {
  name?: string; instrumentId?: string; note?: string; active?: boolean; testIds: string[];
}

export interface ActivityEntry {
  id: string;
  seq: number;
  ts: string;
  user: string;
  username: string;
  userId: string;
  role: string;
  type: string;
  detail: string;
  target: string;
  clientId: string;
  prevHash: string;
  hash: string;
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export interface ActivityPage {
  page: number; pageCount: number; offset: number; rows: ActivityEntry[]; resultFrom: number; resultTo: number;
  /** Số dòng sau khi lọc và TỔNG số dòng nhật ký (không lọc) — trang cần cả hai. */
  filteredCount: number; total: number;
}

export interface ActivityArchivePreview {
  months: number;
  cutoffIso: string;
  removedCount: number;
  retainedCount: number;
  /** CSV của đúng phần sẽ bị gỡ, gồm PrevHash và Hash để đối chiếu độc lập. */
  csv: string;
}

export interface QcPointView {
  /** Tập thống kê do main đánh giá cho chuỗi lô lịch sử. */
  accepted?: boolean;
  id: string; test_id: string; level: number; date: string; run_id: string; val: number;
  note: string; operator_name: string; voided: 0 | 1; void_reason: string;
  verdict: 'ok' | 'warn' | 'rej'; rules: string[];
  /** Tập con của `rules` thật sự gây LOẠI BỎ sau khi áp hành động ghi đè của
   * phòng xét nghiệm (`rejectingRules()`). Một điểm z=2,5 nổ `2-2s` mang
   * `rules=['1-2s','2-2s']` nhưng `rejectRules=['2-2s']` — `1-2s` vẫn chỉ là
   * cảnh báo. Chỉ `entry:queryPoints` điền; nơi khác chỉ hiển thị `rules`
   * nguyên khối nên để tuỳ chọn. */
  rejectRules?: string[];
  /** Các MỨC có điểm bị loại trong CÙNG lần chạy với điểm này (`qcRunKey` =
   * ngày + mã run). Rỗng khi lần chạy không bị loại.
   *
   * Cần vì `accepted` một mình không giải thích được gì: một điểm `verdict:
   * 'ok'` nhưng `accepted: false` là điểm bị loại THEO LẦN CHẠY do MỨC KHÁC
   * vi phạm. Không có trường này, màn hình chỉ có thể nói "Đạt" rồi âm thầm
   * trừ điểm đó khỏi n. */
  runRejectedBy?: number[];
  /** `entry:queryPoints` trả nguyên hàng `qc_points` (`{...p}`) nên các cột
   * đã chốt lúc nhập cũng có sẵn — khai đủ ở đây thay vì để trang phải ép
   * kiểu: `lot`/`qc_mean`/`qc_sd` là số lô + Mean/SD ĐANG dùng tại thời
   * điểm nhập (Giai đoạn B2), tab "Lịch sử dữ liệu" đọc chúng để tính lại Z
   * theo đúng mốc Mean/SD của lô đó. */
  lot?: string; qc_mean?: number | null; qc_sd?: number | null;
  operator_id?: string; operator_username?: string; operator_code?: string; created_at?: string;
}

export interface TestSummary {
  testId: string; testName: string; instrumentName: string; unit: string; decimalPlaces: number;
  levels: {
    level: number; mean: number | null; sd: number | null; qcLotId: string | null; lot: string; exp: string;
    /** Xấu nhất trong MỌI điểm của mức — dùng cho cây điều hướng Nhập QC và
     * trang Phân tích Westgard. */
    worstVerdict: 'ok' | 'warn' | 'rej';
    /** Kết luận + luật của ĐIỂM CUỐI CÙNG. Trang Tổng quan báo động theo
     * đây, KHÔNG theo `worstVerdict` — khớp `summarizeTestStatus()` của app
     * cũ (chỉ đọc điểm cuối), nên mức từng vi phạm hôm trước mà điểm mới
     * nhất đã đạt thì không còn nằm trong "Cần xử lý". */
    latestVerdict: 'ok' | 'warn' | 'rej'; latestRules: string[];
    pointCount: number; todayPointCount: number;
    /** CV QUAN SÁT ĐƯỢC của các điểm QC (SD mẫu n-1 chia |mean| thực tế),
     * không phải CV suy từ Mean/SD đích. `null` khi mức chưa có điểm nào. */
    cv: number | null;
    // `id` cần cho trang Khắc phục sự cố: hệ thống gắn dòng sự cố với hồ sơ
    // NCE theo ĐIỂM QC, không theo test+mức (xem D3.8).
    latest: { id: string; date: string; runId: string; val: number } | null;
  }[];
}

export interface LevelAnalysis {
  evaluationNote?: string;
  points: {
    id: string; date: string; runId: string; val: number; z: number;
    /** 'none' khi mức chưa có Mean/SD hợp lệ — điểm CHƯA ĐƯỢC ĐÁNH GIÁ. */
    verdict: 'ok' | 'warn' | 'rej' | 'none'; rules: string[]; supportRules: string[]; accepted: boolean;
    /** Cả lần chạy bị loại khỏi thống kê, kể cả mức không tự vi phạm luật. */
    runRejected: boolean;
    /** Các MỨC có điểm bị loại trong cùng lần chạy — LÝ DO của `runRejected`.
     * Cùng ngữ nghĩa với `QcPointView.runRejectedBy`; hai đường đọc phải nói
     * một chuyện về cùng một điểm. Rỗng khi lần chạy không bị loại. */
    runRejectedBy?: number[];
    targetMean: number | null; targetSd: number | null;
    /** CUSUM vượt ±h là cảnh báo xu hướng độc lập, không tự loại điểm QC. */
    cusumSignal: 'CUSUM +h' | 'CUSUM −h' | 'CUSUM ±h' | null;
    errorType: string; errorDesc: string;
  }[];
  cusum: { cPos: number[]; cNeg: number[]; flags: ('ok' | 'warn' | 'rej')[]; k: number; h: number; ma: number[] };
  cusumOn: boolean;
}

/** Điểm QC thô cho tab "Lịch sử dữ liệu": MỌI lô của xét nghiệm, KHÔNG kèm
 * kết luận Westgard.
 *
 * Cố ý KHÔNG dùng lại `QcPointView`: trang đó đọc lại Mean/SD đã chốt của
 * từng điểm rồi tự xếp theo dải Z (`Trong ±2s` / `Ngoài ±2s` / `Ngoài ±3s`),
 * và ghi rõ trên giao diện rằng đây không phải kết luận Westgard. Bản trước
 * vẫn trả một trường `verdict` cùng tên, cùng kiểu với verdict thật nhưng
 * tính bằng ngưỡng z thuần — không ai đọc, chỉ nằm đó chờ người sửa sau
 * tưởng nó là kết luận Westgard rồi đem đi dùng. */
export interface HistoryQcPointView {
  id: string; test_id: string; level: number; date: string; run_id: string; val: number;
  lot: string; qc_mean: number | null; qc_sd: number | null;
  note: string; operator_name: string; operator_username: string; operator_code: string;
  voided: 0 | 1; void_reason: string;
}

export interface VoidedQcPointView {
  id: string; test_id: string; level: number; date: string; run_id: string;
  lot: string; val: number; operator_name: string; void_reason: string;
  void_kind: string; void_requires_rerun: 0 | 1; voided_at: string; voided_by: string;
}

export interface RangeCandidateView {
  testId: string; level: number; lot: string; source: 'mfg' | 'lab';
  current: { mean: number | null; sd: number | null; cv: number | null };
  manufacturer: { mean: number | null; sd: number | null };
  proposed: { n: number; days: number; mean: number; sd: number; cv: number; rejected: number; warnings: number } | null;
  safety: { needed: boolean; nceId: string | null; tea: number | null; biasThreshold: number | null };
  eligible: boolean; canRevert: boolean;
}

/** Cột lô mới chỉ xuất hiện khi hồ sơ chuyển lô đang `active`. Điểm trong
 * cột này được Westgard đánh giá riêng và không tham gia verdict lô chính. */
export interface ParallelEntryColumn {
  transitionId: string; level: number; lotId: string; lot: string; startDate: string;
  mean: number; sd: number; low: number | null; high: number | null; exp: string;
  points: QcPointView[];
}

/** Chuỗi lô đã được thay thế bởi các hồ sơ chuyển lô đã chấp nhận. Mỗi
 * chuỗi dùng đúng Mean/SD lịch sử của lô và được đánh giá Westgard riêng. */
export interface PreviousLotSeries {
  level: number; lotId: string; lot: string; mean: number; sd: number;
  points: QcPointView[];
}

/** Trạng thái CHUNG của 1 luật Westgard (toàn phòng xét nghiệm, không riêng
 * xét nghiệm nào) — panel "Cấu hình chung của luật" trang Phân tích Westgard. */
export interface RuleSetting { id: string; desc: string; on: boolean; fix: string; alert: boolean; }

/** Phân tích Westgard cho một lô thuộc nhóm lô đã dừng/lưu trữ. Kết quả được
 * tính lại theo bộ luật đang bật, dùng Mean/SD đã chốt của lô thay vì
 * Mean/SD hiện hành của mức. */
export interface ArchivedBlock {
  level: number; lotId: string; lotNo: string; mean: number; sd: number; analysis: LevelAnalysis;
}

export interface SigmaMetricResult { tea: number; bias: number; cv: number; sigma: number; dpmo: number; yieldPercent: number }
export interface UncertaintyBudgetResult {
  k: number; uRw: number; uBias: number | null; uCal: number | null; bias: number | null;
  /** Độ không đảm bảo của GIÁ TRỊ GÁN EQA/CRM (%) — do nhà cung cấp công bố, không suy từ chuỗi bias quan sát. */
  uCref: number | null;
  includeBias: boolean; uc: number; U: number; shares: Record<string, number | null>; complete: boolean; missing: string[];
  target: number | null; absoluteUc: number | null; absoluteU: number | null;
  tea: number | null; teaRatio: number | null; withinTea: boolean | null;
}
export interface SigmaEqaRound { lab: number; target: number; bias: number }
export interface SigmaLevelResult {
  muBiasMode?: 'include' | 'exclude';
  cohortReviewed?: boolean;
  cohortReviewBy?: string;
  cohortReviewAt?: string;
  cohortStale?: boolean;
  teaCriterion?: string;
  level: number; /** TEa% ĐÃ GIẢI để tính Sigma/MU — có thể đến từ snapshot của mức, từ nguồn TEa của kỳ, từ TEa cấp kỳ, hoặc bậc dự phòng. Dùng để HIỂN THỊ, không phải để ghi lại. */ tea: number | null;
  /** TEa% THẬT SỰ đã chốt trong `lv_json` của mức; `null` = kỳ chưa từng chụp
   * và đang được giải lại mỗi lần đọc. Khi lưu lại kỳ phải gửi trường NÀY chứ
   * không phải `tea`: gửi giá trị đã giải sẽ đóng băng một con số có thể đến
   * từ bậc dự phòng (nguồn khác hẳn nguồn chốt của kỳ) và không kèm `teaBasis`
   * nào — hồ sơ khi đó mang một TEa không nguồn gốc. */
  teaSnapshot: number | null; /** Mean mục tiêu cùng lúc chụp kỳ, để quy đổi U% ra đơn vị xét nghiệm. */ targetMean: number | null; cv: number | null; biasEqa: number | null; /** Bias trung bình có dấu từ các vòng EQA; chỉ để truy xuất hướng lệch. */ biasMean: number | null; eqaRounds: SigmaEqaRound[]; mixedSigns: boolean;
  /** Sai số chuẩn của chính ước lượng bias (SD giữa các vòng / căn n) — CHỈ tham khảo, KHÔNG phải u(Cref). */ biasSem: number | null;
  uCref: number | null; uCal: number | null;
  cvSource: 'manual' | 'iqc-cohort'; cohortN: number | null; sourceLot: string; sourceStart: string; sourceEnd: string; cohortStatus: string;
  sigma: SigmaMetricResult | null; mu: UncertaintyBudgetResult | null;
  qualityDesign: {
    capable: boolean; tier: string; levels: 2 | 3; levelCount: number;
    rules: string[]; n: number; r: number;
    alternatives: { n: number; r: number; note?: string }[];
    risk: string; plan: string;
  } | null;
}
export interface SigmaPeriodView { id: string; testId: string; period: string; tea: number | null; teaSource: string; levels: SigmaLevelResult[] }
export interface SigmaCohortView {
  fingerprint?: string;
  level: number; lot: string; n: number; cv: number | null; start: string; end: string;
  targetMean: number | null; targetSd: number | null; issues: string[];
  excluded: { voided: number; invalidValue: number };
  outOfControl: { rejected: number; unresolved: number };
  status: 'insufficient' | 'provisional' | 'eligible' | 'unstable' | 'out-of-control';
}

export interface NceRecord {
  id: string; date: string; created_at: string; updated_at?: string; created_by_user_id?: string; test_id: string | null; level: number | null; lot: string;
  point_id: string | null; rule: string; error_type: string; nce_id: string; parent_nce_id: string; follow_up_nce_id: string; protocol_version: number;
  approval_status: 'pending' | 'approved' | 'returned'; effectiveness_status: 'pending' | 'effective' | 'ineffective';
  record_status: 'active' | 'cancelled'; risk_level?: string; due_date: string; action_completed_date: string; detail_json: string;
}

export interface NceDetail {
  correction?: string; investigation?: string;
  /** Nhóm nguyên nhân gốc, tách khỏi `NceRecord.error_type` (SE/RE). */
  causeCategory?: 'qc' | 'operator' | 'instrument' | 'reagent' | 'calibration' | 'environment' | 'unknown' | '';
  cause?: string; /** Tên cũ để đọc dữ liệu thí điểm trước protocol-v3. */ causeDescription?: string; action?: string;

  owner?: string;
  releaseDecision?: 'held' | 'released'; releaseNote?: string; releaseDecidedAt?: string; releaseDecidedBy?: string;
  rerunPointId?: string; rerunNote?: string; rerunSnapshot?: { date: string; runId: string; val: number; level: number };
  effectivenessNote?: string; residualRisk?: string;
  eventSource?: 'iqc' | 'eqa' | 'instrument' | 'clinical' | 'audit' | 'other' | '';
  processPhase?: 'pre' | 'exam' | 'post' | '';
  containmentStatus?: 'held' | 'none' | ''; containmentNote?: string;
  riskSeverity?: number; riskOccurrence?: number; riskDetectability?: number; riskLevel?: 'low' | 'medium' | 'high' | 'critical' | ''; riskBasis?: string;
  qcMaterialStatus?: string; qcMaterialNote?: string; instrumentStatus?: string; instrumentNote?: string; reagentStatus?: string; reagentNote?: string; calibrationStatus?: string; calibrationNote?: string; lotToLotStatus?: string; lotToLotNote?: string;
  biasBefore?: string; biasAfter?: string; actionCompletedDate?: string;
  releaseStatus?: 'released' | ''; releaseDate?: string; releaseBy?: string;
  patientImpact?: 'none' | 'held' | 'affected' | ''; patientAction?: string;
  effectivenessStatus?: 'pending' | 'effective' | 'ineffective'; effectivenessDate?: string;
  residualSeverity?: number; residualOccurrence?: number; residualDetectability?: number; residualRiskLevel?: 'low' | 'medium' | 'high' | 'critical' | ''; residualRiskBasis?: string;
  reopenedFrom?: string; reopenNote?: string; returnNote?: string; cancelReason?: string; cancelledBy?: string; cancelledAt?: string;
}

export interface ReagentComparisonFit { a: number; b: number; r2: number }
export interface ReagentComparisonResult {
  o: number[]; n: number[]; N: number; df: number; d: number[]; mO: number; mN: number; vO: number; vN: number;
  md: number; sdd: number; tStat: number; r: number; alpha: number; p2: number; p1: number; tc2: number; tc1: number;
  bias: number; biasT: number; fit: ReagentComparisonFit; pb: { a: number; b: number }; loaLower: number; loaUpper: number; mard: number;
  passP: boolean; passBias: boolean; passR2: boolean; passSlope: boolean; coverage: boolean; enoughN: boolean;
  passScreen: boolean; level: 'ok' | 'mid' | 'no';
}
export interface ReagentComparisonView {
  id: string; reagent: string; lot_old: string; lot_new: string; date: string; operator: string;
  sample_type: string; unit: string; bias_target: number | null; alpha: number | null;
  coverage_confirmed: 0 | 1; extra_json: string; rows_json: string;
  rows: [string, string][]; result: ReagentComparisonResult | null;
}

export interface PublicUser {
  id: string; username: string; name: string; initials: string; role: 'admin' | 'technician' | 'viewer';
  /** Quyền theo từng trang (Giai đoạn D3.1). `null` = KHÔNG thu hẹp, tài
   * khoản xem đủ các thẻ của vai trò. Mảng rỗng không bao giờ được lưu —
   * validate ở main chặn, vì nó sẽ khoá tài khoản khỏi mọi trang. */
  pagePerms: string[] | null;
  active: boolean; mustChangePassword: boolean;
  /** Data URL PNG 160×160 (canvas tự resize ở renderer trước khi gửi lên) —
   * chuỗi rỗng = chưa đặt, hiện chữ cái đầu tên/username thay ảnh. */
  avatar: string;
}

export interface LabProfile {
  id: number; name: string; dept: string; address: string;
  brand_title: string; brand_sub: string; logo_text: string; logo_data: string;
}
/** Phần nhận diện an toàn để hiện trước khi người dùng đăng nhập. */
export type LoginBrand = Pick<LabProfile, 'brand_title' | 'brand_sub' | 'logo_text' | 'logo_data'>;
export interface StorageInfo {
  dbFileBytes: number;
  path: string;
  engine: 'SQLite';
  sqliteVersion: string;
  schemaVersion: number;
  storageMode: 'file' | 'memory' | 'browser-preview';
}
export interface ReportTemplateSettings { formCode: string; version: string }
export interface FirebaseSettings {
  labCode: string; email: string; config: string; connected: boolean; status: string; dataPath: string;
}
export interface FirebaseConnectResult { state: 'pushed' | 'in-sync' | 'conflict'; remoteUpdatedAt: string }
export interface FirebaseSyncResult { state: 'pushed' | 'pulled'; remoteUpdatedAt: string }

export interface PeriodLockRow { id: string; ym: string; locked_at: string; locked_by: string; note: string }

export interface ReportPointRow {
  id: string; test_id: string; level: number; date: string; run_id: string; val: number;
  /** Số lô vật liệu kiểm đã chốt trên chính điểm đó. Báo cáo bắc qua một lần
   * đổi lô liệt kê điểm của CẢ HAI lô, nên thiếu cột này thì không phân biệt
   * được — mà số lô là định danh bắt buộc của vật liệu kiểm trong hồ sơ nội
   * kiểm ISO 15189. */
  lot: string;
  note: string; operator_name: string; voided: 0 | 1; void_reason: string;
}

export interface QcApi {
  hasAnyUsers(): Promise<boolean>;
  currentUser(): Promise<PublicUser | null>;
  bootstrapAdmin(input: { data: { username: string; name: string; password: string } }): Promise<IpcResult<PublicUser>>;
  login(input: { data: { username: string; password: string } }): Promise<IpcResult<PublicUser>>;
  logout(): Promise<IpcResult<null>>;
  listUsers(): Promise<IpcResult<PublicUser[]>>;
  /** `initials` giữ để tương thích API cũ nhưng bị main bỏ qua: mã luôn suy từ họ tên. */
  createUser(input: { data: { username: string; name: string; initials?: string; role: string; password: string; pagePerms?: string[] } }): Promise<IpcResult<PublicUser>>;
  /** `initials` giữ để tương thích API cũ nhưng bị main bỏ qua; `pagePerms`
   * bỏ trống = GIỮ NGUYÊN giá trị đang có (không phải xoá). */
  updateUser(input: { id: string; data: { name: string; role: string; active: boolean; initials?: string; pagePerms?: string[] } }): Promise<IpcResult<PublicUser>>;
  deleteUser(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  resetUserPassword(input: { id: string; data: { newPassword: string } }): Promise<IpcResult<{ id: string }>>;
  changeOwnPassword(input: { data: { oldPassword: string; newPassword: string } }): Promise<IpcResult<{ id: string }>>;
  verifyOwnPassword(input: { data: { password: string } }): Promise<IpcResult<{ ok: true }>>;
  /** Chỉ tự phục vụ (không nhận id người khác) — khớp hệ thống, đổi ảnh đại
   * diện không phải thao tác quản trị. */
  setAvatar(input: { data: { dataUrl: string } }): Promise<IpcResult<{ avatar: string }>>;
  clearAvatar(): Promise<IpcResult<{ avatar: string }>>;
  listInstruments(): Promise<Instrument[]>;
  saveInstrument(input: { id?: string; data: InstrumentDraft }): Promise<IpcResult<Instrument>>;
  removeInstrument(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  listTests(): Promise<Test[]>;
  saveTest(input: { id?: string; data: TestDraft }): Promise<IpcResult<Test>>;
  listTestLevels(testId: string): Promise<TestLevel[]>;
  saveTestLevel(input: { testId: string; data: TestLevelDraft }): Promise<IpcResult<TestLevel>>;
  listPlannedTargets(): Promise<PlannedTarget[]>;
  /** Lưu (upsert) Mean/SD dự kiến cho các (xét nghiệm, mức, lô) trong `items`
   * và bỏ những mục nêu trong `remove`. Không đụng tới mức QC đang chạy. */
  savePlannedTargets(input: {
    items?: { testId: string; level: number; qcLotId: string; mean: number | null; sd: number | null; low: number | null; high: number | null }[];
    remove?: { testId: string; level: number; qcLotId: string }[];
  }): Promise<IpcResult<{ saved: number; removed: number }>>;
  listActivity(limit?: number): Promise<ActivityEntry[]>;
  listRuleScopes(testId: string): Promise<RuleScopeItem[]>;
  saveRuleScope(testId: string, ruleId: string, scope: 'within' | 'across' | 'both' | ''): Promise<IpcResult<{ ruleId: string; scope: string }>>;
  listLots(): Promise<QcLot[]>;
  saveLot(input: { id?: string; data: QcLotDraft }): Promise<IpcResult<QcLot>>;
  /** Kế hoạch đổi số lô — ĐẾM điểm QC sẽ bị viết lại + kỳ đã khoá, KHÔNG ghi
   * gì. Renderer hỏi người dùng bằng đúng con số này TRƯỚC khi gọi `saveLot`
   * (số lô là nhãn tĩnh trên từng điểm QC, xem config-handlers.ts). */
  previewLotRename(input: { id: string; lotNo: string }): Promise<IpcResult<{ rename: null } | { rename: { oldLotNo: string; newLotNo: string; affected: number; lockedCount: number; lockedPeriods: string[] } }>>;
  /** Thao tác hệ thống có cổng chặn ở main khi lô/nhóm đang gán Mean/SD
   * hoặc hồ sơ đã kết luận. */
  setTeaRefValue(input: { analyteId: string; field: 'clia' | 'ricos'; value: string; name?: string; unit?: string; section?: string }): Promise<IpcResult<{ analyteId: string }>>;
  restoreTeaRefDefaults(input: { analyteId: string }): Promise<IpcResult<{ analyteId: string }>>;
  /** Thêm 1 DÒNG analyte mới vào bảng TEa tham chiếu (khác `saveTeaRef` —
   * đó là hồ sơ TEa CHUẨN HOÁ của PXN, bắt buộc 6 trường). */
  addTeaAnalyte(input: { name: string; abbreviation?: string; matrix?: string; unit?: string; section?: string; clia?: string; ricos?: string; cliaRule?: 'percent' | 'absolute' | 'greater-of'; cliaAbsolute?: string; cliaAbsoluteUnit?: string }): Promise<IpcResult<{ analyteId: string }>>;
  removeTest(input: { id: string; ids?: string[] }): Promise<IpcResult<{ id: string; pointsCount: number }>>;
  removePanel(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  removeLot(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  listLotGroups(): Promise<LotGroup[]>;
  removeLotGroup(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  stopLotGroup(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  /** Kích hoạt nhóm lô: áp Mean/SD ĐÃ LƯU của từng lô trong nhóm sang các
   * mức QC tương ứng và dừng nhóm bị thay thế. 3 trạng thái như hệ thống:
   * `applied` / `already-active` / `unready` (chưa mức nào có Mean/SD hợp lệ
   * cho lô của nhóm — KHÔNG đụng gì tới cấu hình). `unready` là một nhánh
   * THÀNH CÔNG trả về, không phải mã lỗi: hợp đồng thiếu nó tới 2026-09-10
   * nên renderer không biết nhánh đó tồn tại. */
  activateLotGroup(input: { id: string }): Promise<IpcResult<{ status: 'applied' | 'already-active' | 'unready'; applied: number; stoppedGroups: string[] }>>;
  removeLotTransition(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  saveLotGroup(input: { id?: string; data: LotGroupDraft }): Promise<IpcResult<LotGroup>>;
  listPanels(): Promise<QcPanel[]>;
  savePanel(input: { id?: string; data: QcPanelDraft }): Promise<IpcResult<QcPanel>>;
  listLotTransitions(): Promise<LotTransition[]>;
  /** Một hàm lưu duy nhất cho hồ sơ chuyển lô — đúng mô hình hệ thống
   * (`saveLotTransitionV2`): modal có 1 ô "Trạng thái" chọn được cả 4 giá
   * trị (`data.status`) + 1 nút Lưu, không phải các nút hành động tách rời.
   * `id` có → SỬA hồ sơ (nút "Sửa"). Hồ sơ đã 'accepted' thì khoá vĩnh viễn
   * (`accepted-immutable` nếu đổi status khác 'accepted'); 'rejected'
   * KHÔNG khoá, vẫn sửa/đổi status lại được. Chuyển SANG 'accepted'/
   * 'rejected' lần đầu (`finalChanged`) là lúc renderer phải xác thực lại
   * mật khẩu TRƯỚC khi gọi hàm này (không có tham số reauth riêng — main
   * không giữ trạng thái phiên xác thực). Chỉ 'accepted' mới thật sự áp
   * `criteria` (Mean/SD ứng viên) vào `test_levels` + đánh dấu lô cũ hết
   * dùng; thiếu Mean/SD cho dù chỉ một xét nghiệm đang dùng lô cũ sẽ bị chặn. */
  createLotTransition(input: { id?: string; data: { panelId: string; fromLotId: string; toLotId: string; startDate?: string; note?: string; status?: 'planned' | 'active' | 'accepted' | 'rejected'; criteria?: { testId: string; level: number; mean: number; sd: number }[] } }): Promise<IpcResult<LotTransition>>;
  listTeaRefs(): Promise<TeaRef[]>;
  saveTeaRef(input: { id?: string; data: Record<string, unknown> }): Promise<IpcResult<TeaRef>>;
  removeTeaRef(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  /** Xoá RIÊNG hồ sơ TEa PXN (khác `removeTeaRef` — xoá cả dòng analyte) —
   * `removedRecord` cho biết dòng có bị xoá luôn không (chỉ khi đó là
   * analyte KHÔNG tự thêm và không còn CLIA/Ricos% ghi đè nào khác). */
  removeTeaLabProfile(input: { id: string }): Promise<IpcResult<{ id: string; removedRecord: boolean }>>;
  /** 4 hàm đọc nhật ký trả `IpcResult` (khác mọi hàm đọc khác của app, trả
   * thẳng dữ liệu) vì trang Nhật ký là ADMIN_ONLY và nội dung nhật ký là dữ
   * liệu nhạy cảm — cổng quyền nằm ở main, xem `audit-handlers.ts`. Với
   * `verifyActivityChainNow`, `.ok` ngoài là cổng quyền, `.data.ok` mới là
   * kết luận chuỗi hash. */
  queryActivity(input: { query?: string; from?: string; to?: string; page?: number; pageSize?: number }): Promise<IpcResult<ActivityPage>>;
  previewArchiveActivity(input: { data: { months: 12 | 24 | 36 } }): Promise<IpcResult<ActivityArchivePreview>>;
  exportActivityCsv(input: { query?: string; from?: string; to?: string }): Promise<IpcResult<string>>;
  verifyActivityChainNow(): Promise<IpcResult<{ ok: boolean; checked: number; unhashed: number; brokenIndex: number; reason: string }>>;
  archiveActivity(input: { data: { months: 12 | 24 | 36 } }): Promise<IpcResult<{ removedCount: number; retainedCount: number; cutoffIso: string }>>;
  queryPoints(testId: string, level: number): Promise<QcPointView[]>;
  /** Mọi điểm chưa hủy của xét nghiệm, gồm cả các lô lịch sử. */
  listEntryHistoryPoints(testId: string): Promise<HistoryQcPointView[]>;
  listVoidedEntryPoints(testId: string): Promise<VoidedQcPointView[]>;
  listParallelEntryColumns(testId: string): Promise<ParallelEntryColumn[]>;
  listPreviousEntryLotSeries(testId: string): Promise<PreviousLotSeries[]>;
  getRangeCandidate(testId: string, level: number): Promise<IpcResult<RangeCandidateView>>;
  /** `mean` + `sd` chỉ được gửi cùng nhau khi người duyệt chọn điều chỉnh
   * thủ công dải đề xuất. Main vẫn áp đầy đủ cổng 20/20, run bị loại và an
   * toàn sai số hệ thống; đây không phải đường bỏ qua điều kiện lập dải. */
  applyLabRange(input: { data: { testId: string; level: number; reason: string; causeConfirmed?: boolean; bias?: number; mean?: number; sd?: number } }): Promise<IpcResult<RangeCandidateView>>;
  revertManufacturerRange(input: { data: { testId: string; level: number; reason: string } }): Promise<IpcResult<RangeCandidateView>>;
  addPoint(input: { data: { testId: string; level: number; date: string; val: number; runId?: string; lotNo?: string; note?: string; operatorName?: string } }): Promise<IpcResult<QcPointView>>;
  /** `kind` quyết định có tự mở/dùng lại hồ sơ NCE hay không
   * (`voidNceChoice()` ở `main/domain/entry-validation.ts`): 'analytical'
   * luôn mở NCE, 'data-entry' luôn không mở, 'other' để `openNce` tự chọn và
   * bắt buộc `reason` ≥5 ký tự (2 kind đầu không bắt buộc, chỉ khuyến nghị). */
  voidPoint(input: { data: { pointId: string; reason: string; kind?: 'analytical' | 'data-entry' | 'other'; openNce?: boolean } }): Promise<IpcResult<{ id: string; nceId: string | null; reusedAction: boolean }>>;
  setDayNote(input: { data: { testId: string; date: string; note: string } }): Promise<IpcResult<{ note: string; updated: number }>>;
  listTestSummaries(): Promise<TestSummary[]>;
  analyzeLevel(testId: string, level: number): Promise<LevelAnalysis>;
  saveRuleAction(testId: string, ruleId: string, action: 'inactive' | 'alert' | 'reject' | ''): Promise<IpcResult<{ ruleId: string; action: 'inactive' | 'alert' | 'reject' | '' }>>;
  listRuleSettings(): Promise<RuleSetting[]>;
  saveRuleSetting(ruleId: string, on: boolean): Promise<IpcResult<{ ruleId: string; on: boolean }>>;
  resetRuleSettings(): Promise<IpcResult<RuleSetting[]>>;
  listArchivedBlocks(testId: string, groupId: string): Promise<ArchivedBlock[]>;
  listArchivedGroupTests(groupId: string): Promise<{ id: string; label: string }[]>;
  /** Chuỗi lô cũ của từng mức đang vận hành — công tắc "Xem lô cũ" trên trang
   * Phân tích Westgard. Cùng hình dạng `ArchivedBlock` với tab nhóm lô đã dừng. */
  listPreviousLotBlocks(testId: string): Promise<ArchivedBlock[]>;
  listSigmaPeriods(testId: string): Promise<SigmaPeriodView[]>;
  listSigmaCohorts(testId: string, period: string, levels: number[]): Promise<SigmaCohortView[]>;
  saveSigmaTeaConfig(input: { testId: string; source: string; tea?: number; eflmAnalyte?: string; eflmAps?: string; eflmLookupDate?: string; eflmRef?: string }): Promise<IpcResult<Test>>;
  saveSigmaPeriod(input: { testId: string; period: string; tea?: number; teaSource?: string; levels: { level: number; /** Nạp lại cohort là thao tác chủ động, không phải lưu Bias/MU. */ refreshCohort?: boolean; cohortFingerprint?: string; /** Xác nhận rà soát theo SOP; main ghi người/thời điểm và dấu vân tay dữ liệu. */ cohortReviewed?: boolean; /** Snapshot TEa% riêng của mức QC, cần thiết cho tiêu chí CLIA tuyệt đối. */ tea?: number; /** Mean mục tiêu chụp cùng kỳ, dùng đổi U% sang đơn vị. */ targetMean?: number; cv?: number; biasEqa?: number; eqaRounds?: Array<{ lab: number; target: number; bias?: number }>; uCref?: number; uCal?: number; muBiasMode?: 'include' | 'exclude'; cvSource?: 'manual' | 'iqc-cohort'; cohortN?: number; sourceLot?: string; sourceStart?: string; sourceEnd?: string; cohortStatus?: string }[]; createOnly?: boolean }): Promise<IpcResult<SigmaPeriodView>>;
  renameSigmaPeriod(input: { id: string; period: string }): Promise<IpcResult<SigmaPeriodView>>;
  removeSigmaPeriod(input: { data: { id: string } }): Promise<IpcResult<{ id: string }>>;
  listNceRecords(): Promise<NceRecord[]>;
  createNce(input: { data: { testId?: string; level?: number; lot?: string; date: string; pointId?: string; rule?: string; errorType?: string; correction: string; dueDate?: string; investigation?: string; causeCategory?: string; causeDescription?: string; protocol?: Partial<NceDetail> } }): Promise<IpcResult<NceRecord>>;
  /** Lưu tiến độ protocol-v3; phê duyệt vẫn có cổng đầy đủ ở main process. */
  saveNceProtocol(input: { data: { id: string; dueDate?: string; protocol: Partial<NceDetail> } }): Promise<IpcResult<NceRecord>>;
  approveNce(input: { data: { id: string } }): Promise<IpcResult<NceRecord>>;
  returnNce(input: { data: { id: string; note: string } }): Promise<IpcResult<NceRecord>>;
  cancelNce(input: { data: { id: string; note: string } }): Promise<IpcResult<NceRecord>>;
  setNceCompletedDate(input: { data: { id: string; actionCompletedDate: string } }): Promise<IpcResult<NceRecord>>;
  markNceEffectiveness(input: { data: { id: string; status: 'effective' | 'ineffective'; residualRisk?: string; note?: string } }): Promise<IpcResult<NceRecord>>;
  setNceReleaseDecision(input: { data: { id: string; decision: 'held' | 'released'; note: string } }): Promise<IpcResult<NceRecord>>;
  setNceRerunEvidence(input: { data: { id: string; rerunPointId: string; note?: string } }): Promise<IpcResult<NceRecord>>;
  reopenNce(input: { data: { id: string; note?: string } }): Promise<IpcResult<NceRecord>>;
  listReagentComparisons(): Promise<ReagentComparisonView[]>;
  createReagentComparison(input: { data: { name?: string; unit?: string } }): Promise<IpcResult<ReagentComparisonView>>;
  saveReagentMetadata(input: { id: string; data: { reagent?: string; lotOld?: string; lotNew?: string; date?: string; operator?: string; sampleType?: string; unit?: string; biasTarget?: number; alpha?: number; coverageConfirmed?: boolean } }): Promise<IpcResult<ReagentComparisonView>>;
  saveReagentRows(input: { id: string; rows: [string, string][] }): Promise<IpcResult<ReagentComparisonView>>;
  removeReagentComparison(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  /** "Chọn nhanh" người thực hiện/loại mẫu — 1 danh sách CHUNG cho toàn app
   * (không gắn theo phép so sánh), lưu ở `app_meta`. */
  listReagentQuickValues(input: { type: 'operator' | 'sampleType' }): Promise<IpcResult<string[]>>;
  addReagentQuickValue(input: { type: 'operator' | 'sampleType'; value: string }): Promise<IpcResult<{ items: string[]; value: string }>>;
  removeReagentQuickValue(input: { type: 'operator' | 'sampleType'; index: number }): Promise<IpcResult<{ items: string[] }>>;
  getLabProfile(): Promise<LabProfile>;
  getLoginBrand(): Promise<LoginBrand>;
  saveLabProfile(input: { data: { name?: string; dept?: string; address?: string; brandTitle?: string; brandSub?: string; logoText?: string; logoData?: string; clearLogo?: boolean } }): Promise<IpcResult<LabProfile>>;
  getStorageInfo(): Promise<StorageInfo>;
  getReportTemplateSettings(): Promise<ReportTemplateSettings>;
  saveReportTemplateSettings(input: { data: { formCode?: string; version?: string } }): Promise<IpcResult<ReportTemplateSettings>>;
  getFirebaseSettings(): Promise<FirebaseSettings>;
  connectFirebase(input: { data: { labCode?: string; email?: string; password?: string; config?: string } }): Promise<IpcResult<FirebaseConnectResult>>;
  syncFirebase(input: { data: { direction: 'push' | 'pull' } }): Promise<IpcResult<FirebaseSyncResult>>;
  disconnectFirebase(): Promise<IpcResult<null>>;
  listPeriodLocks(): Promise<PeriodLockRow[]>;
  lockPeriod(input: { data: { ym: string; note?: string } }): Promise<IpcResult<PeriodLockRow>>;
  unlockPeriod(input: { data: { ym: string; note: string } }): Promise<IpcResult<{ ym: string }>>;
  queryReport(input: { testId: string; from?: string; to?: string }): Promise<ReportPointRow[]>;
  /** Giai đoạn C1 — Excel thật qua `exceljs` (main process), trả base64 để
   * renderer tự tạo Blob + tải về, không cần hộp thoại lưu file native (nhẹ
   * hơn, khớp cơ chế `downloadCsv` đã dùng ở Audit/Report). */
  exportTableXlsx(input: { sheetName: string; headers: string[]; rows: (string | number | null)[][] }): Promise<IpcResult<string>>;

  printHtmlToPdf(input: { html: string; defaultFileName: string; pageNumbers?: boolean }): Promise<IpcResult<{ path: string }>>;
  /** Xuất toàn bộ dữ liệu ra một tệp backup SQLite. Main mở hộp thoại lưu;
   * `data` là `null` khi người dùng huỷ hộp thoại. Chỉ chạy trên máy chính. */
  exportBackup(): Promise<IpcResult<{ path: string; bytes: number; points: number } | null>>;
  /** Mở hộp thoại chọn tệp backup (.sqlite, hoặc .json cũ) và kiểm tra nó mà
   * không chạm vào dữ liệu đang dùng. `data` là `null` khi người dùng huỷ. */
  chooseBackupFile(): Promise<IpcResult<BackupFileSummary | null>>;
  /** Phục hồi từ tệp vừa kiểm tra ở `chooseBackupFile()`; luôn tạo bản an
   * toàn của dữ liệu hiện tại trước khi thay thế. */
  importBackup(): Promise<IpcResult<{ preRestoreSnapshotPath: string }>>;
  backupStatus(): Promise<{ lastBackupAt: string | null; lastBackupBytes: number }>;
  /** Khởi tạo lại dữ liệu vận hành; giữ tài khoản và nhật ký. */
  resetOperationalData(): Promise<IpcResult<{ preResetSnapshotPath: string; clearedTables: string[] }>>;

  getLisSettings(): Promise<LisGatewaySettings>;
  saveLisSettings(input: { data: { enabled: boolean; url: string; token: string } }): Promise<IpcResult<LisGatewaySettings>>;
  pullLisQueue(): Promise<IpcResult<{ pending: LisQueueRecord[]; unresolved: LisQueueRecord[] }>>;
  importLisResult(input: { data: { record: LisQueueRecord } }): Promise<IpcResult<{ pointId: string; gatewayWarning?: string }>>;
  rejectLisResult(input: { data: { messageId: string; note?: string } }): Promise<IpcResult<{ messageId: string }>>;
  /** `store:changed` có phạm vi: main phát bảng nào vừa đổi sau mỗi transaction
   * ghi thành công.
   * Trả về hàm huỷ đăng ký, gọi trong cleanup của `useEffect`. */
  onStoreChanged(callback: (payload: { tables: string[]; testIds: string[] }) => void): () => void;
}

declare global {
  interface Window {
    qcApi: QcApi;
  }
}
