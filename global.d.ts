// Ambient declarations for `tsc --checkJs` (see tsconfig.json / `npm run typecheck`).
//
// This app has no bundler/module system (see CLAUDE.md "Architecture"): every
// `assets/modules/*.js` file runs in one shared global scope via plain
// `<script defer>` tags. A handful of modules additionally *construct* their
// globals at runtime instead of declaring them syntactically:
//   - `*-ui-state.js` files build a local `state` object, then
//     `Object.defineProperty(globalThis, key, {...})` one accessor per key.
//   - Some service modules (`action-workflow-service.js`, `entry-service.js`)
//     do `root.Foo = {...}` and/or `Object.assign(root, {...})`.
//   - `core.js` (UMD) exposes itself as `window.QCCore`.
// TypeScript can't see any of these as declarations, so it reports every
// (correctly spelled) reference as "Cannot find name" — this file lists them
// so real typos still get caught instead of being drowned in that noise.
// Keep this in sync when a `*-ui-state.js` state bag or a service's exported
// name set changes.

// --- UI state accessors (Object.defineProperty(globalThis, ...) in *-ui-state.js) ---
declare var selTest: any, statusMemo: any, wgTestQ: any, dashTestQ: any, dashTestStatus: any,
  wgPrevOpen: any, wgExpandedRows: any, wgViewMode: any, wgArchivedGroupId: any,
  wgArchivedTestId: any, wgArchivedTestQ: any, wgChartMode: any;
declare var currentUser: any, loginFails: any, loginLockUntil: any;
declare var entrySel: any, entryDays: any, entryStart: any, entryEnd: any, entrySheetMonth: any,
  entryQ: any, entryMachine: any, entryLastMsg: any, entryAutoOpenKey: any,
  entryPendingSheetFocus: any, entryJumpToday: any, entryLjRenderCache: any,
  entryPartialRenderCache: any, entryPrevOpen: any, entryExpandedTables: any, treeOpen: any,
  entryExtraRun: any;
declare var manageQ: any, manageTab: any, manageTargetPanel: any, manageTargetGroup: any,
  manageTargetLevel: any, manageHistoryTest: any, targetSwitchCtx: any, configNavScroll: any;
declare var rcId: any, rcSaveT: any, rcModalQ: any, rcCreateModalQ: any, rcQuickType: any;
declare var sgTest: any, sgRefreshT: any, sgBiasCtx: any, sgAddTestQ: any, sgSelectedPeriods: any;

// --- UI state namespace bags (`root.XxxUIState = state`) ---
declare var AnalysisUIState: any, AuthUIState: any, EntryUIState: any, ManageUIState: any,
  ReagentUIState: any, SigmaUIState: any;

// --- Service / view-model namespaces (`root.Foo = {...}`) ---
declare var EntryService: any, PeriodService: any, ChartViewModel: any,
  SigmaCohortService: any, WestgardViewModel: any, ActionWorkflowService: any;

// entry-service.js also aliases two of its members directly onto root
declare var nextRunId: any, cleanEntryRunId: any;

// action-workflow-service.js does Object.assign(root, root.ActionWorkflowService)
declare var actionApprovalStatus: any, actionApprovalLabel: any, actionRecorded: any,
  actionPoint: any, actionNeedsRerun: any, actionRerunStatus: any, actionWorkflowStatus: any,
  pointActions: any, pointRealActions: any, pointWorkflowComplete: any, pointWorkflowSummary: any;

// core.js (UMD) exposes itself as window.QCCore; referenced bare everywhere else
declare var QCCore: any;

// Firebase compat SDK, loaded from CDN <script> tags in index.html (no @types installed)
declare var firebase: any;

// Electron preload bridge / license check, only present under electron/preload.js
declare var qcDialog: any;

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
