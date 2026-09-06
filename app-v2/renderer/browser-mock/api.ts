// Chế độ "xem giao diện qua trình duyệt" — cài `window.qcApi` giả lập khi
// chạy `vite dev` (không có Electron/preload thật). Xem store.ts cho lý do
// phạm vi. TÁI DÙNG THẬT các hàm nghiệp vụ THUẦN (không đụng node:fs/
// node:crypto) từ `main/domain/*` — Westgard/Sigma/Reagent/validate chạy
// ĐÚNG như bản Electron thật, chỉ tầng lưu trữ (mảng JS thay SQL) và
// mật khẩu/audit-hash (không băm thật, xem dưới) là giả lập.
import {
  validateInstrument, validateTest, validateTestLevel, appendMeanSdHistory,
  validateLot, validateLotGroup, validatePanel, validateLotTransition,
} from '../../main/domain/manage-validation';
import { validateTeaRef, TEA_LAB_SOURCE_LABELS } from '../../main/domain/tea-ref-validation';
import { sameText } from '../../main/domain/text-utils';
import { parseRuleScopes, serializeRuleScopes, effectiveScopeList, makeScopeOf, parseRuleActions, serializeRuleActions, makeIsOnLayered, makeRuleActionLayered, isRuleAction, globalRuleList } from '../../main/domain/rule-config';
import { WG_RULE_REGISTRY, defaultRuleAction, errorType, errorTypeDetail } from '../../main/domain/westgard-rules';
import { westgard, westgardByPoint, combinedWestgardByPoint, cusum, type QcPointLike, type RuleVerdict, acceptedPoints } from '../../main/domain/westgard-engine';
import { evaluateRangeCandidate, validateRangeReason } from '../../main/domain/range-workflow';
import { validateQcPointInput, validateVoidInput } from '../../main/domain/entry-validation';
import { validateLockPeriod, validateUnlockPeriod, ymOfDate } from '../../main/domain/period-lock-validation';
import { sigmaMetric, uncertaintyBudget, eqaRoundsStats } from '../../main/domain/sigma-metrics';
import {
  validateNceCreate, validateNceReview, validateReleaseDecision, validateRerunEvidence, validateResidualRisk,
} from '../../main/domain/nce-validation';
import { prepareReagentMetadata, prepareReagentRows, cleanQuickValueType, addQuickValue } from '../../main/domain/reagent-validation';
import { calculateReagentComparison, RC_MIN_PAIRS } from '../../main/domain/reagent-stats';
import { prepareLabProfile } from '../../main/domain/settings-validation';
import { validateUserCreate, validateUserUpdate, validateNewPassword, validateLoginInput, validateSetAvatar } from '../../main/domain/auth-validation';
import { filterActivity, paginateActivity } from '../../main/domain/audit-filter';
import { roleLabel } from '../../main/domain/page-roles';
import { normalizeGatewayUrl, DEFAULT_LIS_GATEWAY_SETTINGS } from '../../main/domain/lis-client';
import type { QcApi, IpcResult } from '../../shared/qc-api';
import { getDb, saveDb, uid, nowIso } from './store';

function ok<T>(data: T): IpcResult<T> { return { ok: true, data }; }
function fail(code: string, message: string): IpcResult<never> { return { ok: false, error: { code, message } }; }
function notAvailable(): IpcResult<never> {
  return fail('not-available-in-browser-preview', 'Không khả dụng ở chế độ xem trước trình duyệt — cần chạy Electron thật (npm run app-v2:start).');
}

function currentActor() {
  const db = getDb();
  const user = db.users.find((u) => u.id === db.currentUserId);
  return user ? { userId: user.id, username: user.username, name: user.name, role: user.role, clientId: 'browser-preview' } : null;
}

function toPublicUser(u: any) {
  return {
    id: u.id, username: u.username, name: u.name, initials: u.initials || '', role: u.role,
    pagePerms: Array.isArray(u.pagePerms) ? u.pagePerms.map(String) : null,
    active: !!u.active, mustChangePassword: !!u.mustChangePassword, avatar: u.avatar || '',
  };
}

let activitySeq = 0;
function logActivity(type: string, detail: string, target = ''): void {
  const db = getDb();
  const a = currentActor();
  activitySeq = Math.max(activitySeq, db.activity.length) + 1;
  db.activity.push({
    id: uid(), seq: activitySeq, ts: nowIso(), user: a?.name || '', username: a?.username || '', userId: a?.userId || '',
    role: a?.role || '', type, detail, target, clientId: 'browser-preview', prevHash: '', hash: '',
  });
}

function ruleActionsFor(test: any) { return parseRuleActions(test.rule_actions_json); }

function isPeriodLocked(ym: string): boolean {
  return getDb().periodLocks.some((l) => l.ym === ym);
}

/** Mirror chính xác cổng `canEnterQcForLevel()` của main và app cũ. */
function canEnterQcForLevel(testId: string, qcLotId: string | null | undefined): boolean {
  if (!qcLotId) return false;
  const db = getDb();
  const test = db.tests.find((item) => item.id === testId);
  if (!test || test.active === 0) return false;
  if (!db.qcPanels.some((panel) => panel.active !== 0 && panel.testIds.includes(testId))) return false;
  const lot = db.qcLots.find((l) => l.id === qcLotId);
  if (!lot || !lot.group_id) return false;
  const group = db.lotGroups.find((g) => g.id === lot.group_id);
  if (!group) return false;
  return group.active !== 0 && group.status !== 'stopped' && group.status !== 'planned';
}

type ActiveMockPoint = QcPointLike & {
  id: string; test_id: string; level: number; date: string; run_id: string;
  val: number; lot: string; qc_mean: number | null; qc_sd: number | null;
  voided: number; runId: string; qcMean: number | null; qcSd: number | null;
};
type ActiveMockLevel = {
  level: number; mean: number | null; sd: number | null; qc_lot_id: string | null;
  lot: string; pts: ActiveMockPoint[]; [key: string]: unknown;
};

function activeMockEvaluation(testId: string) {
  const db = getDb(), test = db.tests.find((t) => t.id === testId);
  const levels: ActiveMockLevel[] = db.testLevels.filter((l) => l.test_id === testId).sort((a, b) => a.level - b.level).map((config) => {
    const lot = config.qc_lot_id ? db.qcLots.find((item) => item.id === config.qc_lot_id)?.lot_no || '' : '';
    const pts = db.qcPoints.filter((p) => p.test_id === testId && p.level === config.level && !p.voided && (p.lot || '') === lot)
      .map((p) => ({ ...p, runId: p.run_id, qcMean: p.qc_mean, qcSd: p.qc_sd }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.run_id.localeCompare(b.run_id, 'vi', { numeric: true })) as ActiveMockPoint[];
    return { ...config, lot, pts };
  });
  const overrides = test ? ruleActionsFor(test) : {};
  const on = makeIsOnLayered(db.westgardRules, overrides), actionOf = makeRuleActionLayered(db.westgardRules, overrides), scope = makeScopeOf(parseRuleScopes(test?.rule_scopes_json), levels.length);
  const within = (rule: string) => on(rule) && ['within', 'both'].includes(scope(rule));
  const across = (rule: string) => on(rule) && ['across', 'both'].includes(scope(rule));
  const byPoint = combinedWestgardByPoint(levels.map((l) => ({ level: l.level, pts: l.pts, mean: l.mean, sd: l.sd })), within, across, actionOf);
  return { levels, within, across, actionOf, byPoint };
}

function queryPointsView(testId: string, level: number) {
  const active = activeMockEvaluation(testId), selected = active.levels.find((item) => item.level === level);
  return (selected?.pts || []).map((p) => { const flag = active.byPoint.get(p) || { level: 'ok' as RuleVerdict, rules: [] }; return { ...p, verdict: flag.level, rules: flag.rules }; });
}

function parallelMockColumns(testId: string) {
  const db = getDb(), test = db.tests.find((item) => item.id === testId);
  if (!test) return [];
  const active = activeMockEvaluation(testId), seen = new Set<number>(), out: any[] = [];
  for (const tr of db.lotTransitions) {
    if (tr.status !== 'active') continue;
    const panel = db.qcPanels.find((item) => item.id === tr.panel_id);
    if (!panel?.testIds?.includes(testId)) continue;
    const config = db.testLevels.find((item) => item.test_id === testId && item.qc_lot_id === tr.from_lot_id);
    const lot = db.qcLots.find((item) => item.id === tr.to_lot_id);
    if (!config || !lot || Number(lot.level) !== Number(config.level) || seen.has(config.level)) continue;
    let criteria: any[] = [];
    try { const parsed = JSON.parse(tr.criteria_json || '[]'); if (Array.isArray(parsed)) criteria = parsed; } catch { /* invalid transition is hidden */ }
    const target = criteria.find((item) => item.testId === testId && Number(item.level) === config.level && Number.isFinite(Number(item.mean)) && Number(item.sd) > 0);
    if (!target) continue;
    const pts = db.qcPoints.filter((point) => point.test_id === testId && point.level === config.level && !point.voided && (point.lot || '') === lot.lot_no)
      .map((point) => ({ ...point, runId: point.run_id, qcMean: point.qc_mean, qcSd: point.qc_sd }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.run_id.localeCompare(b.run_id, 'vi', { numeric: true }));
    const result = westgardByPoint(pts, Number(target.mean), Number(target.sd), active.within, active.actionOf);
    out.push({ transitionId: tr.id, level: config.level, lotId: lot.id, lot: lot.lot_no, startDate: tr.start_date,
      mean: Number(target.mean), sd: Number(target.sd), low: target.low ?? null, high: target.high ?? null, exp: lot.exp || '',
      points: pts.map((point, index) => ({ ...point, verdict: result.F[index]?.level || 'ok', rules: result.F[index]?.rules || [] })) });
    seen.add(config.level);
  }
  return out;
}

function previousMockLotSeries(testId: string) {
  const db = getDb(), test = db.tests.find((item) => item.id === testId);
  if (!test) return [];
  const configs = db.testLevels.filter((item) => item.test_id === testId).sort((a, b) => a.level - b.level);
  const active = activeMockEvaluation(testId), out: any[] = [];
  for (const config of configs) {
    if (!config.qc_lot_id) continue;
    let history: any[] = [];
    try { const parsed = JSON.parse(config.mean_sd_history_json || '[]'); if (Array.isArray(parsed)) history = parsed; } catch { /* ignore */ }
    let currentLotId: string | null = config.qc_lot_id;
    const seen = new Set<string>();
    while (currentLotId && !seen.has(currentLotId)) {
      seen.add(currentLotId);
      const transition = [...db.lotTransitions].reverse().find((tr) => tr.status === 'accepted' && tr.to_lot_id === currentLotId
        && db.qcPanels.find((panel) => panel.id === tr.panel_id)?.testIds?.includes(testId));
      if (!transition) break;
      const previous = db.qcLots.find((lot) => lot.id === transition.from_lot_id);
      if (!previous || Number(previous.level) !== Number(config.level)) break;
      const points = db.qcPoints.filter((point) => point.test_id === testId && point.level === config.level && !point.voided && (point.lot || '') === previous.lot_no)
        .map((point) => ({ ...point, runId: point.run_id, qcMean: point.qc_mean, qcSd: point.qc_sd }))
        .sort((a, b) => a.date.localeCompare(b.date) || a.run_id.localeCompare(b.run_id, 'vi', { numeric: true }));
      const saved = [...history].reverse().find((item) => item.qcLotId === previous.id && item.mean != null && item.sd != null && Number(item.sd) > 0);
      const snap = [...points].reverse().find((point) => point.qc_mean != null && point.qc_sd != null && Number(point.qc_sd) > 0);
      const mean = saved?.mean != null ? Number(saved.mean) : snap?.qc_mean != null ? Number(snap.qc_mean) : NaN;
      const sd = saved?.sd != null ? Number(saved.sd) : snap?.qc_sd != null ? Number(snap.qc_sd) : NaN;
      if (points.length && Number.isFinite(mean) && Number.isFinite(sd) && sd > 0) {
        const result = westgardByPoint(points, mean, sd, active.within, active.actionOf);
        out.push({ level: config.level, lotId: previous.id, lot: previous.lot_no, mean, sd,
          points: points.map((point, index) => ({ ...point, verdict: result.F[index]?.level || 'ok', rules: result.F[index]?.rules || [] })) });
      }
      currentLotId = previous.id;
    }
  }
  return out;
}

export function createBrowserMockApi(): QcApi {
  return {
    // ---- Auth ----
    async hasAnyUsers() { return getDb().users.length > 0; },
    async currentUser() { const a = currentActor(); return a ? getDb().users.filter((u) => u.id === a.userId).map(toPublicUser)[0] || null : null; },
    async bootstrapAdmin(input) {
      const db = getDb();
      if (db.users.length > 0) return fail('already-bootstrapped', 'Hệ thống đã có tài khoản, không thể khởi tạo lại.');
      const result = validateUserCreate(input.data, []);
      if (!result.ok) return fail(result.code, result.message);
      const id = uid();
      const user = { id, username: result.data.username, name: result.data.name, role: 'admin', active: true, mustChangePassword: false };
      db.users.push(user);
      db.passwordsByUserId[id] = result.data.password;
      db.currentUserId = id;
      logActivity('Khởi tạo tài khoản quản trị', `Tạo tài khoản quản trị đầu tiên "${user.username}"`, user.username);
      saveDb();
      return ok(toPublicUser(user));
    },
    async login(input) {
      const db = getDb();
      const result = validateLoginInput(input.data);
      if (!result.ok) return fail(result.code, result.message);
      const user = db.users.find((u) => u.username === result.data.username);
      if (!user || db.passwordsByUserId[user.id] !== result.data.password) return fail('invalid-credentials', 'Sai tên đăng nhập hoặc mật khẩu.');
      if (!user.active) return fail('inactive', 'Tài khoản đã bị khoá.');
      db.currentUserId = user.id;
      logActivity('Đăng nhập', 'Đăng nhập thành công', user.username);
      saveDb();
      return ok(toPublicUser(user));
    },
    async logout() { getDb().currentUserId = null; saveDb(); return ok(null); },
    async listUsers() {
      const a = currentActor(); if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị viên mới được thực hiện thao tác này.');
      return ok(getDb().users.map(toPublicUser));
    },
    async createUser(input) {
      const db = getDb(); const a = currentActor(); if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị viên mới được thực hiện thao tác này.');
      const result = validateUserCreate(input.data as any, db.users.map((u) => u.username));
      if (!result.ok) return fail(result.code, result.message);
      const id = uid();
      const user = { id, username: result.data.username, name: result.data.name, initials: result.data.initials, role: result.data.role, pagePerms: result.data.pagePerms, active: true, mustChangePassword: true };
      db.users.push(user); db.passwordsByUserId[id] = result.data.password;
      logActivity('Thêm người dùng', `Tạo tài khoản "${user.username}": ${roleLabel(user.role)} · ${result.data.pagePerms.length} thẻ · yêu cầu đổi mật khẩu`, user.username); saveDb();
      return ok(toPublicUser(user));
    },
    async updateUser(input) {
      const db = getDb(); const a = currentActor(); if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị viên mới được thực hiện thao tác này.');
      const user = db.users.find((u) => u.id === input.id); if (!user) return fail('not-found', 'Không tìm thấy người dùng.');
      const result = validateUserUpdate(input.data as any); if (!result.ok) return fail(result.code, result.message);
      const otherActiveAdmins = db.users.filter((u) => u.id !== user.id && u.role === 'admin' && u.active).length;
      if (user.role === 'admin' && user.active && !(result.data.role === 'admin' && result.data.active) && otherActiveAdmins === 0) {
        return fail('last-admin', 'Phải còn ít nhất 1 quản trị viên đang hoạt động.');
      }
      if (user.id === a.userId && (result.data.pagePerms !== undefined || result.data.role !== user.role)) {
        return fail('self-perms', 'Không thể tự sửa quyền của tài khoản đang đăng nhập. Hãy dùng tài khoản quản trị khác nếu cần thay đổi.');
      }
      const permsText = result.data.pagePerms !== undefined ? ` · ${result.data.pagePerms.length} thẻ` : '';
      Object.assign(user, result.data);
      logActivity('Sửa người dùng', `Cập nhật "${user.username}": ${roleLabel(user.role)}${permsText}, ${user.active ? 'hoạt động' : 'đã khoá'}`, user.username); saveDb();
      return ok(toPublicUser(user));
    },
    async deleteUser(input) {
      const db = getDb(); const a = currentActor(); if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị viên mới được thực hiện thao tác này.');
      const user = db.users.find((u) => u.id === input.id); if (!user) return fail('not-found', 'Không tìm thấy người dùng.');
      if (user.id === a.userId) return fail('self-delete', 'Không thể tự xoá tài khoản đang đăng nhập.');
      const otherActiveAdmins = db.users.filter((u) => u.id !== user.id && u.role === 'admin' && u.active).length;
      if (user.role === 'admin' && user.active && otherActiveAdmins === 0) return fail('last-admin', 'Phải còn ít nhất 1 quản trị viên đang hoạt động.');
      db.users = db.users.filter((u) => u.id !== user.id);
      delete db.passwordsByUserId[user.id];
      logActivity('Xoá người dùng', `Xoá tài khoản "${user.username}" (${roleLabel(user.role)})`, user.username); saveDb();
      return ok({ id: user.id });
    },
    async resetUserPassword(input) {
      const db = getDb(); const a = currentActor(); if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị viên mới được thực hiện thao tác này.');
      const user = db.users.find((u) => u.id === input.id); if (!user) return fail('not-found', 'Không tìm thấy người dùng.');
      const result = validateNewPassword((input.data as any).newPassword); if (!result.ok) return fail(result.code, result.message);
      db.passwordsByUserId[user.id] = result.data; user.mustChangePassword = true;
      logActivity('Đặt lại mật khẩu', `Đặt lại mật khẩu cho "${user.username}"`, user.username); saveDb();
      return ok({ id: user.id });
    },
    async changeOwnPassword(input) {
      const db = getDb(); const a = currentActor(); if (!a) return fail('forbidden', 'Chưa đăng nhập.');
      if (db.passwordsByUserId[a.userId] !== (input.data as any).oldPassword) return fail('wrong-password', 'Mật khẩu hiện tại không đúng.');
      const result = validateNewPassword((input.data as any).newPassword); if (!result.ok) return fail(result.code, result.message);
      db.passwordsByUserId[a.userId] = result.data; const user = db.users.find((u) => u.id === a.userId); if (user) user.mustChangePassword = false;
      saveDb();
      return ok({ id: a.userId });
    },
    async verifyOwnPassword(input) {
      const db = getDb(); const a = currentActor(); if (!a) return fail('forbidden', 'Chưa đăng nhập.');
      if (db.passwordsByUserId[a.userId] !== (input.data as any).password) return fail('wrong-password', 'Mật khẩu không đúng.');
      return ok({ ok: true as const });
    },
    async setAvatar(input) {
      const db = getDb(); const a = currentActor(); if (!a) return fail('forbidden', 'Chưa đăng nhập.');
      const result = validateSetAvatar((input.data as any)?.dataUrl); if (!result.ok) return fail(result.code, result.message);
      const user = db.users.find((u) => u.id === a.userId); if (user) user.avatar = result.data;
      logActivity('Cập nhật ảnh đại diện', 'Đổi ảnh đại diện cá nhân', a.username); saveDb();
      return ok({ avatar: result.data });
    },
    async clearAvatar() {
      const db = getDb(); const a = currentActor(); if (!a) return fail('forbidden', 'Chưa đăng nhập.');
      const user = db.users.find((u) => u.id === a.userId); if (user) user.avatar = '';
      logActivity('Cập nhật ảnh đại diện', 'Xoá ảnh đại diện cá nhân', a.username); saveDb();
      return ok({ avatar: '' });
    },

    // ---- Cấu hình chung ----
    async listInstruments() { return [...getDb().instruments].sort((a, b) => a.name.localeCompare(b.name, 'vi')); },
    async saveInstrument(input) {
      const db = getDb();
      const existingNames = db.instruments.filter((i) => i.id !== input.id).map((i) => i.name);
      const result = validateInstrument(input.data as any, existingNames);
      if (!result.ok) return fail(result.code, result.message);
      if (input.id) {
        const row = db.instruments.find((i) => i.id === input.id); if (!row) return fail('not-found', 'Không tìm thấy máy xét nghiệm cần cập nhật.');
        Object.assign(row, result.data, { active: result.data.active ? 1 : 0 });
        logActivity('Sửa máy xét nghiệm', `Cập nhật máy "${row.name}"`, row.name); saveDb(); return ok(row);
      }
      const row = { id: uid(), ...result.data, active: result.data.active ? 1 : 0 };
      db.instruments.push(row);
      logActivity('Thêm máy xét nghiệm', `Tạo máy "${row.name}"`, row.name); saveDb(); return ok(row);
    },
    async removeInstrument(input) {
      const db = getDb();
      const idx = db.instruments.findIndex((i) => i.id === (input as any).id);
      if (idx < 0) return fail('not-found', 'Không tìm thấy máy xét nghiệm.');
      const row = db.instruments[idx];
      const testCount = db.tests.filter((t) => t.instrument_id === row.id).length;
      if (testCount > 0) return fail('in-use', `Không thể xoá — máy này đang gắn với ${testCount} xét nghiệm. Xoá/chuyển các xét nghiệm đó trước.`);
      // Cùng cổng "used-by-panel" đã sửa ở main/ipc/config-handlers.ts.
      const panelCount = db.qcPanels.filter((p: any) => p.instrument_id === row.id).length;
      if (panelCount > 0) return fail('in-use', `Không thể xoá — máy này đang gắn với ${panelCount} Panel QC. Xoá/chuyển các Panel QC đó trước.`);
      db.instruments.splice(idx, 1);
      logActivity('Xoá máy xét nghiệm', `Xoá "${row.name}"`, row.name); saveDb(); return ok({ id: row.id });
    },
    // Không sắp xếp — khớp `config-handlers.ts` thật (`ORDER BY rowid`, tức
    // thứ tự tạo): `db.tests.push()` khi thêm mới đã tự giữ đúng thứ tự đó.
    async listTests() { return [...getDb().tests]; },
    async saveTest(input) {
      const db = getDb();
      const knownInstrumentIds = new Set(db.instruments.map((i) => i.id));
      if (Array.isArray((input.data as any).instrumentIds)) {
        const requestedIds = [...new Set((input.data as any).instrumentIds.map(String).filter(Boolean))] as string[];
        if (!requestedIds.length) return fail('missing-instrument', 'Chọn ít nhất một máy xét nghiệm.');
        if (requestedIds.some((id) => !knownInstrumentIds.has(id))) return fail('missing-instrument', 'Có máy xét nghiệm đã chọn không còn tồn tại.');
        const assignmentIds = [...new Set([...(Array.isArray((input.data as any).assignmentIds) ? (input.data as any).assignmentIds.map(String) : []), input.id || ''].filter(Boolean))] as string[];
        if (!input.id && !assignmentIds.length) {
          const nameKey = String((input.data as any).name || '').trim().toLocaleLowerCase('vi');
          const unitKey = String((input.data as any).unit || '').trim().toLocaleLowerCase('vi');
          const refKey = String((input.data as any).teaRefKey || '');
          for (const test of db.tests) {
            const matchesCatalog = refKey
              ? test.tea_ref_key === refKey
              : String(test.name).trim().toLocaleLowerCase('vi') === nameKey
                && String(test.unit).trim().toLocaleLowerCase('vi') === unitKey;
            if (matchesCatalog) assignmentIds.push(test.id);
          }
        }
        const existingAssignments = db.tests.filter((test) => assignmentIds.includes(test.id));
        if (input.id && !existingAssignments.some((test) => test.id === input.id)) return fail('not-found', 'Không tìm thấy xét nghiệm cần cập nhật.');
        const targetIds = [...new Set([...existingAssignments.map((test) => test.instrument_id), ...requestedIds])] as string[];
        const managedIds = new Set(existingAssignments.map((test) => test.id));
        const prepared: any[] = [];
        for (const instrumentId of targetIds) {
          const outsideGroup = db.tests.filter((test) => test.instrument_id === instrumentId && !managedIds.has(test.id));
          const instrument = db.instruments.find((item) => item.id === instrumentId);
          const result = validateTest({ ...(input.data as any), instrumentId, section: instrument?.section || '' }, knownInstrumentIds,
            outsideGroup.map((test) => test.name), outsideGroup.map((test) => test.tea_ref_key).filter(Boolean));
          if (!result.ok) return fail(result.code, result.message);
          prepared.push({ instrumentId, section: instrument?.section || '', data: result.data });
        }
        const analyteId = String((input.data as any).analyteId || existingAssignments[0]?.analyte_id || (input.data as any).teaRefKey || uid());
        const preserveExisting = (input.data as any).preserveExistingAssignments === true;
        const savedIds: string[] = [];
        for (const item of prepared) {
          const d = item.data;
          const values = {
            analyte_id: analyteId, name: d.name, instrument_id: item.instrumentId, unit: d.unit,
            decimal_places: d.decimalPlaces, tea: d.tea, section: item.section, tea_source: d.teaSource,
            tea_ref_key: d.teaRefKey, method: d.method, reagent: d.reagent, cusum_on: d.cusumOn ? 1 : 0,
            cusum_k: d.cusumK, cusum_h: d.cusumH, active: d.active ? 1 : 0,
          };
          const current = existingAssignments.find((test) => test.instrument_id === item.instrumentId);
          if (current) { if (!preserveExisting) Object.assign(current, values); savedIds.push(current.id); continue; }
          const newRow = { id: uid(), ...values, display_name: '', standard_name: '', abbreviation: '', aliases_json: '[]', matrix: '', rule_actions_json: '{}', rule_scopes_json: '{}' };
          db.tests.push(newRow);
          db.testLevels.push({ id: `${newRow.id}:1`, test_id: newRow.id, level: 1, mean: null, sd: null, qc_lot_id: null, low: null, high: null, range_k: 2, mfg_mean: null, mfg_sd: null, applied: 'mfg', mean_sd_history_json: '[]', mean_sd_effective_from: '' });
          savedIds.push(newRow.id);
        }
        const representative = db.tests.find((test) => test.id === (input.id && savedIds.includes(input.id) ? input.id : savedIds[0]));
        logActivity(preserveExisting ? 'Gán thêm máy xét nghiệm' : existingAssignments.length ? 'Sửa xét nghiệm' : 'Thêm xét nghiệm', preserveExisting ? `Gán thêm máy cho xét nghiệm "${prepared[0].data.name}"` : `${existingAssignments.length ? 'Cập nhật' : 'Tạo'} xét nghiệm "${prepared[0].data.name}" trên ${savedIds.length} máy`, prepared[0].data.name);
        saveDb();
        return ok({ ...representative, assignment_ids: savedIds });
      }
      const instrumentId = String((input.data as any).instrumentId || '');
      const existingTests = db.tests.filter((t) => t.id !== input.id && t.instrument_id === instrumentId);
      const result = validateTest(input.data as any, knownInstrumentIds,
        existingTests.map((t) => t.name), existingTests.map((t) => t.tea_ref_key).filter(Boolean));
      if (!result.ok) return fail(result.code, result.message);
      const row = {
        name: result.data.name, instrument_id: result.data.instrumentId, unit: result.data.unit, decimal_places: result.data.decimalPlaces,
        tea: result.data.tea, section: result.data.section, tea_source: result.data.teaSource, tea_ref_key: result.data.teaRefKey,
        method: result.data.method, reagent: result.data.reagent, cusum_on: result.data.cusumOn ? 1 : 0, cusum_k: result.data.cusumK, cusum_h: result.data.cusumH,
        active: result.data.active ? 1 : 0,
        // 6 cột dưới đây schema thật (main/db/schema.ts) có mặc định sẵn;
        // thiếu chúng thì bản xem trước trả object hình dạng khác handler
        // thật — tests/mock-parity.test.mjs khoá đúng chỗ này.
        abbreviation: '', display_name: '', standard_name: '', analyte_id: '', matrix: '', aliases_json: '[]',
      };
      if (input.id) {
        const existing = db.tests.find((t) => t.id === input.id); if (!existing) return fail('not-found', 'Không tìm thấy xét nghiệm cần cập nhật.');
        const oldInstrumentId = existing.instrument_id;
        Object.assign(existing, row);
        // Khớp `saveAssay()` app cũ và handler SQLite thật: đổi máy phải gỡ
        // xét nghiệm khỏi các Panel QC thuộc máy cũ/khác máy mới.
        if (oldInstrumentId !== existing.instrument_id) {
          for (const panel of db.qcPanels) {
            if (panel.instrument_id !== existing.instrument_id) {
              panel.testIds = (panel.testIds || []).filter((testId: string) => testId !== existing.id);
            }
          }
        }
        logActivity('Sửa xét nghiệm', `Cập nhật xét nghiệm "${existing.name}"`, existing.name); saveDb(); return ok(existing);
      }
      const newRow = { id: uid(), ...row, rule_actions_json: '{}', rule_scopes_json: '{}' };
      db.tests.push(newRow);
      db.testLevels.push({ id: `${newRow.id}:1`, test_id: newRow.id, level: 1, mean: null, sd: null, qc_lot_id: null, low: null, high: null, range_k: 2, mfg_mean: null, mfg_sd: null, applied: 'mfg', mean_sd_history_json: '[]', mean_sd_effective_from: '' });
      logActivity('Thêm xét nghiệm', `Tạo xét nghiệm "${newRow.name}"`, newRow.name); saveDb(); return ok(newRow);
    },
    async listTestLevels(testId) { return getDb().testLevels.filter((l) => l.test_id === testId).sort((a, b) => a.level - b.level); },
    async saveTestLevel(input) {
      const db = getDb();
      const test = db.tests.find((t) => t.id === input.testId); if (!test) return fail('not-found', 'Không tìm thấy xét nghiệm.');
      const result = validateTestLevel(input.data as any); if (!result.ok) return fail(result.code, result.message);
      if (result.data.qcLotId) {
        const lot = db.qcLots.find((item) => item.id === result.data.qcLotId);
        if (!lot) return fail('missing-lot', 'Không tìm thấy lô QC đã chọn.');
        if (lot.level !== result.data.level) return fail('wrong-lot-level', `Lô QC đã chọn thuộc Mức ${lot.level}, không thể gán cho Mức ${result.data.level}.`);
        if (lot.depleted) return fail('depleted-lot', 'Lô QC đã hết dùng, không thể gán Mean/SD mới.');
      }
      const levelId = `${input.testId}:${result.data.level}`;
      const today = new Date().toISOString().slice(0, 10);
      const selectedLot = result.data.qcLotId ? db.qcLots.find((item) => item.id === result.data.qcLotId) : undefined;
      let row = db.testLevels.find((l) => l.id === levelId);
      if (row) {
        const lotChanged = row.qc_lot_id !== (result.data.qcLotId || null);
        const changed = lotChanged || row.mean !== result.data.mean || row.sd !== result.data.sd || row.low !== result.data.low || row.high !== result.data.high;
        const oldLot = row.qc_lot_id ? db.qcLots.find((item) => item.id === row.qc_lot_id) : undefined;
        const nextEffectiveFrom = lotChanged ? (selectedLot?.opened || today) : changed ? today : (row.mean_sd_effective_from || selectedLot?.opened || today);
        if (changed) row.mean_sd_history_json = appendMeanSdHistory(row.mean_sd_history_json, {
          mean: row.mean, sd: row.sd, low: row.low, high: row.high, qcLotId: row.qc_lot_id || '', lot: oldLot?.lot_no || '',
          effectiveFrom: row.mean_sd_effective_from || oldLot?.opened || '', effectiveTo: lotChanged ? nextEffectiveFrom : today, source: row.applied,
        }, nowIso());
        if (row.applied === 'mfg') { row.mfg_mean = result.data.mean; row.mfg_sd = result.data.sd; }
        row.mean = result.data.mean; row.sd = result.data.sd; row.low = result.data.low; row.high = result.data.high; row.qc_lot_id = result.data.qcLotId || null;
        row.mean_sd_effective_from = nextEffectiveFrom;
      } else {
        row = { id: levelId, test_id: input.testId, level: result.data.level, mean: result.data.mean, sd: result.data.sd, qc_lot_id: result.data.qcLotId || null, low: result.data.low, high: result.data.high, range_k: 2, mfg_mean: result.data.mean, mfg_sd: result.data.sd, applied: 'mfg', mean_sd_history_json: '[]', mean_sd_effective_from: selectedLot?.opened || today };
        db.testLevels.push(row);
      }
      logActivity('Sửa mức QC', `Mức ${result.data.level} của xét nghiệm "${test.name}": Mean=${result.data.mean ?? '—'} SD=${result.data.sd ?? '—'}`, test.name);
      saveDb(); return ok(row);
    },
    async listActivity(limit = 200) { return [...getDb().activity].reverse().slice(0, limit); },
    async listRuleScopes(testId, levelCount) {
      const test = getDb().tests.find((t) => t.id === testId);
      return effectiveScopeList(test ? parseRuleScopes(test.rule_scopes_json) : {}, levelCount);
    },
    async saveRuleScope(testId, ruleId, scope) {
      const test = getDb().tests.find((t) => t.id === testId); if (!test) return fail('not-found', 'Không tìm thấy xét nghiệm.');
      if (!WG_RULE_REGISTRY.some((r) => r.id === ruleId)) return fail('invalid-rule', 'Mã luật không hợp lệ.');
      if (scope !== '' && !['within', 'across', 'both'].includes(scope)) return fail('invalid-scope', 'Phạm vi luật không hợp lệ.');
      const overrides = parseRuleScopes(test.rule_scopes_json); if (scope) overrides[ruleId] = scope; else delete overrides[ruleId]; test.rule_scopes_json = serializeRuleScopes(overrides);
      logActivity('Sửa phạm vi luật Westgard', `Luật ${ruleId} chuyển thành ${scope ? `phạm vi ${scope}` : 'phạm vi SOP khuyến nghị'}`, test.name);
      saveDb(); return ok({ ruleId, scope });
    },
    async listLots() { return [...getDb().qcLots].sort((a, b) => a.lot_no.localeCompare(b.lot_no, 'vi')); },
    async saveLot(input) {
      const db = getDb();
      const result = validateLot(input.data as any); if (!result.ok) return fail(result.code, result.message);
      // Chặn trùng số lô cùng mức + đổi mức của lô đang gán Mean/SD — cùng
      // logic đã sửa ở main/ipc/config-handlers.ts.
      if (input.id) {
        const beforeCheck = db.qcLots.find((l) => l.id === input.id);
        if (!beforeCheck) return fail('not-found', 'Không tìm thấy lô QC cần cập nhật.');
        if (beforeCheck && beforeCheck.level !== result.data.level && db.testLevels.some((tl: any) => tl.qc_lot_id === input.id)) {
          return fail('level-in-use', 'Lô QC đang gắn với xét nghiệm nên không thể đổi mức QC. Hãy bỏ gán lô trong Mean/SD trước.');
        }
      }
      if (db.qcLots.some((l) => l.id !== (input.id || '') && l.level === result.data.level && sameText(l.lot_no, result.data.lotNo))) {
        return fail('duplicate-lot', 'Số lô QC này đã tồn tại ở cùng mức QC.');
      }
      const row = { group_id: result.data.groupId || null, lot_no: result.data.lotNo, level: result.data.level, description: result.data.description, supplier: result.data.supplier, program: result.data.program, exp: result.data.exp, opened: result.data.opened, active: result.data.active ? 1 : 0, depleted: result.data.depleted ? 1 : 0, note: result.data.note };
      if (input.id) {
        const existing = db.qcLots.find((l) => l.id === input.id); if (!existing) return fail('not-found', 'Không tìm thấy lô QC cần cập nhật.');
        const beforeLotNo = existing.lot_no; const beforeLevel = existing.level;
        const renaming = !!beforeLotNo && beforeLotNo !== result.data.lotNo;
        Object.assign(existing, row);
        let renamed = 0;
        if (renaming) {
          for (const point of db.qcPoints) {
            if (point.level === beforeLevel && (point.lot || '') === beforeLotNo) { point.lot = result.data.lotNo; renamed += 1; }
          }
        }
        logActivity('Sửa lô QC', renaming
          ? `Đổi số lô "${beforeLotNo}" → "${result.data.lotNo}" mức ${result.data.level}, cập nhật ${renamed} điểm QC`
          : `Cập nhật lô "${result.data.lotNo}" mức ${result.data.level}`, result.data.lotNo);
        saveDb(); return ok(existing);
      }
      const newRow = { id: uid(), ...row }; db.qcLots.push(newRow);
      logActivity('Thêm lô QC', `Tạo lô "${result.data.lotNo}" mức ${result.data.level}`, result.data.lotNo);
      saveDb(); return ok(newRow);
    },
    async setTeaRefValue(input) {
      const db = getDb(); const a = currentActor(); if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị mới được thực hiện thao tác này.');
      const analyteId = String(input.analyteId || '');
      if (!analyteId) return fail('invalid-analyte', 'Thiếu mã analyte.');
      if (input.field !== 'clia' && input.field !== 'ricos') return fail('invalid-field', 'Chỉ sửa được TEa CLIA% hoặc Ricos%.');
      const raw = String(input.value ?? '').trim();
      let value: number | null = null;
      if (raw !== '') {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) return fail('invalid-value', 'TEa phải là số lớn hơn 0.');
        value = parsed;
      }
      const name = String(input.name || analyteId);
      const existing = db.teaRefs.find((ref: any) => ref.analyte_id === analyteId);
      if (existing) {
        existing[input.field] = value;
        if (existing.clia == null && existing.ricos == null && existing.lab == null) {
          db.teaRefs = db.teaRefs.filter((ref: any) => ref.id !== existing.id);
        }
      } else {
        if (value == null) return ok({ analyteId });
        db.teaRefs.push({
          id: uid(), analyte_id: analyteId, name, display_name: '', standard_name: '', abbreviation: '',
          aliases_json: '[]', matrix: '', unit: String(input.unit || ''), section: String(input.section || ''),
          clia: input.field === 'clia' ? value : null, ricos: input.field === 'ricos' ? value : null, lab: null,
          lab_source: '', lab_prepared_by: '', lab_next_review_date: '', clia_rule: '', clia_absolute: null,
          clia_absolute_unit: '', sources_json: '{}', created_at: nowIso(),
        });
      }
      const label = input.field === 'clia' ? 'CLIA' : 'Ricos';
      logActivity('Sửa bảng TEa tham chiếu', value == null ? `Bỏ ghi đè TEa ${label} của "${name}"` : `Đặt TEa ${label} của "${name}" = ${value}%`, name);
      saveDb();
      return ok({ analyteId });
    },
    async restoreTeaRefDefaults(input) {
      const db = getDb(); const a = currentActor(); if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị mới được thực hiện thao tác này.');
      const analyteId = String(input.analyteId || '');
      const existing = db.teaRefs.find((ref: any) => ref.analyte_id === analyteId);
      if (!existing) return ok({ analyteId });
      if (existing.lab == null) db.teaRefs = db.teaRefs.filter((ref: any) => ref.id !== existing.id);
      else { existing.clia = null; existing.ricos = null; }
      logActivity('Khôi phục TEa tham chiếu', `Bỏ ghi đè CLIA/Ricos của "${existing.name}"`, existing.name);
      saveDb();
      return ok({ analyteId });
    },
    async addTeaAnalyte(input) {
      const db = getDb(); const a = currentActor(); if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị mới được thực hiện thao tác này.');
      const name = String(input.name || '').trim();
      if (!name) return fail('missing-name', 'Nhập tên xét nghiệm.');
      const num = (value: unknown) => {
        const raw = String(value ?? '').trim();
        if (raw === '') return null;
        const parsed = Number(raw);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      };
      const analyteId = name.normalize('NFD').replace(new RegExp('[\u0300-\u036f]', 'g'), '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || uid();
      if (db.teaRefs.some((ref: any) => ref.analyte_id === analyteId)) {
        return fail('duplicate', `Đã có xét nghiệm tham chiếu "${name}".`);
      }
      db.teaRefs.push({
        id: uid(), analyte_id: analyteId, name, display_name: '', standard_name: '',
        abbreviation: String(input.abbreviation || '').trim(), aliases_json: '[]',
        matrix: String(input.matrix || '').trim(), unit: String(input.unit || '').trim(),
        section: String(input.section || '').trim(), clia: num(input.clia), ricos: num(input.ricos),
        lab: null, lab_source: '', lab_prepared_by: '', lab_next_review_date: '', clia_rule: '',
        clia_absolute: null, clia_absolute_unit: '', sources_json: '{}', created_at: nowIso(),
      });
      logActivity('Thêm xét nghiệm tham chiếu', `Thêm "${name}" vào bảng TEa tham chiếu`, name);
      saveDb();
      return ok({ analyteId });
    },
    async removeTest(input) {
      const db = getDb(); const a = currentActor(); if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị mới được thực hiện thao tác này.');
      const test = db.tests.find((t: any) => t.id === input.id); if (!test) return fail('not-found', 'Không tìm thấy xét nghiệm.');
      const ids = [...new Set([test.id, ...(Array.isArray(input.ids) ? input.ids.map(String) : [])])];
      const points = db.qcPoints.filter((p: any) => ids.includes(p.test_id));
      const configuredLevels = db.testLevels.filter((level: any) => ids.includes(level.test_id)).some((level: any) =>
        level.mean != null || level.sd != null || level.qc_lot_id || !['', '[]'].includes(String(level.mean_sd_history_json || '').trim()));
      const hasSigma = db.sigmaPeriods.some((period: any) => ids.includes(period.testId || period.test_id));
      const hasNce = db.nceRecords.some((record: any) => ids.includes(record.test_id));
      if (points.length || configuredLevels || hasSigma || hasNce) {
        return fail('has-history', `Không thể xoá "${test.name}" vì đã có dữ liệu QC hoặc lịch sử cấu hình. Hãy chọn “Ngừng sử dụng” để giữ nguyên hồ sơ.`);
      }
      db.testLevels = db.testLevels.filter((l: any) => !ids.includes(l.test_id));
      db.qcPanels.forEach((p: any) => { p.testIds = (p.testIds || []).filter((id: string) => !ids.includes(id)); });
      db.tests = db.tests.filter((t: any) => !ids.includes(t.id));
      logActivity('Xoá xét nghiệm', `Xoá cấu hình chưa phát sinh dữ liệu "${test.name}" trên ${ids.length} máy`, test.name); saveDb();
      return ok({ id: test.id, pointsCount: 0 });
    },
    async removePanel(input) {
      const db = getDb(); const a = currentActor(); if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị mới được thực hiện thao tác này.');
      const panel = db.qcPanels.find((p: any) => p.id === input.id); if (!panel) return fail('not-found', 'Không tìm thấy Panel QC.');
      if (db.lotTransitions.some((tr: any) => tr.panel_id === panel.id)) {
        return fail('used-by-transition', 'Panel này đang có lịch sử chuyển tiếp lô. Hãy xóa/chuyển các dòng chuyển tiếp trước.');
      }
      db.qcPanels = db.qcPanels.filter((p: any) => p.id !== panel.id);
      logActivity('Xoá Panel QC', `Xoá Panel QC "${panel.name}"`, panel.name); saveDb();
      return ok({ id: panel.id });
    },
    async removeLot(input) {
      const db = getDb(); const a = currentActor(); if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị mới được thực hiện thao tác này.');
      const lot = db.qcLots.find((l) => l.id === input.id); if (!lot) return fail('not-found', 'Không tìm thấy lô QC.');
      if (db.testLevels.some((l) => l.qc_lot_id === lot.id)) return fail('used-by-assay', 'Lô QC này đang được gắn với xét nghiệm. Hãy đổi lô trong xét nghiệm trước.');
      if (db.lotTransitions.some((tr) => (tr.from_lot_id === lot.id || tr.to_lot_id === lot.id) && tr.status === 'accepted')) {
        return fail('used-by-accepted-transition', 'Lô QC này có hồ sơ chuyển tiếp đã kết luận (đã áp vào cấu hình/Mean-SD). Không thể xoá lô trực tiếp — nếu thực sự cần, hãy xử lý hồ sơ chuyển tiếp đó trước.');
      }
      db.lotTransitions = db.lotTransitions.filter((tr) => tr.from_lot_id !== lot.id && tr.to_lot_id !== lot.id);
      db.qcLots = db.qcLots.filter((l) => l.id !== lot.id);
      db.lotGroups.forEach((g) => { g.lotIds = (g.lotIds || []).filter((id: string) => id !== lot.id); });
      logActivity('Xoá lô QC', `Xoá lô "${lot.lot_no}"`, lot.lot_no); saveDb();
      return ok({ id: lot.id });
    },
    async removeLotGroup(input) {
      const db = getDb(); const a = currentActor(); if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị mới được thực hiện thao tác này.');
      const group = db.lotGroups.find((g) => g.id === input.id); if (!group) return fail('not-found', 'Không tìm thấy nhóm lô QC.');
      const lotIds = db.qcLots.filter((l) => l.group_id === group.id).map((l) => l.id);
      if (db.testLevels.some((l) => lotIds.includes(l.qc_lot_id))) return fail('used-by-assay', 'Nhóm lô này đang được gán Mean/SD cho xét nghiệm. Hãy đổi nhóm/lô ở thẻ Mean/SD trước khi xoá nhóm.');
      db.qcLots.forEach((l) => { if (l.group_id === group.id) l.group_id = null; });
      db.lotGroups = db.lotGroups.filter((g) => g.id !== group.id);
      logActivity('Xoá nhóm lô QC', `Xoá nhóm "${group.name}" (các lô bên trong được giữ lại)`, group.name); saveDb();
      return ok({ id: group.id });
    },
    async stopLotGroup(input) {
      const db = getDb(); const a = currentActor(); if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị mới được thực hiện thao tác này.');
      const group = db.lotGroups.find((g) => g.id === input.id); if (!group) return fail('not-found', 'Không tìm thấy nhóm lô QC.');
      // "Đang hoạt động" là trạng thái SUY (`inUse`), không phải literal
      // 'active' — cùng lý do đã sửa ở main/ipc/config-handlers.ts.
      const groupLotIds = db.qcLots.filter((l) => l.group_id === group.id).map((l) => l.id);
      const inUseNow = groupLotIds.some((lotId) => db.testLevels.some((tl: any) => tl.qc_lot_id === lotId));
      if (group.status === 'stopped' || group.status === 'planned' || !inUseNow) return fail('not-stoppable', 'Chỉ dừng được nhóm lô đang chạy.');
      group.status = 'stopped'; group.stopped_at = nowIso();
      logActivity('Dừng nhóm lô QC', `Dừng nhóm "${group.name}"`, group.name); saveDb();
      return ok({ id: group.id });
    },
    async previewLotRename(input) {
      const db = getDb();
      const existing = db.qcLots.find((l) => l.id === input.id);
      if (!existing) return ok({ rename: null });
      const newLotNo = String(input.lotNo || '').trim();
      if (!newLotNo || newLotNo === existing.lot_no) return ok({ rename: null });
      const rows = db.qcPoints.filter((p: any) => p.level === existing.level && (p.lot || '') === existing.lot_no);
      const lockedPeriods = [...new Set(rows.map((p: any) => String(p.date).slice(0, 7)))]
        .filter((ym) => db.periodLocks.some((lock: any) => lock.ym === ym)).sort();
      const lockedCount = rows.filter((p: any) => lockedPeriods.includes(String(p.date).slice(0, 7))).length;
      return ok({ rename: { oldLotNo: existing.lot_no, newLotNo, affected: rows.length, lockedCount, lockedPeriods } });
    },
    async activateLotGroup(input) {
      const db = getDb(); const a = currentActor(); if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị mới được thực hiện thao tác này.');
      const group = db.lotGroups.find((g) => g.id === input.id); if (!group) return fail('not-found', 'Không tìm thấy nhóm lô QC.');
      const lots = db.qcLots.filter((l) => l.group_id === group.id);
      if (!lots.length) return fail('empty-group', 'Nhóm lô này chưa có lô QC nào.');
      const finite = (value: unknown) => Number.isFinite(Number(value));
      const snapshotFor = (level: any, lotId: string) => {
        if (level.qc_lot_id === lotId && finite(level.mean) && finite(level.sd)) {
          return { mean: Number(level.mean), sd: Number(level.sd), low: level.low, high: level.high };
        }
        let history: any[] = [];
        try { const parsed = JSON.parse(level.mean_sd_history_json || '[]'); if (Array.isArray(parsed)) history = parsed; } catch { history = []; }
        const found = [...history].reverse().find((entry) => entry.qcLotId === lotId && finite(entry.mean) && finite(entry.sd));
        return found ? { mean: Number(found.mean), sd: Number(found.sd), low: found.low ?? null, high: found.high ?? null } : null;
      };
      const candidates: any[] = [];
      for (const lot of lots) {
        for (const level of db.testLevels.filter((tl: any) => tl.level === lot.level)) {
          if (level.qc_lot_id === lot.id) continue;
          const snapshot = snapshotFor(level, lot.id);
          if (!snapshot || !(snapshot.sd > 0)) continue;
          candidates.push({ level, lot, snapshot });
        }
      }
      const at = nowIso();
      if (!candidates.length) {
        const inUse = lots.some((lot) => db.testLevels.some((tl: any) => tl.qc_lot_id === lot.id));
        if (!inUse) return fail('unready', 'Chưa mức QC nào có Mean/SD đã lưu cho lô của nhóm này. Hãy nhập Mean/SD cho lô mới trước khi kích hoạt.');
        group.status = ''; group.stopped_at = '';
        logActivity('Kích hoạt nhóm lô QC', `Nhóm "${group.name}" đã đang được dùng, không có mức nào cần áp thêm`, group.name);
        saveDb();
        return ok({ status: 'already-active' as const, applied: 0, stoppedGroups: [] });
      }
      const stopped = new Set<string>();
      for (const { level, lot, snapshot } of candidates) {
        const oldLot = level.qc_lot_id ? db.qcLots.find((l) => l.id === level.qc_lot_id) : undefined;
        if (level.qc_lot_id) {
          const owner = db.qcLots.find((l) => l.id === level.qc_lot_id);
          if (owner && owner.group_id && owner.group_id !== group.id) stopped.add(owner.group_id);
        }
        level.mean_sd_history_json = appendMeanSdHistory(level.mean_sd_history_json, {
          mean: level.mean, sd: level.sd, low: level.low, high: level.high, qcLotId: level.qc_lot_id || '', lot: oldLot?.lot_no || '',
          effectiveFrom: level.mean_sd_effective_from || oldLot?.opened || '', effectiveTo: lot.opened || at.slice(0, 10), source: level.applied,
        }, at);
        // 'mfg' (NSX), không phải 'lab' — cùng lý do đã sửa ở createLotTransition.
        level.qc_lot_id = lot.id; level.applied = 'mfg';
        level.mean = snapshot.mean; level.sd = snapshot.sd; level.low = snapshot.low; level.high = snapshot.high;
        level.mean_sd_effective_from = lot.opened || at.slice(0, 10);
      }
      for (const id of stopped) {
        const target = db.lotGroups.find((g) => g.id === id);
        if (target) { target.status = 'stopped'; target.stopped_at = at; }
      }
      group.status = ''; group.stopped_at = '';
      logActivity('Kích hoạt nhóm lô QC',
        `Nhóm "${group.name}": áp Mean/SD cho ${candidates.length} mức QC`
        + (stopped.size ? `, dừng ${stopped.size} nhóm lô bị thay thế` : ''), group.name);
      saveDb();
      return ok({ status: 'applied' as const, applied: candidates.length, stoppedGroups: [...stopped] });
    },
    async removeLotTransition(input) {
      const db = getDb(); const a = currentActor(); if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị mới được thực hiện thao tác này.');
      const tr = db.lotTransitions.find((x) => x.id === input.id); if (!tr) return fail('not-found', 'Không tìm thấy hồ sơ chuyển lô.');
      // 'accepted' (không phải 'concluded' — vocabulary cũ, đã đổi lại
      // 2026-09-03) mới là trạng thái khoá vĩnh viễn không xoá được — cùng
      // lý do đã sửa ở main/ipc/config-handlers.ts.
      if (tr.status === 'accepted') return fail('accepted-applied', 'Hồ sơ đã chấp nhận lô mới và đã áp dụng vào nhóm lô/Mean-SD, không nên xóa trực tiếp. Nếu nhập sai, hãy tạo hồ sơ chuyển tiếp mới hoặc chỉnh nhóm lô/Mean-SD thủ công.');
      const lotLabel = (lotId: string) => { const lot = db.qcLots.find((l) => l.id === lotId); return lot ? `${lot.lot_no} · Mức ${lot.level}` : 'Chưa chọn lô'; };
      const detail = `${lotLabel(tr.from_lot_id)} → ${lotLabel(tr.to_lot_id)}`;
      db.lotTransitions = db.lotTransitions.filter((x) => x.id !== tr.id);
      logActivity('Xoá hồ sơ chuyển lô', detail, 'Chuyển tiếp lô'); saveDb();
      return ok({ id: tr.id });
    },
    async listLotGroups() {
      const db = getDb();
      return db.lotGroups.map((g: any) => {
        const liveLotIds = db.qcLots.filter((l) => l.group_id === g.id).map((l) => l.id);
        const inUse = liveLotIds.some((lotId) => db.testLevels.some((tl: any) => tl.qc_lot_id === lotId));
        // Nhóm "Đã lưu trữ" hiện lotIds từ ẢNH CHỤP đã chốt — cùng logic đã
        // sửa ở main/ipc/config-handlers.ts.
        let lotIds = liveLotIds;
        if (g.archived_lot_ids_json) {
          try {
            const parsed = JSON.parse(g.archived_lot_ids_json);
            if (Array.isArray(parsed)) lotIds = parsed;
          } catch { /* JSON hỏng thì rơi về danh sách sống */ }
        }
        return { ...g, lotIds, inUse };
      }).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    },
    async saveLotGroup(input) {
      const db = getDb();
      const requestedLotIds = Array.isArray((input.data as any).lotIds)
        ? [...new Set((input.data as any).lotIds.map((value: unknown) => String(value || '').trim()).filter(Boolean))] as string[]
        : [];
      const fallbackName = requestedLotIds.map((lotId) => db.qcLots.find((lot) => lot.id === lotId)?.lot_no).filter(Boolean).join('/');
      const result = validateLotGroup(input.data as any, fallbackName); if (!result.ok) return fail(result.code, result.message);
      const knownLots = new Set(db.qcLots.map((l) => l.id));
      const validLotIds = result.data.lotIds.filter((l) => knownLots.has(l));
      if (validLotIds.length < 2) return fail('not-enough-lots', 'Nhóm lô QC cần ít nhất 2 lô hợp lệ.');
      // Chặn trùng nhóm lô (tên hoặc trùng nguyên bộ lô) — cùng logic đã sửa
      // ở main/ipc/config-handlers.ts.
      const validLotIdSet = new Set(validLotIds);
      const dup = db.lotGroups.some((g) => {
        if (g.id === (input.id || '')) return false;
        if (sameText(g.name, result.data.name)) return true;
        const otherLotIds = db.qcLots.filter((l) => l.group_id === g.id).map((l) => l.id);
        return otherLotIds.length === validLotIdSet.size && otherLotIds.every((l) => validLotIdSet.has(l));
      });
      if (dup) return fail('duplicate-group', 'Nhóm lô này đã tồn tại hoặc trùng danh sách lô.');
      let group = input.id ? db.lotGroups.find((g) => g.id === input.id) : undefined;
      // `archived_lot_ids_json` — cột thật (main/db/schema.ts) luôn tồn tại
      // dù rỗng (NOT NULL DEFAULT ''); khai rõ ở đây để hình dạng object
      // khớp `SELECT *` thật (tests/mock-parity.test.mjs khoá đúng chỗ này).
      const row = { name: result.data.name, manufacturer: result.data.manufacturer, material: result.data.material, catalog: result.data.catalog, note: result.data.note, active: result.data.active ? 1 : 0, status: result.data.status, stopped_at: '', archived_lot_ids_json: group?.archived_lot_ids_json || '' };
      if (group) { Object.assign(group, row); } else { group = { id: uid(), ...row }; db.lotGroups.push(group); }
      for (const lot of db.qcLots) if (lot.group_id === group.id) lot.group_id = null;
      for (const lotId of validLotIds) { const lot = db.qcLots.find((l) => l.id === lotId); if (lot) lot.group_id = group!.id; }
      logActivity(input.id ? 'Sửa nhóm lô QC' : 'Thêm nhóm lô QC', `Nhóm "${result.data.name}" (${validLotIds.length} lô)`, result.data.name);
      saveDb(); return ok({ ...group, lotIds: validLotIds });
    },
    async listPanels() {
      const db = getDb();
      return db.qcPanels.map((p) => ({ ...p, testIds: db.qcPanels.filter((x) => x.id === p.id).length ? (p.testIds || []) : [] })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    },
    async savePanel(input) {
      const db = getDb();
      const knownInstrumentIds = new Set(db.instruments.map((i) => i.id));
      const result = validatePanel(input.data as any, knownInstrumentIds); if (!result.ok) return fail(result.code, result.message);
      // 3 cổng port từ app cũ — cùng lý do đã sửa ở main/ipc/config-handlers.ts.
      if (!result.data.testIds.length) return fail('missing-tests', 'Chọn ít nhất một xét nghiệm.');
      const testRows = db.tests.filter((t) => result.data.testIds.includes(t.id));
      const knownTests = new Set(testRows.map((t) => t.id));
      const validTestIds = result.data.testIds.filter((t) => knownTests.has(t));
      if (!validTestIds.length) return fail('missing-tests', 'Chọn ít nhất một xét nghiệm hợp lệ.');
      if (validTestIds.length !== result.data.testIds.length) return fail('wrong-instrument', 'Panel QC chỉ được chứa xét nghiệm thuộc máy đã chọn.');
      if (testRows.some((t) => t.instrument_id !== result.data.instrumentId)) return fail('wrong-instrument', 'Panel QC chỉ được chứa xét nghiệm thuộc máy đã chọn.');
      const sameInstrumentNames = db.qcPanels.filter((p) => p.id !== (input.id || '') && p.instrument_id === result.data.instrumentId).map((p) => p.name);
      if (sameInstrumentNames.some((existingName) => sameText(existingName, result.data.name))) return fail('duplicate-panel', 'Panel QC này đã tồn tại trên máy đã chọn.');
      const row = { name: result.data.name, instrument_id: result.data.instrumentId, note: result.data.note, active: result.data.active ? 1 : 0, testIds: validTestIds };
      if (input.id) {
        const existing = db.qcPanels.find((p) => p.id === input.id); if (!existing) return fail('not-found', 'Không tìm thấy Panel QC cần cập nhật.');
        Object.assign(existing, row);
        logActivity('Sửa Panel QC', `Panel "${result.data.name}" (${validTestIds.length} xét nghiệm)`, result.data.name);
        saveDb(); return ok(existing);
      }
      const newRow = { id: uid(), ...row }; db.qcPanels.push(newRow);
      logActivity('Thêm Panel QC', `Panel "${result.data.name}" (${validTestIds.length} xét nghiệm)`, result.data.name);
      saveDb(); return ok(newRow);
    },
    async listLotTransitions() { return [...getDb().lotTransitions].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || '')); },
    async createLotTransition(input) {
      // Mô hình 1 hàm lưu duy nhất, khớp `createLotTransition` main thật
      // (2026-09-03 — modal có 1 ô Trạng thái chọn được cả 4 giá trị + 1 nút
      // Lưu, không phải các nút hành động tách rời). Xem chi tiết từng nhánh
      // trong `main/ipc/config-handlers.ts`.
      const db = getDb();
      const result = validateLotTransition(input.data as any); if (!result.ok) return fail(result.code, result.message);
      const { panelId, fromLotId, toLotId, startDate, note } = result.data as any;
      const panel = db.qcPanels.find((p) => p.id === panelId); if (!panel) return fail('not-found', 'Không tìm thấy Panel QC.');
      const fromLot = db.qcLots.find((l: any) => l.id === fromLotId);
      const toLot = db.qcLots.find((l: any) => l.id === toLotId);
      if (!fromLot || !toLot) return fail('not-found', 'Không tìm thấy lô QC đã chọn.');
      if (fromLot.level !== toLot.level) return fail('different-levels', 'Lô cũ và lô mới phải cùng mức QC để chuyển tiếp.');

      const existing = input.id ? db.lotTransitions.find((x) => x.id === input.id) : undefined;
      if (input.id && !existing) return fail('not-found', 'Không tìm thấy hồ sơ chuyển lô.');
      // `status` thiếu khi SỬA thì giữ nguyên trạng thái cũ — cùng lý do với
      // `main/ipc/config-handlers.ts`.
      const status = typeof (input.data as any).status === 'string' && (input.data as any).status
        ? (result.data as any).status
        : existing ? existing.status : 'planned';
      if (existing && existing.status === 'accepted' && status !== 'accepted') {
        return fail('accepted-immutable', 'Hồ sơ đã chấp nhận lô mới và đã áp dụng vào nhóm lô/Mean-SD, không thể đổi ngược trạng thái.');
      }
      const dup = db.lotTransitions.find((t) => t.id !== (input.id || '') && t.panel_id === panelId && t.from_lot_id === fromLotId && t.to_lot_id === toLotId);
      if (dup) return fail('duplicate-transition', 'Chuyển tiếp lô này đã tồn tại.');

      const finalChanged = (status === 'accepted' || status === 'rejected') && (!existing || existing.status !== status);
      const criteria: { testId: string; level: number; mean: number; sd: number; low?: number | null; high?: number | null }[] = (input.data as any).criteria || [];

      if (status === 'accepted' && finalChanged) {
        const panelTests = (panel.testIds || []).map((id: string) => db.tests.find((t: any) => t.id === id)).filter(Boolean);
        const rows = panelTests
          .map((t: any) => ({ t, level: db.testLevels.find((l: any) => l.test_id === t.id && l.qc_lot_id === fromLotId) }))
          .filter((row: any) => row.level);
        if (!rows.length) return fail('no-target-tests', 'Panel đã chọn không có xét nghiệm nào đang sử dụng lô cũ. Hãy kiểm tra lại Panel và lô chuyển tiếp.');
        const missing = rows.filter((row: any) => !criteria.some((c) => c.testId === row.t.id
          && c.level === row.level.level && Number.isFinite(Number(c.mean))
          && Number.isFinite(Number(c.sd)) && Number(c.sd) > 0));
        if (missing.length) {
          return fail('missing-target', `Chưa thể chấp nhận lô mới: ${missing.map((row: any) => row.t.name).join(', ')} chưa có Mean/SD hợp lệ cho lô ${toLot.lot_no}. Hãy điền đủ ở bảng Mean/SD phía trên rồi lưu lại.`);
        }
      }

      const at = nowIso();
      const criteria_json = JSON.stringify(criteria);
      const approved_at = finalChanged ? at : existing?.approved_at || '';
      const approved_by = finalChanged ? (currentActor()?.username || '') : existing?.approved_by || '';
      let record: any;
      if (existing) {
        Object.assign(existing, { panel_id: panelId, from_lot_id: fromLotId, to_lot_id: toLotId, start_date: startDate, status, note, criteria_json, approved_at, approved_by });
        record = existing;
      } else {
        record = { id: uid(), panel_id: panelId, from_lot_id: fromLotId, to_lot_id: toLotId, start_date: startDate, status, criteria_json, conclusion: '', approved_at, approved_by, note };
        db.lotTransitions.push(record);
      }
      if (status === 'accepted' && finalChanged) {
        for (const item of criteria) {
          const level = db.testLevels.find((l: any) => l.test_id === item.testId && l.level === item.level);
          if (!level || level.qc_lot_id !== fromLotId) continue;
          level.mean_sd_history_json = appendMeanSdHistory(level.mean_sd_history_json, {
            mean: level.mean, sd: level.sd, low: level.low, high: level.high, qcLotId: level.qc_lot_id || '', lot: fromLot.lot_no,
            effectiveFrom: level.mean_sd_effective_from || fromLot.opened || '', effectiveTo: startDate || toLot.opened || at.slice(0, 10), source: level.applied,
          }, at);
          // 'mfg' (NSX), không phải 'lab' — cùng lý do đã sửa ở createLotTransition main.
          level.qc_lot_id = toLotId; level.mean = item.mean; level.sd = item.sd; level.low = item.low ?? null; level.high = item.high ?? null; level.applied = 'mfg';
          level.mean_sd_effective_from = toLot.opened || startDate || at.slice(0, 10);
        }
        fromLot.depleted = 1;
        // Port ĐÚNG `applyAcceptedLotTransition()` app cũ — cùng logic với
        // `main/ipc/config-handlers.ts`: LƯU TRỮ nguyên trạng thái CŨ của
        // nhóm thành một bản ghi riêng (giữ lô cũ làm thành viên), nhóm
        // ĐANG HOẠT ĐỘNG giữ nguyên id gốc, chỉ thay lô cũ bằng lô mới
        // trong thành viên + tự đổi tên nếu đang là tên tự đặt.
        if (fromLot.group_id) {
          const group = db.lotGroups.find((g: any) => g.id === fromLot.group_id);
          if (group) {
            const members = db.qcLots.filter((l: any) => l.group_id === group.id).map((l: any) => ({ id: l.id, lot_no: l.lot_no }));
            const oldName = members.map((m: any) => m.lot_no).join('/');
            const autoNamed = !group.name || group.name === oldName;
            // archived_lot_ids_json: ảnh chụp NGUYÊN VẸN thành viên cũ (kể
            // cả lô KHÔNG chuyển tiếp) — cùng logic đã sửa ở main.
            const archived = {
              id: uid(), name: group.name, manufacturer: group.manufacturer, material: group.material, catalog: group.catalog,
              note: `Đã dùng khi chuyển tiếp lô ${fromLot.lot_no} sang ${toLot.lot_no}`, active: 0, status: 'stopped', stopped_at: startDate || at,
              archived_lot_ids_json: JSON.stringify(members.map((m: any) => m.id)),
            };
            db.lotGroups.push(archived);
            fromLot.group_id = archived.id;
            toLot.group_id = group.id;
            if (autoNamed) {
              const newName = members.map((m: any) => (m.id === fromLotId ? toLot.lot_no : m.lot_no)).join('/');
              if (newName !== group.name) group.name = newName;
            }
          }
        }
      }
      const statusText: Record<string, string> = { planned: 'Dự kiến', active: 'Đang chạy song song', accepted: 'Chấp nhận lô mới', rejected: 'Không chấp nhận' };
      logActivity(existing ? 'Sửa hồ sơ chuyển lô' : 'Thêm hồ sơ chuyển lô', `${panel.name}: ${fromLot.lot_no} → ${toLot.lot_no} · ${statusText[status]}`, panel.name);
      if (status === 'accepted' && finalChanged) {
        logActivity('Áp dụng chuyển tiếp lô', `${panel.name} · ${fromLot.lot_no} → ${toLot.lot_no} · ${criteria.length} xét nghiệm`, panel.name);
      }
      saveDb(); return ok(record);
    },
    async listTeaRefs() { return [...getDb().teaRefs].sort((a, b) => a.name.localeCompare(b.name, 'vi')); },
    async saveTeaRef(input) {
      const db = getDb();
      const result = validateTeaRef(input.data as any); if (!result.ok) return fail(result.code, result.message);
      const sources_json = JSON.stringify({ reference: result.data.reference, reason: result.data.reason, effectiveDate: result.data.effectiveDate, approvedDate: result.data.approvedDate, approvedBy: result.data.approvedBy });
      const row = { name: result.data.name, unit: result.data.unit, section: result.data.section, lab: result.data.labValue, lab_source: result.data.labSource, lab_prepared_by: result.data.preparedBy, lab_next_review_date: result.data.nextReviewDate, sources_json };
      // dd/mm/yyyy + đầy đủ trường tuân thủ trong audit — cùng logic đã sửa
      // ở main/ipc/config-handlers.ts.
      const dmy = (value: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); return m ? `${m[3]}/${m[2]}/${m[1]}` : value; };
      const sourceLabel = TEA_LAB_SOURCE_LABELS[result.data.labSource] || result.data.labSource;
      const detailOf = (before: number | null) =>
        `${result.data.name} · ${before ?? '—'}% → ${result.data.labValue}% · ${sourceLabel} · ${result.data.reference} · Hiệu lực ${dmy(result.data.effectiveDate)}`
        + ` · Xây dựng: ${result.data.preparedBy} · Phê duyệt: ${result.data.approvedBy} (${dmy(result.data.approvedDate)})`
        + `${result.data.nextReviewDate ? ' · Xem xét lại ' + dmy(result.data.nextReviewDate) : ''} · Lý do: ${result.data.reason}`;
      if (input.id) {
        const existing = db.teaRefs.find((r) => r.id === input.id); if (!existing) return fail('not-found', 'Không tìm thấy hồ sơ TEa cần cập nhật.');
        const beforeLab = existing.lab;
        Object.assign(existing, row);
        logActivity(beforeLab == null ? 'Thiết lập TEa chuẩn hóa' : 'Cập nhật TEa chuẩn hóa', detailOf(beforeLab), result.data.name);
        saveDb(); return ok(existing);
      }
      // 11 cột dưới đây schema thật (bảng `tea_refs`) có mặc định sẵn.
      const newRow = {
        id: uid(), analyte_id: '', display_name: '', standard_name: '', abbreviation: '', aliases_json: '[]',
        matrix: '', clia: null, ricos: null, clia_rule: '', clia_absolute: null, clia_absolute_unit: '',
        ...row,
      };
      db.teaRefs.push(newRow);
      logActivity('Thiết lập TEa chuẩn hóa', detailOf(null), result.data.name);
      saveDb(); return ok(newRow);
    },
    async removeTeaRef(input) {
      const db = getDb();
      const existing = db.teaRefs.find((r) => r.id === input.id); if (!existing) return fail('not-found', 'Không tìm thấy hồ sơ TEa.');
      db.teaRefs = db.teaRefs.filter((r) => r.id !== input.id);
      logActivity('Xoá hồ sơ TEa', `Xoá "${existing.name}"`, existing.name);
      saveDb(); return ok({ id: input.id });
    },
    // Xoá RIÊNG hồ sơ TEa PXN — cùng logic đã sửa ở main/ipc/config-handlers.ts.
    async removeTeaLabProfile(input) {
      const db = getDb();
      const existing = db.teaRefs.find((r: any) => r.id === input.id) as any;
      if (!existing) return fail('not-found', 'Không tìm thấy hồ sơ TEa.');
      if (existing.lab == null) return ok({ id: input.id, removedRecord: false });
      const labValue = Number(existing.lab);
      existing.lab = null; existing.lab_source = ''; existing.lab_prepared_by = ''; existing.lab_next_review_date = ''; existing.sources_json = '{}';
      const isCustomAnalyte = !!(existing.abbreviation || existing.matrix);
      const removedRecord = !isCustomAnalyte && existing.clia == null && existing.ricos == null;
      if (removedRecord) db.teaRefs = db.teaRefs.filter((r: any) => r.id !== input.id);
      logActivity('Xóa TEa chuẩn hóa', `${existing.name} · ${labValue.toFixed(2)}%`, existing.name);
      saveDb(); return ok({ id: input.id, removedRecord });
    },

    // ---- Nhật ký hoạt động ----
    async queryActivity(input) {
      const filtered = filterActivity(getDb().activity as any, String(input.query || ''), String(input.from || ''), String(input.to || ''));
      return { ...paginateActivity(filtered, Number(input.page) || 1, Number(input.pageSize) || 25), total: getDb().activity.length } as any;
    },
    async exportActivityCsv(input) {
      const filtered = filterActivity(getDb().activity as any, String(input.query || ''), String(input.from || ''), String(input.to || ''));
      const header = ['seq', 'ts', 'user', 'username', 'role', 'type', 'detail', 'target'];
      // Escape ĐÚNG như `toCsvValue()` của bản thật (audit-handlers.ts) —
      // thiếu nó thì mọi chi tiết có dấu phẩy hoặc ngoặc kép (vd
      // 'Nhóm "Nhom 1" (2 lô)') làm vỡ cấu trúc cột của file CSV tải về.
      const csvValue = (value: unknown) => {
        const s = String(value ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      return [header.join(','), ...filtered.map((r: any) => header.map((h) => csvValue(r[h])).join(','))].join('\n');
    },
    async verifyActivityChainNow() {
      // Chế độ xem giao diện KHÔNG băm hash thật (không có node:crypto trong
      // trình duyệt) — mọi dòng đều coi là "legacy" (không có hash/prevHash),
      // giống hệt cách verifyAuditChain() thật xử lý dòng không hash.
      return { ok: true, checked: 0, legacy: getDb().activity.length, brokenIndex: -1, reason: '' };
    },
    async archiveActivity(input) {
      const db = getDb();
      const months = Math.round(Number((input.data as any).months));
      if (![12, 24, 36].includes(months)) return fail('invalid-months', 'Chỉ chấp nhận 12, 24 hoặc 36 tháng.');
      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months);
      const before = db.activity.length;
      db.activity = db.activity.filter((a) => a.ts >= cutoff.toISOString());
      saveDb(); return ok({ removedCount: before - db.activity.length });
    },

    // ---- Nhập QC ----
    async queryPoints(testId, level) { return queryPointsView(testId, level) as any; },
    async listEntryHistoryPoints(testId) {
      return getDb().qcPoints.filter((point) => point.test_id === testId && !point.voided)
        .sort((a, b) => a.level - b.level || a.date.localeCompare(b.date) || a.run_id.localeCompare(b.run_id, 'vi', { numeric: true }))
        .map((point) => {
          const z = point.qc_mean != null && point.qc_sd != null && point.qc_sd > 0 ? (point.val - point.qc_mean) / point.qc_sd : NaN;
          return { ...point, verdict: !Number.isFinite(z) || Math.abs(z) <= 2 ? 'ok' : Math.abs(z) <= 3 ? 'warn' : 'rej', rules: [] };
        }) as any;
    },
    async listVoidedEntryPoints(testId) {
      return getDb().qcPoints.filter((point) => point.test_id === testId && point.voided)
        .sort((a, b) => a.date.localeCompare(b.date) || a.run_id.localeCompare(b.run_id, 'vi', { numeric: true })) as any;
    },
    async listParallelEntryColumns(testId) { return parallelMockColumns(testId) as any; },
    async listPreviousEntryLotSeries(testId) { return previousMockLotSeries(testId) as any; },
    async getRangeCandidate(testId, level) {
      const db = getDb(), test = db.tests.find((t) => t.id === testId), config = db.testLevels.find((l) => l.test_id === testId && l.level === level);
      if (!test || !config) return fail('not-found', 'Không tìm thấy mức QC.');
      const lot = config.qc_lot_id ? db.qcLots.find((l) => l.id === config.qc_lot_id)?.lot_no || '' : '';
      const active = activeMockEvaluation(testId), rows = active.levels.find((item) => item.level === level)?.pts || [];
      const c = evaluateRangeCandidate(rows.map((p) => ({ date: p.date, val: p.val, verdict: active.byPoint.get(p)?.level || 'ok' })));
      const se = new Set(WG_RULE_REGISTRY.filter((r) => r.err === 'SE').map((r) => r.id));
      const nce = [...db.nceRecords].reverse().find((a) => a.test_id === testId && a.level === level && a.record_status !== 'cancelled' && String(a.rule || '').split(',').some((r) => se.has(r.trim())));
      const tea = test.tea != null && test.tea > 0 ? test.tea : null;
      return ok({ testId, level, lot, source: config.applied, current: { mean: config.mean, sd: config.sd, cv: config.mean && config.sd != null ? config.sd / Math.abs(config.mean) * 100 : null }, manufacturer: { mean: config.mfg_mean, sd: config.mfg_sd }, proposed: c ? { n: c.n, days: c.days, mean: c.m, sd: c.sd, cv: c.cv, rejected: c.rejected, warnings: c.warnings } : null, safety: { needed: !!nce, nceId: nce?.nce_id || null, tea, biasThreshold: tea != null ? tea / 4 : null }, eligible: !!c?.eligible, canRevert: config.applied === 'lab' && config.mfg_mean != null && config.mfg_sd != null && config.mfg_sd > 0 } as any);
    },
    async applyLabRange(input) {
      const actor = currentActor(); if (!actor || actor.role === 'viewer') return fail('forbidden', 'Tài khoản chỉ có quyền xem.');
      const reason = validateRangeReason(input.data.reason, 10); if (!reason) return fail('reason-too-short', 'Cần ghi lý do thiết lập dải tối thiểu 10 ký tự.');
      const candidate = await this.getRangeCandidate(input.data.testId, input.data.level); if (!candidate.ok) return candidate;
      if (!candidate.data.eligible || !candidate.data.proposed) return fail('not-eligible', 'Dữ liệu chưa đủ điều kiện lập dải kiểm soát mới.');
      if (candidate.data.safety.needed) {
        const threshold = candidate.data.safety.biasThreshold, bias = Number(input.data.bias);
        if (!input.data.causeConfirmed) return fail('cause-not-confirmed', 'Cần xác nhận đã xử lý nguyên nhân sai số hệ thống trước khi đổi dải.');
        if (threshold == null) return fail('missing-tea', 'Xét nghiệm chưa có TEa để kiểm tra Bias trước khi đổi dải.');
        if (!Number.isFinite(bias) || Math.abs(bias) > threshold) return fail('bias-out-of-range', `Bias phải nằm trong ±${threshold.toFixed(2)}% (TEa/4).`);
      }
      const db = getDb(), levelRow = db.testLevels.find((l) => l.test_id === input.data.testId && l.level === input.data.level)!;
      const lotRow = levelRow.qc_lot_id ? db.qcLots.find((l) => l.id === levelRow.qc_lot_id) : undefined;
      const changedAt = nowIso();
      levelRow.mean_sd_history_json = appendMeanSdHistory(levelRow.mean_sd_history_json, {
        mean: levelRow.mean, sd: levelRow.sd, low: levelRow.low, high: levelRow.high, qcLotId: levelRow.qc_lot_id || '', lot: lotRow?.lot_no || '',
        effectiveFrom: levelRow.mean_sd_effective_from || lotRow?.opened || '', effectiveTo: changedAt.slice(0, 10), source: levelRow.applied,
      }, changedAt);
      levelRow.mfg_mean ??= levelRow.mean; levelRow.mfg_sd ??= levelRow.sd;
      Object.assign(levelRow, { mean: candidate.data.proposed.mean, sd: candidate.data.proposed.sd, low: candidate.data.proposed.mean - 2 * candidate.data.proposed.sd, high: candidate.data.proposed.mean + 2 * candidate.data.proposed.sd, range_k: 2, applied: 'lab', mean_sd_effective_from: nowIso().slice(0, 10) });
      logActivity('Thiết lập dải QC mới', `Mức ${input.data.level}: ${reason}`, input.data.testId); saveDb();
      return this.getRangeCandidate(input.data.testId, input.data.level);
    },
    async revertManufacturerRange(input) {
      const actor = currentActor(); if (!actor || actor.role === 'viewer') return fail('forbidden', 'Tài khoản chỉ có quyền xem.');
      const reason = validateRangeReason(input.data.reason, 5); if (!reason) return fail('reason-too-short', 'Cần ghi lý do hoàn dải tối thiểu 5 ký tự.');
      const candidate = await this.getRangeCandidate(input.data.testId, input.data.level); if (!candidate.ok) return candidate;
      if (!candidate.data.canRevert || candidate.data.manufacturer.mean == null || candidate.data.manufacturer.sd == null) return fail('cannot-revert', 'Mức QC chưa có dải nhà sản xuất hợp lệ để hoàn lại.');
      const levelRow = getDb().testLevels.find((l) => l.test_id === input.data.testId && l.level === input.data.level)!;
      const m = candidate.data.manufacturer.mean, sd = candidate.data.manufacturer.sd;
      const lotRow = levelRow.qc_lot_id ? getDb().qcLots.find((l) => l.id === levelRow.qc_lot_id) : undefined;
      const changedAt = nowIso();
      levelRow.mean_sd_history_json = appendMeanSdHistory(levelRow.mean_sd_history_json, {
        mean: levelRow.mean, sd: levelRow.sd, low: levelRow.low, high: levelRow.high, qcLotId: levelRow.qc_lot_id || '', lot: lotRow?.lot_no || '',
        effectiveFrom: levelRow.mean_sd_effective_from || lotRow?.opened || '', effectiveTo: changedAt.slice(0, 10), source: levelRow.applied,
      }, changedAt);
      Object.assign(levelRow, { mean: m, sd, low: m - 2 * sd, high: m + 2 * sd, range_k: 2, applied: 'mfg', mean_sd_effective_from: nowIso().slice(0, 10) });
      logActivity('Hoàn dải QC', `Mức ${input.data.level}: ${reason}`, input.data.testId); saveDb();
      return this.getRangeCandidate(input.data.testId, input.data.level);
    },
    async addPoint(input) {
      const db = getDb();
      const knownLevels = db.testLevels.filter((l) => l.test_id === (input.data as any).testId).map((l) => l.level);
      const result = validateQcPointInput(input.data as any, knownLevels); if (!result.ok) return fail(result.code, result.message);
      const test = db.tests.find((t) => t.id === result.data.testId); if (!test) return fail('not-found', 'Không tìm thấy xét nghiệm.');
      if (isPeriodLocked(ymOfDate(result.data.date))) return fail('period-locked', `Kỳ ${ymOfDate(result.data.date)} đã bị khoá, không thể nhập thêm điểm QC.`);
      const levelRow = db.testLevels.find((l) => l.test_id === result.data.testId && l.level === result.data.level);
      if (!canEnterQcForLevel(result.data.testId, levelRow?.qc_lot_id)) {
        return fail('level-not-operational', 'Mức QC chưa thuộc Panel và nhóm lô đang vận hành, không thể nhập QC.');
      }
      const currentLot = levelRow?.qc_lot_id ? db.qcLots.find((l) => l.id === levelRow.qc_lot_id)?.lot_no || '' : '';
      const requestedLot = String((result.data as any).lotNo || '');
      const parallel = requestedLot && requestedLot !== currentLot ? parallelMockColumns(result.data.testId).find((column) => column.level === result.data.level && column.lot === requestedLot) : undefined;
      if (requestedLot && requestedLot !== currentLot && !parallel) return fail('invalid-parallel-lot', 'Lô song song không còn ở trạng thái đang chạy hoặc chưa có Mean/SD ứng viên hợp lệ.');
      const lot = parallel?.lot || currentLot;
      // Ghi chú theo ngày kế thừa từ điểm khác cùng ngày/xét nghiệm đã có ghi
      // chú, mirror main's addPoint().
      const dayNote = db.qcPoints.find((p) => p.test_id === result.data.testId && p.date === result.data.date && !p.voided && p.note)?.note || '';
      const actor = currentActor();
      const row = {
        id: uid(), test_id: result.data.testId, level: result.data.level, date: result.data.date, run_id: result.data.runId, lot,
        val: result.data.val, value_decimals: test.decimal_places ?? 2, qc_mean: parallel?.mean ?? levelRow?.mean ?? null, qc_sd: parallel?.sd ?? levelRow?.sd ?? null,
        note: result.data.note || dayNote, operator_id: actor?.userId || '', operator_username: actor?.username || '', operator_name: result.data.operatorName || actor?.name || '',
        operator_code: '', voided: 0, void_reason: '', void_kind: '', void_requires_rerun: 0, voided_at: '', voided_by: '',
      };
      db.qcPoints.push(row);
      logActivity('Nhập QC', `Điểm QC mức ${row.level}${parallel ? ` · lô song song ${lot}` : ''}, ngày ${row.date}, giá trị ${row.val}`, test.name);
      saveDb();
      const view = parallel
        ? parallelMockColumns(result.data.testId).find((column) => column.level === result.data.level && column.lot === lot)?.points.find((p: any) => p.id === row.id)
        : queryPointsView(result.data.testId, result.data.level).find((p) => p.id === row.id);
      return ok(view as any);
    },
    async voidPoint(input) {
      const db = getDb();
      const result = validateVoidInput(input.data as any); if (!result.ok) return fail(result.code, result.message);
      const point = db.qcPoints.find((p) => p.id === result.data.pointId); if (!point) return fail('not-found', 'Không tìm thấy điểm QC.');
      if (point.voided) return fail('already-voided', 'Điểm QC này đã bị huỷ trước đó.');
      if (isPeriodLocked(ymOfDate(point.date))) return fail('period-locked', `Kỳ ${ymOfDate(point.date)} đã bị khoá, không thể huỷ điểm QC.`);
      const test = db.tests.find((t) => t.id === point.test_id);
      const view = queryPointsView(point.test_id, point.level).find((p) => p.id === point.id)
        || parallelMockColumns(point.test_id).flatMap((column) => column.points).find((p: any) => p.id === point.id);
      const rules = view ? Array.from(new Set(view.rules)) : [];
      const rule = rules.length ? rules.join(', ') : 'Không có luật Westgard';
      const qcVerdict = view && (view.verdict === 'warn' || view.verdict === 'rej') ? view.verdict : 'invalid';
      const { kind, openNce, reason } = result.data;
      const kindLabel = kind === 'analytical' ? 'Kết quả QC thực tế không hợp lệ' : kind === 'data-entry' ? 'Nhập sai dữ liệu' : '';
      const composedReason = kindLabel ? (reason ? `${kindLabel} — ${reason}` : kindLabel) : reason;
      point.voided = 1; point.void_reason = composedReason; point.void_kind = kind; point.void_requires_rerun = openNce ? 1 : 0;
      point.voided_at = nowIso(); point.voided_by = currentActor()?.username || '';
      logActivity('Hủy điểm QC', `Điểm QC mức ${point.level}, ngày ${point.date}, giá trị ${point.val} · Lý do: ${composedReason}`, test?.name || '');
      let nceId: string | null = null, reusedAction = false;
      if (openNce) {
        const existing = [...db.nceRecords].reverse().find((r) => r.point_id === point.id && r.record_status !== 'cancelled' && r.approval_status !== 'approved');
        if (existing) { nceId = existing.nce_id; reusedAction = true; }
        else {
          const now = nowIso();
          const prefix = `NCE-${now.slice(0, 10).replace(/-/g, '')}`;
          const countToday = db.nceRecords.filter((r) => r.nce_id.startsWith(prefix)).length;
          nceId = `${prefix}-${String(countToday + 1).padStart(2, '0')}`;
          const dueDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
          const correction = `Hủy điểm QC mức ${point.level}, ngày ${point.date}, giá trị ${point.val.toFixed(test?.decimal_places ?? 2)}, lần chạy ${point.run_id}. Lý do: ${composedReason}`;
          const actor = currentActor();
          db.nceRecords.push({
            id: uid(), date: point.date, created_at: now, updated_at: now,
            created_by_user_id: actor?.userId || '', created_by_username: actor?.username || '',
            test_id: point.test_id, level: point.level, lot: point.lot || '', point_id: point.id,
            rule, error_type: errorType(rules as string[]), qc_verdict: qcVerdict, nce_id: nceId,
            parent_nce_id: '', follow_up_nce_id: '', protocol_version: 3, risk_level: '', approval_status: 'pending', effectiveness_status: 'pending', record_status: 'active',
            due_date: dueDate, action_completed_date: '',
            detail_json: JSON.stringify({ correction, openedFromVoid: true }),
          } as any);
          logActivity('Tạo hồ sơ NCE', `Mở hồ sơ ${nceId} từ hủy điểm QC`, test?.name || '');
        }
      }
      saveDb(); return ok({ id: point.id, nceId, reusedAction });
    },
    async setDayNote(input) {
      const db = getDb();
      const testId = String(input.data?.testId || '').trim();
      const date = String(input.data?.date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('invalid-date', 'Ngày không hợp lệ (định dạng YYYY-MM-DD).');
      const test = db.tests.find((t) => t.id === testId); if (!test) return fail('not-found', 'Không tìm thấy xét nghiệm.');
      if (isPeriodLocked(ymOfDate(date))) return fail('period-locked', `Kỳ ${ymOfDate(date)} đã bị khoá, không thể sửa ghi chú.`);
      const note = String(input.data?.note ?? '').slice(0, 1000).trim();
      const rows = db.qcPoints.filter((p) => p.test_id === testId && p.date === date && !p.voided);
      if (!rows.length) return fail('no-points', 'Ngày này chưa có điểm QC nào để gắn ghi chú.');
      rows.forEach((p) => { p.note = note; });
      logActivity('Ghi chú QC', `Ngày ${date}${note ? ' · ' + note : ' · xoá ghi chú'}`, test.name);
      saveDb(); return ok({ note, updated: rows.length });
    },

    // ---- Phân tích Westgard ----
    async listTestSummaries() {
      const db = getDb();
      const today = new Date().toISOString().slice(0, 10);
      return db.tests.map((t) => {
        const instrument = db.instruments.find((i) => i.id === t.instrument_id);
        const active = activeMockEvaluation(t.id);
        const levels = active.levels.map((lv) => {
          const points = lv.pts;
          let worstVerdict: RuleVerdict = 'ok';
          // Giữ ĐÚNG cùng ngữ nghĩa với main/ipc/westgard-handlers.ts —
          // `latestVerdict`/`latestRules` theo ĐIỂM CUỐI, `cv` là CV quan
          // sát được. Lệch một chút ở đây là bản xem trước trình duyệt sẽ
          // hiện Tổng quan khác bản Electron thật.
          let latestVerdict: RuleVerdict = 'ok';
          let latestRules: string[] = [];
          if (lv.mean != null && lv.sd != null && points.length) {
            const result = points.map((point) => active.byPoint.get(point)!);
            const rank: Record<RuleVerdict, number> = { ok: 0, warn: 1, rej: 2 };
            for (const f of result) if (rank[f.level] > rank[worstVerdict]) worstVerdict = f.level;
            const lastFlag = result.at(-1);
            if (lastFlag) { latestVerdict = lastFlag.level; latestRules = lastFlag.rules.slice(); }
          }
          const qcLot = lv.qc_lot_id ? db.qcLots.find((lot) => lot.id === lv.qc_lot_id) : null;
          const last = points.at(-1);
          const vals = points.map((p) => p.val);
          const n = vals.length;
          const obsMean = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
          const obsSd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - obsMean) ** 2, 0) / (n - 1)) : 0;
          return {
            level: lv.level, mean: lv.mean, sd: lv.sd, qcLotId: lv.qc_lot_id || null, lot: qcLot?.lot_no || '', exp: qcLot?.exp || '',
            worstVerdict, latestVerdict, latestRules,
            pointCount: n, todayPointCount: points.filter((point) => point.date === today).length,
            cv: n ? (obsMean ? obsSd / Math.abs(obsMean) * 100 : 0) : null,
            latest: last ? { id: last.id, date: last.date, runId: last.run_id, val: last.val } : null,
          };
        });
        return { testId: t.id, testName: t.name, instrumentName: instrument?.name || '', unit: t.unit || '', decimalPlaces: t.decimal_places ?? 2, levels };
      }); // `db.tests` đã ở đúng thứ tự thêm-trước-nằm-đầu (khớp main's `ORDER BY t.rowid`) — không tự sắp lại theo tên.
    },
    async analyzeLevel(testId, level) {
      const db = getDb();
      const test = db.tests.find((t) => t.id === testId);
      const active = activeMockEvaluation(testId), levelRow = active.levels.find((l) => l.level === level), rows = levelRow?.pts || [];
      const asWestgard: QcPointLike[] = rows;
      const hasTarget = !!(levelRow && levelRow.mean != null && levelRow.sd != null);
      const cusumOn = !!test?.cusum_on;
      const cs = hasTarget && cusumOn
        ? cusum(asWestgard, levelRow!.mean, levelRow!.sd, test!.cusum_k, test!.cusum_h)
        : { cPos: rows.map(() => 0), cNeg: rows.map(() => 0), flags: rows.map(() => 'ok' as RuleVerdict) };
      // Cùng chuỗi được chấp nhận như handler thật (acceptedPoints trong
      // domain) — lệch chỗ này là bản xem trước vẽ biểu đồ khác Electron.
      const acceptedIds = new Set(
        (hasTarget ? acceptedPoints(rows, levelRow!.mean, levelRow!.sd, active.within, active.actionOf) : rows).map((r) => r.id),
      );
      const points = rows.map((r, i) => {
        if (!hasTarget) return { id: r.id, date: r.date, runId: r.run_id, val: r.val, z: NaN, verdict: 'none' as const, rules: [], supportRules: [], accepted: false, errorType: '—', errorDesc: '' };
        const flag = active.byPoint.get(r)!; const rules = flag.rules;
        const detail = errorTypeDetail(rules);
        return { id: r.id, date: r.date, runId: r.run_id, val: r.val, z: flag.z, verdict: flag.level, rules, supportRules: flag.supportRules, accepted: acceptedIds.has(r.id), errorType: detail.type, errorDesc: detail.desc };
      });
      return { points, cusum: { cPos: cs.cPos, cNeg: cs.cNeg, flags: cs.flags }, cusumOn };
    },
    async saveRuleAction(testId, ruleId, value) {
      const test = getDb().tests.find((t) => t.id === testId); if (!test) return fail('not-found', 'Không tìm thấy xét nghiệm.');
      if (!WG_RULE_REGISTRY.some((r) => r.id === ruleId)) return fail('invalid-rule', 'Mã luật không hợp lệ.');
      if (typeof value !== 'boolean' && value !== '' && !isRuleAction(value)) return fail('invalid-action', 'Hành động luật không hợp lệ.');
      const action = value === '' ? '' : typeof value === 'boolean' ? defaultRuleAction(ruleId, value) : value;
      const overrides = ruleActionsFor(test); if (action) overrides[ruleId] = action; else delete overrides[ruleId]; test.rule_actions_json = serializeRuleActions(overrides);
      const label = action === '' ? 'theo cấu hình chung' : action === 'inactive' ? 'không dùng' : action === 'alert' ? 'cảnh báo' : 'loại bỏ';
      logActivity('Sửa cấu hình luật Westgard', `Luật ${ruleId} chuyển thành ${label}`, test.name);
      saveDb(); return ok({ ruleId, action });
    },
    async listRuleSettings() {
      return globalRuleList(getDb().westgardRules).map((r) => {
        const rule = WG_RULE_REGISTRY.find((x) => x.id === r.id);
        return { id: r.id, on: r.on, desc: rule?.desc || '', fix: rule?.fix || '', alert: !!rule?.alert };
      });
    },
    async saveRuleSetting(ruleId, on) {
      if (!WG_RULE_REGISTRY.some((r) => r.id === ruleId)) return fail('invalid-rule', 'Mã luật không hợp lệ.');
      const db = getDb();
      db.westgardRules = { ...db.westgardRules, [ruleId]: on };
      logActivity('Sửa cấu hình luật Westgard', `Luật ${ruleId} chuyển thành ${on ? 'bật' : 'tắt'} (cấu hình chung)`, ruleId);
      saveDb(); return ok({ ruleId, on });
    },
    async resetRuleSettings() {
      const db = getDb();
      const defaults: Record<string, boolean> = {};
      for (const rule of WG_RULE_REGISTRY) defaults[rule.id] = rule.defaultOn;
      db.westgardRules = defaults;
      logActivity('Sửa cấu hình luật Westgard', 'Khôi phục cấu hình chung của luật về mặc định', 'Westgard');
      saveDb();
      return ok(globalRuleList(defaults).map((r) => {
        const rule = WG_RULE_REGISTRY.find((x) => x.id === r.id);
        return { id: r.id, on: r.on, desc: rule?.desc || '', fix: rule?.fix || '', alert: !!rule?.alert };
      }));
    },
    async listArchivedBlocks(testId, groupId) {
      const db = getDb();
      const test = db.tests.find((t) => t.id === testId);
      const overrides = test ? ruleActionsFor(test) : {};
      const isOn = makeIsOnLayered(db.westgardRules, overrides);
      const actionOf = makeRuleActionLayered(db.westgardRules, overrides);
      const group = db.lotGroups.find((g: any) => g.id === groupId);
      if (!group) return [];
      const byId = new Map<string, any>();
      for (const lot of db.qcLots.filter((l: any) => l.group_id === groupId)) byId.set(lot.id, lot);
      if (group.archived_lot_ids_json) {
        try {
          for (const id of JSON.parse(group.archived_lot_ids_json) as string[]) {
            if (byId.has(id)) continue;
            const lot = db.qcLots.find((l: any) => l.id === id);
            if (lot) byId.set(id, lot);
          }
        } catch { /* ignore */ }
      }
      const blocks: { level: number; lotId: string; lotNo: string; mean: number; sd: number; analysis: any }[] = [];
      for (const lot of byId.values()) {
        const levelRow = db.testLevels.find((l) => l.test_id === testId && l.level === lot.level);
        let target: { mean: number; sd: number } | null = null;
        if (levelRow && levelRow.qc_lot_id === lot.id && levelRow.mean != null && levelRow.sd != null) {
          target = { mean: levelRow.mean, sd: levelRow.sd };
        } else if (levelRow) {
          try {
            const history = JSON.parse(levelRow.mean_sd_history_json || '[]') as { qcLotId: string; mean: number | null; sd: number | null }[];
            const entry = [...history].reverse().find((h) => h.qcLotId === lot.id && h.mean != null && h.sd != null);
            if (entry) target = { mean: entry.mean as number, sd: entry.sd as number };
          } catch { /* ignore */ }
        }
        if (!target) continue;
        const rows = db.qcPoints.filter((p) => p.test_id === testId && p.level === lot.level && (p.lot || '') === lot.lot_no && !p.voided);
        const asWestgard: QcPointLike[] = rows.map((r) => ({ val: r.val, runId: r.run_id, date: r.date }));
        const wg = westgard(asWestgard, target.mean, target.sd, isOn, actionOf);
        const points = rows.map((r, i) => {
          const rules = wg.F[i].rules;
          const detail = errorTypeDetail(rules);
          return { id: r.id, date: r.date, runId: r.run_id, val: r.val, z: wg.zs[i], verdict: wg.F[i].level, rules, supportRules: wg.F[i].supportRules, accepted: false, errorType: detail.type, errorDesc: detail.desc };
        });
        blocks.push({ level: lot.level, lotId: lot.id, lotNo: lot.lot_no, mean: target.mean, sd: target.sd, analysis: { points, cusum: { cPos: [], cNeg: [], flags: [] }, cusumOn: false } });
      }
      blocks.sort((a, b) => a.level - b.level);
      return blocks;
    },
    async listArchivedGroupTests(groupId) {
      const db = getDb();
      const group = db.lotGroups.find((g: any) => g.id === groupId);
      if (!group) return [];
      const lotIds = new Set(db.qcLots.filter((l: any) => l.group_id === groupId).map((l: any) => l.id));
      if (group.archived_lot_ids_json) {
        try { for (const id of JSON.parse(group.archived_lot_ids_json) as string[]) lotIds.add(id); } catch { /* ignore */ }
      }
      if (!lotIds.size) return [];
      const matched = new Map<string, string>();
      for (const level of db.testLevels) {
        let hit = !!(level.qc_lot_id && lotIds.has(level.qc_lot_id));
        if (!hit) {
          try { hit = (JSON.parse(level.mean_sd_history_json || '[]') as { qcLotId: string }[]).some((h) => lotIds.has(h.qcLotId)); } catch { /* ignore */ }
        }
        if (hit) {
          const test = db.tests.find((t) => t.id === level.test_id);
          if (test) matched.set(test.id, test.name);
        }
      }
      return [...matched.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
    },

    // ---- Six Sigma ----
    async listSigmaPeriods(testId) {
      return getDb().sigmaPeriods.filter((p) => p.testId === testId).sort((a, b) => b.period.localeCompare(a.period)).map((p) => ({
        ...p, levels: p.levels.map((lv: any) => computeSigmaLevel(lv, p.tea)),
      }));
    },
    async removeSigmaPeriod(input) {
      const db = getDb(); const a = currentActor();
      if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị mới được thực hiện thao tác này.');
      const row = db.sigmaPeriods.find((p) => p.id === input.data.id);
      if (!row) return fail('not-found', 'Không tìm thấy kỳ Six Sigma.');
      const test = db.tests.find((t) => t.id === row.testId);
      db.sigmaPeriods = db.sigmaPeriods.filter((p) => p.id !== row.id);
      logActivity('Xoá kỳ Six Sigma', `Kỳ ${row.period} của xét nghiệm "${test ? test.name : ''}"`, test ? test.name : '');
      saveDb(); return ok({ id: row.id });
    },
    async saveSigmaPeriod(input) {
      const db = getDb();
      // Cổng này bản thật có (sigma-handlers.ts) — thiếu nó bản xem trước
      // nhận cả TEa âm rồi tính Sigma từ số vô nghĩa.
      if (input.tea != null && String(input.tea) !== '' && !(Number(input.tea) > 0)) {
        return fail('invalid-tea', 'TEa phải là số dương.');
      }
      const test = db.tests.find((t) => t.id === input.testId); if (!test) return fail('not-found', 'Không tìm thấy xét nghiệm.');
      if (!/^\d{4}-\d{2}$/.test(input.period)) return fail('invalid-period', 'Kỳ phải có định dạng YYYY-MM.');
      if (!input.levels || !input.levels.length) return fail('missing-levels', 'Cần ít nhất 1 mức dữ liệu.');
      const id = `${input.testId}:${input.period}`;
      const stored = input.levels.map((lv) => ({ level: lv.level, cv: lv.cv ?? null, biasEqa: lv.biasEqa ?? null, eqaRounds: lv.eqaRounds || [], uCal: lv.uCal ?? null, muBiasMode: lv.muBiasMode === 'exclude' ? 'exclude' : 'include' }));
      const existingIndex = db.sigmaPeriods.findIndex((p) => p.id === id);
      const row = { id, testId: input.testId, period: input.period, tea: input.tea ?? null, teaSource: input.teaSource || '', levels: stored };
      if (existingIndex >= 0) db.sigmaPeriods[existingIndex] = row; else db.sigmaPeriods.push(row);
      logActivity(existingIndex >= 0 ? 'Sửa kỳ Six Sigma' : 'Thêm kỳ Six Sigma', `Kỳ ${row.period} của xét nghiệm "${test.name}"`, test.name);
      saveDb(); return ok({ ...row, levels: stored.map((s) => computeSigmaLevel(s, row.tea)) });
    },

    // ---- Khắc phục sự cố (NCE) ----
    async listNceRecords() { return [...getDb().nceRecords].sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async createNce(input) {
      const db = getDb();
      const result = validateNceCreate(input.data as any); if (!result.ok) return fail(result.code, result.message);
      const now = nowIso();
      const prefix = `NCE-${now.slice(0, 10).replace(/-/g, '')}`;
      const countToday = db.nceRecords.filter((r) => r.nce_id.startsWith(prefix)).length;
      const row = {
        id: uid(), date: result.data.date, created_at: now, updated_at: now,
        created_by_user_id: currentActor()?.userId || '', created_by_username: currentActor()?.username || '',
        test_id: result.data.testId || null, level: result.data.level, lot: result.data.lot, point_id: result.data.pointId || null,
        rule: result.data.rule, error_type: result.data.errorType, qc_verdict: '', nce_id: `${prefix}-${String(countToday + 1).padStart(2, '0')}`,
        parent_nce_id: '', follow_up_nce_id: '', protocol_version: 3, risk_level: '', approval_status: 'pending', effectiveness_status: 'pending', record_status: 'active',
        due_date: result.data.dueDate, action_completed_date: '',
        detail_json: JSON.stringify({ correction: result.data.correction, investigation: result.data.investigation, causeCategory: result.data.causeCategory, causeDescription: result.data.causeDescription }),
      };
      db.nceRecords.push(row);
      logActivity('Tạo hồ sơ NCE', `Mở hồ sơ ${row.nce_id}`, row.test_id || '');
      saveDb(); return ok(row as any);
    },
    async approveNce(input) {
      const record = getDb().nceRecords.find((r) => r.id === (input.data as any).id); if (!record) return fail('not-found', 'Không tìm thấy hồ sơ.');
      if (record.record_status === 'cancelled') return fail('cancelled', 'Hồ sơ đã huỷ, không thể duyệt.');
      if (record.approval_status === 'approved') return fail('already-approved', 'Hồ sơ đã duyệt trước đó.');
      record.approval_status = 'approved'; record.updated_at = nowIso();
      logActivity('Duyệt hồ sơ NCE', `Duyệt hồ sơ ${record.nce_id}`, record.test_id || '');
      saveDb(); return ok(record as any);
    },
    async returnNce(input) {
      const result = validateNceReview(input.data as any, true); if (!result.ok) return fail(result.code, result.message);
      const record = getDb().nceRecords.find((r) => r.id === result.data.id); if (!record) return fail('not-found', 'Không tìm thấy hồ sơ.');
      const detail = JSON.parse(record.detail_json || '{}'); detail.returnNote = result.data.note;
      record.approval_status = 'returned'; record.updated_at = nowIso(); record.detail_json = JSON.stringify(detail);
      logActivity('Trả lại hồ sơ NCE', `Lý do: ${result.data.note}`, record.test_id || '');
      saveDb(); return ok(record as any);
    },
    async cancelNce(input) {
      const result = validateNceReview(input.data as any, true); if (!result.ok) return fail(result.code, result.message);
      const record = getDb().nceRecords.find((r) => r.id === result.data.id); if (!record) return fail('not-found', 'Không tìm thấy hồ sơ.');
      if (record.approval_status === 'approved') return fail('already-approved', 'Hồ sơ đã duyệt không thể huỷ.');
      const detail = JSON.parse(record.detail_json || '{}');
      detail.cancelReason = result.data.note; detail.cancelledBy = currentActor()?.name || ''; detail.cancelledAt = nowIso();
      record.record_status = 'cancelled'; record.updated_at = nowIso(); record.detail_json = JSON.stringify(detail);
      saveDb(); return ok(record as any);
    },
    async setNceCompletedDate(input) {
      const date = (input.data as any).actionCompletedDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('invalid-date', 'Ngày hoàn thành không hợp lệ.');
      const record = getDb().nceRecords.find((r) => r.id === (input.data as any).id); if (!record) return fail('not-found', 'Không tìm thấy hồ sơ.');
      record.action_completed_date = date; record.updated_at = nowIso();
      logActivity('Cập nhật ngày hoàn thành NCE', `Hồ sơ ${record.nce_id}: ${date}`, record.test_id || '');
      saveDb(); return ok(record as any);
    },
    async markNceEffectiveness(input) {
      const record = getDb().nceRecords.find((r) => r.id === (input.data as any).id); if (!record) return fail('not-found', 'Không tìm thấy hồ sơ.');
      if (record.record_status === 'cancelled') return fail('cancelled', 'Hồ sơ đã huỷ.');
      if (!record.action_completed_date) return fail('missing-completed-date', 'Cần nhập ngày hoàn thành hành động trước khi đánh giá hiệu lực.');
      const result = validateResidualRisk(input.data as any); if (!result.ok) return fail(result.code, result.message);
      const detail = JSON.parse(record.detail_json || '{}');
      if (result.data.note) detail.effectivenessNote = result.data.note; if (result.data.residualRisk) detail.residualRisk = result.data.residualRisk;
      record.effectiveness_status = result.data.status; record.updated_at = nowIso(); record.detail_json = JSON.stringify(detail);
      logActivity('Đánh giá hiệu lực NCE', `Hồ sơ ${record.nce_id}: ${result.data.status}`, record.test_id || '');
      saveDb(); return ok(record as any);
    },
    async setNceReleaseDecision(input) {
      const result = validateReleaseDecision(input.data as any); if (!result.ok) return fail(result.code, result.message);
      const record = getDb().nceRecords.find((r) => r.id === result.data.id); if (!record) return fail('not-found', 'Không tìm thấy hồ sơ.');
      const detail = JSON.parse(record.detail_json || '{}');
      detail.releaseDecision = result.data.decision; detail.releaseNote = result.data.note; detail.releaseDecidedAt = nowIso(); detail.releaseDecidedBy = currentActor()?.name || '';
      record.updated_at = nowIso(); record.detail_json = JSON.stringify(detail);
      logActivity('Quyết định release-to-service', `Hồ sơ ${record.nce_id}: ${result.data.decision}`, record.test_id || '');
      saveDb(); return ok(record as any);
    },
    async setNceRerunEvidence(input) {
      const result = validateRerunEvidence(input.data as any); if (!result.ok) return fail(result.code, result.message);
      const record = getDb().nceRecords.find((r) => r.id === result.data.id); if (!record) return fail('not-found', 'Không tìm thấy hồ sơ.');
      const point = getDb().qcPoints.find((p) => p.id === result.data.rerunPointId); if (!point) return fail('point-not-found', 'Không tìm thấy điểm QC rerun.');
      if (record.test_id && point.test_id !== record.test_id) return fail('point-wrong-test', 'Điểm QC rerun phải cùng xét nghiệm với hồ sơ NCE.');
      const detail = JSON.parse(record.detail_json || '{}');
      detail.rerunPointId = result.data.rerunPointId; detail.rerunNote = result.data.note; detail.rerunSnapshot = { date: point.date, runId: point.run_id, val: point.val, level: point.level };
      record.updated_at = nowIso(); record.detail_json = JSON.stringify(detail); saveDb(); return ok(record as any);
    },
    async reopenNce(input) {
      const db = getDb();
      const record = db.nceRecords.find((r) => r.id === (input.data as any).id); if (!record) return fail('not-found', 'Không tìm thấy hồ sơ.');
      if (record.record_status === 'cancelled') return fail('cancelled', 'Hồ sơ đã huỷ, không thể mở lại.');
      if (record.effectiveness_status !== 'ineffective') return fail('not-ineffective', 'Chỉ mở vòng tiếp theo khi hành động đã bị kết luận không hiệu quả.');
      if (record.follow_up_nce_id) return fail('already-reopened', 'Hồ sơ này đã có vòng tiếp theo, mở tiếp từ vòng đó.');
      const now = nowIso();
      const prefix = `NCE-${now.slice(0, 10).replace(/-/g, '')}`;
      const countToday = db.nceRecords.filter((r) => r.nce_id.startsWith(prefix)).length;
      const newRow = {
        id: uid(), date: now.slice(0, 10), created_at: now, updated_at: now,
        created_by_user_id: currentActor()?.userId || '', created_by_username: currentActor()?.username || '',
        test_id: record.test_id, level: record.level, lot: record.lot, point_id: record.point_id,
        rule: record.rule, error_type: record.error_type, qc_verdict: '', nce_id: `${prefix}-${String(countToday + 1).padStart(2, '0')}`,
        parent_nce_id: record.nce_id, follow_up_nce_id: '', protocol_version: 3, risk_level: '', approval_status: 'pending', effectiveness_status: 'pending', record_status: 'active',
        due_date: record.due_date, action_completed_date: '',
        detail_json: JSON.stringify({ correction: '', reopenedFrom: record.nce_id, reopenNote: String((input.data as any).note || '') }),
      };
      db.nceRecords.push(newRow); record.follow_up_nce_id = newRow.id; record.updated_at = now;
      logActivity('Mở vòng tiếp theo NCE', `Từ hồ sơ ${record.nce_id} sang ${newRow.nce_id}`, record.test_id || '');
      saveDb(); return ok(newRow as any);
    },

    // ---- So sánh hoá chất ----
    async listReagentComparisons() {
      const db = getDb();
      if (!db.reagentComparisons.length) db.reagentComparisons.push(blankReagentRow());
      return db.reagentComparisons.map(toReagentView).sort((a, b) => a.reagent.localeCompare(b.reagent, 'vi'));
    },
    async createReagentComparison(input) {
      const db = getDb();
      const name = String((input.data as any)?.name || '').trim() || 'Hóa chất mới';
      const row = blankReagentRow(name, String((input.data as any)?.unit || ''));
      db.reagentComparisons.push(row);
      logActivity('Tạo phép so sánh hóa chất', `Tạo "${row.reagent}"`, row.reagent);
      saveDb(); return ok(toReagentView(row));
    },
    async saveReagentMetadata(input) {
      const db = getDb();
      const existing = db.reagentComparisons.find((r) => r.id === input.id); if (!existing) return fail('not-found', 'Không tìm thấy phép so sánh.');
      const meta = prepareReagentMetadata(input.data as any, { reagent: existing.reagent, biasTarget: existing.bias_target ?? 6, alpha: existing.alpha ?? 0.05 });
      Object.assign(existing, { reagent: meta.reagent, lot_old: meta.lotOld, lot_new: meta.lotNew, date: meta.date, operator: meta.operator, sample_type: meta.sampleType, unit: meta.unit, bias_target: meta.biasTarget, alpha: meta.alpha, coverage_confirmed: meta.coverageConfirmed ? 1 : 0 });
      logActivity('Sửa thông tin so sánh hóa chất', `Cập nhật "${meta.reagent}"`, meta.reagent);
      saveDb(); return ok(toReagentView(existing));
    },
    async saveReagentRows(input) {
      const db = getDb();
      const existing = db.reagentComparisons.find((r) => r.id === input.id); if (!existing) return fail('not-found', 'Không tìm thấy phép so sánh.');
      existing.rows_json = JSON.stringify(prepareReagentRows(input.rows));
      logActivity('Sửa dữ liệu so sánh hóa chất', `Cập nhật số liệu "${existing.reagent}"`, existing.reagent);
      saveDb(); return ok(toReagentView(existing));
    },
    async removeReagentComparison(input) {
      const db = getDb();
      const existing = db.reagentComparisons.find((r) => r.id === input.id); if (!existing) return fail('not-found', 'Không tìm thấy phép so sánh.');
      if (db.reagentComparisons.length <= 1) return fail('last-comparison', 'Phải giữ lại ít nhất 1 phép so sánh.');
      db.reagentComparisons = db.reagentComparisons.filter((r) => r.id !== input.id); saveDb(); return ok({ id: input.id });
    },
    async listReagentQuickValues(input) {
      const type = cleanQuickValueType((input as any).type); if (!type) return fail('invalid-type', 'Loại giá trị chọn nhanh không hợp lệ.');
      return ok(getDb().reagentQuickValues[type]);
    },
    async addReagentQuickValue(input) {
      const db = getDb();
      const type = cleanQuickValueType((input as any).type); if (!type) return fail('invalid-type', 'Loại giá trị chọn nhanh không hợp lệ.');
      const result = addQuickValue(db.reagentQuickValues[type], (input as any).value);
      if ('error' in result) return fail(result.error, 'Nhập giá trị cần thêm.');
      if (result.added) { db.reagentQuickValues[type] = result.items; saveDb(); }
      return ok({ items: result.items, value: result.value });
    },
    async removeReagentQuickValue(input) {
      const db = getDb();
      const type = cleanQuickValueType((input as any).type); if (!type) return fail('invalid-type', 'Loại giá trị chọn nhanh không hợp lệ.');
      const items = db.reagentQuickValues[type];
      const index = Number((input as any).index);
      if (!Number.isInteger(index) || index < 0 || index >= items.length) return fail('invalid-index', 'Không tìm thấy giá trị cần xoá.');
      items.splice(index, 1); saveDb();
      return ok({ items });
    },

    // ---- Cài đặt ----
    async getLabProfile() { return getDb().lab; },
    async saveLabProfile(input) {
      const db = getDb();
      const prepared = prepareLabProfile(input.data as any, { logoText: db.lab.logo_text, logoData: db.lab.logo_data });
      db.lab = { id: 1, name: prepared.name, dept: prepared.dept, address: prepared.address, brand_title: prepared.brandTitle, brand_sub: prepared.brandSub, logo_text: prepared.logoText, logo_data: prepared.logoData };
      logActivity('Sửa thông tin phòng xét nghiệm', `Cập nhật hồ sơ "${prepared.name || prepared.brandTitle}"`, prepared.name || prepared.brandTitle);
      saveDb(); return ok(db.lab);
    },
    async getStorageInfo() {
      let bytes = 0;
      try { bytes = new Blob([JSON.stringify(getDb())]).size; } catch { /* ignore */ }
      return { dbFileBytes: bytes, path: '(chế độ xem trước trình duyệt — dữ liệu lưu trong localStorage, không có file SQLite thật)' };
    },

    // ---- Báo cáo ----
    async listPeriodLocks() { return [...getDb().periodLocks].sort((a, b) => b.ym.localeCompare(a.ym)); },
    async lockPeriod(input) {
      const db = getDb();
      const result = validateLockPeriod(input.data as any); if (!result.ok) return fail(result.code, result.message);
      if (isPeriodLocked(result.data.ym)) return fail('already-locked', `Kỳ ${result.data.ym} đã được khoá trước đó.`);
      const row = { id: uid(), ym: result.data.ym, locked_at: nowIso(), locked_by: currentActor()?.username || '', note: result.data.note };
      db.periodLocks.push(row);
      logActivity('Khoá kỳ báo cáo', `Khoá kỳ ${row.ym}${row.note ? ': ' + row.note : ''}`, row.ym);
      saveDb(); return ok(row);
    },
    async unlockPeriod(input) {
      const db = getDb();
      const result = validateUnlockPeriod(input.data as any); if (!result.ok) return fail(result.code, result.message);
      if (!isPeriodLocked(result.data.ym)) return fail('not-locked', `Kỳ ${result.data.ym} chưa bị khoá.`);
      db.periodLocks = db.periodLocks.filter((l) => l.ym !== result.data.ym);
      logActivity('Mở khoá kỳ báo cáo', `Mở khoá kỳ ${result.data.ym}: ${result.data.note}`, result.data.ym);
      saveDb(); return ok({ ym: result.data.ym });
    },
    async queryReport(input) {
      const db = getDb();
      if (!input.testId) return [];
      return db.qcPoints.filter((p) => p.test_id === input.testId && (!input.from || p.date >= input.from) && (!input.to || p.date <= input.to))
        .sort((a, b) => a.date.localeCompare(b.date) || a.level - b.level || a.run_id.localeCompare(b.run_id));
    },

    // ---- Không khả dụng ở chế độ xem trước trình duyệt (cần Electron thật) ----
    async exportTableXlsx() { return notAvailable(); },
    async printHtmlToPdf() { return notAvailable(); },
    async exportBackup() { return notAvailable(); },
    async importBackup() { return notAvailable(); },
    async backupStatus() { return { lastBackupAt: null, lastBackupBytes: 0, maxImportBytes: 128 * 1024 * 1024 }; },
    async verifyBackup() { return notAvailable(); },
    async resetOperationalData() { return notAvailable(); },
    async previewLegacyBackup() { return notAvailable(); },
    async importLegacyBackup() { return notAvailable(); },
    async getLisSettings() { return getDb().lisSettings; },
    async saveLisSettings(input) {
      // Cổng admin + allowlist origin đều là của bản thật (lis-handlers.ts).
      // Allowlist là kiểm soát an toàn có chủ đích của Giai đoạn C5 — thiếu
      // nó ở bản xem trước là dạy người dùng một hành vi không tồn tại.
      const a = currentActor();
      if (!a || a.role !== 'admin') return fail('forbidden', 'Chỉ quản trị viên mới được cấu hình LIS Gateway.');
      const url = normalizeGatewayUrl(input.data.url);
      if (input.data.enabled && !url) {
        return fail('invalid-url', 'Địa chỉ Gateway không hợp lệ — chỉ chấp nhận http://127.0.0.1:8787 hoặc http://localhost:8787.');
      }
      const settings = { enabled: input.data.enabled === true, url: url || DEFAULT_LIS_GATEWAY_SETTINGS.url, token: String(input.data.token || '') };
      getDb().lisSettings = settings;
      logActivity('Cấu hình LIS Gateway', settings.enabled ? `Bật, url=${settings.url}` : 'Tắt', '');
      saveDb();
      return ok(settings);
    },
    async pullLisQueue() { return fail('not-available-in-browser-preview', 'LIS Gateway cần Electron thật (server độc lập gọi qua main process).'); },
    async importLisResult() { return notAvailable(); },
    async rejectLisResult() { return notAvailable(); },

    // `store:changed` — bản xem trước chỉ 1 tab, không cần đồng bộ chéo tiến
    // trình; mỗi trang tự fetch lại sau khi gọi save/add/v.v. là đủ.
    onStoreChanged() { return () => {}; },
  };
}

function computeSigmaLevel(stored: any, tea: number | null) {
  const roundsStats = stored.eqaRounds && stored.eqaRounds.length ? eqaRoundsStats(stored.eqaRounds) : null;
  const biasEqa = roundsStats ? roundsStats.rms : stored.biasEqa;
  const biasRefU = roundsStats ? roundsStats.biasRefU : null;
  const sigma = tea != null && stored.cv != null ? sigmaMetric(tea, biasEqa || 0, stored.cv) : null;
  const mu = stored.cv != null
    ? uncertaintyBudget({ cv: stored.cv, bias: biasEqa, biasRefU, includeBias: stored.muBiasMode !== 'exclude', uCal: stored.uCal, tea: tea ?? undefined })
    : null;
  return { level: stored.level, cv: stored.cv, biasEqa, eqaRounds: stored.eqaRounds || [], mixedSigns: roundsStats?.mixedSigns ?? false, uCal: stored.uCal, sigma, mu };
}

function blankReagentRow(name = 'Hóa chất mới', unit = '') {
  return {
    id: uid(), reagent: name, lot_old: '', lot_new: '', date: '', operator: '', sample_type: 'Mẫu bệnh nhân', unit,
    bias_target: 6, alpha: 0.05, coverage_confirmed: 0, extra_json: '{}', rows_json: JSON.stringify(prepareReagentRows(null)),
  };
}

function toReagentView(row: any) {
  let rows: [string, string][];
  try { rows = JSON.parse(row.rows_json); } catch { rows = [['', '']]; }
  const result = calculateReagentComparison({ rows, test: { biasTarget: row.bias_target ?? 6, alpha: row.alpha ?? 0.05, coverageConfirmed: !!row.coverage_confirmed } }, RC_MIN_PAIRS);
  return { ...row, rows, result };
}
