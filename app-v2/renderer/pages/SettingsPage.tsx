// Cài đặt — Giai đoạn B10 (docs/APP-V2-PLAN.md): logo/brand ảnh (canvas
// resize) + kiểm tra dung lượng lưu trữ. Giai đoạn C3: backup/restore thật
// (`main/domain/backup.ts` + `main/ipc/backup-handlers.ts`). Giai đoạn C4:
// di trú dữ liệu từ backup app CŨ (`main/domain/migrate-legacy.ts`) — khác
// C3 (round-trip cùng định dạng), đây là ánh xạ giữa 2 hình dạng dữ liệu
// khác nhau nên có bước "xem trước số lượng" riêng trước khi xác nhận.
// Giai đoạn C5: client cho LIS Gateway prototype (`main/ipc/lis-handlers.ts`)
// — gateway server độc lập (`lis-gateway/`), không đổi gì ở đó. Firebase
// (C2) vẫn tạm dừng theo quyết định người dùng.
import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../store/settings-store';
import { infoDialog, confirmDialog, reauthDialog } from '../state/dialog-store';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import type { MigrationSummary, LisGatewaySettings, LisQueueRecord } from '../../shared/qc-api';

const LOGO_SIZE = 96;
/** Chu kỳ tự động kiểm tra hàng chờ LIS — copy `LIS_POLL_MS` app cũ. */
const LIS_POLL_MS = 5 * 60 * 1000;
const LIS_STATUS_LABEL: Record<string, string> = { off: 'Đang tắt', idle: 'Chưa kiểm tra', ok: 'Đã kết nối', error: 'Lỗi kết nối' };

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export function SettingsPage() {
  const { profile, storage, load, loadStorage, save } = useSettingsStore();
  const [name, setName] = useState('');
  const [dept, setDept] = useState('');
  const [address, setAddress] = useState('');
  const [brandTitle, setBrandTitle] = useState('');
  const [brandSub, setBrandSub] = useState('');
  const [seeded, setSeeded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pendingLogo, setPendingLogo] = useState<string | null>(null);
  const [logoText, setLogoText] = useState('');
  const [logoFileName, setLogoFileName] = useState('');
  const [backupInfo, setBackupInfo] = useState<{ lastBackupAt: string | null; lastBackupBytes: number; maxImportBytes: number } | null>(null);
  const [lisStatus, setLisStatus] = useState<{ kind: 'off' | 'idle' | 'ok' | 'error'; detail: string }>({ kind: 'off', detail: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const verifyFileInputRef = useRef<HTMLInputElement>(null);
  const migrationFileInputRef = useRef<HTMLInputElement>(null);
  const [migrationPreview, setMigrationPreview] = useState<{ json: string; summary: MigrationSummary } | null>(null);

  const [lisEnabled, setLisEnabled] = useState(false);
  const [lisUrl, setLisUrl] = useState('');
  const [lisToken, setLisToken] = useState('');
  const [lisErr, setLisErr] = useState<string | null>(null);
  const [lisQueue, setLisQueue] = useState<{ pending: LisQueueRecord[]; unresolved: LisQueueRecord[] } | null>(null);
  const [lisQueueOpen, setLisQueueOpen] = useState(false);

  useEffect(() => {
    load(); loadStorage();
    window.qcApi.backupStatus().then(setBackupInfo);
    window.qcApi.getLisSettings().then((s: LisGatewaySettings) => { setLisEnabled(s.enabled); setLisUrl(s.url); setLisToken(s.token); });
  }, [load, loadStorage]);

  // Bật LIS = TỰ ĐỘNG kiểm tra hàng chờ mỗi 5 phút, đúng như nhãn app cũ
  // hứa (`LIS_POLL_MS`). Trước Giai đoạn D3.3 app-v2 chỉ lấy hàng chờ khi
  // bấm nút, nên nhãn đó là lời hứa suông — nay có bộ đếm thật.
  useEffect(() => {
    if (!lisEnabled) { setLisStatus({ kind: 'off', detail: 'Chưa bật' }); return; }
    let alive = true;
    const tick = async () => {
      const result = await window.qcApi.pullLisQueue();
      if (!alive) return;
      if (!result.ok) { setLisStatus({ kind: 'error', detail: result.error.message }); return; }
      setLisQueue(result.data);
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

  if (!profile) return <div className="panel"><p className="empty-state">Đang tải…</p></div>;

  async function submit() {
    setErr(null);
    const result = await save({ name, dept, address, brandTitle, brandSub, logoText, logoData: pendingLogo || undefined });
    if (!result.ok) { setErr(result.error.message); return; }
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
    if (!result.ok) { setErr(result.error.message); return; }
    setPendingLogo(null);
    setLogoFileName('');
  }

  const currentLogo = pendingLogo || profile.logo_data;

  async function exportBackupFile() {
    const result = await window.qcApi.exportBackup();
    if (!result.ok) { setErr(result.error.message); return; }
    const blob = new Blob([result.data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `qclab-v2-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBackupInfo(await window.qcApi.backupStatus());
  }

  async function pickBackupFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const json = await file.text();
    if (!(await confirmDialog(
      'Phục hồi từ backup sẽ THAY THẾ TOÀN BỘ dữ liệu hiện có bằng nội dung trong file này. Một bản sao lưu an toàn của dữ liệu hiện tại sẽ được tự động tạo trước khi ghi đè. Tiếp tục?',
      { title: 'Phục hồi từ backup', danger: true, confirmLabel: 'Phục hồi' },
    ))) return;
    if (!(await reauthDialog({ title: 'Xác thực trước khi phục hồi', message: 'Phục hồi từ backup là thao tác không thể huỷ ngang — xác thực lại mật khẩu.' }))) return;
    const result = await window.qcApi.importBackup({ data: { json } });
    if (!result.ok) { setErr(result.error.message); return; }
    await infoDialog(`Đã phục hồi thành công. Bản sao lưu dữ liệu trước khi phục hồi được lưu tại:\n${result.data.preRestoreSnapshotPath}`, { type: 'success' });
  }

  // Giai đoạn C4 — di trú từ backup app CŨ ('qclab-backup'). Khác luồng
  // backup C3 ở trên: hình dạng dữ liệu 2 bên khác nhau nên XEM TRƯỚC số
  // lượng (preview, không ghi DB) trước khi hỏi xác nhận — người dùng cần
  // biết "sẽ nhập bao nhiêu" trước khi quyết định thay thế toàn bộ dữ liệu
  // app-v2 hiện có.
  async function pickMigrationFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMigrationPreview(null);
    const json = await file.text();
    const result = await window.qcApi.previewLegacyBackup({ data: { json } });
    if (!result.ok) { setErr(result.error.message); return; }
    setErr(null);
    setMigrationPreview({ json, summary: result.data });
  }

  async function confirmMigration() {
    if (!migrationPreview) return;
    const s = migrationPreview.summary;
    if (!(await confirmDialog(
      `Sẽ nhập: ${s.instruments} máy, ${s.tests} xét nghiệm, ${s.qcLots} lô QC, ${s.qcPoints} điểm QC, ${s.users} người dùng, ${s.activity} dòng nhật ký, ${s.actions} hồ sơ NCE.\n\n` +
      'Thao tác này sẽ THAY THẾ TOÀN BỘ dữ liệu app-v2 hiện có bằng dữ liệu đã di trú từ app cũ. Một bản sao lưu an toàn của dữ liệu hiện tại sẽ được tự động tạo trước khi ghi đè. Tiếp tục?',
      { title: 'Di trú dữ liệu từ app cũ', danger: true, confirmLabel: 'Di trú' },
    ))) return;
    if (!(await reauthDialog({ title: 'Xác thực trước khi di trú', message: 'Di trú dữ liệu là thao tác không thể huỷ ngang — xác thực lại mật khẩu.' }))) return;
    const result = await window.qcApi.importLegacyBackup({ data: { json: migrationPreview.json } });
    if (!result.ok) { setErr(result.error.message); return; }
    setMigrationPreview(null);
    await infoDialog(`Đã di trú thành công. Bản sao lưu dữ liệu trước khi di trú được lưu tại:\n${result.data.preMigrationSnapshotPath}`, { type: 'success' });
  }

  // Giai đoạn C5 — LIS Gateway (xem main/ipc/lis-handlers.ts).
  async function saveLisSettings() {
    setLisErr(null);
    const result = await window.qcApi.saveLisSettings({ data: { enabled: lisEnabled, url: lisUrl, token: lisToken } });
    if (!result.ok) { setLisErr(result.error.message); return; }
    await infoDialog('Đã lưu cấu hình LIS Gateway.', { type: 'success' });
  }

  async function openLisQueue() {
    if (!lisEnabled) { setLisErr('Bật LIS Gateway và lưu cấu hình trước khi xem hàng chờ.'); return; }
    setLisErr(null);
    const result = await window.qcApi.pullLisQueue();
    if (!result.ok) { setLisErr(result.error.message); return; }
    setLisQueue(result.data);
    setLisQueueOpen(true);
  }

  async function refreshLisQueue() {
    const result = await window.qcApi.pullLisQueue();
    if (!result.ok) { setLisErr(result.error.message); return; }
    setLisQueue(result.data);
  }

  async function importLisRecord(record: LisQueueRecord) {
    const result = await window.qcApi.importLisResult({ data: { record } });
    if (!result.ok) { await infoDialog(result.error.message, { type: 'warn' }); return; }
    if (result.data.gatewayWarning) await infoDialog(result.data.gatewayWarning, { type: 'warn' });
    await refreshLisQueue();
  }

  async function rejectLisRecord(messageId: string) {
    if (!(await confirmDialog('Bỏ kết quả QC này khỏi hàng chờ LIS?', { title: 'Hàng chờ LIS', danger: true }))) return;
    const result = await window.qcApi.rejectLisResult({ data: { messageId } });
    if (!result.ok) { await infoDialog(result.error.message, { type: 'warn' }); return; }
    await refreshLisQueue();
  }

  /** "Kiểm tra backup" — chỉ đọc file, không đụng dữ liệu đang dùng. */
  async function pickVerifyFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = await window.qcApi.verifyBackup({ data: { json: await file.text() } });
    if (!result.ok) { await infoDialog(`File backup KHÔNG hợp lệ: ${result.error.message}`, { type: 'warn' }); return; }
    await infoDialog(
      `File backup hợp lệ (checksum khớp).\n\nSố bảng: ${result.data.tables}\nSố điểm QC: ${result.data.points}\nTổng số dòng: ${result.data.rows}\nPhiên bản schema: ${result.data.schemaVersion}\nXuất lúc: ${result.data.createdAt}`,
      { type: 'success' },
    );
  }

  // Port `backupReminder.statusText()/capacityText()` app cũ — giữ nguyên
  // từng chuỗi để lời nhắc sao lưu đọc giống nhau ở 2 bản.
  function backupStatusText(): string {
    if (!backupInfo || !backupInfo.lastBackupAt) return 'Chưa sao lưu trên máy này.';
    const days = Math.floor((Date.now() - new Date(backupInfo.lastBackupAt).getTime()) / 86400000);
    return days <= 0 ? 'Sao lưu gần nhất: hôm nay.' : `Sao lưu gần nhất: ${days} ngày trước.`;
  }
  function backupCapacityText(): string {
    const limit = Math.round((backupInfo?.maxImportBytes ?? 0) / 1024 / 1024);
    if (!backupInfo?.lastBackupBytes) return `Khuyến nghị dưới ${limit} MB.`;
    const mb = (backupInfo.lastBackupBytes / 1024 / 1024).toFixed(1);
    return `Backup gần nhất ${mb} MB (khuyến nghị dưới ${limit} MB).`;
  }

  async function checkStorage() {
    await loadStorage();
    const [info, summaries] = await Promise.all([window.qcApi.getStorageInfo(), window.qcApi.listTestSummaries()]);
    const points = summaries.reduce((sum, test) => sum + test.levels.reduce((s, level) => s + level.pointCount, 0), 0);
    await infoDialog(`Số điểm QC đang lưu: ${points}.\nFile dữ liệu SQLite đang chiếm ${formatBytes(info.dbFileBytes)} trên đĩa.\n\n${info.path}`);
  }

  /** "Xóa sạch dữ liệu test" — xoá dữ liệu vận hành, GIỮ tài khoản + nhật ký
   * (ánh xạ `ResetOperationalDataCommand` app cũ). Không thể hoàn tác nên đi
   * qua đủ confirm + reauth, và main tự chốt 1 bản an toàn ra đĩa trước. */
  async function resetAll() {
    if (!(await confirmDialog(
      'Toàn bộ máy xét nghiệm, xét nghiệm, mức QC, điểm QC, hồ sơ NCE, so sánh hoá chất, kỳ Sigma, khoá kỳ báo cáo và bảng TEa sẽ bị xoá. Tài khoản người dùng và nhật ký hoạt động được giữ lại. Một bản sao lưu an toàn sẽ được tạo tự động trước khi xoá. Tiếp tục?',
      { title: 'Xóa sạch dữ liệu test', danger: true, confirmLabel: 'Xóa sạch' },
    ))) return;
    if (!(await reauthDialog({ title: 'Xác thực trước khi xoá', message: 'Xoá sạch dữ liệu là thao tác không thể huỷ ngang — xác thực lại mật khẩu.' }))) return;
    const result = await window.qcApi.resetOperationalData();
    if (!result.ok) { setErr(result.error.message); return; }
    await loadStorage();
    await infoDialog(`Đã xoá ${result.data.clearedTables.length} bảng dữ liệu vận hành.\n\nBản sao lưu trước khi xoá: ${result.data.preResetSnapshotPath}`, { type: 'success' });
  }

  return (
    <>
      {/* Tiêu đề giống app cũ. PHỤ ĐỀ cố ý khác: bản cũ ghi "kết nối
          Firebase" mà app-v2 chưa có Firebase (C2 tạm dừng) — copy nguyên
          văn sẽ hứa một tính năng không tồn tại. Đây là 1 trong 3 khác biệt
          đã ghi vào baseline gate của trang này, xem CLAUDE.md D3.3. */}
      <PageHeader title="Cài đặt & Đồng bộ" subtitle="Thông tin đơn vị, logo, backup, di trú dữ liệu và LIS Gateway" />
      {err && <p className="field-error">{err}</p>}

      <div className="settings-profile-grid">
        <div className="panel">
          <h2 className="panel-title">Thông tin đơn vị</h2>
          <div className="settings-unit-fields">
            <div><label htmlFor="labName">Tên bệnh viện / đơn vị</label><input id="labName" aria-label="Tên bệnh viện / đơn vị" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label htmlFor="labDept">Khoa / phòng</label><input id="labDept" aria-label="Khoa / phòng" value={dept} onChange={(e) => setDept(e.target.value)} /></div>
            <div><label htmlFor="labAddr">Địa chỉ</label><input id="labAddr" aria-label="Địa chỉ" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          </div>
          <div className="settings-panel-actions"><button className="btn teal" onClick={submit}>Lưu thông tin</button></div>
        </div>

        <div className="panel">
          <h2 className="panel-title">Logo &amp; tên phần mềm</h2>
          <div className="grid2">
            <div>
              <label htmlFor="brandTitle">Tên hiển thị</label><input id="brandTitle" aria-label="Tên hiển thị" value={brandTitle} onChange={(e) => setBrandTitle(e.target.value)} />
              <label htmlFor="brandSub">Dòng phụ</label><input id="brandSub" aria-label="Dòng phụ" value={brandSub} onChange={(e) => setBrandSub(e.target.value)} />
              <label htmlFor="logoText">Chữ trong logo khi chưa dùng ảnh</label><input id="logoText" aria-label="Chữ trong logo khi chưa dùng ảnh" maxLength={4} value={logoText} onChange={(e) => setLogoText(e.target.value)} />
            </div>
            <div>
              <label>Logo hiện tại</label>
              <div className="brand-preview">
                <div className="brand-mark">{currentLogo ? <img src={currentLogo} alt="" /> : (logoText || 'QC')}</div>
                <div><b>{brandTitle}</b><small>{brandSub}</small></div>
              </div>
              <label>Chọn ảnh logo</label>
              <div className="file-pick">
                <button type="button" className="btn ghost sm" onClick={() => fileInputRef.current?.click()}>Chọn tệp</button>
                <span id="logoFileName" className="hint">{logoFileName || 'Chưa chọn tệp'}</span>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickLogo} />
              <div className="hint settings-brand-note">Nên dùng ảnh vuông PNG/JPG, dung lượng nhỏ. Logo được lưu cùng dữ liệu phần mềm.</div>
            </div>
          </div>
          <div className="settings-panel-actions">
            <button className="btn teal" onClick={submit}>Lưu logo</button>
            <button className="btn ghost" onClick={clearLogo}>Bỏ ảnh logo</button>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Quản trị dữ liệu</h2>
        <div className="admin-tools">
          <div className="admin-tool">
            <b>Xuất backup</b>
            <span>Lưu dữ liệu hiện tại ra file. {backupStatusText()} {backupCapacityText()}</span>
            <button className="btn ghost" onClick={exportBackupFile}>Xuất backup</button>
          </div>
          <div className="admin-tool">
            <b>Nhập backup</b>
            <span>Khôi phục dữ liệu từ file backup đã xuất. Chỉ quản trị viên được nhập.</span>
            <button className="btn ghost" onClick={() => backupFileInputRef.current?.click()}>Chọn file backup</button>
            <input ref={backupFileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={pickBackupFile} />
          </div>
          <div className="admin-tool">
            <b>Kiểm tra backup</b>
            <span>Kiểm tra checksum, cấu trúc và số điểm — không ảnh hưởng dữ liệu đang dùng.</span>
            <button className="btn ghost" onClick={() => verifyFileInputRef.current?.click()}>Chọn file để kiểm tra</button>
            <input ref={verifyFileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={pickVerifyFile} />
          </div>
          <div className="admin-tool">
            <b>Dung lượng cục bộ</b>
            <span>Xem dung lượng file dữ liệu SQLite mà phần mềm đang dùng.</span>
            <button className="btn ghost" onClick={checkStorage}>Kiểm tra dung lượng</button>
          </div>
          <div className="admin-tool">
            <b>Xóa sạch dữ liệu test</b>
            <span>Xóa toàn bộ dữ liệu, giữ lại tài khoản đang đăng nhập.</span>
            <button className="btn danger" onClick={resetAll}>Xóa sạch dữ liệu</button>
          </div>
        </div>
      </div>

      {/* App cũ đặt 2 panel [Đồng bộ đám mây] [LIS Gateway] cạnh nhau ở đây.
          app-v2 chưa có Firebase nên ô bên trái là panel Di trú dữ liệu (thứ
          app cũ không có) — giữ lưới 2 cột để không để trống nửa trang. */}
      <div className="settings-cloud-grid">
        <div className="panel">
          <h2 className="panel-title">Di trú dữ liệu từ app cũ</h2>
          <div className="lis-gateway-body">
            <div className="hint">
              Nhập dữ liệu từ 1 file backup của app QC Lab CŨ (định dạng khác, không phải backup app-v2 ở trên) — máy/xét nghiệm/mức QC, toàn bộ điểm QC, người dùng (giữ nguyên mật khẩu), nhật ký hoạt động (giữ nguyên chuỗi xác thực), lô/nhóm lô, Panel QC, chuyển tiếp lô, hồ sơ NCE, so sánh hoá chất, khoá kỳ báo cáo, bảng TEa tham chiếu.
            </div>
            {migrationPreview && (
              <div className="alert">
                Sẽ nhập: <b>{migrationPreview.summary.instruments}</b> máy, <b>{migrationPreview.summary.tests}</b> xét nghiệm,{' '}
                <b>{migrationPreview.summary.qcLots}</b> lô QC, <b>{migrationPreview.summary.qcPoints}</b> điểm QC,{' '}
                <b>{migrationPreview.summary.users}</b> người dùng, <b>{migrationPreview.summary.activity}</b> dòng nhật ký,{' '}
                <b>{migrationPreview.summary.actions}</b> hồ sơ NCE, <b>{migrationPreview.summary.reagentTests}</b> so sánh hoá chất.
              </div>
            )}
          </div>
          <div className="settings-panel-actions">
            <input ref={migrationFileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={pickMigrationFile} />
            <button className="btn ghost" onClick={() => migrationFileInputRef.current?.click()}>Chọn file backup app cũ</button>
            {migrationPreview && <button className="btn danger" onClick={confirmMigration}>Di trú dữ liệu</button>}
          </div>
        </div>

        <div className="panel lis-gateway-panel">
          <h2 className="panel-title">LIS Gateway (thử nghiệm)</h2>
          <div className="lis-gateway-body">
            <div className="lis-gateway-grid">
              <div><label htmlFor="lisGatewayUrl">Địa chỉ Gateway cục bộ</label><input id="lisGatewayUrl" value={lisUrl} onChange={(e) => setLisUrl(e.target.value)} placeholder="http://127.0.0.1:8787" /></div>
              <div><label htmlFor="lisGatewayToken">Bearer token{lisToken ? ' (đã lưu)' : ''}</label><input id="lisGatewayToken" type="password" autoComplete="off" value={lisToken} onChange={(e) => setLisToken(e.target.value)} placeholder="Dán token in ra khi chạy npm run lis:gateway" /></div>
              <label className="lis-gateway-toggle"><input id="lisGatewayEnabled" type="checkbox" checked={lisEnabled} onChange={(e) => setLisEnabled(e.target.checked)} /><span>Tự động kiểm tra hàng chờ mỗi 5 phút</span></label>
            </div>
            <div id="lisGatewayStatus" className={`alert${lisStatus.kind === 'ok' ? ' ok' : lisStatus.kind === 'error' ? ' rej' : ''}`}>
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

      {lisQueueOpen && lisQueue && (
        <Modal
          title="Hàng chờ QC từ LIS Gateway"
          onClose={() => setLisQueueOpen(false)}
          width={640}
          footer={<>
            <button className="btn ghost sm" onClick={refreshLisQueue}>Làm mới</button>
            <button className="btn ghost sm" onClick={() => setLisQueueOpen(false)}>Đóng</button>
          </>}
        >
          <h4>Sẵn sàng nhận ({lisQueue.pending.length})</h4>
          {lisQueue.pending.length === 0
            ? <p className="empty-state">Không có kết quả nào chờ nhận.</p>
            : (
              <table className="data-table">
                <thead><tr><th>Xét nghiệm</th><th>Mức</th><th>Lô</th><th>Giá trị</th><th></th></tr></thead>
                <tbody>
                  {lisQueue.pending.map((r) => (
                    <tr key={r.id}>
                      <td>{r.resolved.displayName}</td><td>{r.resolved.level}</td><td>{r.resolved.lot}</td><td>{r.message.value}</td>
                      <td style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                        <button className="btn teal sm" onClick={() => importLisRecord(r)}>Nhận</button>
                        <button className="btn ghost sm" onClick={() => rejectLisRecord(r.message.messageId)}>Bỏ</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          <h4 style={{ marginTop: 'var(--space-md)' }}>Chưa khớp cấu hình ({lisQueue.unresolved.length})</h4>
          {lisQueue.unresolved.length === 0
            ? <p className="empty-state">Không có bản ghi nào chưa khớp.</p>
            : (
              <table className="data-table">
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
