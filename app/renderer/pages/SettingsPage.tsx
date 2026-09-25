// Cài đặt: hồ sơ đơn vị, sao lưu/phục hồi, LIS Gateway và đồng bộ Firebase.
import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../store/settings-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { infoDialog, confirmDialog, reauthDialog } from '../state/dialog-store';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import type { LisGatewaySettings, LisQueueRecord, FirebaseSettings } from '../../shared/qc-api';

const LOGO_SIZE = 96;

const LIS_POLL_MS = 5 * 60 * 1000;
const LIS_STATUS_LABEL: Record<string, string> = { off: 'Đang tắt', idle: 'Chưa kiểm tra', ok: 'Đã kết nối', error: 'Lỗi kết nối' };
const FIREBASE_CONFIG_PLACEHOLDER = `const firebaseConfig = {
  apiKey: "...",
  authDomain: "yourapp.firebaseapp.com",
  databaseURL: "https://yourapp-default-rtdb.firebaseio.com",
  projectId: "yourapp",
  appId: "..."
};`;

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DataAdminIcon() {
  return (
    <svg className="settings-admin-icon" viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="10" cy="5" rx="6.5" ry="2.5" />
      <path d="M3.5 5v5c0 1.4 2.9 2.5 6.5 2.5.7 0 1.4 0 2-.1M3.5 10v5c0 1.4 2.9 2.5 6.5 2.5h1.2" />
      <path d="M16.7 12.4a4.2 4.2 0 1 1-1.8 7.9 4.2 4.2 0 0 1 1.8-7.9Z" />
      <path d="m15.1 16.6 1.1 1.1 2.2-2.3" />
    </svg>
  );
}

export function SettingsPage() {
  const {
    profile, backup: backupInfo, lis, lisQueue, firebase,
    loadAll, loadStorage, save, loadFirebase,
    exportBackup, chooseBackupFile, importBackup, resetOperationalData,
    saveLis, pullLisQueue, importLisResult, rejectLisResult,
    connectFirebase: connectFirebaseApi, syncFirebase, disconnectFirebase: disconnectFirebaseApi,
  } = useSettingsStore();
  const [name, setName] = useState('');
  const [dept, setDept] = useState('');
  const [address, setAddress] = useState('');
  const [brandTitle, setBrandTitle] = useState('');
  const [brandSub, setBrandSub] = useState('');
  const [seeded, setSeeded] = useState(false);
  const [pendingLogo, setPendingLogo] = useState<string | null>(null);
  const [logoText, setLogoText] = useState('');
  const [logoFileName, setLogoFileName] = useState('');
  const [lisStatus, setLisStatus] = useState<{ kind: 'off' | 'idle' | 'ok' | 'error'; detail: string }>({ kind: 'off', detail: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lisEnabled, setLisEnabled] = useState(false);
  const [lisUrl, setLisUrl] = useState('');
  const [lisToken, setLisToken] = useState('');
  const [lisErr, setLisErr] = useState<string | null>(null);
  const [lisQueueOpen, setLisQueueOpen] = useState(false);
  const [fbCode, setFbCode] = useState('khoaXN');
  const [fbEmail, setFbEmail] = useState('');
  const [fbPassword, setFbPassword] = useState('');
  const [fbConfig, setFbConfig] = useState('');
  const [fbBusy, setFbBusy] = useState(false);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Trang này đọc hồ sơ đơn vị (`lab`) và các mốc trong `app_meta` (sao lưu
  // gần nhất, cấu hình LIS/Firebase) — đổi ở nơi khác thì phải tự cập nhật,
  // đúng như các trang còn lại. Trước 2026-09-10 trang gọi thẳng
  // `window.qcApi` nên invalidation không có đường nào chạm tới.
  useStoreInvalidation(['lab', 'app_meta'], undefined, () => { loadAll(); });

  // Ô nhập LIS/Firebase là NHÁP của người dùng: chỉ seed MỘT LẦN từ giá trị
  // đã lưu, sau đó form thuộc về người gõ — cùng cờ `seeded` mà hồ sơ đơn vị
  // đang dùng.
  const [lisSeeded, setLisSeeded] = useState(false);
  useEffect(() => {
    if (lisSeeded || !lis) return;
    setLisEnabled(lis.enabled); setLisUrl(lis.url); setLisToken(lis.token); setLisSeeded(true);
  }, [lis, lisSeeded]);
  const [fbSeeded, setFbSeeded] = useState(false);
  useEffect(() => {
    if (fbSeeded || !firebase) return;
    setFbCode(firebase.labCode || 'khoaXN'); setFbEmail(firebase.email); setFbConfig(firebase.config); setFbSeeded(true);
  }, [firebase, fbSeeded]);

  // Bật LIS = TỰ ĐỘNG kiểm tra hàng chờ mỗi 5 phút, đúng như nhãn hệ thống
  // hứa (`LIS_POLL_MS`). Trước Giai đoạn D3.3 app chỉ lấy hàng chờ khi
  // bấm nút, nên nhãn đó là lời hứa suông — nay có bộ đếm thật.
  useEffect(() => {
    if (!lisEnabled) { setLisStatus({ kind: 'off', detail: 'Chưa bật' }); return; }
    let alive = true;
    const tick = async () => {
      const result = await pullLisQueue();
      if (!alive) return;
      if (!result.ok) { setLisStatus({ kind: 'error', detail: result.error.message }); return; }
      setLisStatus({ kind: 'ok', detail: `${result.data.pending.length} chờ nhận · ${result.data.unresolved.length} chưa khớp` });
    };
    tick();
    const timer = setInterval(tick, LIS_POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [lisEnabled]);

  // Nạp giá trị đã lưu vào form đúng 1 lần khi profile về — sau đó form là
  // của người dùng gõ, không bị ghi đè lại mỗi khi store re-render.
  useEffect(() => {
    if (profile && !seeded) {
      setName(profile.name); setDept(profile.dept); setAddress(profile.address);
      setBrandTitle(profile.brand_title); setBrandSub(profile.brand_sub); setLogoText(profile.logo_text);
      setSeeded(true);
    }
  }, [profile, seeded]);

  if (!profile) return <div className="panel"><EmptyState>Đang tải…</EmptyState></div>;

  const showError = (message: string) => infoDialog(message, { type: 'warn' });

  async function submit() {
    const result = await save({ name, dept, address, brandTitle, brandSub, logoText, logoData: pendingLogo || undefined });
    if (!result.ok) { await showError(result.error.message); return; }
    setPendingLogo(null);
    await infoDialog('Đã lưu cài đặt.', { type: 'success' });
  }

  function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = LOGO_SIZE; canvas.height = LOGO_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // Fit-cover: cắt vuông chính giữa ảnh rồi thu về đúng LOGO_SIZE, giữ
        // đúng tỉ lệ khung vuông của logo hiển thị trên sidebar/báo cáo in.
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, LOGO_SIZE, LOGO_SIZE);
        setPendingLogo(canvas.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function clearLogo() {
    if (!(await confirmDialog('Xoá logo hiện tại?', { danger: true }))) return;
    const result = await save({ name, dept, address, brandTitle, brandSub, logoText, clearLogo: true });
    if (!result.ok) { await showError(result.error.message); return; }
    setPendingLogo(null);
    setLogoFileName('');
  }

  const currentLogo = pendingLogo || profile.logo_data;

  // Hộp thoại lưu/mở tệp do main process mở; `data` là null khi người dùng huỷ.
  async function exportBackupFile() {
    const result = await exportBackup();
    if (!result.ok) { await showError(result.error.message); return; }
    if (!result.data) return;
    await infoDialog(`Đã xuất backup ${formatMb(result.data.bytes)} (${result.data.points} điểm QC) tại:\n${result.data.path}`, { type: 'success' });
  }

  async function pickBackupFile() {
    const verified = await chooseBackupFile();
    if (!verified.ok) { await infoDialog(`File backup KHÔNG hợp lệ: ${verified.error.message}`, { type: 'warn' }); return; }
    if (!verified.data) return;
    const created = verified.data.createdAt ? ` tạo lúc ${new Date(verified.data.createdAt).toLocaleString('vi-VN')}` : '';
    if (!(await confirmDialog(
      `File ${verified.data.fileName} hợp lệ (${verified.data.points} điểm QC${created}). Phục hồi sẽ THAY THẾ TOÀN BỘ dữ liệu hiện có. Một bản sao lưu an toàn được tạo trước khi ghi đè. Tiếp tục?`,
      { title: 'Phục hồi từ backup', danger: true, confirmLabel: 'Phục hồi' },
    ))) return;
    if (!(await reauthDialog({ title: 'Xác thực trước khi phục hồi', message: 'Phục hồi từ backup là thao tác không thể huỷ ngang — xác thực lại mật khẩu.' }))) return;
    const result = await importBackup();
    if (!result.ok) { await showError(result.error.message); return; }
    await infoDialog(`Đã phục hồi thành công. Bản sao lưu dữ liệu trước khi phục hồi được lưu tại:\n${result.data.preRestoreSnapshotPath}`, { type: 'success' });
  }

  // Giai đoạn C5 — LIS Gateway (xem main/ipc/lis-handlers.ts).
  async function saveLisSettings() {
    setLisErr(null);
    const result = await saveLis({ enabled: lisEnabled, url: lisUrl, token: lisToken });
    if (!result.ok) { setLisErr(result.error.message); return; }
    await infoDialog('Đã lưu cấu hình LIS Gateway.', { type: 'success' });
  }

  async function refreshFirebase() {
    await loadFirebase();
  }

  async function connectFirebase() {
    setFbBusy(true);
    try {
      const result = await connectFirebaseApi({ labCode: fbCode, email: fbEmail, password: fbPassword, config: fbConfig });
      setFbPassword('');
      if (!result.ok) { await showError(result.error.message); return; }
      if (result.data.state === 'conflict') {
        const push = await confirmDialog(
          'Cả máy này và Firebase đều có dữ liệu khác nhau. Chọn “Đẩy dữ liệu máy” để ghi đè bản đám mây. Chọn “Hủy” để giữ nguyên và chọn tải dữ liệu đám mây ở bước tiếp theo.',
          { title: 'Chọn hướng đồng bộ', danger: true, confirmLabel: 'Đẩy dữ liệu máy' },
        );
        if (push) {
          const synced = await syncFirebase('push');
          if (!synced.ok) { await showError(synced.error.message); return; }
          await infoDialog('Đã ghi dữ liệu trên máy lên Firebase.', { type: 'success' });
        } else if (await confirmDialog('Tải dữ liệu từ Firebase sẽ thay thế dữ liệu trên máy. Một backup an toàn sẽ được tạo tự động. Tiếp tục?', { title: 'Tải từ Firebase', danger: true, confirmLabel: 'Tải dữ liệu đám mây' })) {
          if (!(await reauthDialog({ title: 'Xác thực trước khi tải Firebase', message: 'Tải dữ liệu đám mây sẽ thay thế dữ liệu cục bộ — xác thực lại mật khẩu.' }))) return;
          const synced = await syncFirebase('pull');
          if (!synced.ok) { await showError(synced.error.message); return; }
          await infoDialog('Đã tải dữ liệu từ Firebase. Nếu tài khoản hiện tại không còn trong dữ liệu đám mây, hãy đăng nhập lại.', { type: 'success' });
        }
      } else {
        await infoDialog(result.data.state === 'pushed' ? 'Đã kết nối và đưa dữ liệu hiện tại lên Firebase.' : 'Đã kết nối Firebase; dữ liệu đã đồng bộ.', { type: 'success' });
      }
      await refreshFirebase();
    } finally { setFbBusy(false); }
  }

  async function disconnectFirebase() {
    if (!(await confirmDialog('Ngắt Firebase? Dữ liệu vẫn được giữ nguyên trên máy.', { title: 'Ngắt đồng bộ đám mây' }))) return;
    const result = await disconnectFirebaseApi();
    if (!result.ok) { await showError(result.error.message); return; }
    await refreshFirebase();
    await infoDialog('Đã ngắt Firebase.', { type: 'success' });
  }


  async function openLisQueue() {
    if (!lisEnabled) { setLisErr('Bật LIS Gateway và lưu cấu hình trước khi xem hàng chờ.'); return; }
    setLisErr(null);
    const result = await pullLisQueue();
    if (!result.ok) { setLisErr(result.error.message); return; }
    setLisQueueOpen(true);
  }

  async function refreshLisQueue() {
    const result = await pullLisQueue();
    if (!result.ok) setLisErr(result.error.message);
  }

  async function importLisRecord(record: LisQueueRecord) {
    // `importLisResult` của store tự làm mới hàng chờ TỪ NGUỒN THẬT sau khi
    // ghi thành công (không tự suy đoán trạng thái mới) — xem settings-store.
    const result = await importLisResult(record);
    if (!result.ok) { await infoDialog(result.error.message, { type: 'warn' }); return; }
    if (result.data.gatewayWarning) await infoDialog(result.data.gatewayWarning, { type: 'warn' });
  }

  async function rejectLisRecord(messageId: string) {
    if (!(await confirmDialog('Bỏ kết quả QC này khỏi hàng chờ LIS?', { title: 'Hàng chờ LIS', danger: true }))) return;
    const result = await rejectLisResult(messageId);
    if (!result.ok) await infoDialog(result.error.message, { type: 'warn' });
  }

  function backupStatusText(): string {
    if (!backupInfo || !backupInfo.lastBackupAt) return 'Chưa sao lưu trên máy này.';
    const days = Math.floor((Date.now() - new Date(backupInfo.lastBackupAt).getTime()) / 86400000);
    return days <= 0 ? 'Sao lưu gần nhất: hôm nay.' : `Sao lưu gần nhất: ${days} ngày trước.`;
  }
  function backupCapacityText(): string {
    return backupInfo?.lastBackupBytes ? `Backup gần nhất ${formatMb(backupInfo.lastBackupBytes)}.` : '';
  }

  /** "Xóa sạch dữ liệu test" — xoá dữ liệu vận hành, GIỮ tài khoản + nhật ký
   * (ánh xạ `ResetOperationalDataCommand` hệ thống). Không thể hoàn tác nên đi
   * qua đủ confirm + reauth, và main tự chốt 1 bản an toàn ra đĩa trước. */
  async function resetAll() {
    if (!(await confirmDialog(
      'Toàn bộ máy xét nghiệm, xét nghiệm, mức QC, điểm QC, hồ sơ NCE, so sánh hoá chất, kỳ Sigma, khoá kỳ báo cáo và bảng TEa sẽ bị xoá. Tài khoản người dùng và nhật ký hoạt động được giữ lại. Một bản sao lưu an toàn sẽ được tạo tự động trước khi xoá. Tiếp tục?',
      { title: 'Xóa sạch dữ liệu test', danger: true, confirmLabel: 'Xóa sạch' },
    ))) return;
    if (!(await reauthDialog({ title: 'Xác thực trước khi xoá', message: 'Xoá sạch dữ liệu là thao tác không thể huỷ ngang — xác thực lại mật khẩu.' }))) return;
    const result = await resetOperationalData();
    if (!result.ok) { await showError(result.error.message); return; }
    await loadStorage();
    await infoDialog(`Đã xoá ${result.data.clearedTables.length} bảng dữ liệu vận hành.\n\nBản sao lưu trước khi xoá: ${result.data.preResetSnapshotPath}`, { type: 'success' });
  }

  return (
    <>
      {/* Tiêu đề/phụ đề đã trở về đúng hệ thống từ khi C2 Firebase hoàn tất. */}
      <PageHeader title="Cài đặt & Đồng bộ" subtitle="Thông tin đơn vị, backup và kết nối Firebase" />
      <div className="settings-profile-grid">
        <div className="panel">
          <h2 className="panel-title">Thông tin đơn vị</h2>
          <div className="settings-unit-fields">
            <div className="field"><label htmlFor="labName">Tên bệnh viện / đơn vị</label><input id="labName" aria-label="Tên bệnh viện / đơn vị" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label htmlFor="labDept">Khoa / phòng</label><input id="labDept" aria-label="Khoa / phòng" value={dept} onChange={(e) => setDept(e.target.value)} /></div>
            <div className="field"><label htmlFor="labAddr">Địa chỉ</label><input id="labAddr" aria-label="Địa chỉ" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          </div>
          <div className="settings-panel-actions"><button className="btn teal" onClick={submit}>Lưu thông tin</button></div>
        </div>

        <div className="panel">
          <h2 className="panel-title">Logo &amp; tên phần mềm</h2>
          <div className="grid2">
            <div className="settings-brand-fields">
              <div className="field"><label htmlFor="brandTitle">Tên hiển thị</label><input id="brandTitle" aria-label="Tên hiển thị" value={brandTitle} onChange={(e) => setBrandTitle(e.target.value)} /></div>
              <div className="field"><label htmlFor="brandSub">Dòng phụ</label><input id="brandSub" aria-label="Dòng phụ" value={brandSub} onChange={(e) => setBrandSub(e.target.value)} /></div>
              <div className="field"><label htmlFor="logoText">Chữ trong logo khi chưa dùng ảnh</label><input id="logoText" aria-label="Chữ trong logo khi chưa dùng ảnh" maxLength={4} value={logoText} onChange={(e) => setLogoText(e.target.value)} /></div>
            </div>
            <div className="settings-logo-fields">
              <div className="field">
                <label>Logo hiện tại</label>
                <div className="brand-preview">
                  <div className="brand-mark">{currentLogo ? <img src={currentLogo} alt="" /> : (logoText || 'QC')}</div>
                  <div><b>{brandTitle}</b><small>{brandSub}</small></div>
                </div>
              </div>
              <div className="field">
                <label>Chọn ảnh logo</label>
                <div className="file-pick">
                  <button type="button" className="btn ghost sm" onClick={() => fileInputRef.current?.click()}>Chọn tệp</button>
                  <span id="logoFileName" className="hint">{logoFileName || 'Chưa chọn tệp'}</span>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickLogo} />
                <div className="hint settings-brand-note">Nên dùng ảnh vuông PNG/JPG, dung lượng nhỏ. Logo được lưu cùng dữ liệu phần mềm.</div>
              </div>
            </div>
          </div>
          <div className="settings-panel-actions">
            <button className="btn teal" onClick={submit}>Lưu logo</button>
            <button className="btn ghost" onClick={clearLogo}>Bỏ ảnh logo</button>
          </div>
        </div>
      </div>

      <div className="panel settings-admin-panel">
        <h2 className="panel-title settings-admin-title"><DataAdminIcon />Quản trị dữ liệu</h2>
        <div className="admin-tools">
          <div className="admin-tool">
            <b>Xuất backup</b>
            <span>Lưu toàn bộ dữ liệu ra một tệp .sqlite. {backupStatusText()} {backupCapacityText()}</span>
            <button className="btn ghost" onClick={exportBackupFile}>Xuất backup</button>
          </div>
          <div className="admin-tool">
            <b>Nhập backup</b>
            <span>Chọn file để kiểm tra tự động rồi khôi phục dữ liệu. Chỉ quản trị viên được nhập.</span>
            <button className="btn ghost" onClick={pickBackupFile}>Chọn file backup</button>
          </div>
          <div className="admin-tool">
            <b>Xóa sạch dữ liệu test</b>
            <span>Xóa toàn bộ dữ liệu, giữ lại tài khoản đang đăng nhập.</span>
            <button className="btn danger" onClick={resetAll}>Xóa sạch dữ liệu</button>
          </div>
        </div>
      </div>

      <div className="settings-cloud-grid">
        <div className="panel firebase-sync-panel">
          <h2 className="panel-title">Đồng bộ đám mây (Firebase Realtime Database)</h2>
          <div className="firebase-body">
            <div className="firebase-auth-grid">
              <div className="field"><label htmlFor="fbCode">Mã phòng</label><input id="fbCode" value={fbCode} onChange={(e) => setFbCode(e.target.value)} /></div>
              <div className="field"><label htmlFor="fbEmail">Email Firebase Authentication</label><input id="fbEmail" type="email" autoComplete="username" value={fbEmail} onChange={(e) => setFbEmail(e.target.value)} /></div>
              <div className="field"><label htmlFor="fbPassword">Mật khẩu Firebase</label><input id="fbPassword" type="password" autoComplete="current-password" value={fbPassword} onChange={(e) => setFbPassword(e.target.value)} placeholder="Chỉ dùng để đăng nhập, không lưu" /></div>
            </div>
            <div className="field">
              <label htmlFor="fbConfig">Firebase config (dán nguyên đoạn từ tab Config của Firebase console)</label>
              <textarea id="fbConfig" className="firebase-config-input" value={fbConfig} onChange={(e) => setFbConfig(e.target.value)} placeholder={FIREBASE_CONFIG_PLACEHOLDER} />
            </div>
            <div className={`alert${firebase?.connected ? ' ok' : ''}`}>{firebase?.status || 'Chưa kết nối'} · {firebase?.dataPath || 'qclab-shared/{mã-phòng}'}</div>
          </div>
          <div className="firebase-actions settings-panel-actions">
            <button className="btn teal" disabled={fbBusy} onClick={connectFirebase}>{fbBusy ? 'Đang kết nối…' : 'Lưu & kết nối'}</button>
            <button className="btn ghost" onClick={disconnectFirebase}>Ngắt đám mây</button>
          </div>
        </div>

        <div className="panel lis-gateway-panel">
          <h2 className="panel-title">LIS Gateway (thử nghiệm)</h2>
          <div className="lis-gateway-body">
            <div className="lis-gateway-grid">
              <div className="field"><label htmlFor="lisGatewayUrl">Địa chỉ Gateway cục bộ</label><input id="lisGatewayUrl" value={lisUrl} onChange={(e) => setLisUrl(e.target.value)} placeholder="http://127.0.0.1:8787" /></div>
              <div className="field"><label htmlFor="lisGatewayToken">Bearer token{lisToken ? ' (đã lưu)' : ''}</label><input id="lisGatewayToken" type="password" autoComplete="off" value={lisToken} onChange={(e) => setLisToken(e.target.value)} placeholder="Dán token in ra khi chạy npm run lis:gateway" /></div>
              <label className="lis-gateway-toggle"><input id="lisGatewayEnabled" type="checkbox" checked={lisEnabled} onChange={(e) => setLisEnabled(e.target.checked)} /><span>Tự động kiểm tra hàng chờ mỗi 5 phút</span></label>
            </div>
            <div id="lisGatewayStatus" className={`alert lis-gateway-status${lisStatus.kind === 'ok' ? ' ok' : lisStatus.kind === 'error' ? ' rej' : ''}`}>
              {LIS_STATUS_LABEL[lisStatus.kind]}{lisErr ? ` · ${lisErr}` : lisStatus.detail ? ` · ${lisStatus.detail}` : ''}
            </div>
            <div className="hint">Lấy kết quả nội kiểm mà middleware LIS đã đẩy vào Gateway. Kết quả KHÔNG tự thành điểm QC — phải mở hàng chờ và xác nhận từng dòng thì mới ghi vào dữ liệu nội kiểm. Không nhận dữ liệu bệnh nhân. Prototype chỉ cho phép localhost:8787.</div>
          </div>
          <div className="settings-panel-actions">
            <button className="btn teal" onClick={saveLisSettings}>Lưu &amp; kiểm tra</button>
            <button className="btn ghost" onClick={openLisQueue}>Xem hàng chờ QC</button>
          </div>
        </div>
      </div>

      <p className="settings-firebase-help"><a href="./firebase-guide.html" target="_blank" rel="noreferrer">Mở hướng dẫn thiết lập Firebase và Firebase Rules</a></p>

      {lisQueueOpen && lisQueue && (
        <Modal
          title="Hàng chờ QC từ LIS Gateway"
          onClose={() => setLisQueueOpen(false)}
          footer={<>
            <button className="btn ghost sm" onClick={refreshLisQueue}>Làm mới</button>
            <button className="btn ghost sm" onClick={() => setLisQueueOpen(false)}>Đóng</button>
          </>}
        >
          <h4>Sẵn sàng nhận ({lisQueue.pending.length})</h4>
          {lisQueue.pending.length === 0
            ? <EmptyState size="compact">Không có kết quả nào chờ nhận.</EmptyState>
            : (
              <table>
                <thead><tr><th>Xét nghiệm</th><th>Mức</th><th>Lô</th><th>Giá trị</th><th></th></tr></thead>
                <tbody>
                  {lisQueue.pending.map((r) => (
                    <tr key={r.id}>
                      <td>{r.resolved.displayName}</td><td>{r.resolved.level}</td><td>{r.resolved.lot}</td><td>{r.message.value}</td>
                      <td style={{ display: 'flex', gap: 'var(--space-1-5)' }}>
                        <button className="btn teal sm" onClick={() => importLisRecord(r)}>Nhận</button>
                        <button className="btn ghost sm" onClick={() => rejectLisRecord(r.message.messageId)}>Bỏ</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          <h4 style={{ marginTop: 'var(--space-2-5)' }}>Chưa khớp cấu hình ({lisQueue.unresolved.length})</h4>
          {lisQueue.unresolved.length === 0
            ? <EmptyState size="compact">Không có bản ghi nào chưa khớp.</EmptyState>
            : (
              <table>
                <thead><tr><th>Máy/Mã xét nghiệm</th><th>Lý do</th><th></th></tr></thead>
                <tbody>
                  {lisQueue.unresolved.map((r) => (
                    <tr key={r.id}>
                      <td>{r.message.analyzerId}/{r.message.testCode}</td><td>{r.resolved?.reason}</td>
                      <td><button className="btn ghost sm" onClick={() => rejectLisRecord(r.message.messageId)}>Bỏ</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Modal>
      )}
    </>
  );
}


