// Ambient declarations for `tsc --checkJs` (see tsconfig.json / `npm run typecheck`).
//
// Phần classic còn lại vẫn chạy trong shared global scope; các module đã chuyển
// được Vite bundle thành một IIFE compatibility artifact. Một số API được tạo
// động nên TypeScript không nhìn thấy declaration cú pháp:
//   - `src/presentation/state/ui-state.ts` cài accessor qua
//     `Object.defineProperty(globalThis, key, {...})`.
//   - Retired classic service modules used to do `root.Foo = {...}` and/or
//     `Object.assign(root, {...})`; the resulting globals are still declared
//     here for whatever classic reader (or test) references them bare.
//   - `core.js` (UMD) exposes itself as `window.QCCore`.
// TypeScript can't see any of these as declarations, so it reports every
// (correctly spelled) reference as "Cannot find name" — this file lists them
// so real typos still get caught instead of being drowned in that noise.
// Keep this in sync when a UI state bag or a service's exported
// name set changes.

// --- Core mutable state + derived caches (globalThis property, khai báo tại
// state.js: `globalThis.state = ...`; xem chú thích tách nền trong state.js). ---
declare var state: Record<string, any> & { data?: Record<string, Record<string, any>[]>; tests?: Record<string, any>[]; activity?: any[] };
declare var mem: any, startupProblem: any, derivedIndex: any;
declare var pointsCache: Map<string, any>, pointsIndexCache: Map<string, any>, pointsLotCache: Map<string, any>,
  wgMemo: Map<string, any>, acceptedMemo: Map<string, any>, cusumMemo: Map<string, any>;

// --- UI state accessors (cài từ modular compatibility artifact) ---
declare var selTest: any, statusMemo: any, wgTestQ: any, dashTestQ: any, dashTestStatus: any,
  wgPrevOpen: any, wgVisibleRows: any, wgViewMode: any, wgArchivedGroupId: any,
  wgArchivedTestId: any, wgArchivedTestQ: any, wgChartMode: any;
declare var currentUser: any;
declare var page: string;
// `storageHydrationPromise`/`ensureAdmin`/`showLogin`/`showStartupRecovery`/
// `initFirebase`/`loadBootState` không còn khai báo ở đây — chỉ classic
// assets/app.js từng đọc chúng trần, và nó đã retire vào
// src/compat/modular-pilot.global.ts (2026-08-20, Pha H lát 1); không còn file
// classic nào trong assets/**/*.js (chỉ còn core.js, UMD thuần toán) đọc chúng.
declare function afterRender(page: string): void;
declare function openModal(html: string): void;
declare function closeModal(): void;
declare function modalTemplate(options?: Record<string, any>): string;
declare function modalCloseButton(action?: string): string;
declare function confirmDialog(options?: Record<string, any>): Promise<boolean>;
declare function infoDialog(message: string, options?: Record<string, any>): Promise<unknown>;
declare function openDialogOverlay(html: string, resolve: (result?: any) => void): void;
declare function closeDialogOverlay(result?: any): void;
declare function ensureLabBrandShape(): void;
declare function backupCurrentData(prefix?: string): Promise<boolean>;
declare function reportExportSelection(): { tid: string; t: any; start: string; end: string; includeNceAppendix: boolean };
declare function reportRangeText(start: string, end: string): string;
declare function wgMultiViews(test: any): any[];
declare var ACTIVITY_HARD_CAP: number, ACTIVITY_ROTATE_TO: number;
declare function auditChainStatus(force?: boolean): { ok: boolean; idle: boolean; checked: number; legacy: number; total?: number; brokenIndex?: number; reason?: string };
declare const SG_TEA_SOURCES: [string, string][];
declare function testDisplayName(t: any): string;
declare function jsq(value: unknown): string;
declare function actionLevelShort(t: any, level: unknown, lotSnap: unknown): string;
declare function ljDataURL(points: any[], mean: number, sd: number): string;
declare function ljMultiDataURL(levelViews: any[], test: any, opts?: { divider?: boolean }): string;
declare function esc(value: unknown): string;
declare function escAttr(value: unknown): string;
declare function sgData(tid: string): any[];
declare function sgVisibleLevels(t: any): any[];
declare function sgRows(t: any, data: any[], levels: any[]): any[];
declare function sgFrequencyHTML(t: any, selectedRow: any, levels: any[]): string;
declare function sgTrendSVG(t: any, valid: any[], levels: any[]): string;
declare function sgMDCSVG(t: any, valid: any[], levels: any[]): string;
declare function sgReconcileAllTeaSnapshots(): void;
declare function effectiveTeaRefs(): any[];
declare function sgRef(t: any, refs?: any[]): any;
declare function sgTeaSource(t: any): string;
declare function sgTeaBySource(t: any, src: string, target?: unknown, refs?: any[]): number;
declare function sgTea(t: any): number;
declare function sgTeaCriterionText(t: any, src?: string): string;
declare function sgTeaLabel(src: string): string;
declare function sgTeaRefText(t: any): string;
declare function sgTeaSnapshot(t: any): any;
declare function sgEnsureTeaSnapshot(t: any, e: any): any;
declare function sgLevelTarget(t: any, L: any, level: unknown): number | null;
declare function sgSetLevelTeaSnapshot(t: any, e: any, level: unknown, force?: boolean): any;
declare function sgEntryTea(t: any, e: any, level: unknown, refs?: any[]): number;
declare function teaRefName(v: unknown): string;
declare function teaRefIsDefault(value: unknown): boolean;
declare function instrumentName(id: unknown, fallback?: string): string;
declare function lotTransitionToNo(lotId: unknown): unknown;
declare function targetGroupLots(group: any): any[];
declare function parseVN(value: unknown): string;
declare function setManageTab(tab: unknown): void;
declare function role(): string;
declare function canWrite(): boolean;
declare function requireWrite(message?: string): boolean;
declare function requireAdmin(message?: string): boolean;
declare function roleLabel(role: string): string;
declare function roleSelectOptions(selected: string): string;
declare function rolePageIds(role?: string): string[];
declare function canAccessPage(id: string, user?: any): boolean;
declare function firstAccessPage(user?: any): string;
declare function icon(id: string): string;
declare function icoDownload(): string;
declare function dateBox(id: string, value?: string, cls?: string, attrs?: string): string;
declare function go(page: string): void;
declare function resetMainScroll(): void;
declare function headOnly(title: string, subtitle: string, actions?: string): string;
declare function emptyState(title: string, body: string, actions?: string): string;
declare function btn(label: string, onclick: string, cls?: string, title?: string, opts?: Record<string, any>): string;
declare function rangeActions(testId: string, level: number, eligible: boolean, applied?: string): string;
declare function stateName(value: string): string;
declare function qcVerdictLabel(value: string): string;
declare function render(): void;
declare function rerender(): void;
declare function replaceSelectItems(select: any, items: any[], emptyText?: string): void;
declare function scheduleSearchRender(owner: any, apply: () => void, focusId?: string, delay?: number): void;
declare function brandTitle(): string;
declare function brandSub(): string;
declare function brandMarkText(): string;
declare function brandLogo(): string;
declare function renderBrand(): void;
declare function nav(): void;
declare function sideFoot(): void;
declare function vnPickerParse(value: unknown): string;
declare const PAGES: [string, string][];
declare var entrySel: any, entryDays: any, entryStart: any, entryEnd: any, entrySheetMonth: any,
  entryQ: any, entryMachine: any, entryLastMsg: any, entryAutoOpenKey: any,
  entryPendingSheetFocus: any, entryJumpToday: any, entryLjRenderCache: any,
  entryPrevOpen: any, entryExpandedTables: any, entryDetailOpen: any, treeOpen: any,
  entryExtraRun: any, entryTreeCollapsed: any;
declare var manageQ: any, manageTab: any, manageTargetPanel: any, manageTargetGroup: any,
  manageTargetLevel: any, manageHistoryTest: any, targetSwitchCtx: any;
declare var rcId: any, rcSaveT: any, rcModalQ: any, rcCreateModalQ: any, rcQuickType: any, rcMetaBefore: any;
declare var sgTest: any, sgRefreshT: any, sgMuCtx: any, sgAddTestQ: any, sgSelectedPeriods: any;

// --- Service / view-model namespaces (`root.Foo = {...}`) ---
declare var EntryService: any, PeriodService: any, ReagentComparisonService: any, ChartViewModel: any,
  SigmaCohortService: any, SigmaPresentation: any, SigmaPeriodViewModel: any, SigmaBiasService: any, SigmaCohortImportService: any, SigmaPeriodRecordService: any, SigmaLevelEditService: any, SigmaTrackedTestService: any, SigmaBiasWorkflowService: any, SigmaCohortSelectionService: any, SigmaTeaEditService: any, SigmaTeaSnapshotService: any, SigmaLevelSelectionService: any, SigmaPeriodSelectionService: any, WestgardViewModel: any, ActionReviewService: any, ActionEscalationService: any, ActionBiasService: any, ActionBiasPresentation: any, ActionViolationService: any, ActionListPresentation: any, ActionEvidencePresentation: any, ActionRerunEvidencePresentation: any, ActionStatusPresentation: any, ActionReviewPresentation: any, ActionDetailPresentation: any, ActionGuidePresentation: any, ReportPeriodPresentation: any, ManageConfigService: any, LotTransitionPickerService: any,
  qcPointWarnings: any, AuditService: any;
declare var LISClientService: any, lisGatewayRuntime: any,
  lisGatewayConfig: any, lisNormalizeGatewayUrl: any, lisGatewayStatusText: any,
  lisGatewayPull: any,
  lisImportResult: any, lisRejectResult: any, lisGatewayStart: any;
// action-workflow-service.js retired 2026-08-20 (Pha G nhóm C lát 1) — glue functions now
// live only in src/compat/modular-pilot.global.ts (typed there via QCLabGlobal), and no
// remaining classic .js file references them bare, so no ambient `declare var` needed here.

// core.js (UMD) exposes itself as window.QCCore; referenced bare everywhere else
declare var QCCore: any;

// Firebase compat SDK, loaded from CDN <script> tags in index.html (no @types installed)
declare var firebase: any;

interface Window {
  QCLAB_APP: any;
  QCLAB_CLOUD: any;
  qcLicense: any;
  qcDialog: any;
  // Catch-all: any other ad-hoc window.* property this dense, no-framework
  // codebase reaches for that isn't worth naming individually above.
  [key: string]: any;
}

// The DOM lib types `document.getElementById` as `HTMLElement | null`, which
// makes every `.value`/`.checked`/`.disabled` read on a known <input>/<select>
// a type error unless each call site is cast. This codebase never does that
// (see CLAUDE.md "dense/minified-looking by convention") — loosen the return
// type app-wide instead of retrofitting hundreds of casts.
interface Document {
  getElementById(elementId: string): any;
}

// Same reasoning as Document.getElementById above: querySelector/closest/
// event.target etc. return the strict DOM Element/EventTarget types, but
// every call site here reads arbitrary `.value`/`.dataset`/`.style`/`.checked`
// straight off the result without narrowing or casting.
interface Element {
  [key: string]: any;
}
interface EventTarget {
  [key: string]: any;
}
declare function qcTooltip():any;
// qc-domain.js retired into the TS bundle (2026-08-20, Pha G nhóm C lát 5);
// state.js's ensureShape()/migrateLegacyLots() still reference these two by
// shorthand property name, so classic-file checkJs needs them declared here.
declare function normalizePointLots(): void;
declare function searchText(value: unknown): string;
