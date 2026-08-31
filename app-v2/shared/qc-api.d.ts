// Hợp đồng IPC lộ ra qua preload.ts — dùng chung giữa main và renderer để
// renderer có type an toàn khi gọi window.qcApi.*
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
  name: string;
  instrument_id: string;
  unit: string;
  decimal_places: number;
  tea: number;
  section: string;
}

export interface TestLevel {
  id: string;
  test_id: string;
  level: number;
  mean: number | null;
  sd: number | null;
  qc_lot_id: string | null;
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
}

export interface QcPointView {
  id: string; test_id: string; level: number; date: string; run_id: string; val: number;
  note: string; operator_name: string; voided: 0 | 1; void_reason: string;
  verdict: 'ok' | 'warn' | 'rej'; rules: string[];
}

export interface TestSummary {
  testId: string; testName: string; instrumentName: string;
  levels: { level: number; mean: number | null; sd: number | null; worstVerdict: 'ok' | 'warn' | 'rej'; pointCount: number }[];
}

export interface LevelAnalysis {
  points: { id: string; date: string; runId: string; val: number; z: number; verdict: 'ok' | 'warn' | 'rej'; rules: string[] }[];
  cusum: { cPos: number[]; cNeg: number[]; flags: ('ok' | 'warn' | 'rej')[] };
  ruleActions: { id: string; desc: string; on: boolean }[];
}

export interface SigmaMetricResult { tea: number; bias: number; cv: number; sigma: number; dpmo: number; yieldPercent: number }
export interface UncertaintyBudgetResult {
  k: number; uRw: number; uBias: number | null; uCal: number | null; bias: number | null; biasRefU: number | null;
  includeBias: boolean; uc: number; U: number; shares: Record<string, number | null>; complete: boolean; missing: string[];
  target: number | null; absoluteUc: number | null; absoluteU: number | null;
  tea: number | null; teaRatio: number | null; withinTea: boolean | null;
}
export interface SigmaLevelResult {
  level: number; cv: number | null; biasEqa: number | null; uCal: number | null;
  sigma: SigmaMetricResult | null; mu: UncertaintyBudgetResult | null;
}
export interface SigmaPeriodView { id: string; testId: string; period: string; tea: number | null; teaSource: string; levels: SigmaLevelResult[] }

export interface NceRecord {
  id: string; date: string; created_at: string; updated_at?: string; test_id: string | null; level: number | null; lot: string;
  point_id: string | null; rule: string; error_type: string; nce_id: string; protocol_version: number;
  approval_status: 'pending' | 'approved' | 'returned'; effectiveness_status: 'pending' | 'effective' | 'ineffective';
  record_status: 'active' | 'cancelled'; due_date: string; action_completed_date: string; detail_json: string;
}

export interface ReagentComparisonFit { a: number; b: number; r2: number }
export interface ReagentComparisonResult {
  o: number[]; n: number[]; N: number; df: number; d: number[]; mO: number; mN: number; vO: number; vN: number;
  md: number; sdd: number; tStat: number; r: number; alpha: number; p2: number; p1: number; tc2: number; tc1: number;
  bias: number; biasT: number; fit: ReagentComparisonFit; pb: { a: number; b: number }; mard: number;
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
  id: string; username: string; name: string; role: 'admin' | 'technician' | 'viewer';
  active: boolean; mustChangePassword: boolean;
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
  createUser(input: { data: { username: string; name: string; role: string; password: string } }): Promise<IpcResult<PublicUser>>;
  updateUser(input: { id: string; data: { name: string; role: string; active: boolean } }): Promise<IpcResult<PublicUser>>;
  resetUserPassword(input: { id: string; data: { newPassword: string } }): Promise<IpcResult<{ id: string }>>;
  changeOwnPassword(input: { data: { oldPassword: string; newPassword: string } }): Promise<IpcResult<{ id: string }>>;
  listInstruments(): Promise<Instrument[]>;
  saveInstrument(input: { id?: string; data: Partial<Instrument> }): Promise<IpcResult<Instrument>>;
  listTests(): Promise<Test[]>;
  saveTest(input: { id?: string; data: Partial<Test> & { instrumentId?: string } }): Promise<IpcResult<Test>>;
  listTestLevels(testId: string): Promise<TestLevel[]>;
  saveTestLevel(input: { testId: string; data: Partial<TestLevel> }): Promise<IpcResult<TestLevel>>;
  listActivity(limit?: number): Promise<ActivityEntry[]>;
  queryActivity(input: { query?: string; from?: string; to?: string; page?: number; pageSize?: number }): Promise<ActivityPage>;
  queryPoints(testId: string, level: number): Promise<QcPointView[]>;
  addPoint(input: { data: { testId: string; level: number; date: string; val: number; runId?: string; note?: string; operatorName?: string } }): Promise<IpcResult<QcPointView>>;
  voidPoint(input: { data: { pointId: string; reason: string } }): Promise<IpcResult<{ id: string }>>;
  listTestSummaries(): Promise<TestSummary[]>;
  analyzeLevel(testId: string, level: number): Promise<LevelAnalysis>;
  saveRuleAction(testId: string, ruleId: string, on: boolean): Promise<IpcResult<{ ruleId: string; on: boolean }>>;
  listSigmaPeriods(testId: string): Promise<SigmaPeriodView[]>;
  saveSigmaPeriod(input: { testId: string; period: string; tea?: number; teaSource?: string; levels: { level: number; cv?: number; biasEqa?: number; uCal?: number; muBiasMode?: 'include' | 'exclude' }[] }): Promise<IpcResult<SigmaPeriodView>>;
  listNceRecords(): Promise<NceRecord[]>;
  createNce(input: { data: { testId?: string; level?: number; lot?: string; date: string; pointId?: string; rule?: string; errorType?: string; correction: string; dueDate?: string } }): Promise<IpcResult<NceRecord>>;
  approveNce(input: { data: { id: string } }): Promise<IpcResult<NceRecord>>;
  returnNce(input: { data: { id: string; note: string } }): Promise<IpcResult<NceRecord>>;
  cancelNce(input: { data: { id: string; note: string } }): Promise<IpcResult<NceRecord>>;
  setNceCompletedDate(input: { data: { id: string; actionCompletedDate: string } }): Promise<IpcResult<NceRecord>>;
  markNceEffectiveness(input: { data: { id: string; status: 'effective' | 'ineffective'; note?: string } }): Promise<IpcResult<NceRecord>>;
  listReagentComparisons(): Promise<ReagentComparisonView[]>;
  createReagentComparison(input: { data: { name?: string; unit?: string } }): Promise<IpcResult<ReagentComparisonView>>;
  saveReagentMetadata(input: { id: string; data: { reagent?: string; lotOld?: string; lotNew?: string; date?: string; operator?: string; sampleType?: string; unit?: string; biasTarget?: number; alpha?: number; coverageConfirmed?: boolean } }): Promise<IpcResult<ReagentComparisonView>>;
  saveReagentRows(input: { id: string; rows: [string, string][] }): Promise<IpcResult<ReagentComparisonView>>;
  removeReagentComparison(input: { id: string }): Promise<IpcResult<{ id: string }>>;
  getLabProfile(): Promise<LabProfile>;
  saveLabProfile(input: { data: { name?: string; dept?: string; address?: string; brandTitle?: string; brandSub?: string } }): Promise<IpcResult<LabProfile>>;
  listPeriodLocks(): Promise<PeriodLockRow[]>;
  lockPeriod(input: { data: { ym: string; note?: string } }): Promise<IpcResult<PeriodLockRow>>;
  unlockPeriod(input: { data: { ym: string; note: string } }): Promise<IpcResult<{ ym: string }>>;
  queryReport(input: { testId: string; from?: string; to?: string }): Promise<ReportPointRow[]>;
}

declare global {
  interface Window {
    qcApi: QcApi;
  }
}
