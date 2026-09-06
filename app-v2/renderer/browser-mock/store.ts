// Chế độ "xem giao diện qua trình duyệt" (vite dev, không có Electron thật)
// — xem docs/APP-V2-PLAN.md mục "Xem qua localhost". Đây là 1 "database"
// giả lập TỐI GIẢN, lưu trong localStorage của trình duyệt, KHÔNG PHẢI
// SQLite thật và KHÔNG dùng chung dữ liệu với app Electron thật.
//
// Phạm vi CỐ Ý: chỉ đủ để bấm/xem/thêm/sửa các danh sách cơ bản (CRUD đơn
// giản) — KHÔNG tái hiện engine nghiệp vụ thật (Westgard/Sigma/audit hash
// chain/PBKDF2 thật) để tránh có 2 bản logic phải giữ đồng bộ mãi mãi với
// main/ipc/*.ts. Mật khẩu ở đây lưu dạng chuỗi thường (không băm) — chấp
// nhận được vì đây chỉ là dữ liệu demo trong trình duyệt của người xem, KHÔNG
// phải dữ liệu QC/tài khoản thật.
const STORAGE_KEY = 'qclab-v2-browser-preview';

export interface MockDb {
  lab: { id: 1; name: string; dept: string; address: string; brand_title: string; brand_sub: string; logo_text: string; logo_data: string };
  instruments: any[];
  tests: any[];
  testLevels: any[];
  qcLots: any[];
  lotGroups: any[];
  qcPanels: any[];
  lotTransitions: any[];
  teaRefs: any[];
  activity: any[];
  qcPoints: any[];
  sigmaPeriods: any[];
  nceRecords: any[];
  reagentComparisons: any[];
  periodLocks: any[];
  users: any[];
  passwordsByUserId: Record<string, string>;
  currentUserId: string | null;
  lisSettings: { enabled: boolean; url: string; token: string };
  /** "Chọn nhanh" người thực hiện/loại mẫu ở So sánh hóa chất — 1 danh sách
   * CHUNG cho toàn app, mirror `app_meta`-backed storage của main. */
  reagentQuickValues: { operator: string[]; sampleType: string[] };
  /** Cấu hình luật Westgard CHUNG toàn phòng xét nghiệm (panel "Cấu hình
   * chung của luật" trang Phân tích Westgard) — mirror `app_meta.westgardRules`
   * của main. `{}` = mọi luật theo đúng mặc định `WG_RULE_REGISTRY`. */
  westgardRules: Record<string, boolean>;
}

function emptyDb(): MockDb {
  return {
    lab: { id: 1, name: '', dept: '', address: '', brand_title: 'QC Lab', brand_sub: 'Nội kiểm xét nghiệm', logo_text: 'QC', logo_data: '' },
    instruments: [], tests: [], testLevels: [], qcLots: [], lotGroups: [], qcPanels: [],
    lotTransitions: [], teaRefs: [], activity: [], qcPoints: [], sigmaPeriods: [], nceRecords: [],
    reagentComparisons: [], periodLocks: [], users: [], passwordsByUserId: {}, currentUserId: null,
    lisSettings: { enabled: false, url: 'http://127.0.0.1:8787', token: '' },
    reagentQuickValues: { operator: [], sampleType: ['Mẫu bệnh nhân', 'Mẫu nội kiểm (IQC)', 'Mẫu ngoại kiểm (EQA)'] },
    westgardRules: {},
  };
}

let db: MockDb = load();

function load(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    return { ...emptyDb(), ...JSON.parse(raw) };
  } catch {
    return emptyDb();
  }
}

function persist(): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* trình duyệt chặn localStorage — bỏ qua, chỉ là bản xem giao diện */ }
}

export function getDb(): MockDb { return db; }
export function saveDb(): void { persist(); }
export function resetDb(): void { db = emptyDb(); persist(); }

export function uid(): string { return Math.random().toString(36).slice(2, 9); }
export function nowIso(): string { return new Date().toISOString(); }
