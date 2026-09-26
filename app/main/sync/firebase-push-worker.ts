// Tiến trình phụ (Electron `utilityProcess`) dựng và đẩy gói sao lưu lên
// Firebase, để main process không đứng trong lúc đọc toàn bộ CSDL, tạo JSON
// hàng trăm MB và gửi đi (kế hoạch kiến trúc B.2). Trước 2026-09-26 việc này
// chạy trên luồng chính sau MỖI thao tác ghi: khoảng 300.000 điểm là app và
// mọi máy trạm LAN đứng khoảng 4 giây mỗi lần.
//
// Mở kết nối SQLite CHỈ ĐỌC riêng và đọc trong một transaction: nhờ chế độ WAL
// (E.3) đây là một bản chụp nhất quán dù main vẫn ghi trong lúc đó. Dùng
// `utilityProcess` thay cho `worker_threads` vì nó nạp được mã trong `app.asar`.
import { DatabaseSync } from 'node:sqlite';
import { buildFirebasePayload, sizeVerdict, type PushRequest, type PushResponse } from './firebase-payload';

async function handle(request: PushRequest): Promise<PushResponse> {
  let json: string;
  let ts: number;
  let checksum: string;
  try {
    const db = new DatabaseSync(request.dbPath, { readOnly: true });
    try {
      db.exec('BEGIN');
      const payload = buildFirebasePayload(db);
      db.exec('COMMIT');
      json = JSON.stringify(payload);
      ts = payload._ts;
      checksum = payload.backup.checksum;
    } finally {
      db.close();
    }
  } catch (error) {
    return { ok: false, code: 'build-failed', message: error instanceof Error ? error.message : String(error) };
  }
  const body = Buffer.from(json, 'utf8');
  const size = sizeVerdict(body.length);
  if (size.kind === 'too-large') return { ok: false, code: 'too-large', message: 'Gói đồng bộ vượt giới hạn một lần ghi của Firebase.', bytes: size.bytes, ratio: size.ratio };
  if (request.uploadUrl) {
    try {
      const response = await fetch(request.uploadUrl, { method: 'PUT', headers: { 'content-type': 'application/json' }, body });
      if (!response.ok) {
        const text = await response.text();
        let message = text;
        try { message = (JSON.parse(text) as { error?: string }).error || text; } catch { /* phản hồi không phải JSON */ }
        return { ok: false, code: 'upload-failed', message: `Không thể ghi Firebase Realtime Database${message ? `: ${message}` : ` (HTTP ${response.status})`}`, bytes: size.bytes, ratio: size.ratio };
      }
    } catch (error) {
      return { ok: false, code: 'upload-failed', message: error instanceof Error ? error.message : String(error), bytes: size.bytes, ratio: size.ratio };
    }
  }
  return { ok: true, bytes: size.bytes, ts, checksum, ratio: size.ratio };
}

process.parentPort.on('message', (event: { data: PushRequest }) => {
  void handle(event.data).then((result) => process.parentPort.postMessage(result));
});
