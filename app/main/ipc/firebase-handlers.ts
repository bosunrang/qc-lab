// Đồng bộ Firebase cho app — CHỈ để sao lưu (kế hoạch kiến trúc B): một máy
// đẩy toàn bộ CSDL lên. Dữ liệu SQLite luôn được đóng thành backup có checksum
// trước khi rời máy; Firebase chỉ lưu một "vỏ" RTDB (_ts/_client) quanh backup
// đó. Không gửi mật khẩu hay token qua renderer hoặc lưu xuống DB.
//
// Từ 2026-09-26: đẩy tự động theo chu kỳ 15 phút khi có thay đổi và khi đóng
// app (trước đây 1 giây sau MỖI thao tác ghi); dựng gói ở tiến trình phụ khi
// chạy bằng tệp CSDL (`sync/firebase-push-worker.ts`); đo cỡ trước khi gửi.
import type { Db } from '../db/sqlite-like';
import { SCHEMA_VERSION } from '../db/schema';
import { listTableNames, restoreAllTables, writeSafetySnapshot } from '../db/table-io';
import { validateBackupEnvelope } from '../domain/backup';
import { buildFirebasePayload, formatMb, sizeVerdict, FIREBASE_MAX_WRITE_BYTES, type FirebasePayload } from '../sync/firebase-payload';
import type { PushResponse, PushRunner } from '../sync/firebase-payload';
import { DEFAULT_REAGENT_NAME, prepareReagentRows } from '../domain/reagent-validation';
import { cleanFirebaseEmail, cleanLabCode, parseFirebaseConfig, type FirebaseConfig } from '../domain/firebase-validation';
import { createFirebaseClient, type FirebaseSession } from '../domain/firebase-client';
import { type IpcResult } from './shared';
import { writeCommand, writeCommandAsync, type WriteSteps } from './write-command';

const CONFIG_KEY = 'firebaseConfig';
const EMAIL_KEY = 'firebaseEmail';
const LAB_CODE_KEY = 'firebaseLabCode';
const STATUS_KEY = 'firebaseLastStatus';
const TOO_LARGE_PREFIX = 'Không đẩy lên';

export interface FirebaseSettings {
  labCode: string; email: string; config: string; connected: boolean; status: string; dataPath: string;
}
export type FirebaseConnectResult = { state: 'pushed' | 'in-sync' | 'conflict'; remoteUpdatedAt: string };
export type FirebaseSyncResult = { state: 'pushed' | 'pulled'; remoteUpdatedAt: string };

type FirebaseClient = ReturnType<typeof createFirebaseClient>;

/** Chu kỳ đẩy tự động khi có thay đổi (người dùng chốt 2026-09-26). */
export const FIREBASE_PUSH_PERIOD_MS = 15 * 60 * 1000;

export interface FirebaseHandlerOptions {
  /** Đường dẫn tệp CSDL + bộ chạy tiến trình phụ. Thiếu một trong hai (test,
   * CSDL trong bộ nhớ, bản xem trước) thì dựng và gửi ngay trên luồng này. */
  dbPath?: string;
  pushRunner?: PushRunner;
  periodMs?: number;
}

export function createFirebaseHandlers(db: Db, userDataDir: string, client: FirebaseClient = createFirebaseClient(), options: FirebaseHandlerOptions = {}) {
  let session: FirebaseSession | null = null;
  let config: FirebaseConfig | null = null;
  let labCode = '';
  let syncing = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** Thời điểm có thay đổi đầu tiên chưa đẩy; `null` = đã đẩy hết. Hẹn giờ
   * tính từ mốc này chứ không dời theo mỗi thay đổi mới, nên phòng xét nghiệm
   * nhập liên tục vẫn được đẩy đều 15 phút một lần. */
  let dirtySince: number | null = null;
  let nextPushAt: number | null = null;
  /** Lần thử đẩy gần nhất (thành công hay không), để lần thử lại sau một lần
   * hỏng cách đủ một chu kỳ. */
  let lastAttemptAt: number | null = null;
  const periodMs = options.periodMs ?? FIREBASE_PUSH_PERIOD_MS;

  const meta = (key: string) => (db.prepare('SELECT value FROM app_meta WHERE key=?').get(key) as { value: string } | undefined)?.value || '';
  const setMeta = (key: string, value: string) => db.prepare('INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
  const setStatus = (value: string) => setMeta(STATUS_KEY, value);
  /** Trạng thái lỗi chung, trừ khi `pushNow()` vừa ghi lý do cụ thể (gói quá cỡ). */
  const setFailureStatus = (value: string) => { if (!meta(STATUS_KEY).startsWith(TOO_LARGE_PREFIX)) setStatus(value); };

  function storedConfig(): FirebaseConfig | null {
    try { return meta(CONFIG_KEY) ? parseFirebaseConfig(meta(CONFIG_KEY)) : null; } catch { return null; }
  }
  function settings(): FirebaseSettings {
    const savedConfig = config || storedConfig();
    const code = labCode || meta(LAB_CODE_KEY);
    return {
      labCode: code, email: meta(EMAIL_KEY), config: savedConfig ? JSON.stringify(savedConfig, null, 2) : '',
      connected: !!session && !!config, status: (meta(STATUS_KEY) || 'Chưa kết nối') + pendingNote(),
      dataPath: code ? `qclab-shared/${code}` : 'qclab-shared/{mã-phòng}',
    };
  }
  function pendingNote(): string {
    if (dirtySince == null || !session || !config) return '';
    const at = nextPushAt ? ` · tự đẩy lúc ${new Date(nextPushAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : '';
    return ` · Có thay đổi chưa đẩy${at}`;
  }
  /** Dựng gói, đo cỡ và gửi (hoặc chỉ dựng để lấy checksum khi `upload = false`). */
  async function runPush(upload: boolean): Promise<PushResponse> {
    if (!session || !config || !labCode) throw new Error('Chưa kết nối Firebase.');
    if (options.dbPath && options.pushRunner) {
      return options.pushRunner({ dbPath: options.dbPath, uploadUrl: upload ? client.uploadUrl(config, labCode, session.idToken) : null });
    }
    const payload = buildFirebasePayload(db);
    const json = JSON.stringify(payload);
    const size = sizeVerdict(Buffer.byteLength(json));
    if (size.kind === 'too-large') return { ok: false, code: 'too-large', message: 'Gói đồng bộ vượt giới hạn một lần ghi của Firebase.', bytes: size.bytes, ratio: size.ratio };
    if (upload) await client.writeJson(config, labCode, session.idToken, json);
    return { ok: true, bytes: size.bytes, ts: payload._ts, checksum: payload.backup.checksum, ratio: size.ratio };
  }
  function parsePayload(value: unknown): { ok: true; data: FirebasePayload } | { ok: false; message: string } {
    if (!value) return { ok: false, message: 'empty' };
    const row = value as Partial<FirebasePayload>;
    if (row._format !== 'qclab-v2-firebase' || !row.backup) {
      return { ok: false, message: 'Dữ liệu Firebase này không đúng định dạng backup được hỗ trợ.' };
    }
    const checked = validateBackupEnvelope(row.backup, SCHEMA_VERSION);
    return checked.ok ? { ok: true, data: row as FirebasePayload } : { ok: false, message: checked.message };
  }
  function localHasOperationalData(): boolean {
    const tables = ['instruments', 'tests', 'qc_lots', 'qc_panels', 'qc_points', 'sigma_data', 'actions', 'period_locks'];
    return tables.some((table) => Number((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n) > 0)
      || hasEnteredReagentComparison()
      || !!(db.prepare('SELECT name FROM lab WHERE id=1').get() as { name: string }).name;
  }
  /** Phép so sánh hoá chất trống do `seedInitialRows()` tạo sẵn ở mọi CSDL
   * mới không phải dữ liệu của người dùng: đếm nó thì máy mới cài luôn bị coi
   * là có dữ liệu và không tải được từ Firebase. */
  function hasEnteredReagentComparison(): boolean {
    return !!db.prepare(`SELECT 1 FROM reagent_tests
      WHERE reagent<>? OR lot_old<>'' OR lot_new<>'' OR date<>'' OR operator<>'' OR unit<>''
        OR coverage_confirmed<>0 OR rows_json<>? LIMIT 1`).get(DEFAULT_REAGENT_NAME, JSON.stringify(prepareReagentRows(null)));
  }
  /** Đẩy toàn bộ dữ liệu hiện tại. Xoá dấu "có thay đổi" TRƯỚC khi dựng gói:
   * thay đổi phát sinh trong lúc đẩy sẽ đánh dấu lại và vào lần đẩy sau. */
  async function pushNow(): Promise<{ ts: number; bytes: number }> {
    const hadPending = dirtySince;
    dirtySince = null;
    lastAttemptAt = Date.now();
    if (timer) { clearTimeout(timer); timer = null; }
    nextPushAt = null;
    let result: PushResponse;
    try {
      result = await runPush(true);
    } catch (error) {
      result = { ok: false, code: 'upload-failed', message: error instanceof Error ? error.message : String(error) };
    }
    if (!result.ok) {
      // Lần đẩy hỏng: giữ lại mốc thay đổi cũ để chu kỳ sau thử lại.
      if (hadPending != null && dirtySince == null) dirtySince = hadPending;
      if (dirtySince != null) schedule();
      if (result.code === 'too-large') {
        const text = `${TOO_LARGE_PREFIX}: gói đồng bộ ${formatMb(result.bytes ?? 0)} vượt giới hạn ${formatMb(FIREBASE_MAX_WRITE_BYTES)} mỗi lần ghi của Firebase. Dữ liệu vẫn lưu cục bộ; hãy dùng Xuất backup (.sqlite).`;
        setStatus(text);
        throw new Error(text);
      }
      throw new Error(result.message);
    }
    const warn = sizeVerdict(result.bytes).kind === 'warn'
      ? ` · Cảnh báo: đã dùng ${Math.round(result.ratio * 100)}% giới hạn ${formatMb(FIREBASE_MAX_WRITE_BYTES)} mỗi lần ghi của Firebase — nên chuyển sang sao lưu bằng tệp .sqlite`
      : '';
    setStatus(`Đã đồng bộ ${new Date(result.ts).toLocaleString('vi-VN')} · ${formatMb(result.bytes)}${warn}`);
    return { ts: result.ts, bytes: result.bytes };
  }
  type Connection = { config: string; email: string; code: string };
  const savedConnection = (): Connection => ({ config: meta(CONFIG_KEY), email: meta(EMAIL_KEY), code: meta(LAB_CODE_KEY) });
  const writeConnection = (c: Connection) => { setMeta(CONFIG_KEY, c.config); setMeta(EMAIL_KEY, c.email); setMeta(LAB_CODE_KEY, c.code); };

  /** Tải dữ liệu đám mây về, trong lần ghi `w` của thao tác gọi nó. Cấu hình
   * kết nối `keep` không bị remote cũ ghi đè; luôn tạo đường lùi vật lý trước
   * khi RESTORE toàn bộ bảng. `restoreAllTables()` tự chạy transaction riêng
   * (cần tắt khoá ngoại NGOÀI transaction), `w.commit()` giữ phần còn lại. */
  async function pullNow(w: WriteSteps, remote: FirebasePayload, keep: Connection): Promise<void> {
    const snapshot = writeSafetySnapshot(db, userDataDir, 'pre-firebase-pull');
    restoreAllTables(db, remote.backup.data);
    w.commit((tx) => {
      writeConnection(keep);
      tx.audit('Tải dữ liệu từ Firebase', `Phục hồi dữ liệu đám mây; bản an toàn trước đó tại ${snapshot}`, '');
      tx.changed(listTableNames(db));
    });
    await pushNow(); // ghi lại audit vừa phát sinh để hai phía thực sự cùng trạng thái.
  }

  // Cấu hình kết nối được lưu CÙNG transaction với dòng nhật ký, ở đúng nhánh
  // kết nối thành công. Trước đây nó được lưu trước khi đọc dữ liệu đám mây,
  // nên nhánh "cần chọn hướng" và "không tương thích" để lại cấu hình mà
  // không có dòng nhật ký nào.
  const connect = writeCommandAsync(db, 'connect', 'admin', async (w, input: { data: { labCode?: unknown; email?: unknown; password?: unknown; config?: unknown } }): Promise<IpcResult<FirebaseConnectResult>> => {
    try {
      const nextConfig = parseFirebaseConfig(input.data.config);
      const nextCode = cleanLabCode(input.data.labCode);
      const email = cleanFirebaseEmail(input.data.email);
      const password = String(input.data.password || '');
      if (!password) return { ok: false, error: { code: 'missing-password', message: 'Nhập mật khẩu Firebase Authentication để kết nối an toàn.' } };
      const nextSession = await client.signIn(nextConfig, email, password);
      // Chỉ lưu thông tin cần cho lần kết nối sau. Password và token chỉ sống
      // trong RAM main process, mất khi đóng ứng dụng.
      config = nextConfig; session = nextSession; labCode = nextCode;
      const connection: Connection = { config: JSON.stringify(nextConfig), email, code: nextCode };
      const commitConnection = (detail: string) => w.commit((tx) => {
        writeConnection(connection);
        tx.audit('Kết nối Firebase', detail, nextCode);
        tx.changed(['app_meta']);
      });
      const raw = await client.read(nextConfig, nextCode, nextSession.idToken);
      const parsed = parsePayload(raw);
      if (!raw) {
        commitConnection(`Kết nối ${nextCode} với UID ${nextSession.uid}`);
        const sent = await pushNow();
        return { ok: true, data: { state: 'pushed', remoteUpdatedAt: new Date(sent.ts).toISOString() } };
      }
      if (!parsed.ok) { setStatus('Dữ liệu đám mây không tương thích'); return { ok: false, error: { code: 'invalid-remote', message: parsed.message } }; }
      const local = await runPush(false);
      if (local.ok && local.checksum === parsed.data.backup.checksum) {
        setStatus('Đã kết nối · dữ liệu đã đồng bộ');
        commitConnection(`Kết nối ${nextCode}; dữ liệu đã khớp`);
        return { ok: true, data: { state: 'in-sync', remoteUpdatedAt: new Date(parsed.data._ts).toISOString() } };
      }
      if (localHasOperationalData()) {
        setStatus('Cần chọn hướng đồng bộ');
        commitConnection(`Kết nối ${nextCode}; dữ liệu cục bộ và đám mây khác nhau, chờ chọn hướng đồng bộ`);
        return { ok: true, data: { state: 'conflict', remoteUpdatedAt: new Date(parsed.data._ts).toISOString() } };
      }
      await pullNow(w, parsed.data, connection);
      return { ok: true, data: { state: 'in-sync', remoteUpdatedAt: new Date(parsed.data._ts).toISOString() } };
    } catch (error) {
      setStatus('Lỗi kết nối Firebase');
      return { ok: false, error: { code: 'connection-failed', message: error instanceof Error ? error.message : 'Không thể kết nối Firebase.' } };
    }
  });

  const sync = writeCommandAsync(db, 'sync', 'admin', async (w, input: { data: { direction: 'push' | 'pull' } }): Promise<IpcResult<FirebaseSyncResult>> => {
    if (!session || !config || !labCode) return { ok: false, error: { code: 'not-connected', message: 'Hãy kết nối Firebase trước khi đồng bộ.' } };
    try {
      syncing = true;
      if (input.data.direction === 'push') {
        // Dữ liệu cục bộ không đổi; dòng nhật ký ghi trước để nằm trong gói đẩy lên.
        const code = labCode;
        w.commit((tx) => {
          tx.audit('Đẩy dữ liệu lên Firebase', `Đồng bộ lên ${code}`, code);
          tx.changed(['activity']);
        });
        const sent = await pushNow();
        return { ok: true, data: { state: 'pushed', remoteUpdatedAt: new Date(sent.ts).toISOString() } };
      }
      const parsed = parsePayload(await client.read(config, labCode, session.idToken));
      if (!parsed.ok) return { ok: false, error: { code: 'invalid-remote', message: parsed.message === 'empty' ? 'Chưa có dữ liệu trên Firebase để tải về.' : parsed.message } };
      await pullNow(w, parsed.data, savedConnection());
      return { ok: true, data: { state: 'pulled', remoteUpdatedAt: new Date(parsed.data._ts).toISOString() } };
    } catch (error) {
      setFailureStatus('Lỗi đồng bộ Firebase');
      return { ok: false, error: { code: 'sync-failed', message: error instanceof Error ? error.message : 'Đồng bộ Firebase thất bại.' } };
    } finally { syncing = false; }
  });

  const disconnect = writeCommand(db, 'disconnect', 'admin', (w): IpcResult<null> => {
    // Xoá cấu hình, trạng thái và dòng nhật ký là MỘT đơn vị (kế hoạch B.4).
    w.commit((tx) => {
      writeConnection({ config: '', email: '', code: '' }); setStatus('Đã ngắt kết nối');
      tx.audit('Ngắt Firebase', 'Ngắt đồng bộ đám mây; dữ liệu cục bộ được giữ nguyên', '');
      tx.changed(['app_meta']);
    });
    session = null; config = null; labCode = '';
    if (timer) { clearTimeout(timer); timer = null; }
    dirtySince = null; nextPushAt = null;
    return { ok: true, data: null };
  });

  function schedule(): void {
    if (timer || dirtySince == null) return;
    // Tính từ mốc muộn hơn giữa thay đổi đầu tiên và lần thử gần nhất: sau một
    // lần đẩy hỏng (mạng, quá cỡ) thì chờ đủ một chu kỳ mới thử lại, không để
    // mỗi thao tác ghi mới kích hoạt một lần đẩy ngay.
    const base = Math.max(dirtySince, lastAttemptAt ?? 0);
    const delay = Math.max(0, base + periodMs - Date.now());
    nextPushAt = Date.now() + delay;
    timer = setTimeout(() => {
      timer = null;
      nextPushAt = null;
      if (syncing) { schedule(); return; }
      void pushNow().catch(() => {
        // pushNow đã ghi trạng thái cụ thể cho ca quá cỡ; các lỗi khác (mạng,
        // token hết hạn) thì báo chung và thử lại ở chu kỳ sau.
        setFailureStatus('Lỗi đồng bộ tự động — dữ liệu vẫn được lưu cục bộ, sẽ thử lại ở chu kỳ sau');
      });
    }, delay);
    // Lịch sao lưu không giữ tiến trình sống: app Electron vốn đang chạy, còn
    // khi đóng app phần còn chờ đã được `flushPending()` đẩy nốt.
    timer.unref?.();
  }

  /** Được gọi tập trung từ writeAudit() sau mỗi thao tác ghi đã hoàn tất:
   * chỉ đánh dấu "có thay đổi" và hẹn lần đẩy sau 15 phút tính từ thay đổi
   * đầu tiên. Không tạo audit mới khi đẩy, tránh vòng lặp audit → sync →
   * audit. Lỗi chỉ cập nhật trạng thái, không làm hỏng thao tác cục bộ vốn đã
   * commit thành công. */
  function onDataChanged(): void {
    if (!session || !config) return;
    if (dirtySince == null) dirtySince = Date.now();
    schedule();
  }

  /** Có thay đổi chưa đẩy lên (để đẩy nốt khi đóng app). */
  function hasPendingPush(): boolean {
    return dirtySince != null && !!session && !!config;
  }

  /** Đẩy ngay phần thay đổi còn chờ; dùng khi đóng app. Không ném. */
  async function flushPending(): Promise<void> {
    if (!hasPendingPush()) return;
    await pushNow().catch(() => { /* trạng thái lỗi đã được ghi */ });
  }

  return { settings, connect, sync, disconnect, onDataChanged, hasPendingPush, flushPending };
}

export type FirebaseHandlers = ReturnType<typeof createFirebaseHandlers>;


