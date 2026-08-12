export function createFirebaseConnectionPanelHtml(deps: { escape: (value: unknown) => string; escapeAttribute: (value: unknown) => string; button: (label: string, action: string, variant: string) => string }) {
  return (input: { labCode?: unknown; email?: unknown; config?: unknown; locked?: unknown; dataPath?: unknown }): string => {
    const locked = !!input.locked;
    const readOnly = locked ? 'readonly' : '';
    const config = input.config ? JSON.stringify(input.config, null, 2) : '';
    const lockNote = locked ? `<div class="hint flow-note">Bản deploy này khóa sẵn <code>${deps.escape(input.dataPath || '')}</code>. Muốn đổi mã phòng cần sửa <code>assets/modules/app-meta.js</code>.</div>` : '';
    return `<div class="panel firebase-sync-panel"><h2 class="panel-title">Đồng bộ Đám mây (Firebase Realtime Database)</h2>
     <div class="firebase-auth-grid"><div><label>Mã phòng</label><input id="fbCode" aria-label="Mã phòng" value="${deps.escapeAttribute(input.labCode || 'khoaXN')}" ${readOnly}></div>
       <div><label>Email Firebase Authentication</label><input id="fbEmail" aria-label="Email Firebase Authentication" type="email" autocomplete="username" value="${deps.escapeAttribute(input.email || '')}"></div>
       <div><label>Mật khẩu Firebase</label><input id="fbPassword" type="password" autocomplete="current-password" placeholder="Chỉ dùng để đăng nhập, không lưu"></div></div>
     ${lockNote}
     <label>Firebase config (dán nguyên đoạn từ tab Config của Firebase console)</label>
     <textarea id="fbConfig" class="firebase-config-input" ${readOnly} placeholder='const firebaseConfig = {
  apiKey: "...",
  authDomain: "yourapp.firebaseapp.com",
  databaseURL: "https://yourapp-default-rtdb.firebaseio.com",
  projectId: "yourapp",
  storageBucket: "yourapp.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};'>${deps.escape(config)}</textarea>
     <div class="firebase-actions">${deps.button('Lưu &amp; kết nối', 'saveFb()', 'teal')} ${deps.button('Ngắt đám mây', 'clearFb()', 'ghost')}</div></div>`;
  };
}
