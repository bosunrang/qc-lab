import { useAppStore } from '../state/kernel';
import { settingsModel, headOnlyHtml, firebaseGuideHtml, type SettingsModel } from '../bridge/settingsBridge';

function Head() {
  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: headOnlyHtml('Cài đặt & Đồng bộ', 'Thông tin đơn vị, backup và kết nối Firebase') }} />;
}

function UnitProfilePanel({ lab }: { lab: SettingsModel['lab'] }) {
  return (
    <div className="panel">
      <h2 className="panel-title">Thông tin đơn vị</h2>
      <div className="settings-unit-fields">
        <div><label>Tên bệnh viện / đơn vị</label><input id="labName" aria-label="Tên bệnh viện / đơn vị" defaultValue={lab.name} /></div>
        <div><label>Khoa / phòng</label><input id="labDept" aria-label="Khoa / phòng" defaultValue={lab.dept} /></div>
        <div><label>Địa chỉ</label><input id="labAddr" aria-label="Địa chỉ" defaultValue={lab.address} /></div>
      </div>
      <div className="settings-panel-actions"><button className="btn teal" data-action="saveLab">Lưu thông tin</button></div>
    </div>
  );
}

function BrandPreview({ logo, markText, title, subtitle }: { logo: string; markText: string; title: string; subtitle: string }) {
  return (
    <div className="brand-preview">
      <div className="brand-mark">{logo ? <img src={logo} alt="" /> : markText}</div>
      <div><b>{title}</b><small>{subtitle}</small></div>
    </div>
  );
}

function BrandPanel({ brand }: { brand: SettingsModel['brand'] }) {
  return (
    <div className="panel">
      <h2 className="panel-title">Logo & tên phần mềm</h2>
      <div className="grid2">
        <div>
          <label>Tên hiển thị</label><input id="brandTitle" aria-label="Tên hiển thị" defaultValue={brand.title} />
          <label>Dòng phụ</label><input id="brandSub" aria-label="Dòng phụ" defaultValue={brand.subtitle} />
          <label>Chữ trong logo khi chưa dùng ảnh</label><input id="logoText" aria-label="Chữ trong logo khi chưa dùng ảnh" maxLength={4} defaultValue={brand.markText} />
        </div>
        <div>
          <label>Logo hiện tại</label>
          <BrandPreview logo={brand.logo} markText={brand.markText} title={brand.title} subtitle={brand.subtitle} />
          <label>Chọn ảnh logo</label>
          <div className="file-pick">
            <button type="button" className="btn ghost sm" data-action="brandPickLogo">Chọn tệp</button>
            <span id="logoFileName" className="hint">Chưa chọn tệp</span>
          </div>
          <input id="logoFile" type="file" accept="image/*" style={{ display: 'none' }} data-action="pickLogo" data-action-on="change" />
          <div className="hint settings-brand-note">Nên dùng ảnh vuông PNG/JPG, dung lượng nhỏ. Logo được lưu cùng dữ liệu phần mềm.</div>
        </div>
      </div>
      <div className="settings-panel-actions">
        <button className="btn teal" data-action="saveBrand">Lưu logo</button>
        <button className="btn ghost" data-action="clearLogo">Bỏ ảnh logo</button>
      </div>
    </div>
  );
}

function AdminToolsPanel({ backup }: { backup: SettingsModel['backup'] }) {
  return (
    <div className="panel">
      <h2 className="panel-title">Quản trị dữ liệu</h2>
      <div className="admin-tools">
        <div className="admin-tool">
          <b>Xuất backup</b>
          <span>Lưu dữ liệu hiện tại ra file. {backup.statusText} {backup.capacityText}</span>
          <button className="btn ghost" data-action="exportData">Xuất backup</button>
        </div>
        <div className="admin-tool">
          <b>Nhập backup</b>
          <span>Khôi phục dữ liệu từ file backup đã xuất. Chỉ quản trị viên được nhập.</span>
          <button className="btn ghost" data-action="clickElementById" data-args='["imp"]'>Chọn file backup</button>
          <input id="imp" type="file" accept="application/json" style={{ display: 'none' }} data-action="importData" data-action-on="change" />
        </div>
        <div className="admin-tool">
          <b>Kiểm tra backup</b>
          <span>Kiểm tra checksum, cấu trúc và số điểm — không ảnh hưởng dữ liệu đang dùng.</span>
          <button className="btn ghost" data-action="clickElementById" data-args='["verifyBackup"]'>Chọn file để kiểm tra</button>
          <input id="verifyBackup" type="file" accept="application/json" style={{ display: 'none' }} data-action="verifyBackupFile" data-action-on="change" />
        </div>
        <div className="admin-tool">
          <b>Dung lượng cục bộ</b>
          <span>Xem số điểm QC và dung lượng trình duyệt đang dùng.</span>
          <button className="btn ghost" data-action="checkStorageUsage">Kiểm tra dung lượng</button>
        </div>
        <div className="admin-tool">
          <b>Xóa sạch dữ liệu test</b>
          <span>Xóa toàn bộ dữ liệu, giữ lại tài khoản đang đăng nhập.</span>
          <button className="btn danger" data-action="resetAllData">Xóa sạch dữ liệu</button>
        </div>
      </div>
    </div>
  );
}

const FIREBASE_CONFIG_PLACEHOLDER = `const firebaseConfig = {
  apiKey: "...",
  authDomain: "yourapp.firebaseapp.com",
  databaseURL: "https://yourapp-default-rtdb.firebaseio.com",
  projectId: "yourapp",
  storageBucket: "yourapp.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};`;

function FirebaseConnectionPanel({ firebase }: { firebase: SettingsModel['firebase'] }) {
  return (
    <div className="panel firebase-sync-panel">
      <h2 className="panel-title">Đồng bộ đám mây (Firebase Realtime Database)</h2>
      <div className="firebase-auth-grid">
        <div><label>Mã phòng</label><input id="fbCode" aria-label="Mã phòng" defaultValue={firebase.labCode || 'khoaXN'} readOnly={firebase.locked} /></div>
        <div><label>Email Firebase Authentication</label><input id="fbEmail" aria-label="Email Firebase Authentication" type="email" autoComplete="username" defaultValue={firebase.email} /></div>
        <div><label>Mật khẩu Firebase</label><input id="fbPassword" type="password" autoComplete="current-password" placeholder="Chỉ dùng để đăng nhập, không lưu" /></div>
      </div>
      {firebase.locked && (
        <div className="hint flow-note">
          Bản deploy này khóa sẵn <code>{firebase.dataPath}</code>. Muốn đổi mã phòng cần sửa <code>assets/modules/app-meta.js</code>.
        </div>
      )}
      <label>Firebase config (dán nguyên đoạn từ tab Config của Firebase console)</label>
      <textarea id="fbConfig" className="firebase-config-input" readOnly={firebase.locked} placeholder={FIREBASE_CONFIG_PLACEHOLDER} defaultValue={firebase.config} />
      <div className="firebase-actions">
        <button className="btn teal" data-action="saveFb">Lưu & kết nối</button>
        <button className="btn ghost" data-action="clearFb">Ngắt đám mây</button>
      </div>
    </div>
  );
}

function LisGatewayPanel({ lis }: { lis: SettingsModel['lis'] }) {
  const alertClass = ['alert', lis.status === 'ok' ? 'ok' : lis.status === 'error' ? 'rej' : ''].filter(Boolean).join(' ');
  return (
    <div className="panel lis-gateway-panel">
      <h2 className="panel-title">LIS Gateway (thử nghiệm)</h2>
      <div className="lis-gateway-body">
        <div className="lis-gateway-grid">
          <div><label htmlFor="lisGatewayUrl">Địa chỉ Gateway cục bộ</label><input id="lisGatewayUrl" defaultValue={lis.url} placeholder="http://127.0.0.1:8787" /></div>
          <div><label htmlFor="lisGatewayToken">Bearer token{lis.token ? ' (đã lưu — để trống nếu giữ nguyên)' : ''}</label><input id="lisGatewayToken" type="password" autoComplete="off" placeholder={lis.token ? '••••••••' : 'Dán token in ra khi chạy npm run lis:gateway'} /></div>
          <label className="lis-gateway-toggle"><input id="lisGatewayEnabled" type="checkbox" defaultChecked={lis.enabled} /><span>Tự động kiểm tra hàng chờ mỗi 5 phút</span></label>
        </div>
        <div id="lisGatewayStatus" className={alertClass}>{lis.statusText}</div>
        <div className="hint">Lấy kết quả nội kiểm mà middleware LIS đã đẩy vào Gateway. Kết quả KHÔNG tự thành điểm QC — phải mở hàng chờ và xác nhận từng dòng thì mới ghi vào dữ liệu nội kiểm. Không nhận dữ liệu bệnh nhân. Prototype chỉ cho phép localhost:8787.</div>
      </div>
      <div className="settings-panel-actions">
        <button className="btn teal" data-action="lisGatewaySaveSettings">Lưu & kiểm tra</button>
        <button className="btn ghost" data-action="lisOpenQueueModal">Xem hàng chờ QC</button>
      </div>
    </div>
  );
}

function FirebaseRulesPanel({ rulesText }: { rulesText: string }) {
  return (
    <div className="panel">
      <h2 className="panel-title">Firebase Rules</h2>
      <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: firebaseGuideHtml() }} />
      <div className="rules-tools">
        <span>Copy cố định vào Realtime Database → Rules. Không sửa <code>$labCode</code> hoặc <code>$uid</code>.</span>
        <button className="btn ghost sm" data-action="copyFirebaseRules">Copy rules</button>
      </div>
      <pre className="rules-code" tabIndex={0}>{rulesText}</pre>
    </div>
  );
}

export function SettingsPage() {
  useAppStore();
  const model = settingsModel();

  return (
    <>
      <Head />
      <div className="settings-profile-grid">
        <UnitProfilePanel lab={model.lab} />
        <BrandPanel brand={model.brand} />
      </div>
      <AdminToolsPanel backup={model.backup} />
      <div className="settings-cloud-grid">
        <FirebaseConnectionPanel firebase={model.firebase} />
        <LisGatewayPanel lis={model.lis} />
      </div>
      <FirebaseRulesPanel rulesText={model.firebaseRulesText} />
    </>
  );
}
