export const BACKUP_IMPORT_MAX_BYTES = 128 * 1024 * 1024;
export const BACKUP_IMPORT_WARN_BYTES = 96 * 1024 * 1024;

type BackupState = Record<string, any>;

export type BackupMeta = {
  type: string;
  formatVersion: number;
  createdAt?: string;
  appVersion?: string;
  schemaVersion?: number;
  year?: string;
  checksum?: string;
  checksumStatus: 'legacy' | 'verified' | 'unavailable' | 'missing';
};

export type BackupPackage = {
  text: string;
  bytes: number;
  meta: Record<string, any>;
};

export type BackupServiceDeps = {
  validateBackup: (value: unknown) => string[];
  sanitizeBackup: (value: unknown, options: { owned: boolean }) => BackupState;
  validateStateInvariants: (value: BackupState, options: { sanitized: boolean }) => string[];
  verifyAuditChain: (activity: unknown[], anchor: string) => { ok: boolean; brokenIndex: number; reason: string };
  schemaVersion: number;
  hash: (text: string) => Promise<string>;
  textBytes: (text: string) => number;
  nowIso: () => string;
  appVersion: () => string;
};

export type BackupServiceApi = ReturnType<typeof createBackupService>;

export function createBackupService(deps: BackupServiceDeps) {
  const serializeBackupData = (value: unknown): string => JSON.stringify(value);
  const backupTextBytes = (text: unknown): number => deps.textBytes(String(text));
  const backupSizeMB = (size: unknown): string => (Number(size || 0) / 1024 / 1024).toFixed(1);
  const backupImportSizeError = (size: unknown): string => Number(size) > BACKUP_IMPORT_MAX_BYTES
    ? `File backup vượt quá giới hạn ${BACKUP_IMPORT_MAX_BYTES / 1024 / 1024} MB.` : '';
  const backupSizeWarning = (size: unknown): string => Number(size) >= BACKUP_IMPORT_WARN_BYTES
    ? `File backup đã đạt ${backupSizeMB(size)} MB, gần giới hạn ${BACKUP_IMPORT_MAX_BYTES / 1024 / 1024} MB. Nên lưu trữ dữ liệu cũ hoặc giảm kích thước trước kỳ sao lưu tiếp theo.` : '';
  const backupChecksum = async (text: unknown): Promise<string> => deps.hash(String(text));

  const createBackupPackage = async (value: BackupState): Promise<BackupPackage> => {
    const payload = serializeBackupData(value);
    const checksum = await backupChecksum(payload);
    const header = {
      format: 'qclab-backup', formatVersion: 1, type: 'full', createdAt: deps.nowIso(),
      appVersion: deps.appVersion(), schemaVersion: Number(value && value.schemaVersion || deps.schemaVersion), checksum,
    };
    const text = JSON.stringify(header).slice(0, -1) + ',"data":' + payload + '}';
    return { text, bytes: backupTextBytes(text), meta: header };
  };

  const parseBackupPackage = async (text: unknown): Promise<{ incoming: BackupState; meta: BackupMeta }> => {
    const parsed = JSON.parse(String(text));
    if (!parsed || parsed.format !== 'qclab-backup' || !parsed.data) {
      return { incoming: parsed, meta: { type: 'legacy', formatVersion: 0, checksumStatus: 'legacy' } };
    }
    if (Number(parsed.formatVersion) !== 1) throw new Error('Phiên bản gói backup chưa được hỗ trợ.');
    const payload = serializeBackupData(parsed.data);
    const actual = parsed.checksum ? await backupChecksum(payload) : '';
    if (parsed.checksum && (!actual || actual !== parsed.checksum)) {
      throw new Error('Checksum SHA-256 không khớp; file có thể đã hỏng hoặc bị thay đổi.');
    }
    return {
      incoming: parsed.data,
      meta: {
        type: parsed.type || 'full', formatVersion: 1, createdAt: parsed.createdAt || '', appVersion: parsed.appVersion || '',
        schemaVersion: parsed.schemaVersion, year: parsed.year || '', checksum: parsed.checksum || '',
        checksumStatus: parsed.checksum ? (actual ? 'verified' : 'unavailable') : 'missing',
      },
    };
  };

  const prepareBackupState = (incoming: BackupState): BackupState => {
    const errors = deps.validateBackup(incoming);
    if (errors.length) throw new Error(errors.join('\n'));
    const next = deps.sanitizeBackup(incoming, { owned: true });
    const audit = deps.verifyAuditChain(next.activity || [], next.activityAnchor || '');
    if (!audit.ok) {
      throw new Error(`Chuỗi audit trong backup không hợp lệ tại dòng ${audit.brokenIndex + 1}: ${audit.reason}. Dữ liệu chưa được nhập.`);
    }
    const invariantErrors = deps.validateStateInvariants(next, { sanitized: true });
    if (invariantErrors.length) throw new Error('Backup sau chuẩn hóa không đạt kiểm tra dữ liệu:\n' + invariantErrors.join('\n'));
    return next;
  };

  const prepareBackupImport = async (text: unknown): Promise<BackupState> => {
    const parsed = await parseBackupPackage(text);
    if (parsed.meta.type === 'year-archive') {
      throw new Error('File này là archive theo năm của bản thử nghiệm cũ, không phải backup đầy đủ — nhập vào sẽ mất dữ liệu các năm khác.');
    }
    return prepareBackupState(parsed.incoming);
  };

  const backupSummary = (next: BackupState): { points: number; minDate: string; maxDate: string; configuredTests: number } => {
    let points = 0, minDate = '', maxDate = '';
    Object.values(next && next.data || {}).forEach((rows: any) => (rows || []).forEach((point: any) => {
      const date = String(point && point.date || '');
      points += 1;
      if (date && (!minDate || date < minDate)) minDate = date;
      if (date && (!maxDate || date > maxDate)) maxDate = date;
    }));
    return { points, minDate, maxDate, configuredTests: (next && next.tests || []).length };
  };

  const inspectBackupText = async (text: unknown, size = 0) => {
    const parsed = await parseBackupPackage(text);
    if (parsed.meta.type === 'year-archive') {
      throw new Error('File này là archive theo năm của bản thử nghiệm cũ, không phải backup đầy đủ và không còn được hỗ trợ.');
    }
    const state = prepareBackupState(parsed.incoming);
    return { meta: parsed.meta, summary: backupSummary(state), state, size: Number(size) || backupTextBytes(text) };
  };

  return Object.freeze({
    serializeBackupData, backupTextBytes, backupSizeMB, backupImportSizeError, backupSizeWarning,
    backupChecksum, createBackupPackage, parseBackupPackage, prepareBackupState, prepareBackupImport,
    backupSummary, inspectBackupText,
  });
}
