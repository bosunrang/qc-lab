// Hợp đồng IPC lộ ra qua preload.ts — dùng chung giữa main và renderer để
// renderer có type an toàn khi gọi window.qcApi.*
export interface LisGatewaySettings { enabled: boolean; url: string; token: string }
/** Chế độ vận hành đã bật: lúc nào, ai bật. */
export interface OperationModeState { enabledAt: string; enabledBy: string }
/** Trạng thái cho panel "Quản trị dữ liệu". `activityRows` dùng để nhắc lưu
 * trữ nhật ký; `operationMode` là `null` khi chưa bật chế độ vận hành. */
export interface BackupStatus { lastBackupAt: string | null; lastBackupBytes: number; activityRows: number; operationMode: OperationModeState | null }
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
  /** Nguồn và mã bản tin gốc của LIS (Gateway SQLite cấp); `message.messageId`
   * là UUID của Gateway. QC Lab dùng để không nhận trùng sau khi phục hồi Gateway. */
  source?: { sourceId: string; messageId: string };
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
  /** Nguồn TEa vận hành chung của danh mục và Sigma; rỗng giữ cách phân giải của cấu hình cũ. */
  operational_tea_source: string;
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
  /** TEa riêng theo số mức QC của analyte, áp dụng cho mọi cấu hình xét
   * nghiệm–máy khớp analyte; mức không có ở đây dùng `lab` (TEa chung). */
  lab_level_defaults: TeaRefLevelDefault[];
  /** Các phiên bản đã lưu của hồ sơ TEa PXN, cũ trước. */
  lab_versions: TeaRefVersion[];
  /** `config:listTeaRefs` trả nguyên hàng `tea_refs`, nên 3 cột này cũng có
   * sẵn — khai đủ ở đây vì bảng TEa tham chiếu cần chúng: `analyte_id` khoá
   * theo analyte của danh mục tích hợp, `clia`/`ricos` là GHI ĐÈ của phòng
   * xét nghiệm lên giá trị mặc định (null = dùng mặc định). */
  analyte_id?: string; aliases_json?: string; clia?: number | null; ricos?: number | null;
  clia_rule?: 'percent' | 'absolute' | 'greater-of' | ''; clia_absolute?: number | null; clia_absolute_unit?: string;
}

export interface TeaRefLevelDefault {
  level: number;
  tea: number;
}

/** Một phiên bản hồ sơ TEa của PXN (N8): ảnh chụp lúc lưu hoặc xoá, cũ trước.
 * `baseline` là hồ sơ đã có trước khi app lưu phiên bản (`saved_at` rỗng). */
export interface TeaRefVersion {
  id: string; action: 'baseline' | 'save' | 'remove'; saved_at: string; saved_by: string;
  lab: number | null; levels: TeaRefLevelDefault[]; lab_source: string; lab_prepared_by: string;
  lab_next_review_date: string; sources_json: string;
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
  teaSource?: string; operationalTeaSource?: string; teaRefKey?: string; method?: string; reagent?: string;
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

/** Một lần chạy ĐÃ CÓ đổi kết luận Westgard vì điểm vừa nhập lùi ngày hoặc
 * vừa huỷ (luật nhiều lần chạy nhìn lại lần chạy trước) — xem tệp
 * `main/domain/run-conclusion-change.ts` để biết cách so trước/sau. */
export interface QcRunConclusionChange {
  date: string; runId: string;
  before: 'ok' | 'warn' | 'rej'; after: 'ok' | 'warn' | 'rej';
  rulesBefore: string[]; rulesAfter: string[];
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
   * điểm nhập, tab "Lịch sử dữ liệu" đọc chúng để tính lại Z
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
     * đây, KHÔNG theo `worstVerdict` (chỉ đọc điểm cuối), nên mức từng vi
     * phạm hôm trước mà điểm mới nhất đã đạt thì không còn nằm trong "Cần xử lý". */
    latestVerdict: 'ok' | 'warn' | 'rej'; latestRules: string[];
    pointCount: number; todayPointCount: number;
    /** CV QUAN SÁT ĐƯỢC của các điểm QC (SD mẫu n-1 chia |mean| thực tế),
     * không phải CV suy từ Mean/SD đích. `null` khi mức chưa có điểm nào. */
    cv: number | null;
    // `id` cần cho trang Khắc phục sự cố: trang gắn dòng sự cố với hồ sơ
    // NCE theo ĐIỂM QC, không theo test+mức.
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

/** Điểm chưa huỷ của MỌI lô trong lịch sử xét nghiệm. Kết luận do main đánh
 * giá bằng đầy đủ chuỗi/lần chạy, cùng nguồn với báo cáo nội kiểm; không
 * phân loại đạt/loại chỉ từ Z của một điểm. */
export interface HistoryQcPointView {
  id: string; test_id: string; level: number; date: string; run_id: string; val: number;
  lot: string; qc_mean: number | null; qc_sd: number | null;
  note: string; operator_name: string; operator_username: string; operator_code: string;
  voided: 0 | 1; void_reason: string;
  verdict: 'ok' | 'warn' | 'rej' | 'none'; rules: string[];
  accepted: boolean; run_rejected_by: number[];
}

export interface VoidPointAssessment {
  error_class: 'SE' | 'RE' | '';
  /** Chỉ các luật cùng loại sai số trong những điểm bị loại của lần chạy. */
  rules: string[];
  run_rejected: boolean;
  rejected_levels: number[];
}

export interface VoidedQcPointView {
  id: string; test_id: string; level: number; date: string; run_id: string;
  lot: string; val: number; operator_name: string; void_reason: string;
  void_kind: string; void_requires_rerun: 0 | 1; voided_at: string; voided_by: string;
  /** Họ tên tài khoản người huỷ; dùng username gốc khi không còn tên để đối chiếu. */
  voided_by_name: string;
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
/** Một mẫu ngoại kiểm đề xuất làm Bias cho Sigma (SIGMA-REVIEW-2026-11-17). */
export interface SigmaEqaBiasSampleView {
  resultId: string; label: string; reportDate: string; result: number; assigned: number; assignedUncertain: boolean; ncCauseCategory: string;
}
export type SigmaEqaExclusionView = 'after-period' | 'outside-window' | 'nce-cause' | 'assigned-uncertain' | 'invalid';
export interface SigmaEqaBiasView {
  included: (SigmaEqaBiasSampleView & { bias: number })[];
  excluded: (SigmaEqaBiasSampleView & { reason: SigmaEqaExclusionView })[];
  /** Trung bình có dấu (Sigma), RMS (chỉ MU), sai số chuẩn; null khi chưa có mẫu. */
  mean: number | null; rms: number | null; sem: number | null; n: number; mixedSigns: boolean; enough: boolean;
  /** targetMean giữ null để tương thích bản cũ; Bias chung không lọc theo Mean QC. */
  window: { start: string; end: string }; windowMonths: number; targetMean: number | null;
}
/** Vòng lấy từ ngoại kiểm đã nhập mang mã kết quả và nhãn để truy vết (SIGMA-REVIEW-2026-11-17 SB-7). */
export interface SigmaEqaRound { lab: number; target: number; bias: number; eqaResultId?: string; label?: string }
export interface SigmaLevelResult {
  /** Khoảng tháng đã chụp khi áp dụng Bias chung. */
  eqaWindowMonths?: number;
  muBiasMode?: 'include' | 'exclude';
  cohortReviewed?: boolean;
  cohortReviewBy?: string;
  cohortReviewAt?: string;
  cohortStale?: boolean;
  teaCriterion?: string;
  /** Mean và đơn vị thực dùng khi quy đổi CLIA. null ở Mean nghĩa là kỳ cũ chưa lưu căn cứ này. */
  teaConversion?: { targetMean: number | null; unit: string };
  level: number; /** TEa% ĐÃ GIẢI để tính Sigma/MU — có thể đến từ snapshot của mức, từ nguồn TEa của kỳ, từ TEa cấp kỳ, hoặc bậc dự phòng. Dùng để HIỂN THỊ, không phải để ghi lại. */ tea: number | null;
  /** TEa% THẬT SỰ đã chốt trong `lv_json` của mức; `null` = kỳ chưa từng chụp
   * và đang được giải lại mỗi lần đọc. Khi lưu lại kỳ phải gửi trường NÀY chứ
   * không phải `tea`: gửi giá trị đã giải sẽ đóng băng một con số có thể đến
   * từ bậc dự phòng (nguồn khác hẳn nguồn chốt của kỳ) và không kèm `teaBasis`
   * nào — hồ sơ khi đó mang một TEa không nguồn gốc. */
  teaSnapshot: number | null; /** Mean mục tiêu cùng lúc chụp kỳ, để quy đổi U% ra đơn vị xét nghiệm. */ targetMean: number | null; cv: number | null; /** Bias dùng tính Sigma: trung bình có dấu các vòng EQA, hoặc Bias nhập tay (SIGMA-REVIEW-2026-11-17 SB-1). */ biasEqa: number | null; /** Bias trung bình có dấu từ các vòng EQA; null khi nhập Bias tay. */ biasMean: number | null;
  /** Bias RMS các vòng, CHỈ dùng cho ngân sách MU (Nordtest); bằng `biasEqa` khi nhập tay hoặc một vòng. */ biasRms: number | null; eqaRounds: SigmaEqaRound[]; mixedSigns: boolean;
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
export type SigmaTeaMode = 'stored' | 'operational';
export interface SigmaPeriodView {
  id: string; testId: string; period: string; tea: number | null; teaSource: string; levels: SigmaLevelResult[];
  /** Bản gốc để lưu CV/Bias mà không ghi đè TEa lịch sử bằng kết quả đang tính theo nguồn vận hành. */
  savedTea?: { tea: number | null; source: string };
}
export interface SigmaCohortView {
  fingerprint?: string;
  level: number; lot: string; n: number; cv: number | null; start: string; end: string;
  targetMean: number | null; targetSd: number | null; issues: string[];
  excluded: { voided: number; invalidValue: number; resolved: number };
  outOfControl: { rejected: number; unresolved: number };
  status: 'insufficient' | 'provisional' | 'eligible' | 'unstable' | 'out-of-control';
}

/** Hồ sơ NCE protocol 4 (docs/NCE-REDESIGN-2026-10-12.md). Các dòng dưới đây
 * là bảng `nce_*` đọc thẳng từ SQLite (snake_case) kèm vài trường main tính. */
export type NceStatus = 'open' | 'released' | 'pending_approval' | 'closed' | 'cancelled';
export type NceSource = 'iqc' | 'eqa' | 'instrument' | 'reagent' | 'calibration' | 'other';
export type NceNextStepName = 'release' | 'submit' | 'approve' | null;

export interface NceRecordRow {
  id: string; nce_id: string; source: NceSource; phase: 'pre' | 'exam' | 'post';
  eqa_result_id: string | null; eqa_source_key: string; eqa_snapshot_json: string;
  test_id: string | null; detected_at: string; description: string; correction: string;
  containment_note: string; occurred_note: string;
  /** 1 có giữ kết quả, 0 không, null chưa xác định. */
  hold_results: 0 | 1 | null;
  status: NceStatus; tier: 'low' | 'capa' | ''; tier_reason: string;
  risk_severity: number; risk_probability: number; risk_level: 'low' | 'medium' | 'high' | 'critical' | ''; risk_basis: string;
  checklist_json: string;
  cause_status: 'identified' | 'suspected' | 'undetermined' | ''; cause_category: string; cause_text: string; cause_check_plan: string;
  effectiveness_criteria: string; effectiveness_review_due: string;
  owner_user_id: string; due_date: string; reported_by_user_id: string; reported_by_name: string;
  error_class: 'SE' | 'RE' | ''; qc_resolved: 0 | 1;
  created_at: string; updated_at: string; row_version: number; protocol_version: number; legacy_json: string;
  /** Main tính lúc đọc. */
  test_name: string; owner_name: string; overdue_days: number; next_step: NceNextStepName;
  open_actions: number; overdue_actions: number;
}

export interface NceRunRow {
  id: string; nce_record_id: string; test_id: string; date: string; run_id: string;
  role: 'trigger' | 'repeat_reject' | 'rerun'; snapshot_json: string;
  attached_at: string; attached_by_user_id: string; attached_by_name: string;
}

export interface NceActionRow {
  id: string; nce_record_id: string; kind: 'corrective' | 'preventive' | 'system_change'; description: string;
  owner_user_id: string; due_date: string; status: 'open' | 'done' | 'cancelled';
  done_at: string; done_by_user_id: string; done_by_name: string; evidence: string; cancel_reason: string;
  created_at: string; created_by_user_id: string;
  owner_name: string; overdue_days: number;
}

export interface NceDecisionRow {
  id: string; nce_record_id: string;
  type: 'release' | 'technical_assessment' | 'patient_impact' | 'effectiveness' | 'submit' | 'approve' | 'return' | 'cancel';
  payload_json: string; actor_user_id: string; actor_name: string; decided_at: string;
}

export interface NceRevisionRow { id: string; nce_record_id: string; actor_user_id: string; actor_name: string; at: string; changes_json: string }

export interface NceMissingItem { code: string; message: string }
export interface NceRunKeyView { date: string; runId: string }

export interface NceDossierView {
  eqa_followup?: { evidence: EqaNceEvidence | null; missing: string[]; fingerprint: string } | null;
  record: NceRecordRow;
  runs: NceRunRow[]; actions: NceActionRow[]; decisions: NceDecisionRow[]; revisions: NceRevisionRow[];
  /** Bước kế tiếp còn thiếu gì (main tính bằng `domain/nce/gates.ts`). */
  missing: NceMissingItem[];
  /** Lý do bắt buộc tầng CAPA; rỗng thì được chọn xử lý nhanh. */
  capa_triggers: NceMissingItem[];
  recurrence: boolean;
  /** Khoảng nghi ngờ ảnh hưởng kết quả bệnh nhân (chỉ hồ sơ có lần chạy khởi đầu). */
  /** `onset`: lần chạy đầu tiên của chuỗi vi phạm (khác `trigger` khi luật
   * đếm nhiều lần chạy làm khoảng lùi về trước); `onset_rules`: các luật đó. */
  suspect_window: { last_accepted: NceRunKeyView | null; onset: NceRunKeyView; onset_rules: string[]; trigger: NceRunKeyView; rerun: NceRunKeyView | null; runs: NceRunKeyView[] } | null;
  /** Thao tác người đang xem được phép làm, để giao diện ẩn/hiện nút; main vẫn chặn thật. */
  can: { edit: boolean; release: boolean; patient_impact: boolean; submit: boolean; approve: boolean; return: boolean; cancel: boolean; review_effectiveness: boolean };
  /** Lý do người đang xem không được duyệt (không độc lập…); rỗng nếu được. */
  approve_block: string;
  /** Số liệu gợi ý để điền sẵn form "Xác minh kỹ thuật IQC" (chỉ hồ sơ IQC có
   * lần khởi đầu, chưa nộp duyệt) — xem `main/domain/nce/technical-prefill.ts`. */
  technical_prefill: NceTechnicalPrefillView | null;
  /** Lời nhắc theo mục checklist từ dữ liệu sẵn có (lô QC hết hạn, mới đổi
   * lô…), khoá là mã mục — xem `main/domain/nce/checklist-hints.ts`. */
  checklist_hints: Record<string, string>;
  /** Mốc thời gian dựng từ dữ liệu đã lưu (`main/domain/nce/timeline.ts`),
   * thay việc gõ lại diễn biến; `occurred_note` chỉ để ghi thêm. */
  timeline: NceTimelineEntryView[];
  /** Bản nháp phạm vi kiểm soát từ dữ liệu app biết, chừa `[cần ghi]` cho
   * phần người làm phải ghi; rỗng khi không có (hồ sơ không phải IQC…). */
  containment_draft: string;
}

export interface NceTimelineEntryView {
  /** `YYYY-MM-DD` khi `dateOnly`, ngược lại là ISO đầy đủ. */
  at: string; dateOnly: boolean; label: string; detail: string;
  /** Lần chạy QC gắn với mốc (bị loại, chạy lại); `null` nếu không có. */
  run: NceRunKeyView | null;
}

/** Gợi ý số liệu xác minh kỹ thuật, đơn vị % so với Mean đích. */
export interface NceTechnicalPrefillView {
  /** Mức và lô dùng để tính: mức bị loại có |z| lớn nhất trong lần khởi đầu. */
  level: number; lot: string; unit: string;
  tea: number | null; teaSource: string;
  stableBias: number | null; incidentBias: number | null;
  sd: number | null; sdSource: string;
  observedDispersion: number | null; sampleCount: number | null;
  /** Số điểm sự cố đã dùng (từ lần đầu chuỗi vi phạm tới lần khởi đầu). */
  incidentCount: number;
  /** Lưu ý khi thiếu dữ liệu (ít điểm ổn định, chưa có TEa…). */
  notes: string[];
}

export interface NceQueueRowView {
  test_id: string; test_name: string; date: string; run_id: string;
  rejected_levels: { level: number; lot: string; rules: string[]; point_id: string }[];
  record: { id: string; nce_id: string } | null;
  attach_to: { id: string; nce_id: string } | null;
}

export interface NceReleasePreview {
  ok: boolean; problems: NceMissingItem[]; lot_changed_levels: number[];
  warnings: NceMissingItem[];
  /** Quyết định ảnh hưởng bệnh nhân hiện hành chưa bao phủ khoảng nghi ngờ
   * kết thúc ở lần chạy ứng viên; chặn cho phép hoạt động trở lại. */
  impact_problems: NceMissingItem[];
  points: { level: number; lot: string; val: number; z: number | null; verdict: 'ok' | 'warn' | 'rej' | 'none'; rules: string[]; voided: boolean }[];
}

export interface NceUserOption { id: string; name: string; username: string; role: 'admin' | 'technician' | 'viewer'; capabilities: string[] }

export interface NceConfigView {
  dueDays: { low: number; capa: number }; recurrenceWindowDays: number;
  separationException: { enabled: boolean; sopRef: string };
}

/** Mọi lệnh sửa một hồ sơ gửi kèm `expectedVersion` (= `row_version` đang
 * xem); lệch thì main trả lỗi `stale`. */
export interface NceWriteBase { id: string; expectedVersion: number }

export interface NceTechnicalAssessmentInput {
  errorNature: 'systematic' | 'random' | 'mixed' | 'undetermined';
  verificationMethod: string; correctiveEvidence: string; technicalConclusion: string;
  metricMode: 'calculated' | 'not_applicable'; metricReason: string; unit: string;
  tea: number | null; teaSource: string; stableBias: number | null; incidentBias: number | null;
  postCorrectionBias: number | null; sd: number | null; sdSource: string;
  observedDispersion: number | null; sampleCount: number | null;
  meanResetDecision: 'not_applicable' | 'not_allowed' | 'eligible';
  meanResetReason: string; meanResetEvidence: string;
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
  /** Quyền theo từng trang. `null` = KHÔNG thu hẹp, tài
   * khoản xem đủ các thẻ của vai trò. Mảng rỗng không bao giờ được lưu —
   * validate ở main chặn, vì nó sẽ khoá tài khoản khỏi mọi trang. */
  pagePerms: string[] | null;
  active: boolean; mustChangePassword: boolean;
  /** Data URL PNG 160×160 (canvas tự resize ở renderer trước khi gửi lên) —
   * chuỗi rỗng = chưa đặt, hiện chữ cái đầu tên/username thay ảnh. */
  avatar: string;
  /** Quyền nghiệp vụ NCE cấp riêng (`nce.release`, `nce.approve`); quản trị
   * viên mặc nhiên có cả hai nên mảng có thể rỗng. */
  capabilities: string[];
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
/** Loại PDF có biểu mẫu kiểm soát riêng: nội kiểm, Westgard, Six Sigma, so sánh hoá chất. */
export type ReportFormKind = 'iqc' | 'westgard' | 'sigma' | 'reagent' | 'review' | 'eqa';
/** Thông tin kiểm soát tài liệu in ở đầu PDF. `effectiveDate` là `YYYY-MM-DD` hoặc rỗng. */
export interface ReportForm { formCode: string; version: string; effectiveDate: string }
export type ReportTemplateSettings = Record<ReportFormKind, ReportForm>;
/** Một dòng biên bản xem xét QC tháng: một xét nghiệm × mức × lô (GV4 mục 2). */
export interface QcMonthlyReviewRow {
  test_id: string; test_name: string; instrument_name: string; unit: string; decimal_places: number; level: number; lot: string;
  n: number; accepted: number; rejected: number; unevaluated: number;
  mean: number | null; sd: number | null; cv: number | null;
  target_mean: number | null; target_sd: number | null; target_cv: number | null; target_changed: boolean;
  shift_sd: number | null; bias_pct: number | null;
  /** Điểm đã huỷ trong tháng; trong đó thuộc lần chạy bị loại. */
  voided: number; voided_rejected: number;
}
export interface QcMonthlyReviewNce { nce_id: string; test_name: string; status: string; error_class: string; detected_at: string }
export type QcReviewConclusion = 'ok' | 'monitor' | 'action';
export interface QcMonthlyReviewSignature {
  id: string; ym: string; conclusion: QcReviewConclusion; note: string;
  reviewer_name: string; reviewer_username: string; reviewed_at: string;
}
export interface QcMonthlyReview {
  ym: string; rows: QcMonthlyReviewRow[]; nce: QcMonthlyReviewNce[];
  totals: { points: number; accepted: number; rejected: number; rejected_runs: number; voided: number; voided_rejected: number; nce: number; nce_open: number };
  /** Việc còn tồn của kỳ (lần chạy bị loại chưa có NCE, NCE chưa đóng); rỗng nếu không còn. */
  open_items: string;
  /** Các lần ký, cũ trước; lần cuối là kết luận hiện hành. */
  signatures: QcMonthlyReviewSignature[];
  /** Đã ký nhưng số liệu tháng đổi sau lần ký cuối: kết luận chỉ áp dụng cho
   * số liệu lúc ký, cần ký lại trước khi khoá kỳ. */
  signature_stale: boolean;
}
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
  /** Cùng nguồn đánh giá với Westgard, tính trước khi cắt khoảng ngày báo cáo.
   * Điểm đã huỷ/chưa đánh giá có z=null, không được vẽ thành điểm đạt. */
  target_mean: number | null; target_sd: number | null; z: number | null;
  verdict: 'ok' | 'warn' | 'rej' | 'none'; rules: string[];
  accepted: boolean; run_rejected_by: number[];
}

// ── Ngoại kiểm (docs/EQA-PLAN-2026-10-28.md) ──────────────────────────────
// Bản nháp nhập (camelCase) là dữ liệu renderer đọc từ báo cáo PDF; main kiểm lại
// toàn bộ. Dòng đọc từ SQLite giữ snake_case.

export interface EqaPeerStatsView { mean: number | null; sd: number | null; cv: number | null; n: number | null }
export type EqaPeerView = Partial<Record<'all' | 'method' | 'instrument', EqaPeerStatsView>>;
export interface EqaRoundDraft {
  program: string; provider: string; programCode: string; unitCode: string; year: number | null; round: string;
  reportCode: string; reportDate: string; assignedLevel: string;
}
export interface EqaRowDraft {
  ref: string; code: string; instrument: string; sample: string; unit: string;
  result: number | null; assigned: number | null; sigmaP: number | null; zProvider: number | null;
  method: string; peerGroup: string; peer: EqaPeerView;
}
export type EqaClassView = 'ok' | 'warn' | 'rej';
export type EqaProviderCheckView = 'match' | 'swapped' | 'mismatch' | 'none';
export interface EqaCheckedRowDraft extends EqaRowDraft {
  testId: string | null; z: number | null; pct: number | null; zOfficial: number | null; cls: EqaClassView | null;
  providerCheck: EqaProviderCheckView; errors: string[]; warnings: string[];
}
export interface EqaSourceFileDraft { fileName: string; sha256: string; creationDate: string }
export interface EqaImportInput {
  round: EqaRoundDraft; rows: EqaRowDraft[]; source: 'pdf'; sourceName?: string;
  sourceFiles?: EqaSourceFileDraft[];
  /** Ánh xạ người dùng chọn cho cặp mã thông số × tên máy chưa có. */
  mappings?: { code: string; instrument: string; testId: string }[];
  /** Bắt buộc khi thay kết quả của máy đã có trong kỳ hoặc mở lại kỳ đã huỷ. */
  replaceReason?: string;
  /** Phiên bản kỳ lúc xem trước, để không ghi đè lần nhập của người khác. */
  expectedVersion?: number;
}
export interface EqaImportPreview {
  round: EqaRoundDraft; round_errors: string[]; rows: EqaCheckedRowDraft[];
  pairs: { code: string; instrument: string; test_id: string | null; suggestions: string[]; rows: number }[];
  blocking: number;
  counts: { total: number; ok: number; warn: number; rej: number; accept_pct: number | null };
  /** Kỳ cùng chương trình/năm/đợt đã có trong CSDL: máy đang có kết quả,
   * máy mà lần nhập này thay kết quả, và có cần lý do nhập lại không. */
  existing: { id: string; version: number; row_version: number; status: string; instruments: string[]; replaces: string[]; needs_reason: boolean;
    /** Mọi dòng trùng khớp kết quả đang lưu: ghi sẽ không tạo phiên bản mới. */
    unchanged: boolean;
    /** Đợt có phiếu "Tất cả máy" đã ký trên phiên bản hiện hành: sau khi bổ sung cần ký lại phiếu đó. */
    reviewed_all: boolean } | null;
}
export interface EqaRoundRow {
  id: string; program_id: string; program_name: string; provider: string; program_code: string; unit_code: string;
  year: number; round: string; round_no: number; report_code: string; report_date: string;
  assigned_level: string; source: string; source_name: string; status: 'open' | 'cancelled';
  version: number; row_version: number; created_at: string; updated_at: string;
  /** `accept_pct`: tỷ lệ kết quả chấp nhận — chỉ số tổng hợp, không phải tiêu chí đạt (N-06). */
  total: number; ok: number; warn: number; rej: number; accept_pct: number | null; instruments: string[];
  /** Đếm xếp loại theo từng máy của phiên bản hiện hành. */
  by_instrument: EqaInstrumentSummary[];
  /** Máy đã có kết quả ở đợt khác cùng chương trình–năm nhưng chưa có ở đợt này. */
  missing_instruments: { instrument_id: string; instrument_name: string }[];
}
export interface EqaInstrumentSummary { instrument_id: string; instrument_name: string; total: number; ok: number; warn: number; rej: number; accept_pct: number | null }
/** Một xét nghiệm của một máy qua các đợt đang dùng trong một chương trình–năm. */
export interface EqaInstrumentGridRow {
  test_id: string; test_name: string; unit: string;
  cells: { round_id: string; result_id: string; sample: string; z: number; class: EqaClassView }[];
}
export interface EqaPeerComparisonView { level: 'all' | 'method' | 'instrument'; mean: number; sd: number | null; sdi: number | null; pct: number | null; cv: number | null; n: number | null }
export interface EqaResultRow {
  id: string; test_id: string; test_name: string; instrument_id: string; instrument_name: string;
  code: string; instrument_label: string; sample: string; unit: string;
  result: number; assigned: number; sigma_p: number; z: number; z_provider: number | null; z_official: number; pct: number | null;
  class: EqaClassView; provider_check: EqaProviderCheckView; method: string; peer_group: string;
  peer: EqaPeerComparisonView[]; warnings: string[];
  /** Độ tin cậy giá trị ấn định từ N, SD của nhóm làm giá trị ấn định (N-05). */
  assigned_check: { level: 'all' | 'method' | 'instrument'; n: number; u: number; ratio: number; uncertain: boolean; z_prime: number } | null;
  /** TEa (%) của xét nghiệm trong danh mục và % lệch có nằm trong đó không — thông tin nội bộ. */
  tea_pct: number | null; within_tea: boolean | null;
  /** Tín hiệu của chuỗi xét nghiệm tính tới kết quả này (N-06, N-07). */
  trend: { signals: EqaSignalView[]; unsuccessful: boolean; j: number; enough: boolean } | null;
}
export type EqaSignalView = 'reject' | 'two_of_three' | 'six_same_side' | 'j_score';
export interface EqaSeriesView {
  test_id: string; test_name: string; instrument_id: string; instrument_name: string; unit: string; enough: boolean;
  /** Ngưỡng đang dùng để biểu đồ và xếp loại cùng một cấu hình. */
  config: { z_warn: number; z_reject: number };
  /** Số đợt của chương trình có đợt mới nhất — `enough` khi ≥ `min_points`. */
  rounds: number; j_limit: number; min_points: number;
  /** Số đợt của từng chương trình; màn xem một chương trình dùng dòng của nó. */
  programs: { program_id: string; program_name: string; rounds: number; enough: boolean }[];
  points: {
    result_id: string; round_id: string; program_id: string; program_name: string; year: number; round: string; sample: string; report_date: string;
    result: number; assigned: number; z: number; class: EqaClassView; pct: number | null;
    /** TEa vận hành (%) tại giá trị ấn định của mẫu; null khi xét nghiệm chưa có TEa. */
    tea_pct: number | null; within_tea: boolean | null;
    j: number; signals: EqaSignalView[]; unsuccessful: boolean;
  }[];
}
export interface EqaAttentionRow {
  test_id: string; test_name: string; instrument_id: string; instrument_name: string; points: number;
  /** Số kết quả có tín hiệu trong đợt mới nhất (mọi mẫu, N-06/N-07). */
  flagged: number;
  /** Kết quả nặng nhất trong đợt mới nhất của MỘT chương trình, kèm hợp mọi
   * tín hiệu của đợt. Một xét nghiệm ở hai chương trình là hai dòng. */
  latest: { round_id: string; program_id: string; program_name: string; year: number; round: string; sample: string; z: number; class: EqaClassView; signals: EqaSignalView[]; unsuccessful: boolean };
}
/** Một đợt trong lịch ngoại kiểm. `status` do main suy ra: đã có báo cáo của
 * trung tâm > đã nộp > quá hạn > chưa nộp. `days_left`: số ngày tới hạn nộp (âm = đã quá). */
export type EqaScheduleStatus = 'planned' | 'overdue' | 'submitted' | 'reported';
/** Một máy chạy mẫu của đợt: đã nộp phiếu kết quả chưa, đã có báo cáo chưa. */
export interface EqaScheduleInstrument {
  instrument_id: string; instrument_name: string; submitted_at: string; submitted_by: string;
  /** Báo cáo của trung tâm đã có kết quả của máy này (coi như đã nộp). */
  reported: boolean;
}
export interface EqaScheduleRow {
  /** Mỗi lịch có loại mẫu và ngày riêng cho nhóm máy đã chọn của đợt. */
  id: string; program_id: string; program_name: string; provider: string; sample_type: string;
  year: number; round: string; round_no: number;
  receive_date: string; run_date: string; due_date: string; assignee: string; note: string;
  /** Đợt có khai máy: lần nộp cuối khi đã đủ máy, ngược lại rỗng. */
  submitted_at: string; submitted_by: string;
  /** Máy chạy mẫu; rỗng = đợt không khai máy, "đã nộp" ghi cho cả đợt. */
  instruments: EqaScheduleInstrument[];
  /** Đợt đã có báo cáo của trung tâm (eqa_rounds đang dùng), nếu có. */
  round_id: string | null;
  status: EqaScheduleStatus; days_left: number;
}
export interface EqaProgramOption {
  /** Loại mẫu gợi sẵn từ lịch gần nhất; không phải phân loại chung của chương trình. */
  id: string; name: string; provider: string; sample_type: string;
  /** Máy gợi sẵn cho đợt mới: máy của lịch gần nhất, nếu chưa có lịch thì
   * máy có kết quả ở báo cáo gần nhất của chương trình. */
  instrument_ids: string[];
}
export interface EqaScheduleInput {
  programId?: string; programName?: string; provider?: string; year: number; round: string;
  receiveDate?: string; runDate?: string; dueDate: string; assignee?: string; note?: string;
  sampleType?: string; instrumentIds?: string[];
}
/** Thông tin tối thiểu của tài khoản đang hoạt động để chọn người phụ trách. */
export interface EqaAssigneeOption { id: string; name: string; username: string }
export interface EqaDecisionRow { id: string; type: string; payload_json: string; actor_name: string; decided_at: string }
/** Không truyền instrumentId khi xem tất cả máy trong phạm vi. */
export interface EqaReportScope { programId: string; year: number; roundId?: string; instrumentId?: string }
export interface EqaNceSource {
  round: EqaRoundRow; result: EqaResultRow; fingerprint: string;
  required: boolean; reasons: string[];
}
export interface EqaCorrectiveRow extends EqaNceSource {
  current: boolean;
  evidence: EqaNceEvidence | null;
  record: Pick<NceRecordRow, 'id' | 'nce_id' | 'status' | 'owner_name' | 'due_date' | 'overdue_days' | 'open_actions' | 'overdue_actions'> | null;
}
export interface EqaNceEvidence extends EqaNceSource {
  run_date: string; captured_at: string;
  last_accepted: { round_id: string; round: string; year: number; report_date: string } | null;
  related_results: EqaResultRow[];
  iqc_runs: { date: string; run_id: string; complete: boolean; points: { level: number; lot: string; value: number; z: number | null; verdict: string; rules: string[]; voided: boolean }[] }[];
}
export type EqaReviewKind = 'preliminary_review' | 'analysis_review' | 'system_review';
export type EqaReviewAssessment = 'pending' | 'appropriate' | 'not_appropriate';
export type EqaCarDecision = 'pending' | 'not_required' | 'proposed' | 'recorded';
export interface EqaCoverageAlternative { testId: string; method: string; reason: string; result: string }
export interface EqaReviewDraft {
  scope: EqaReportScope; expectedFingerprint: string; kind: EqaReviewKind;
  conclusion: string; communication: string; warningNote: string; receivedDate: string; nextReviewDate: string;
  alternatives: EqaCoverageAlternative[];
  assessment?: EqaReviewAssessment; carDecision?: EqaCarDecision; carReference?: string; communicationDate?: string;
}
export interface EqaReportReview {
  id: string; kind: EqaReviewKind; conclusion: string; communication: string; warning_note: string;
  received_date: string; next_review_date: string; actor_name: string; decided_at: string;
  fingerprint: string; current: boolean; alternatives: EqaCoverageAlternative[];
  assessment: EqaReviewAssessment; car_decision: EqaCarDecision; car_reference: string; communication_date: string;
}
export interface EqaReportView {
  scope: EqaReportScope; program_name: string; fingerprint: string;
  rounds: EqaRoundView[]; totals: { total: number; ok: number; warn: number; rej: number; accept_pct: number | null };
  tests: { test_id: string; test_name: string; instrument_name: string; total: number; ok: number; warn: number; rej: number }[];
  requires_investigation: boolean; reviews: EqaReportReview[];
  coverage: { start_date: string; end_date: string; missing: { test_id: string; test_name: string; instrument_name: string }[] };
}
export interface EqaRoundView {
  round: EqaRoundRow; results: EqaResultRow[]; decisions: EqaDecisionRow[];
  instruments: EqaInstrumentSummary[];
  config: { z_warn: number; z_reject: number };
}

export interface SoftwareLicenseStatus {
  state: 'development' | 'required' | 'active' | 'expired' | 'invalid' | 'unavailable';
  runtime: 'desktop' | 'development' | 'browser-preview' | 'lan';
  machine_code: string; license_id: string; licensed_to: string; issued_at: string; expires_at: string | null;
  message: string;
}

export interface SoftwareUpdateStatus {
  phase: 'unsupported' | 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error';
  current_version: string; available_version: string; release_notes: string; checked_at: string;
  percent: number; transferred: number; total: number; message: string;
}

export interface QcApi {
  getLicenseStatus(): Promise<SoftwareLicenseStatus>;
  activateSoftware(input: { data: { activationCode: string } }): Promise<IpcResult<SoftwareLicenseStatus>>;
  getSoftwareUpdateStatus(): Promise<SoftwareUpdateStatus>;
  checkSoftwareUpdate(): Promise<IpcResult<SoftwareUpdateStatus>>;
  downloadSoftwareUpdate(): Promise<IpcResult<SoftwareUpdateStatus>>;
  installSoftwareUpdate(): Promise<IpcResult<SoftwareUpdateStatus>>;
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
  /** Cấp/thu quyền NCE cho một tài khoản (chỉ quản trị viên). */
  setUserNceCapabilities(input: { id: string; capabilities: string[] }): Promise<IpcResult<PublicUser>>;
  deleteUser(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  resetUserPassword(input: { id: string; data: { newPassword: string } }): Promise<IpcResult<{ id: string }>>;
  changeOwnPassword(input: { data: { oldPassword: string; newPassword: string } }): Promise<IpcResult<{ id: string }>>;
  verifyOwnPassword(input: { data: { password: string } }): Promise<IpcResult<{ ok: true }>>;
  /** Chỉ tự phục vụ (không nhận id người khác) — đổi ảnh đại diện không phải
   * thao tác quản trị. */
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
  listRuleScopes(testId: string): Promise<RuleScopeItem[]>;
  saveRuleScope(testId: string, ruleId: string, scope: 'within' | 'across' | 'both' | ''): Promise<IpcResult<{ ruleId: string; scope: string }>>;
  listLots(): Promise<QcLot[]>;
  saveLot(input: { id?: string; data: QcLotDraft }): Promise<IpcResult<QcLot>>;
  /** Kế hoạch đổi số lô — ĐẾM điểm QC sẽ bị viết lại + kỳ đã khoá, KHÔNG ghi
   * gì. Renderer hỏi người dùng bằng đúng con số này TRƯỚC khi gọi `saveLot`
   * (số lô là nhãn tĩnh trên từng điểm QC, xem config-handlers.ts). */
  previewLotRename(input: { id: string; lotNo: string }): Promise<IpcResult<{ rename: null } | { rename: { oldLotNo: string; newLotNo: string; affected: number; lockedCount: number; lockedPeriods: string[] } }>>;
  /** Thao tác có cổng chặn ở main khi lô/nhóm đang gán Mean/SD
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
   * mức QC tương ứng và dừng nhóm bị thay thế. 3 trạng thái:
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
  /** Một hàm lưu duy nhất cho hồ sơ chuyển lô: modal có 1 ô "Trạng thái"
   * chọn được cả 4 giá trị (`data.status`) + 1 nút Lưu, không phải các nút
   * hành động tách rời.
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
  getVoidPointAssessment(pointId: string): Promise<IpcResult<VoidPointAssessment>>;
  listParallelEntryColumns(testId: string): Promise<ParallelEntryColumn[]>;
  listPreviousEntryLotSeries(testId: string): Promise<PreviousLotSeries[]>;
  getRangeCandidate(testId: string, level: number): Promise<IpcResult<RangeCandidateView>>;
  /** `mean` + `sd` chỉ được gửi cùng nhau khi người duyệt chọn điều chỉnh
   * thủ công dải đề xuất. Main vẫn áp đầy đủ cổng 20/20, run bị loại và an
   * toàn sai số hệ thống; đây không phải đường bỏ qua điều kiện lập dải. */
  applyLabRange(input: { data: { testId: string; level: number; reason: string; causeConfirmed?: boolean; bias?: number; mean?: number; sd?: number } }): Promise<IpcResult<RangeCandidateView>>;
  revertManufacturerRange(input: { data: { testId: string; level: number; reason: string } }): Promise<IpcResult<RangeCandidateView>>;
  /** Điểm làm đổi kết luận của lần chạy đã có (nhập lùi ngày): đổi trạng thái
   * loại bỏ thì cần `retroReason` ≥10 ký tự, thiếu thì trả lỗi
   * `retro-reason-required`; lần chạy đổi kết luận thuộc kỳ đã khoá thì trả
   * `retro-locked`. `retroChanges` liệt kê mọi lần chạy khác đã đổi kết luận. */
  addPoint(input: { data: { testId: string; level: number; date: string; val: number; runId?: string; lotNo?: string; note?: string; operatorName?: string; retroReason?: string } }): Promise<IpcResult<QcPointView & { retroChanges: QcRunConclusionChange[] }>>;
  /** `kind` quyết định có tự mở/dùng lại hồ sơ NCE hay không
   * (`voidNceChoice()` ở `main/domain/entry-validation.ts`): 'analytical'
   * luôn mở NCE, 'data-entry' luôn không mở, 'other' để `openNce` tự chọn và
   * bắt buộc `reason` ≥5 ký tự (2 kind đầu không bắt buộc, chỉ khuyến nghị).
   * Huỷ điểm làm đổi trạng thái loại bỏ của lần chạy khác cũng cần `reason`
   * ≥10 ký tự (`reason-required-retro`); chạm kỳ đã khoá thì `retro-locked`. */
  voidPoint(input: { data: { pointId: string; reason: string; kind?: 'analytical' | 'data-entry' | 'other'; openNce?: boolean } }): Promise<IpcResult<{ id: string; nceId: string | null; reusedAction: boolean; retroChanges: QcRunConclusionChange[] }>>;
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
  listSigmaPeriods(testId: string, teaMode?: SigmaTeaMode): Promise<SigmaPeriodView[]>;
  listSigmaCohorts(testId: string, period: string, levels: number[]): Promise<SigmaCohortView[]>;
  /** Mẫu ngoại kiểm đề xuất làm Bias cho một mức QC của kỳ Sigma; null khi tham số sai. */
  getSigmaEqaBias(testId: string, period: string, level: number, windowMonths?: number): Promise<SigmaEqaBiasView | null>;
  saveSigmaTeaConfig(input: { testId: string; source: string; tea?: number; eflmAnalyte?: string; eflmAps?: string; eflmLookupDate?: string; eflmRef?: string }): Promise<IpcResult<Test>>;
  saveSigmaPeriod(input: { testId: string; period: string; tea?: number; teaSource?: string; levels: { level: number; /** Nạp lại cohort là thao tác chủ động, không phải lưu Bias/MU. */ refreshCohort?: boolean; cohortFingerprint?: string; /** Xác nhận rà soát theo SOP; main ghi người/thời điểm và dấu vân tay dữ liệu. */ cohortReviewed?: boolean; /** Snapshot TEa% riêng của mức QC, cần thiết cho tiêu chí CLIA tuyệt đối. */ tea?: number; /** Mean mục tiêu chụp cùng kỳ, dùng đổi U% sang đơn vị. */ targetMean?: number; cv?: number; biasEqa?: number; eqaRounds?: Array<{ lab: number; target: number; bias?: number; eqaResultId?: string; label?: string }>; uCref?: number; uCal?: number; muBiasMode?: 'include' | 'exclude'; cvSource?: 'manual' | 'iqc-cohort'; cohortN?: number; sourceLot?: string; sourceStart?: string; sourceEnd?: string; cohortStatus?: string }[]; createOnly?: boolean; /** Chủ động thay Bias chung của mọi mức trong kỳ; không dùng khi chỉ sửa CV/MU. */ sharedEqaRounds?: Array<{ lab: number; target: number; eqaResultId?: string; label?: string }>; eqaWindowMonths?: number }): Promise<IpcResult<SigmaPeriodView>>;
  renameSigmaPeriod(input: { id: string; period: string }): Promise<IpcResult<SigmaPeriodView>>;
  removeSigmaPeriod(input: { data: { id: string } }): Promise<IpcResult<{ id: string }>>;
  listNceQueue(): Promise<NceQueueRowView[]>;
  listNce(): Promise<NceRecordRow[]>;
  getNce(id: string): Promise<NceDossierView | null>;
  listNceUsers(): Promise<NceUserOption[]>;
  getNceConfig(): Promise<NceConfigView>;
  saveNceConfig(input: { data: NceConfigView }): Promise<IpcResult<NceConfigView>>;
  /** Đánh giá thử lần chạy rerun/xác minh trong giai đoạn mới, không ghi gì. */
  previewNceRelease(input: { data: { id: string; rerun: NceRunKeyView; lotChangeNote?: string } }): Promise<IpcResult<NceReleasePreview>>;
  // Ngoại kiểm
  listEqaRounds(): Promise<EqaRoundRow[]>;
  getEqaRound(id: string): Promise<EqaRoundView | null>;
  /** Có reviewId: đọc số liệu và chữ ký đã chụp tại thời điểm ký phiếu đó. */
  getEqaReport(scope: EqaReportScope, reviewId?: string): Promise<EqaReportView>;
  listEqaCorrective(scope: EqaReportScope): Promise<EqaCorrectiveRow[]>;
  getEqaCorrectiveEvidence(input: { resultId: string; runDate?: string }): Promise<EqaNceEvidence>;
  reviewEqaReport(input: { data: EqaReviewDraft }): Promise<IpcResult<EqaReportView>>;
  /** Chuỗi z/J của một xét nghiệm qua các đợt. */
  getEqaSeries(testId: string): Promise<EqaSeriesView | null>;
  /** Xét nghiệm đang có tín hiệu hoặc không thành công ở đợt mới nhất. */
  listEqaAttention(input?: { programId?: string; year?: number; instrumentId?: string }): Promise<EqaAttentionRow[]>;
  getEqaInstrumentGrid(input: { programId: string; year: number; instrumentId: string }): Promise<EqaInstrumentGridRow[]>;
  listEqaSchedule(): Promise<EqaScheduleRow[]>;
  listEqaPrograms(): Promise<EqaProgramOption[]>;
  listEqaAssignees(): Promise<EqaAssigneeOption[]>;
  saveEqaSchedule(input: { id?: string; data: EqaScheduleInput }): Promise<IpcResult<EqaScheduleRow>>;
  /** Đợt có khai máy: `instrumentIds` là các máy đã nộp (máy khác bỏ đánh dấu);
   * không gửi thì `submitted` áp cho mọi máy. */
  markEqaSubmitted(input: { data: { id: string; submitted?: boolean; instrumentIds?: string[] } }): Promise<IpcResult<EqaScheduleRow>>;
  removeEqaSchedule(input: { data: { id: string } }): Promise<IpcResult<{ id: string }>>;
  /** Kiểm và tính thử một lần nhập; không ghi gì. */
  previewEqaImport(input: { data: EqaImportInput }): Promise<IpcResult<EqaImportPreview>>;
  importEqaRound(input: { data: EqaImportInput }): Promise<IpcResult<EqaRoundView>>;
  cancelEqaRound(input: { data: { id: string; expectedVersion: number; reason: string } }): Promise<IpcResult<EqaRoundView>>;
  /** IQC chỉ gửi khoá lần chạy; main tự đọc xét nghiệm, mức, lô, luật, verdict. */
  createNce(input: { data: { source: NceSource; phase?: 'pre' | 'exam' | 'post'; testId?: string; trigger?: NceRunKeyView; eqaResultId?: string; expectedEqaFingerprint?: string; eqaRunDate?: string; description: string; correction: string; holdResults: boolean; detectedAt: string; ownerUserId: string; dueDate?: string } }): Promise<IpcResult<NceDossierView>>;
  attachNceRun(input: { data: NceWriteBase & { run: NceRunKeyView } }): Promise<IpcResult<NceDossierView>>;
  /** Đính chính ngày lưu riêng, cần nce.release, chỉ khi open; giữ lịch sử và lý do. */
  updateNce(input: { data: NceWriteBase & { patch: Record<string, unknown>; detectedAtCorrection?: { detectedAt: string; reason: string } } }): Promise<IpcResult<NceDossierView>>;
  addNceAction(input: { data: NceWriteBase & { action: { kind: string; description: string; ownerUserId: string; dueDate: string } } }): Promise<IpcResult<NceDossierView>>;
  updateNceAction(input: { data: NceWriteBase & { actionId: string; action: { kind: string; description: string; ownerUserId: string; dueDate: string } } }): Promise<IpcResult<NceDossierView>>;
  completeNceAction(input: { data: NceWriteBase & { actionId: string; doneAt: string; evidence: string } }): Promise<IpcResult<NceDossierView>>;
  cancelNceAction(input: { data: NceWriteBase & { actionId: string; reason: string } }): Promise<IpcResult<NceDossierView>>;
  recordNceTechnicalAssessment(input: { data: NceWriteBase & { assessment: NceTechnicalAssessmentInput } }): Promise<IpcResult<NceDossierView>>;
  recordNcePatientImpact(input: { data: NceWriteBase & { impact: { outcome: string; description: string; resultCount?: number | null; reference?: string; notified?: string } } }): Promise<IpcResult<NceDossierView>>;
  releaseNce(input: { data: NceWriteBase & { release: { reason: string; rerun?: NceRunKeyView | null; lotChangeNote?: string; notApplicable?: boolean } } }): Promise<IpcResult<NceDossierView>>;
  reviewNceEffectiveness(input: { data: NceWriteBase & { review: { result: string; reviewedAt: string; evidence: string; residualSeverity?: number; residualProbability?: number; residualLevel?: string; residualBasis?: string } } }): Promise<IpcResult<NceDossierView>>;
  submitNce(input: { data: NceWriteBase }): Promise<IpcResult<NceDossierView>>;
  approveNce(input: { data: NceWriteBase & { note?: string } }): Promise<IpcResult<NceDossierView>>;
  returnNce(input: { data: NceWriteBase & { note: string } }): Promise<IpcResult<NceDossierView>>;
  cancelNce(input: { data: NceWriteBase & { reason: string } }): Promise<IpcResult<NceDossierView>>;
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
  saveReportTemplateSettings(input: { data: { kind: ReportFormKind; formCode?: string; version?: string; effectiveDate?: string } }): Promise<IpcResult<ReportTemplateSettings>>;
  getFirebaseSettings(): Promise<FirebaseSettings>;
  connectFirebase(input: { data: { labCode?: string; email?: string; password?: string; config?: string } }): Promise<IpcResult<FirebaseConnectResult>>;
  syncFirebase(input: { data: { direction: 'push' | 'pull' } }): Promise<IpcResult<FirebaseSyncResult>>;
  disconnectFirebase(): Promise<IpcResult<null>>;
  listPeriodLocks(): Promise<PeriodLockRow[]>;
  /** `acknowledge`: đã xem việc còn tồn của kỳ (lỗi `period-open-items`) và vẫn khoá. */
  getQcMonthlyReview(ym: string): Promise<QcMonthlyReview>;
  signQcMonthlyReview(input: { data: { ym: string; conclusion: QcReviewConclusion; note?: string } }): Promise<IpcResult<QcMonthlyReviewSignature>>;
  lockPeriod(input: { data: { ym: string; note?: string; acknowledge?: boolean } }): Promise<IpcResult<PeriodLockRow>>;
  unlockPeriod(input: { data: { ym: string; note: string } }): Promise<IpcResult<{ ym: string }>>;
  queryReport(input: { testId: string; from?: string; to?: string }): Promise<ReportPointRow[]>;
  /** Excel thật qua `exceljs` (main process), trả base64 để
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
  /** `signedOut`: tài khoản đang đăng nhập không có trong dữ liệu vừa phục hồi, main đã kết thúc phiên. */
  importBackup(input?: { keepAccounts?: boolean }): Promise<IpcResult<{ preRestoreSnapshotPath: string; signedOut?: boolean }>>;
  backupStatus(): Promise<BackupStatus>;
  /** Ghi lỗi không được bắt của renderer vào tệp log của máy chính. Chỉ cửa
   * sổ Electron của máy chính gọi được; máy trạm LAN không mở kênh này. */
  reportClientError(input: { message: string; stack?: string }): Promise<IpcResult<null>>;
  /** Mở thư mục log (và tệp crash) bằng trình quản lý tệp của hệ điều hành,
   * để người quản trị gửi kèm khi báo lỗi. Chỉ quản trị viên, chỉ máy chính. */
  openLogFolder(): Promise<IpcResult<{ path: string }>>;
  /** Ghi gói ZIP gồm log, tệp crash và thông tin môi trường tới nơi người
   * dùng chọn; `data: null` khi huỷ hộp thoại. Không kèm CSDL. Chỉ quản trị
   * viên, chỉ máy chính. */
  exportLogBundle(): Promise<IpcResult<{ path: string; files: number; bytes: number } | null>>;
  /** Khởi tạo lại dữ liệu vận hành; giữ tài khoản và nhật ký. Bị chặn
   * (`operation-mode`) khi đã bật chế độ vận hành. */
  resetOperationalData(): Promise<IpcResult<{ preResetSnapshotPath: string; clearedTables: string[] }>>;
  /** Bật chế độ vận hành — một chiều, không tắt được. Renderer xác thực lại
   * mật khẩu trước khi gọi. Chỉ quản trị viên, chỉ máy chính. */
  enableOperationMode(): Promise<IpcResult<OperationModeState>>;

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

/** Công cụ cấp mã riêng của bên phát hành; không lộ qua qcApi của khách hàng. */
export interface LicenseIssuerInput { machineCode: string; licensedTo: string; expiresOn: string | null }
export interface LicenseIssuerLicense {
  activation_code: string; license_id: string; licensed_to: string;
  machine_code: string; issued_at: string; expires_at: string | null;
}
export interface LicenseIssuerStatus { key_path: string; key_ready: boolean; key_message: string }
export interface LicenseIssuerApi {
  status(): Promise<LicenseIssuerStatus>;
  chooseKey(): Promise<IpcResult<LicenseIssuerStatus | null>>;
  issue(input: LicenseIssuerInput): Promise<IpcResult<LicenseIssuerLicense>>;
  copy(): Promise<IpcResult<null>>;
  save(): Promise<IpcResult<{ path: string } | null>>;
  discard(): Promise<void>;
}

declare global {
  interface Window {
    qcApi: QcApi;
    licenseIssuer?: LicenseIssuerApi;
  }
}
