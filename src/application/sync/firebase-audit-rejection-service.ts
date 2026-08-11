export type FirebaseAuditRejectionService = Readonly<{ reject: (source: string, result: { brokenIndex?: number; reason?: string } | null | undefined) => false }>;

export function createFirebaseAuditRejectionService(deps: {
  disconnect: () => void;
  disconnected: () => void;
  report: (detail: string) => void;
}): FirebaseAuditRejectionService {
  const reject = (source: string, result: { brokenIndex?: number; reason?: string } | null | undefined): false => {
    const where = result && Number(result.brokenIndex) >= 0 ? ` dòng ${Number(result.brokenIndex) + 1}` : '';
    deps.disconnect();
    deps.disconnected();
    deps.report(`${source}${where}: ${result?.reason || 'chuỗi hash bị hỏng'} · dữ liệu cục bộ được giữ nguyên`);
    return false;
  };
  return Object.freeze({ reject });
}
