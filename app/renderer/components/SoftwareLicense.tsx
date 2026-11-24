import { useEffect, useState, type ReactNode } from 'react';
import type { LoginBrand, SoftwareLicenseStatus } from '../../shared/qc-api';
import { useSoftwareStore } from '../store/software-store';
import { AuthBrand } from '../pages/LoginPage';
import { isLanStation } from '../lib/runtime';
import { errorDialog } from '../state/dialog-store';

export function SoftwareActivationForm({ license, onActivated }: { license: SoftwareLicenseStatus; onActivated(): void }) {
  const [code, setCode] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [copyHint, setCopyHint] = useState('Gửi mã máy này cho bên cấp phần mềm để nhận mã kích hoạt.');
  const lan = license.runtime === 'lan';
  if (lan) return <p className="hint">Liên hệ quản trị viên để kích hoạt phần mềm trên máy chủ.</p>;
  return <form className="auth-form" onSubmit={async (event) => {
    event.preventDefault(); if (busy || !code.trim()) return;
    setBusy(true); setError('');
    try {
      const result = await window.qcApi.activateSoftware({ data: { activationCode: code.trim() } });
      if (!result.ok) setError(result.error.message); else { setCode(''); onActivated(); }
    } catch { await errorDialog('Không lưu được mã kích hoạt. Hãy thử lại.', { title: 'Chưa kích hoạt được phần mềm' }); }
    finally { setBusy(false); }
  }}>
    <div className="field auth-field">
      <label htmlFor="software-machine-code">Mã máy</label>
      <div className="activation-machine">
        <input id="software-machine-code" value={license.machine_code} readOnly onFocus={(event) => event.target.select()} aria-describedby="activation-machine-help" />
        <button type="button" className="btn ghost" disabled={!license.machine_code} aria-label="Sao chép mã máy" onClick={async () => {
          try { await navigator.clipboard.writeText(license.machine_code); setCopyHint('Đã sao chép mã máy. Gửi mã này cho bên cấp phần mềm.'); }
          catch { document.getElementById('software-machine-code')?.focus(); setCopyHint('Chọn mã máy rồi nhấn Ctrl+C để sao chép.'); }
        }}>Sao chép</button>
      </div>
      <p id="activation-machine-help" className="hint activation-help" role="status">{copyHint}</p>
    </div>
    <div className="field auth-field">
      <label htmlFor="software-activation-code">Mã kích hoạt</label>
      <textarea id="software-activation-code" className="activation-code" rows={4} maxLength={8192} value={code} placeholder="Dán mã kích hoạt bạn đã nhận vào đây" spellCheck={false} autoCapitalize="off" autoFocus disabled={busy} aria-invalid={!!error} aria-describedby={error ? 'activation-error' : 'activation-code-help'} onChange={(event) => { setCode(event.target.value); setError(''); }} />
      <p id="activation-code-help" className="hint activation-help">Mỗi mã kích hoạt chỉ dùng cho một máy.</p>
      {error && <p id="activation-error" className="field-error" role="alert">{error}</p>}
    </div>
    <div className="auth-actions"><button type="submit" className="btn teal" disabled={busy || !code.trim() || !license.machine_code} aria-busy={busy}>{busy ? 'Đang kích hoạt…' : 'Kích hoạt phần mềm'}</button></div>
  </form>;
}

export function SoftwareLicenseBoundary({ children }: { children: ReactNode }) {
  const license = useSoftwareStore((state) => state.license), error = useSoftwareStore((state) => state.licenseError);
  const load = useSoftwareStore((state) => state.loadLicense);
  const [hasSession, setHasSession] = useState(false);
  const [brand, setBrand] = useState<LoginBrand | null>(null);
  useEffect(() => {
    let alive = true;
    void window.qcApi.getLoginBrand().then((value) => { if (alive) setBrand(value); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!license || license.state === 'active' || license.state === 'development' || license.runtime === 'lan') return;
    let alive = true;
    void window.qcApi.currentUser().then((user) => { if (alive) setHasSession(!!user); }).catch(() => {});
    return () => { alive = false; };
  }, [license]);
  useEffect(() => {
    void load();
    // Trước đăng nhập, LAN chỉ hỏi trạng thái công khai và kiểm tra định kỳ.
    // Mở SSE lúc này sẽ nhận 401 rồi giữ luồng đã đóng cho cả phiên sau đó.
    const remove = isLanStation() ? () => {} : window.qcApi.onStoreChanged((event) => { if (event.tables.includes('app_meta')) void load(); });
    const timer = setInterval(() => { void load(); }, 60_000);
    return () => { remove(); clearInterval(timer); };
  }, [load]);
  if (license && (license.state === 'active' || license.state === 'development')) return children;
  return <div className="auth-overlay"><div className="auth-card activation-card">
    <AuthBrand brand={brand} />
    <div className="activation-heading"><h1>Kích hoạt phần mềm</h1><p>Nhập mã kích hoạt để bắt đầu sử dụng QC Lab.</p></div>
    {error && <div className="auth-err activation-status" role="alert">{error}</div>}
    {!error && license && !['required', 'development', 'active'].includes(license.state) && <div className="alert warn activation-status" role="status">{license.message}</div>}
    {!license && !error && <p className="hint activation-status">Đang kiểm tra giấy phép…</p>}
    {license && <SoftwareActivationForm license={license} onActivated={() => { void load(); }} />}
    <div className="activation-secondary">
      {hasSession && <button type="button" className="btn ghost" onClick={async () => { await window.qcApi.logout(); setHasSession(false); void load(); }}>Đăng xuất phiên hiện tại</button>}
      {(error || license?.runtime === 'lan' || license?.state === 'unavailable') && <button className="btn ghost" type="button" onClick={() => { void load(); }}>Kiểm tra lại</button>}
    </div>
    <div className="auth-hint">Phiên bản {import.meta.env.VITE_APP_VERSION}</div>
  </div></div>;
}
