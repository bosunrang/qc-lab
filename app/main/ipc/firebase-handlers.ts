// Đồng bộ Firebase cho app. Dữ liệu SQLite luôn được đóng thành backup có
// checksum trước khi rời máy; Firebase chỉ lưu một "vỏ" RTDB (_ts/_client)
// quanh backup đó. Không gửi mật khẩu hay token qua renderer hoặc lưu xuống DB.
import type { Db } from '../db/sqlite-like';
import { SCHEMA_VERSION } from '../db/schema';
import { dumpAllTables, listTableNames, restoreAllTables, writeSafetySnapshot } from '../db/table-io';
import { buildBackupEnvelope, validateBackupEnvelope, type BackupEnvelope } from '../domain/backup';
import { DEFAULT_REAGENT_NAME, prepareReagentRows } from '../domain/reagent-validation';
import { cleanFirebaseEmail, cleanLabCode, parseFirebaseConfig, type FirebaseConfig } from '../domain/firebase-validation';
import { createFirebaseClient, type FirebaseSession } from '../domain/firebase-client';
import { type Actor, type IpcResult, nowIso, notifyChanged, requireAdmin, writeAudit } from './shared';

const CONFIG_KEY = 'firebaseConfig';
const EMAIL_KEY = 'firebaseEmail';
const LAB_CODE_KEY = 'firebaseLabCode';
const STATUS_KEY = 'firebaseLastStatus';

export interface FirebaseSettings {
  labCode: string; email: string; config: string; connected: boolean; status: string; dataPath: string;
}
export type FirebaseConnectResult = { state: 'pushed' | 'in-sync' | 'conflict'; remoteUpdatedAt: string };
export type FirebaseSyncResult = { state: 'pushed' | 'pulled'; remoteUpdatedAt: string };

interface FirebasePayload { _format: 'qclab-v2-firebase'; _ts: number; _client: string; backup: BackupEnvelope; }
type FirebaseClient = ReturnType<typeof createFirebaseClient>;

export function createFirebaseHandlers(db: Db, userDataDir: string, client: FirebaseClient = createFirebaseClient()) {
  let session: FirebaseSession | null = null;
  let config: FirebaseConfig | null = null;
  let labCode = '';
  let syncing = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const meta = (key: string) => (db.prepare('SELECT value FROM app_meta WHERE key=?').get(key) as { value: string } | undefined)?.value || '';
  const setMeta = (key: string, value: string) => db.prepare('INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
  const setStatus = (value: string) => setMeta(STATUS_KEY, value);

  function storedConfig(): FirebaseConfig | null {
    try { return meta(CONFIG_KEY) ? parseFirebaseConfig(meta(CONFIG_KEY)) : null; } catch { return null; }
  }
  function settings(): FirebaseSettings {
    const savedConfig = config || storedConfig();
    const code = labCode || meta(LAB_CODE_KEY);
    return {
      labCode: code, email: meta(EMAIL_KEY), config: savedConfig ? JSON.stringify(savedConfig, null, 2) : '',
      connected: !!session && !!config, status: meta(STATUS_KEY) || 'Chưa kết nối',
      dataPath: code ? `qclab-shared/${code}` : 'qclab-shared/{mã-phòng}',
    };
  }
  function payload(): FirebasePayload {
    return {
      _format: 'qclab-v2-firebase', _ts: Date.now(), _client: 'qclab-v2-desktop',
      backup: buildBackupEnvelope(dumpAllTables(db), SCHEMA_VERSION, 'app', nowIso()),
    };
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
  async function pushNow(): Promise<FirebasePayload> {
    if (!session || !config || !labCode) throw new Error('Chưa kết nối Firebase.');
    const next = payload();
    await client.write(config, labCode, session.idToken, next);
    setStatus(`Đã đồng bộ ${new Date(next._ts).toLocaleString('vi-VN')}`);
    return next;
  }
  async function pullNow(actor: Actor, remote: FirebasePayload): Promise<void> {
    // Không để cấu hình kết nối bị remote cũ ghi đè, đồng thời luôn tạo đường
    // lùi vật lý trước khi RESTORE toàn bộ bảng.
    const snapshot = writeSafetySnapshot(db, userDataDir, 'pre-firebase-pull');
    const saved = { config: meta(CONFIG_KEY), email: meta(EMAIL_KEY), code: meta(LAB_CODE_KEY) };
    restoreAllTables(db, remote.backup.data);
    setMeta(CONFIG_KEY, saved.config); setMeta(EMAIL_KEY, saved.email); setMeta(LAB_CODE_KEY, saved.code);
    writeAudit(db, actor, 'Tải dữ liệu từ Firebase', `Phục hồi dữ liệu đám mây; bản an toàn trước đó tại ${snapshot}`, '');
    await pushNow(); // ghi lại audit vừa phát sinh để hai phía thực sự cùng trạng thái.
    notifyChanged(listTableNames(db));
  }

  async function connect(input: { data: { labCode?: unknown; email?: unknown; password?: unknown; config?: unknown } }, actor: Actor): Promise<IpcResult<FirebaseConnectResult>> {
    const denied = requireAdmin(actor); if (denied) return denied;
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
      setMeta(CONFIG_KEY, JSON.stringify(nextConfig)); setMeta(EMAIL_KEY, email); setMeta(LAB_CODE_KEY, nextCode);
      const raw = await client.read(nextConfig, nextCode, nextSession.idToken);
      const parsed = parsePayload(raw);
      if (!raw) {
        writeAudit(db, actor, 'Kết nối Firebase', `Kết nối ${nextCode} với UID ${nextSession.uid}`, nextCode);
        const sent = await pushNow();
        return { ok: true, data: { state: 'pushed', remoteUpdatedAt: new Date(sent._ts).toISOString() } };
      }
      if (!parsed.ok) { setStatus('Dữ liệu đám mây không tương thích'); return { ok: false, error: { code: 'invalid-remote', message: parsed.message } }; }
      const local = payload();
      if (local.backup.checksum === parsed.data.backup.checksum) {
        setStatus('Đã kết nối · dữ liệu đã đồng bộ');
        writeAudit(db, actor, 'Kết nối Firebase', `Kết nối ${nextCode}; dữ liệu đã khớp`, nextCode);
        return { ok: true, data: { state: 'in-sync', remoteUpdatedAt: new Date(parsed.data._ts).toISOString() } };
      }
      if (localHasOperationalData()) {
        setStatus('Cần chọn hướng đồng bộ');
        return { ok: true, data: { state: 'conflict', remoteUpdatedAt: new Date(parsed.data._ts).toISOString() } };
      }
      await pullNow(actor, parsed.data);
      return { ok: true, data: { state: 'in-sync', remoteUpdatedAt: new Date(parsed.data._ts).toISOString() } };
    } catch (error) {
      setStatus('Lỗi kết nối Firebase');
      return { ok: false, error: { code: 'connection-failed', message: error instanceof Error ? error.message : 'Không thể kết nối Firebase.' } };
    }
  }

  async function sync(input: { data: { direction: 'push' | 'pull' } }, actor: Actor): Promise<IpcResult<FirebaseSyncResult>> {
    const denied = requireAdmin(actor); if (denied) return denied;
    if (!session || !config || !labCode) return { ok: false, error: { code: 'not-connected', message: 'Hãy kết nối Firebase trước khi đồng bộ.' } };
    try {
      syncing = true;
      if (input.data.direction === 'push') {
        writeAudit(db, actor, 'Đẩy dữ liệu lên Firebase', `Đồng bộ lên ${labCode}`, labCode);
        const sent = await pushNow();
        return { ok: true, data: { state: 'pushed', remoteUpdatedAt: new Date(sent._ts).toISOString() } };
      }
      const parsed = parsePayload(await client.read(config, labCode, session.idToken));
      if (!parsed.ok) return { ok: false, error: { code: 'invalid-remote', message: parsed.message === 'empty' ? 'Chưa có dữ liệu trên Firebase để tải về.' : parsed.message } };
      await pullNow(actor, parsed.data);
      return { ok: true, data: { state: 'pulled', remoteUpdatedAt: new Date(parsed.data._ts).toISOString() } };
    } catch (error) {
      setStatus('Lỗi đồng bộ Firebase');
      return { ok: false, error: { code: 'sync-failed', message: error instanceof Error ? error.message : 'Đồng bộ Firebase thất bại.' } };
    } finally { syncing = false; }
  }

  function disconnect(actor: Actor): IpcResult<null> {
    const denied = requireAdmin(actor); if (denied) return denied;
    session = null; config = null; labCode = '';
    if (timer) { clearTimeout(timer); timer = null; }
    setMeta(CONFIG_KEY, ''); setMeta(EMAIL_KEY, ''); setMeta(LAB_CODE_KEY, ''); setStatus('Đã ngắt kết nối');
    writeAudit(db, actor, 'Ngắt Firebase', 'Ngắt đồng bộ đám mây; dữ liệu cục bộ được giữ nguyên', '');
    return { ok: true, data: null };
  }

  /** Được gọi tập trung từ writeAudit(): mọi mutation đã hoàn tất sẽ được
   * gom trong 1 giây rồi đẩy lên cloud. Không tạo audit mới khi đẩy, tránh
   * vòng lặp audit → sync → audit. Lỗi chỉ cập nhật trạng thái, không làm hỏng
   * thao tác cục bộ vốn đã commit thành công. */
  function onDataChanged(): void {
    if (!session || !config || syncing) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void pushNow().catch(() => setStatus('Lỗi đồng bộ tự động — dữ liệu vẫn được lưu cục bộ'));
    }, 1000);
  }

  return { settings, connect, sync, disconnect, onDataChanged };
}

export type FirebaseHandlers = ReturnType<typeof createFirebaseHandlers>;


