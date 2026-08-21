export function createCorruptLocalQuarantine(now:()=>string) {
  return (raw:any, error:any) => ({ capturedAt: now(), source: 'localStorage:qclab', message: error && error.message ? error.message : 'Dữ liệu cục bộ không hợp lệ.', raw: String(raw || '') });
}
