type AnyRec = any;

export function createSettingsPageController(deps: {
  document: Document;
  navigator: () => any;
  createImage: () => HTMLImageElement;
  createFileReader: () => FileReader;
  getState: () => AnyRec;
  infoDialog: (message: string, opts?: AnyRec) => Promise<unknown>;
  requireAdmin: () => boolean;
  cloud: {
    setStatus: (text: string, connected: boolean) => void;
    markSaved: (status: string, detail: string) => void;
    dataPath: () => string;
    getConfig: () => AnyRec;
    authUser: () => AnyRec;
  };
  profileCommand: { saveLab: (input: AnyRec) => void; saveBrand: (input: AnyRec) => void; updateDraft: (input: AnyRec) => void; saveLogo: (input: AnyRec, dataUrl: string) => void; clearLogo: () => void };
  firebaseCommand: { connect: (input: AnyRec) => Promise<unknown>; clear: () => Promise<unknown> };
  firebaseSettingsService: { prepare: (input: AnyRec) => AnyRec };
  brand: { logo: () => string; markText: () => string; title: () => string; subtitle: () => string; profile: (lab: AnyRec) => AnyRec };
  html: {
    storageUsageText: (data: AnyRec, estimate: AnyRec) => string;
    brandPreviewHtml: (input: AnyRec) => string;
    firebaseRulesPanelHtml: (guideHtml: string, rulesText: string) => string;
    firebaseGuideHtml: () => string;
    firebaseRulesText: () => string;
    pageLayoutHtml: (input: AnyRec) => string;
    unitProfileHtml: (lab: AnyRec) => string;
    brandPanelHtml: (input: AnyRec) => string;
    adminToolsHtml: (statusText: string, capacityText: string) => string;
    firebaseConnectionPanelHtml: (input: AnyRec) => string;
    lisGatewayPanelHtml: (input: AnyRec) => string;
    firebaseAclHelp: (labCode: string, uid: string) => string;
  };
  lis: { config: () => AnyRec; runtime: () => AnyRec; statusText: () => string };
  backup: { statusText: () => string; capacityText: () => string };
}) {
  const field = (id: string) => deps.document.getElementById(id) as AnyRec;
  const fieldValue = (id: string) => { const el = field(id); return el ? el.value : ''; };

  const checkStorageUsage = async () => {
    let estimate = null;
    try {
      const nav = deps.navigator();
      if (nav && nav.storage && typeof nav.storage.estimate === 'function') estimate = await nav.storage.estimate();
    } catch { /* storage estimate not available */ }
    await deps.infoDialog(deps.html.storageUsageText(deps.getState().data, estimate), { title: 'Dung lượng cục bộ', type: 'success' });
  };

  const saveLab = async () => {
    if (!deps.requireAdmin()) return;
    deps.profileCommand.saveLab({ name: fieldValue('labName'), dept: fieldValue('labDept'), address: fieldValue('labAddr') });
    await deps.infoDialog('Đã lưu thông tin đơn vị.', { type: 'success' });
  };

  const ensureLabBrandShape = () => {
    const state = deps.getState();
    state.lab = state.lab || {};
    Object.assign(state.lab, deps.brand.profile(state.lab));
  };

  const saveBrand = async () => {
    if (!deps.requireAdmin()) return;
    deps.profileCommand.saveBrand({ brandTitle: fieldValue('brandTitle'), brandSub: fieldValue('brandSub'), logoText: fieldValue('logoText') });
    await deps.infoDialog('Đã lưu logo và tên hiển thị.', { type: 'success' });
  };

  const brandInputDraft = () => {
    const state = deps.getState(), lab = state.lab || {};
    const title = field('brandTitle'), sub = field('brandSub'), txt = field('logoText');
    return { brandTitle: title ? title.value : lab.brandTitle, brandSub: sub ? sub.value : lab.brandSub, logoText: txt ? txt.value : lab.logoText };
  };

  const readBrandInputs = () => deps.profileCommand.updateDraft(brandInputDraft());

  const pickLogo = async (e: AnyRec) => {
    if (!deps.requireAdmin()) return;
    const f = e && e.target && e.target.files && e.target.files[0];
    const nameEl = field('logoFileName');
    if (!f) return;
    if (nameEl) nameEl.textContent = f.name;
    if (!/^image\//.test(f.type)) { await deps.infoDialog('Vui lòng chọn file ảnh.'); return; }
    const r = deps.createFileReader();
    r.onload = () => {
      const img = deps.createImage();
      img.onload = () => {
        const size = 160, c = deps.document.createElement('canvas'), ctx = c.getContext('2d')!;
        c.width = size; c.height = size;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
        const scale = Math.min(size / img.width, size / img.height), w = img.width * scale, h = img.height * scale, x = (size - w) / 2, y = (size - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        deps.profileCommand.saveLogo(brandInputDraft(), c.toDataURL('image/png'));
      };
      img.onerror = async () => { await deps.infoDialog('Không đọc được ảnh logo.'); };
      img.src = String(r.result);
    };
    r.readAsDataURL(f);
  };

  const clearLogo = () => { if (!deps.requireAdmin()) return; deps.profileCommand.clearLogo(); };

  const saveFb = async () => {
    if (!deps.requireAdmin()) return;
    const input = { labCode: fieldValue('fbCode'), email: fieldValue('fbEmail'), password: fieldValue('fbPassword'), config: fieldValue('fbConfig') };
    let plan;
    try { plan = deps.firebaseSettingsService.prepare(input); } catch (e: AnyRec) { await deps.infoDialog(e && e.message ? e.message : 'Firebase config không hợp lệ.'); return; }
    if (!plan.ok) { await deps.infoDialog('Nhập email và mật khẩu Firebase Authentication để kết nối an toàn.'); return; }
    const code = plan.labCode, email = plan.email, password = plan.password, cfg = plan.config;
    try {
      deps.cloud.setStatus('Đang kết nối Firebase...', false); deps.cloud.markSaved('đang kết nối', 'Firebase');
      await deps.firebaseCommand.connect({ labCode: code, email, password, config: cfg });
      await deps.infoDialog('Đã xác thực và bật đồng bộ Firebase.\nVào Realtime Database xem tại: ' + (deps.cloud.dataPath() || 'qclab-shared/{labCode}'), { type: 'success' });
    } catch (e: AnyRec) {
      const msg = e && e.message ? e.message : 'Kiểm tra tài khoản và cấu hình.';
      deps.cloud.setStatus(msg.indexOf('permission_denied') >= 0 ? 'Chưa được cấp quyền Firebase' : 'Đăng nhập Firebase thất bại', false);
      const user = deps.cloud.authUser();
      await deps.infoDialog(msg.indexOf('permission_denied') >= 0 ? deps.html.firebaseAclHelp(code, user && user.uid || 'UID_TAI_KHOAN_FIREBASE') : 'Không thể đăng nhập Firebase: ' + msg);
    }
  };

  const clearFb = async () => {
    if (!deps.requireAdmin()) return;
    await deps.firebaseCommand.clear(); await deps.infoDialog('Đã ngắt đám mây. Dữ liệu vẫn lưu cục bộ.', { type: 'success' });
  };

  const copyFirebaseRules = async () => {
    const text = deps.html.firebaseRulesText();
    try {
      const nav = deps.navigator();
      if (nav && nav.clipboard && nav.clipboard.writeText) await nav.clipboard.writeText(text);
      else { const ta = deps.document.createElement('textarea'); ta.value = text; deps.document.body.appendChild(ta); ta.select(); deps.document.execCommand('copy'); ta.remove(); }
      await deps.infoDialog('Đã copy Firebase Rules.', { type: 'success' });
    } catch { await deps.infoDialog('Không copy được tự động. Bạn có thể chọn và copy trong thẻ Firebase Rules.'); }
  };

  const pageSettings = () => {
    const fbcfg = deps.cloud.getConfig() || {};
    const liscfg = deps.lis.config();
    const lockedCloud = !!(fbcfg && fbcfg.locked);
    const logo = deps.brand.logo();
    const brandPreview = deps.html.brandPreviewHtml({ logo, markText: deps.brand.markText(), title: deps.brand.title(), subtitle: deps.brand.subtitle() });
    const firebaseRulesPanel = deps.html.firebaseRulesPanelHtml(deps.html.firebaseGuideHtml(), deps.html.firebaseRulesText());
    return deps.html.pageLayoutHtml({
      profileHtml: deps.html.unitProfileHtml(deps.getState().lab) + deps.html.brandPanelHtml({ title: deps.brand.title(), subtitle: deps.brand.subtitle(), markText: deps.brand.markText(), previewHtml: brandPreview }),
      adminHtml: deps.html.adminToolsHtml(deps.backup.statusText(), deps.backup.capacityText()),
      firebaseHtml: deps.html.firebaseConnectionPanelHtml({ labCode: fbcfg.labCode, email: fbcfg.email, config: fbcfg.config, locked: lockedCloud, dataPath: deps.cloud.dataPath() }),
      lisHtml: deps.html.lisGatewayPanelHtml({ url: liscfg.url, token: liscfg.token, enabled: liscfg.enabled, status: deps.lis.runtime().status, statusText: deps.lis.statusText() }),
      rulesHtml: firebaseRulesPanel,
    });
  };

  return { checkStorageUsage, saveLab, ensureLabBrandShape, saveBrand, readBrandInputs, pickLogo, clearLogo, saveFb, clearFb, copyFirebaseRules, pageSettings };
}
