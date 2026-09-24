export const LIS_GATEWAY_ALLOWED_ORIGINS = ['http://127.0.0.1:8787', 'http://localhost:8787'];

export interface LisGatewaySettings { enabled: boolean; url: string; token: string }

export const DEFAULT_LIS_GATEWAY_SETTINGS: LisGatewaySettings = { enabled: false, url: 'http://127.0.0.1:8787', token: '' };


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


