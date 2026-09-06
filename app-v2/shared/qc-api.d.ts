// Hợp đồng IPC lộ ra qua preload.ts — dùng chung giữa main và renderer để
// renderer có type an toàn khi gọi window.qcApi.*
export interface MigrationSummary {
  instruments: number; tests: number; qcLots: number; lotGroups: number; qcPanels: number;
  lotTransitions: number; qcPoints: number; users: number; activity: number; actions: number;
  reagentTests: number; periodLocks: number; teaRefs: number; sigmaPeriods: number;
}

export interface LisGatewaySettings { enabled: boolean; url: string; token: string }
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
  /** '' = không có trạng thái tự đặt — "Đang hoạt động"/"Chưa dùng" SUY từ
   * `inUse`, không phải literal 'active' nào được lưu (port đúng app cũ,
   * xem manage-validation.ts). */
  status: '' | 'stopped' | 'planned'; stopped_at: string; lotIds: string[];
  /** Có lô nào của nhóm đang được gán (`test_levels.qc_lot_id`) cho xét
   * nghiệm nào không — tính ở `listLotGroups()`, KHÔNG lưu trong DB. */
  inUse: boolean;
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
  analyte_id?: string; clia?: number | null; ricos?: number | null;
}

export interface RuleScopeItem { id: string; scope: 'within' | 'across' | 'both'; scopeMin: number; desc: string }

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

export interface QcPointView {
  id: string; test_id: string; level: number; date: string; run_id: string; val: number;
  note: string; operator_name: string; voided: 0 | 1; void_reason: string;
  verdict: 'ok' | 'warn' | 'rej'; rules: string[];
  /** `entry:queryPoints` trả nguyên hàng `qc_points` (`{...p}`) nên các cột
   * đã chốt lúc nhập cũng có sẵn — khai đủ ở đây thay vì để trang phải ép
   * kiểu: `lot`/`qc_mean`/`qc_sd` là số lô + Mean/SD ĐANG dùng tại thời
   * điểm nhập (Giai đoạn B2), tab "Lịch sử dữ liệu" đọc chúng để tính lại Z
   * theo đúng mốc Mean/SD của lô đó. */
  lot?: string; qc_mean?: number | null; qc_sd?: number | null;
  operator_id?: string; operator_username?: string; created_at?: string;
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
    // `id` cần cho trang Khắc phục sự cố: app cũ gắn dòng sự cố với hồ sơ
    // NCE theo ĐIỂM QC, không theo test+mức (xem D3.8).
    latest: { id: string; date: string; runId: string; val: number } | null;
  }[];
}

export interface LevelAnalysis {
  points: {
    id: string; date: string; runId: string; val: number; z: number;
    /** 'none' khi mức chưa có Mean/SD hợp lệ — điểm CHƯA ĐƯỢC ĐÁNH GIÁ. */
    verdict: 'ok' | 'warn' | 'rej' | 'none'; rules: string[]; supportRules: string[]; accepted: boolean;
    errorType: string; errorDesc: string;
  }[];
  cusum: { cPos: number[]; cNeg: number[]; flags: ('ok' | 'warn' | 'rej')[] };
  cusumOn: boolean;
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

/** Phân tích Westgard THẬT cho 1 lô thuộc 1 nhóm lô đã dừng/lưu trữ — tab
 * "Nhóm lô đã dừng" trang Phân tích Westgard (port `wgLotBlockModel()` app
 * cũ): tính lại theo bộ luật ĐANG BẬT hiện nay, dùng Mean/SD ĐÃ CHỐT của
 * đúng lô đó (không phải Mean/SD hiện hành của mức). */
export interface ArchivedBlock {
  level: number; lotId: string; lotNo: string; mean: number; sd: number; analysis: LevelAnalysis;
}

export interface SigmaMetricResult { tea: number; bias: number; cv: number; sigma: number; dpmo: number; yieldPercent: number }
export interface UncertaintyBudgetResult {
  k: number; uRw: number; uBias: number | null; uCal: number | null; bias: number | null; biasRefU: number | null;
  includeBias: boolean; uc: number; U: number; shares: Record<string, number | null>; complete: boolean; missing: string[];
  target: number | null; absoluteUc: number | null; absoluteU: number | null;
  tea: number | null; teaRatio: number | null; withinTea: boolean | null;
}
export interface SigmaLevelResult {
  level: number; cv: number | null; biasEqa: number | null; eqaRounds: number[]; mixedSigns: boolean; uCal: number | null;
  sigma: SigmaMetricResult | null; mu: UncertaintyBudgetResult | null;
}
export interface SigmaPeriodView { id: string; testId: string; period: string; tea: number | null; teaSource: string; levels: SigmaLevelResult[] }

export interface NceRecord {
  id: string; date: string; created_at: string; updated_at?: string; test_id: string | null; level: number | null; lot: string;
  point_id: string | null; rule: string; error_type: string; nce_id: string; parent_nce_id: string; follow_up_nce_id: string; protocol_version: number;
  approval_status: 'pending' | 'approved' | 'returned'; effectiveness_status: 'pending' | 'effective' | 'ineffective';
  record_status: 'active' | 'cancelled'; due_date: string; action_completed_date: string; detail_json: string;
}

export interface NceDetail {
  correction?: string; investigation?: string; causeCategory?: 'SE' | 'RE' | ''; causeDescription?: string;
  /** Người phụ trách hồ sơ — app cũ lưu ở trường `by` của bản ghi; app-v2
   * chưa có cột riêng nên giữ trong `detail_json` (mục còn treo từ D2). */
  owner?: string;
  releaseDecision?: 'held' | 'released'; releaseNote?: string; releaseDecidedAt?: string; releaseDecidedBy?: string;
  rerunPointId?: string; rerunNote?: string; rerunSnapshot?: { date: string; runId: string; val: number; level: number };
  effectivenessNote?: string; residualRisk?: string;
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

export interface PeriodLockRow { id: string; ym: string; locked_at: string; locked_by: string; note: string }

export interface ReportPointRow {
  id: string; test_id: string; level: number; date: string; run_id: string; val: number;
  note: string; operator_name: string; voided: 0 | 1; void_reason: string;
}

export interface QcApi {
  hasAnyUsers(): Promise<boolean>;
  currentUser(): Promise<PublicUser | null>;
  bootstrapAdmin(input: { data: { username: string; name: string; password: string } }): Promise<IpcResult<PublicUser>>;
  login(input: { data: { username: string; password: string } }): Promise<IpcResult<PublicUser>>;
  logout(): Promise<IpcResult<null>>;
  listUsers(): Promise<IpcResult<PublicUser[]>>;
  createUser(input: { data: { username: string; name: string; initials?: string; role: string; password: string; pagePerms?: string[] } }): Promise<IpcResult<PublicUser>>;
  /** `initials`/`pagePerms` bỏ trống = GIỮ NGUYÊN giá trị đang có (không phải
   * xoá) — nút Khoá/Mở khoá chỉ gửi `active` nên không đụng tới quyền. */
  updateUser(input: { id: string; data: { name: string; role: string; active: boolean; initials?: string; pagePerms?: string[] } }): Promise<IpcResult<PublicUser>>;
  deleteUser(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  resetUserPassword(input: { id: string; data: { newPassword: string } }): Promise<IpcResult<{ id: string }>>;
  changeOwnPassword(input: { data: { oldPassword: string; newPassword: string } }): Promise<IpcResult<{ id: string }>>;
  verifyOwnPassword(input: { data: { password: string } }): Promise<IpcResult<{ ok: true }>>;
  /** Chỉ tự phục vụ (không nhận id người khác) — khớp app cũ, đổi ảnh đại
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
  listActivity(limit?: number): Promise<ActivityEntry[]>;
  listRuleScopes(testId: string, levelCount: number): Promise<RuleScopeItem[]>;
  saveRuleScope(testId: string, ruleId: string, scope: 'within' | 'across' | 'both' | ''): Promise<IpcResult<{ ruleId: string; scope: string }>>;
  listLots(): Promise<QcLot[]>;
  saveLot(input: { id?: string; data: QcLotDraft }): Promise<IpcResult<QcLot>>;
  /** Kế hoạch đổi số lô — ĐẾM điểm QC sẽ bị viết lại + kỳ đã khoá, KHÔNG ghi
   * gì. Renderer hỏi người dùng bằng đúng con số này TRƯỚC khi gọi `saveLot`
   * (số lô là nhãn tĩnh trên từng điểm QC, xem config-handlers.ts). */
  previewLotRename(input: { id: string; lotNo: string }): Promise<IpcResult<{ rename: null } | { rename: { oldLotNo: string; newLotNo: string; affected: number; lockedCount: number; lockedPeriods: string[] } }>>;
  /** Giai đoạn D3.4 — thao tác app cũ có mà app-v2 chưa có. Cổng chặn
   * (lô/nhóm đang gán Mean/SD, hồ sơ đã kết luận) nằm ở main, xem
   * config-handlers.ts. */
  setTeaRefValue(input: { analyteId: string; field: 'clia' | 'ricos'; value: string; name?: string; unit?: string; section?: string }): Promise<IpcResult<{ analyteId: string }>>;
  restoreTeaRefDefaults(input: { analyteId: string }): Promise<IpcResult<{ analyteId: string }>>;
  /** Thêm 1 DÒNG analyte mới vào bảng TEa tham chiếu (khác `saveTeaRef` —
   * đó là hồ sơ TEa CHUẨN HOÁ của PXN, bắt buộc 6 trường). */
  addTeaAnalyte(input: { name: string; abbreviation?: string; matrix?: string; unit?: string; section?: string; clia?: string; ricos?: string }): Promise<IpcResult<{ analyteId: string }>>;
  removeTest(input: { id: string; ids?: string[] }): Promise<IpcResult<{ id: string; pointsCount: number }>>;
  removePanel(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  removeLot(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  listLotGroups(): Promise<LotGroup[]>;
  removeLotGroup(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  stopLotGroup(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  /** Kích hoạt nhóm lô: áp Mean/SD ĐÃ LƯU của từng lô trong nhóm sang các
   * mức QC tương ứng và dừng nhóm bị thay thế. 3 trạng thái như app cũ:
   * `applied` / `already-active` / lỗi `unready` (chưa có Mean/SD nào). */
  activateLotGroup(input: { id: string }): Promise<IpcResult<{ status: 'applied' | 'already-active'; applied: number; stoppedGroups: string[] }>>;
  removeLotTransition(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  saveLotGroup(input: { id?: string; data: LotGroupDraft }): Promise<IpcResult<LotGroup>>;
  listPanels(): Promise<QcPanel[]>;
  savePanel(input: { id?: string; data: QcPanelDraft }): Promise<IpcResult<QcPanel>>;
  listLotTransitions(): Promise<LotTransition[]>;
  /** MỘT hàm lưu duy nhất cho hồ sơ chuyển lô — đúng mô hình app cũ
   * (`saveLotTransitionV2`): modal có 1 ô "Trạng thái" chọn được cả 4 giá
   * trị (`data.status`) + 1 nút Lưu, không phải các nút hành động tách rời.
   * `id` có → SỬA hồ sơ (nút "Sửa"). Hồ sơ đã 'accepted' thì khoá vĩnh viễn
   * (`accepted-immutable` nếu đổi status khác 'accepted'); 'rejected'
   * KHÔNG khoá, vẫn sửa/đổi status lại được. Chuyển SANG 'accepted'/
   * 'rejected' lần đầu (`finalChanged`) là lúc renderer phải xác thực lại
   * mật khẩu TRƯỚC khi gọi hàm này (không có tham số reauth riêng — main
   * không giữ trạng thái phiên xác thực). Chỉ 'accepted' mới thật sự áp
   * `criteria` (Mean/SD ứng viên) vào `test_levels` + đánh dấu lô cũ hết
   * dùng; thiếu Mean/SD cho dù chỉ 1 xét nghiệm đang dùng lô cũ sẽ bị chặn
   * (`missing-target`). */
  createLotTransition(input: { id?: string; data: { panelId: string; fromLotId: string; toLotId: string; startDate?: string; note?: string; status?: 'planned' | 'active' | 'accepted' | 'rejected'; criteria?: { testId: string; level: number; mean: number; sd: number }[] } }): Promise<IpcResult<LotTransition>>;
  listTeaRefs(): Promise<TeaRef[]>;
  saveTeaRef(input: { id?: string; data: Record<string, unknown> }): Promise<IpcResult<TeaRef>>;
  removeTeaRef(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  /** Xoá RIÊNG hồ sơ TEa PXN (khác `removeTeaRef` — xoá cả dòng analyte) —
   * `removedRecord` cho biết dòng có bị xoá luôn không (chỉ khi đó là
   * analyte KHÔNG tự thêm và không còn CLIA/Ricos% ghi đè nào khác). */
  removeTeaLabProfile(input: { id: string }): Promise<IpcResult<{ id: string; removedRecord: boolean }>>;
  queryActivity(input: { query?: string; from?: string; to?: string; page?: number; pageSize?: number }): Promise<ActivityPage>;
  exportActivityCsv(input: { query?: string; from?: string; to?: string }): Promise<string>;
  verifyActivityChainNow(): Promise<{ ok: boolean; checked: number; legacy: number; brokenIndex: number; reason: string }>;
  archiveActivity(input: { data: { months: 12 | 24 | 36 } }): Promise<IpcResult<{ removedCount: number }>>;
  queryPoints(testId: string, level: number): Promise<QcPointView[]>;
  /** Mọi điểm chưa hủy của xét nghiệm, gồm cả các lô lịch sử. */
  listEntryHistoryPoints(testId: string): Promise<QcPointView[]>;
  listVoidedEntryPoints(testId: string): Promise<VoidedQcPointView[]>;
  listParallelEntryColumns(testId: string): Promise<ParallelEntryColumn[]>;
  listPreviousEntryLotSeries(testId: string): Promise<PreviousLotSeries[]>;
  getRangeCandidate(testId: string, level: number): Promise<IpcResult<RangeCandidateView>>;
  applyLabRange(input: { data: { testId: string; level: number; reason: string; causeConfirmed?: boolean; bias?: number } }): Promise<IpcResult<RangeCandidateView>>;
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
  saveRuleAction(testId: string, ruleId: string, action: boolean | 'inactive' | 'alert' | 'reject' | ''): Promise<IpcResult<{ ruleId: string; action: 'inactive' | 'alert' | 'reject' | '' }>>;
  listRuleSettings(): Promise<RuleSetting[]>;
  saveRuleSetting(ruleId: string, on: boolean): Promise<IpcResult<{ ruleId: string; on: boolean }>>;
  resetRuleSettings(): Promise<IpcResult<RuleSetting[]>>;
  listArchivedBlocks(testId: string, groupId: string): Promise<ArchivedBlock[]>;
  listArchivedGroupTests(groupId: string): Promise<{ id: string; label: string }[]>;
  listSigmaPeriods(testId: string): Promise<SigmaPeriodView[]>;
  saveSigmaPeriod(input: { testId: string; period: string; tea?: number; teaSource?: string; levels: { level: number; cv?: number; biasEqa?: number; eqaRounds?: number[]; uCal?: number; muBiasMode?: 'include' | 'exclude' }[] }): Promise<IpcResult<SigmaPeriodView>>;
  removeSigmaPeriod(input: { data: { id: string } }): Promise<IpcResult<{ id: string }>>;
  listNceRecords(): Promise<NceRecord[]>;
  createNce(input: { data: { testId?: string; level?: number; lot?: string; date: string; pointId?: string; rule?: string; errorType?: string; correction: string; dueDate?: string; investigation?: string; causeCategory?: 'SE' | 'RE' | ''; causeDescription?: string } }): Promise<IpcResult<NceRecord>>;
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
  saveLabProfile(input: { data: { name?: string; dept?: string; address?: string; brandTitle?: string; brandSub?: string; logoText?: string; logoData?: string; clearLogo?: boolean } }): Promise<IpcResult<LabProfile>>;
  getStorageInfo(): Promise<{ dbFileBytes: number; path: string }>;
  listPeriodLocks(): Promise<PeriodLockRow[]>;
  lockPeriod(input: { data: { ym: string; note?: string } }): Promise<IpcResult<PeriodLockRow>>;
  unlockPeriod(input: { data: { ym: string; note: string } }): Promise<IpcResult<{ ym: string }>>;
  queryReport(input: { testId: string; from?: string; to?: string }): Promise<ReportPointRow[]>;
  /** Giai đoạn C1 — Excel thật qua `exceljs` (main process), trả base64 để
   * renderer tự tạo Blob + tải về, không cần hộp thoại lưu file native (nhẹ
   * hơn, khớp cơ chế `downloadCsv` đã dùng ở Audit/Report). */
  exportTableXlsx(input: { sheetName: string; headers: string[]; rows: (string | number | null)[][] }): Promise<IpcResult<string>>;
  /** Giai đoạn C1 — in PDF thật qua `webContents.printToPDF`, có hộp thoại
   * lưu file native (khác Excel — PDF là "kết xuất trình bày" nên giữ đúng
   * luồng "Lưu PDF" của bản cũ, không tải ngầm qua Blob). */
  printHtmlToPdf(input: { html: string; defaultFileName: string }): Promise<IpcResult<{ path: string }>>;
  /** Giai đoạn C3 — xuất/phục hồi toàn bộ dữ liệu app-v2 (định dạng RIÊNG,
   * không đọc được backup app cũ — xem `main/domain/backup.ts`). */
  exportBackup(): Promise<IpcResult<string>>;
  importBackup(input: { data: { json: string } }): Promise<IpcResult<{ preRestoreSnapshotPath: string }>>;
  /** Giai đoạn D3.3 — 2 công cụ quản trị app cũ có mà app-v2 chưa có.
   * `verifyBackup` CHỈ ĐỌC file, không chạm DB đang dùng.
   * `resetOperationalData` xoá dữ liệu vận hành nhưng GIỮ tài khoản + nhật ký
   * hoạt động (ánh xạ `ResetOperationalDataCommand` app cũ). */
  backupStatus(): Promise<{ lastBackupAt: string | null; lastBackupBytes: number; maxImportBytes: number }>;
  verifyBackup(input: { data: { json: string } }): Promise<IpcResult<{ tables: number; rows: number; points: number; schemaVersion: number; createdAt: string }>>;
  resetOperationalData(): Promise<IpcResult<{ preResetSnapshotPath: string; clearedTables: string[] }>>;
  /** Giai đoạn C4 — di trú dữ liệu từ backup app CŨ (định dạng
   * `'qclab-backup'`, KHÁC hẳn `'qclab-v2-backup'` ở trên — xem
   * `main/domain/migrate-legacy.ts`). `previewLegacyBackup` chỉ ánh xạ +
   * đếm, KHÔNG ghi DB — dùng để hiện rõ "sẽ nhập bao nhiêu..." trước khi xác
   * nhận thao tác THAY THẾ TOÀN BỘ dữ liệu hiện có. */
  previewLegacyBackup(input: { data: { json: string } }): Promise<IpcResult<MigrationSummary>>;
  importLegacyBackup(input: { data: { json: string } }): Promise<IpcResult<{ preMigrationSnapshotPath: string; summary: MigrationSummary }>>;
  /** Giai đoạn C5 — client cho LIS Gateway prototype (`lis-gateway/`, server
   * độc lập không đóng gói cùng Electron — xem CLAUDE.md "LIS Gateway").
   * Cấu hình lưu ở `app_meta` (thay `localStorage` bản cũ), chỉ admin sửa.
   * `importLisResult` ghi điểm QC cục bộ TRƯỚC, chỉ báo gateway 'imported'
   * SAU KHI ghi thành công — xem `main/domain/lis-client.ts`. */
  getLisSettings(): Promise<LisGatewaySettings>;
  saveLisSettings(input: { data: { enabled: boolean; url: string; token: string } }): Promise<IpcResult<LisGatewaySettings>>;
  pullLisQueue(): Promise<IpcResult<{ pending: LisQueueRecord[]; unresolved: LisQueueRecord[] }>>;
  importLisResult(input: { data: { record: LisQueueRecord } }): Promise<IpcResult<{ pointId: string; gatewayWarning?: string }>>;
  rejectLisResult(input: { data: { messageId: string; note?: string } }): Promise<IpcResult<{ messageId: string }>>;
  /** `store:changed` — invalidation có phạm vi (xem docs/APP-V2-PLAN.md Giai
   * đoạn A1): main phát bảng nào vừa đổi sau mỗi transaction ghi thành công.
   * Trả về hàm huỷ đăng ký, gọi trong cleanup của `useEffect`. */
  onStoreChanged(callback: (payload: { tables: string[]; testIds: string[] }) => void): () => void;
}

declare global {
  interface Window {
    qcApi: QcApi;
  }
}
