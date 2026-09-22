// Giai đoạn C5 (docs/APP-V2-PLAN.md) — client cho LIS Gateway prototype
// (`lis-gateway/`, server Node độc lập, KHÔNG đổi gì ở đó — chỉ thêm phía
// app gọi vào). Tham khảo `src/application/lis/lis-client-service.ts`
// bản cũ nhưng viết lại thuần (không đụng DOM/localStorage — main process
// Electron dùng `app_meta` thay vì `localStorage` trình duyệt).
//
// 2 nguyên tắc BẮT BUỘC giữ nguyên từ bản cũ (xem CLAUDE.md "LIS Gateway"):
// (1) chỉ báo gateway 'imported' SAU KHI ghi điểm QC cục bộ thành công — nếu
// ghi thất bại thì KHÔNG được báo gateway gì cả (bản ghi vẫn còn 'pending'
// trong hàng chờ); (2) ngày của điểm QC phải suy từ GIỜ ĐỊA PHƯƠNG của
// `measuredAt` (`getFullYear()/getMonth()/getDate()`), KHÔNG cắt chuỗi ISO
// UTC — 1 lần QC lúc 06:05 giờ VN có `measuredAt` là 23:05Z NGÀY HÔM TRƯỚC,
// cắt UTC sẽ lệch ngày âm thầm trên biểu đồ Levey-Jennings.
export const LIS_GATEWAY_ALLOWED_ORIGINS = ['http://127.0.0.1:8787', 'http://localhost:8787'];

export interface LisGatewaySettings { enabled: boolean; url: string; token: string }

export const DEFAULT_LIS_GATEWAY_SETTINGS: LisGatewaySettings = { enabled: false, url: 'http://127.0.0.1:8787', token: '' };

/** Chỉ chấp nhận đúng origin của gateway đã biết trước — cùng lý do CSP của
 * bản cũ hardcode allowlist thay vì tin bất kỳ URL nào người dùng gõ vào. */
export function normalizeGatewayUrl(value: unknown): string {
  try {
    const url = new URL(String(value || ''));
    return LIS_GATEWAY_ALLOWED_ORIGINS.includes(url.origin) ? url.origin : '';
  } catch {
    return '';
  }
}

export interface LisResolved {
  ok: boolean; code: string; reason?: string;
  qclabTestId?: string; level?: number; lot?: string; displayName?: string;
}
export interface LisMessage {
  messageId: string; analyzerId: string; testCode: string; qcLevel: string; qcLotCode?: string;
  value: number; unit?: string; measuredAt: string; runId?: string; operator?: string;
}
export interface LisQueueRecord {
  id: string; receivedAt: string; status: string; message: LisMessage; resolved: LisResolved;
}

export interface LisPointInput { testId: string; level: number; date: string; val: number; runId: string; operatorName: string }

/** Ánh xạ 1 bản ghi ĐÃ KHỚP CẤU HÌNH (`resolved.ok===true`) của gateway sang
 * input cho `EntryService`/`addPoint()` — trả `null` nếu thiếu dữ liệu bắt
 * buộc hoặc `measuredAt` không parse được (KHÔNG fallback về "hôm nay"). */
export function resultToPointInput(record: LisQueueRecord): LisPointInput | null {
  const message = record.message, resolved = record.resolved;
  if (!resolved || !resolved.ok || !resolved.qclabTestId || resolved.level == null) return null;
  const measured = new Date(message.measuredAt || '');
  if (!Number.isFinite(measured.getTime())) return null;
  const date = `${measured.getFullYear()}-${String(measured.getMonth() + 1).padStart(2, '0')}-${String(measured.getDate()).padStart(2, '0')}`;
  return {
    testId: resolved.qclabTestId, level: resolved.level, date, val: Number(message.value),
    runId: message.runId || '', operatorName: message.operator || '',
  };
}
