// Áp CÙNG chính sách quyền của main process lên bản `window.qcApi` giả lập
// của chế độ xem trước trình duyệt. Không có file này, bản giả lập sẽ cho
// vai trò "chỉ xem" ghi được dữ liệu trong khi bản Electron thật chặn —
// nghĩa là xem trước sẽ nói dối về hành vi thật.
//
// Bảng dưới đây phải khớp đúng các guard `requireWrite`/`requireAdmin` trong
// main/ipc/*.ts (xem main/ipc/shared.ts để biết lý do ánh xạ vai trò). Sửa
// một bên thì phải sửa bên kia — `POLICY` được gõ theo `keyof QcApi` nên gõ
// sai TÊN hàm sẽ bị TypeScript bắt, nhưng đặt SAI MỨC (write ↔ admin) thì
// không có gì bắt được ngoài việc đọc đối chiếu.
//
// Các hàm KHÔNG có trong bảng: hàm chỉ đọc (list*/query*/analyze*), hàm
// đăng nhập/đổi mật khẩu/ảnh đại diện (`setAvatar`/`clearAvatar`) của chính
// mình, hàm users/backup/di trú/LIS (bản giả lập đã tự kiểm admin sẵn trong
// api.ts, hoặc trả `not-available-in-browser-preview`).
import { getDb } from './store';
import type { QcApi, IpcResult } from '../../shared/qc-api';

type Level = 'write' | 'admin';

const POLICY: Partial<Record<keyof QcApi, Level>> = {
  // Cấu hình chung — trang admin-only ở cả 2 bản
  saveInstrument: 'admin', removeInstrument: 'admin', saveTest: 'admin', saveTestLevel: 'admin',
  saveRuleScope: 'admin', saveLot: 'admin', saveLotGroup: 'admin', savePanel: 'admin', activateLotGroup: 'admin',
  createLotTransition: 'admin', saveTeaRef: 'admin', removeTeaRef: 'admin', removeTeaLabProfile: 'admin', addTeaAnalyte: 'admin',
  // Nhật ký hoạt động, Cài đặt, khoá/mở kỳ báo cáo
  archiveActivity: 'admin', saveLabProfile: 'admin', lockPeriod: 'admin', unlockPeriod: 'admin',
  // Dữ liệu QC hằng ngày — admin + KTV
  addPoint: 'write', voidPoint: 'write', saveRuleAction: 'write', saveRuleSetting: 'write', resetRuleSettings: 'write', saveSigmaPeriod: 'write',
  createNce: 'write', approveNce: 'write', returnNce: 'write', cancelNce: 'write',
  setNceCompletedDate: 'write', markNceEffectiveness: 'write', setNceReleaseDecision: 'write',
  setNceRerunEvidence: 'write', reopenNce: 'write',
  createReagentComparison: 'write', saveReagentMetadata: 'write', saveReagentRows: 'write',
  removeReagentComparison: 'admin', addReagentQuickValue: 'write', removeReagentQuickValue: 'write',
};

function currentRole(): string {
  const db = getDb();
  const user = db.users.find((u) => u.id === db.currentUserId);
  return user ? String(user.role) : 'viewer';
}

function denied(level: Level): IpcResult<never> | null {
  const role = currentRole();
  if (level === 'admin') {
    return role === 'admin' ? null : { ok: false, error: { code: 'forbidden', message: 'Chỉ quản trị mới được thực hiện thao tác này.' } };
  }
  return role === 'admin' || role === 'technician' ? null : { ok: false, error: { code: 'forbidden', message: 'Bạn không có quyền sửa dữ liệu.' } };
}

export function withPermissionPolicy(api: QcApi): QcApi {
  const wrapped = { ...api } as Record<string, unknown>;
  for (const [name, level] of Object.entries(POLICY) as [string, Level][]) {
    const original = (api as unknown as Record<string, unknown>)[name];
    if (typeof original !== 'function') continue;
    wrapped[name] = async (...args: unknown[]) => denied(level) ?? (original as (...a: unknown[]) => unknown)(...args);
  }
  return wrapped as unknown as QcApi;
}
