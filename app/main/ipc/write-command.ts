// Cổng ghi dùng chung cho mọi handler (kế hoạch kiến trúc, điểm "quyền →
// kiểm dữ liệu → transaction → audit → notify"). Trước đây trình tự này chỉ là
// quy ước viết tay ở từng handler; một handler mới có thể quên ghi nhật ký
// hoặc quên báo renderer mà không test nào chặn. `writeCommand()` biến quy ước
// thành ràng buộc:
//
// 1. Quyền: kiểm TRƯỚC khi chạy thân handler.
// 2. Kiểm dữ liệu: thân handler tự làm, trả `{ ok: false }` trước khi ghi.
// 3. Transaction: phần ghi nằm trong `w.commit(tx => …)`.
// 4. Nhật ký: trong commit phải gọi `tx.audit()` ít nhất một lần, nếu không
//    transaction bị huỷ và lỗi lập trình nổi lên (A.5 ghi log `internal-error`).
// 5. Báo thay đổi: trong commit phải gọi `tx.changed()`; lời báo chỉ gửi SAU
//    khi commit xong, nên renderer không bao giờ nạp lại dữ liệu chưa ghi.
//
// Handler trả `{ ok: true }` mà không commit cũng là lỗi lập trình, trừ khi
// khai tường minh `w.noChange(data)` (lưu lại đúng giá trị cũ).
import type { Db } from '../db/sqlite-like';
import { type Actor, type IpcResult, type PermissionDenied, notifyChanged, requireAdmin, requireWrite, withTransaction, writeAudit } from './shared';

export type WriteGuard = 'write' | 'admin' | ((actor: Actor) => PermissionDenied | null);

export interface WriteTx {
  /** Ghi một dòng nhật ký hoạt động (bắt buộc ít nhất một lần mỗi lần ghi). */
  audit(type: string, detail: string, target?: string): void;
  /** Khai bảng (và xét nghiệm) vừa đổi; mỗi lời khai thành một `notifyChanged`
   * sau khi commit, giữ nguyên thứ tự — không gộp, vì renderer lọc theo
   * cặp bảng + xét nghiệm của từng lời báo. Thao tác chỉ ghi nhật ký (không
   * đổi bảng dữ liệu nào) khai `tx.changed(['activity'])`. */
  changed(tables: string[], testIds?: string[]): void;
}

export interface WriteSteps {
  /** Người thực hiện, đã qua cổng quyền. */
  readonly actor: Actor;
  /** Chạy phần ghi trong MỘT transaction; trả đúng giá trị `work` trả về. Lỗi
   * ném ra trong `work` huỷ toàn bộ phần ghi (kể cả nhật ký) và không báo gì. */
  commit<R>(work: (tx: WriteTx) => R): R;
  /** Trả thành công mà CỐ Ý không ghi gì (vd lưu lại đúng giá trị cũ): không
   * nhật ký, không báo renderer. Phải gọi tường minh — trả `{ ok: true }` trơn
   * mà không commit vẫn là lỗi lập trình. */
  noChange<T>(data: T): IpcResult<T>;
}

function guardOf(guard: WriteGuard): (actor: Actor) => PermissionDenied | null {
  if (guard === 'write') return requireWrite;
  if (guard === 'admin') return requireAdmin;
  return guard;
}

/** Lỗi lập trình của cổng ghi (thiếu nhật ký, thiếu khai bảng đổi, commit hai
 * lần, trả ok mà không ghi). Khác lỗi dữ liệu: handler có `try/catch` quanh
 * `w.commit()` không được biến nó thành "Lưu thất bại" — cổng ghi nhớ lỗi
 * và ném lại khi handler trả về, để lớp IPC ghi log `internal-error`. */
export class WriteCommandError extends Error {}

/** Dấu nhận biết handler đã đi qua cổng ghi — test đọc để khoá danh sách. */
export const WRITE_COMMAND = Symbol('write-command');

export type WriteCommand<A extends unknown[], T> = ((...args: [...A, Actor]) => IpcResult<T>) & { [WRITE_COMMAND]: string };
export type AsyncWriteCommand<A extends unknown[], T> = ((...args: [...A, Actor]) => Promise<IpcResult<T>>) & { [WRITE_COMMAND]: string };

/** Các bước của MỘT lần ghi, cùng hai cờ để kiểm sau khi thân handler xong. */
function beginWrite(db: Db, name: string, actor: Actor) {
  const state: { committed: boolean; declaredNoChange: boolean; violation: WriteCommandError | null } = { committed: false, declaredNoChange: false, violation: null };
  const violate = (message: string): never => {
    state.violation = new WriteCommandError(`${name}: ${message}`);
    throw state.violation;
  };
  const steps: WriteSteps = {
    actor,
    noChange<D>(data: D): IpcResult<D> {
      state.declaredNoChange = true;
      return { ok: true, data };
    },
    commit<R>(work: (tx: WriteTx) => R): R {
      if (state.committed) violate('commit() chỉ được gọi một lần cho mỗi lần ghi.');
      let audited = 0;
      const pending: Array<[string[], string[]]> = [];
      const tx: WriteTx = {
        audit: (type, detail, target = '') => { writeAudit(db, actor, type, detail, target); audited++; },
        changed: (tables, testIds = []) => { pending.push([tables, testIds]); },
      };
      const result = withTransaction(db, () => {
        const value = work(tx);
        // Ném TRONG transaction để phần đã ghi bị huỷ theo.
        if (!audited) violate('thao tác ghi thiếu nhật ký (tx.audit).');
        if (!pending.length) violate('thao tác ghi thiếu khai báo bảng đổi (tx.changed).');
        return value;
      });
      state.committed = true;
      // `['activity']` là lời khai "chỉ nhật ký đổi"; `writeAudit()` đã tự báo
      // bảng này, không báo lặp.
      for (const [tables, testIds] of pending) if (!(tables.length === 1 && tables[0] === 'activity')) notifyChanged(tables, testIds);
      return result;
    },
  };
  const finish = <T>(result: IpcResult<T>): IpcResult<T> => {
    // Thân handler có thể đã bắt lỗi của commit và trả "Lưu thất bại": vẫn ném lại.
    if (state.violation) throw state.violation;
    if (result.ok && !state.committed && !state.declaredNoChange) violate('trả kết quả thành công mà không ghi gì (thiếu w.commit).');
    return result;
  };
  return { steps, finish };
}

export function writeCommand<A extends unknown[], T>(
  db: Db,
  name: string,
  guard: WriteGuard,
  body: (w: WriteSteps, ...args: A) => IpcResult<T>,
): WriteCommand<A, T> {
  const check = guardOf(guard);
  const command = (...args: [...A, Actor]): IpcResult<T> => {
    const actor = args[args.length - 1] as Actor;
    const denied = check(actor);
    if (denied) return denied;
    const { steps, finish } = beginWrite(db, name, actor);
    return finish(body(steps, ...(args.slice(0, -1) as unknown as A)));
  };
  return Object.assign(command, { [WRITE_COMMAND]: name });
}

/** Như `writeCommand()` cho thân handler bất đồng bộ (băm mật khẩu, gọi LIS
 * Gateway…). Phần ghi trong `w.commit()` vẫn là một transaction đồng bộ,
 * chạy SAU các bước chờ, nên không có transaction nào mở qua `await`. */
export function writeCommandAsync<A extends unknown[], T>(
  db: Db,
  name: string,
  guard: WriteGuard,
  body: (w: WriteSteps, ...args: A) => Promise<IpcResult<T>>,
): AsyncWriteCommand<A, T> {
  const check = guardOf(guard);
  const command = async (...args: [...A, Actor]): Promise<IpcResult<T>> => {
    const actor = args[args.length - 1] as Actor;
    const denied = check(actor);
    if (denied) return denied;
    const { steps, finish } = beginWrite(db, name, actor);
    return finish(await body(steps, ...(args.slice(0, -1) as unknown as A)));
  };
  return Object.assign(command, { [WRITE_COMMAND]: name });
}
