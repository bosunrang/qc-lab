// Cổng quyền của main process (GV5). Trước đây danh tính chụp lúc đăng nhập
// (vai trò, còn hoạt động hay không) dùng suốt phiên; quyền theo trang chỉ ẩn
// mục ở renderer; nhiều thao tác đọc không đòi đăng nhập; cờ "phải đổi mật
// khẩu" không được main kiểm. Mỗi lời gọi giờ đọc lại tài khoản từ CSDL:
// - tài khoản không còn hoặc đã khoá: coi như chưa đăng nhập;
// - đang phải đổi mật khẩu: chỉ cho đổi mật khẩu và đăng xuất;
// - thao tác thuộc một trang: tài khoản phải được vào trang đó
//   (`page-roles.ts`, cùng bảng renderer dùng để hiện menu);
// - handler nhận vai trò MỚI NHẤT, không phải vai trò lúc đăng nhập.
// Vai trò vẫn do từng handler tự kiểm như cũ (`requireAdmin`, `writeCommand`);
// cổng này chỉ thêm, không thay.
import type { Db } from '../db/sqlite-like';
import type { Actor } from './shared';
import { AccessError, NotSignedInError, type AccessGate, type CallContext } from './operations';
import { canUserAccessPage, pageById } from '../domain/page-roles';

/** Gọi được khi chưa đăng nhập: màn đăng nhập/khởi tạo cần chúng, và báo lỗi
 * renderer phải ghi được cả trước khi đăng nhập. */
const PUBLIC_CHANNELS: ReadonlySet<string> = new Set([
  'auth:hasAnyUsers', 'auth:currentUser', 'auth:bootstrapAdmin', 'auth:login', 'auth:logout',
  'settings:getLoginBrand', 'log:clientError',
  'software:getLicenseStatus', 'software:activate',
]);

/** Thêm vào các kênh công khai khi tài khoản đang phải đổi mật khẩu. */
const PASSWORD_CHANGE_CHANNELS: ReadonlySet<string> = new Set(['auth:changeOwnPassword']);
const UNACTIVATED_CHANNELS = new Set(['auth:hasAnyUsers', 'auth:currentUser', 'auth:logout', 'settings:getLoginBrand', 'log:clientError', 'software:getLicenseStatus', 'software:activate']);

/** Kênh → các trang được dùng nó (chỉ cần vào được một trang). Kênh không có
 * ở đây và không thuộc nhóm theo tiền tố bên dưới thì chỉ cần đăng nhập: đó
 * là dữ liệu dùng chung nhiều trang (danh mục, điểm QC, tóm tắt Westgard, hồ
 * sơ đơn vị…), chặn theo trang sẽ làm vỡ trang khác đang đọc nó. */
const CHANNEL_PAGES: Readonly<Record<string, readonly string[]>> = {
  'auth:listUsers': ['users'], 'auth:createUser': ['users'], 'auth:updateUser': ['users'], 'auth:deleteUser': ['users'],
  'auth:resetPassword': ['users'], 'auth:setNceCapabilities': ['users'],
  'entry:addPoint': ['entry'], 'entry:voidPoint': ['entry'], 'entry:setDayNote': ['entry'],
  'entry:voidPointAssessment': ['entry'],
  'entry:applyLabRange': ['entry'], 'entry:revertManufacturerRange': ['entry'], 'entry:rangeCandidate': ['entry'],
  'westgard:saveRuleAction': ['manage'], 'westgard:saveRuleSetting': ['westgard'], 'westgard:resetRuleSettings': ['westgard'],
  // Tổng quan và Báo cáo đọc tóm tắt NCE; Cài đặt sửa cấu hình NCE.
  'nce:list': [], 'nce:getConfig': ['settings'], 'nce:saveConfig': ['settings'],
  // Six Sigma và Ngoại kiểm in báo cáo theo biểu mẫu dùng chung.
  'report:getTemplateSettings': ['report', 'sigma', 'eqa'],
  // Tổng quan nhắc hạn nộp ngoại kiểm.
  'eqa:listSchedule': ['eqa', 'dash'],
  'settings:saveLabProfile': ['settings'], 'settings:enableOperationMode': ['settings'],
  'lis:saveSettings': ['settings'], 'lis:pullQueue': ['settings'], 'lis:importResult': ['settings'], 'lis:rejectResult': ['settings'],
  'firebase:connect': ['settings'], 'firebase:sync': ['settings'], 'firebase:disconnect': ['settings'],
  'backup:export': ['settings'], 'backup:chooseFile': ['settings'], 'backup:import': ['settings'], 'backup:resetAll': ['settings'],
  'log:openFolder': ['settings'], 'log:exportBundle': ['settings'],
  'software:checkUpdate': ['settings'], 'software:downloadUpdate': ['settings'], 'software:installUpdate': ['settings'],
};

/** Cả nhóm kênh thuộc một trang. `config:list*` đọc danh mục cho mọi trang
 * nên không thuộc nhóm; các thao tác `config:` khác là việc của Cấu hình chung. */
const PREFIX_PAGES: readonly (readonly [string, readonly string[]])[] = [
  ['audit:', ['audit']], ['sigma:', ['sigma']], ['reagent:', ['reagent']], ['eqa:', ['eqa']],
  ['nce:', ['actions']], ['report:', ['report']],
];

/** Các trang được dùng kênh; `null` = chỉ cần đăng nhập. */
export function channelPages(channel: string): readonly string[] | null {
  if (channel in CHANNEL_PAGES) { const pages = CHANNEL_PAGES[channel]; return pages.length ? pages : null; }
  if (channel.startsWith('config:') && !channel.startsWith('config:list')) return ['manage'];
  for (const [prefix, pages] of PREFIX_PAGES) if (channel.startsWith(prefix)) return pages;
  return null;
}

export function isPublicChannel(channel: string): boolean { return PUBLIC_CHANNELS.has(channel); }

interface AccessRow { id: string; username: string; name: string; role: string; page_perms_json: string | null; active: number; must_change_password: number }

function pagePermsOf(value: string | null): string[] | null {
  if (!value) return null;
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : null; } catch { return null; }
}

export function createAccessGate(db: Db, licenseAllowed: () => boolean = () => true): AccessGate {
  const read = db.prepare('SELECT id, username, name, role, page_perms_json, active, must_change_password FROM users WHERE id=?');
  return {
    guard(channel: string, ctx: CallContext): CallContext {
      if (!licenseAllowed() && !UNACTIVATED_CHANNELS.has(channel)) throw new AccessError('activation-required', 'Máy chủ QC Lab cần được kích hoạt trước khi sử dụng.');
      if (PUBLIC_CHANNELS.has(channel)) return ctx;
      const actor = ctx.actor();
      const row = read.get(actor.userId) as AccessRow | undefined;
      if (!row || !row.active) throw new NotSignedInError();
      if (row.must_change_password && !PASSWORD_CHANGE_CHANNELS.has(channel)) {
        throw new AccessError('password-change-required', 'Bạn cần đổi mật khẩu trước khi tiếp tục.');
      }
      const pages = channelPages(channel);
      const user = { role: row.role, pagePerms: pagePermsOf(row.page_perms_json) };
      if (pages && !pages.some((page) => canUserAccessPage(page, user))) {
        const names = pages.map((page) => `"${pageById(page)?.label ?? page}"`).join(' hoặc ');
        throw new AccessError('forbidden', `Tài khoản không có quyền dùng trang ${names}.`);
      }
      const fresh: Actor = { ...actor, username: row.username, name: row.name, role: row.role };
      return { actor: () => fresh };
    },
  };
}
