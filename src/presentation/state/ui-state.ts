export type UiStateBag = Record<string, any>;

export function installUiState<T extends UiStateBag>(root: object, namespace: string, initialState: T) {
  const target = root as Record<string, any>;
  const state = initialState as UiStateBag;
  Object.keys(initialState).forEach(name => Object.defineProperty(target, name, {
    configurable: true,
    get() { return state[name]; },
    set(value) { state[name] = value; },
  }));
  target[namespace] = initialState;
  return initialState;
}

export function createAnalysisUiState() {
  return { selTest: null, statusMemo: new Map(), wgTestQ: '', dashTestQ: '', dashTestStatus: 'all',
    wgPrevOpen: new Set(), wgExpandedRows: new Set(), wgViewMode: 'current', wgArchivedGroupId: '',
    wgArchivedTestId: '', wgArchivedTestQ: '', wgChartMode: 'lj' };
}

export function createAuthUiState(lockout: unknown = null) {
  const normalized = normalizeLoginLockoutState(lockout);
  return { currentUser: null, loginFails: normalized.fails, loginLockUntil: normalized.until };
}

export function createEntryUiState() {
  return { entrySel: null, entryDays: 30, entryStart: null, entryEnd: null, entrySheetMonth: '', entryQ: '',
    entryMachine: 'all', entryLastMsg: '', entryAutoOpenKey: null, entryPendingSheetFocus: '', entryJumpToday: false,
    entryLjRenderCache: null, entryPartialRenderCache: null, entryPrevOpen: new Map(), entryExpandedTables: new Set(),
    entryDetailOpen: new Set(), treeOpen: new Set(), entryExtraRun: new Set(), entryTreeCollapsed: null };
}

export function createManageUiState() {
  return { manageQ: '', manageTab: 'instruments', manageTargetPanel: '', manageTargetGroup: '',
    manageTargetLevel: '', manageHistoryTest: '', targetSwitchCtx: null, configNavScroll: 0 };
}

export function createReagentUiState() {
  return { rcId: null, rcSaveT: null, rcModalQ: '', rcCreateModalQ: '', rcQuickType: '', rcMetaBefore: null };
}

export function createSigmaUiState() {
  return { sgTest: null, sgRefreshT: null, sgBiasCtx: null, sgMuCtx: null, sgAddTestQ: '', sgSelectedPeriods: {} };
}
import { normalizeLoginLockoutState } from '../../domain/auth/login-lockout-policy';
