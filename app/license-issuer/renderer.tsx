import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { LicenseIssuerApi, LicenseIssuerLicense, LicenseIssuerStatus } from '../shared/qc-api';
import { DateField } from '../renderer/components/DateField';
import { DatePickerPopup } from '../renderer/components/DatePickerPopup';
import { closeDatePicker } from '../renderer/state/date-picker-store';
import '../renderer/styles/tokens.css';
import '../renderer/styles/app.css';
import './styles.css';

function Issuer({ api }: { api: LicenseIssuerApi }) {
  const [status, setStatus] = useState<LicenseIssuerStatus | null>(null);
  const [machineCode, setMachineCode] = useState(''), [licensedTo, setLicensedTo] = useState('');
  const [perpetual, setPerpetual] = useState(true), [expiresOn, setExpiresOn] = useState('');
  const [issued, setIssued] = useState<LicenseIssuerLicense | null>(null);
  const [error, setError] = useState(''), [feedback, setFeedback] = useState('Gửi mã kích hoạt cho đúng máy đã đăng ký.');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false), formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { void api.status().then(setStatus).catch(() => setError('Không kiểm tra được khoá cấp phép. Hãy mở lại công cụ.')); }, [api]);

  function discard() {
    setIssued(null); setError(''); setFeedback('Gửi mã kích hoạt cho đúng máy đã đăng ký.');
    void api.discard().catch(() => {});
  }
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); closeDatePicker();
    try { await action(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thực hiện được thao tác. Hãy thử lại.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function generate(event: FormEvent) {
    event.preventDefault();
    // DateField chốt ISO ở blur/Enter. Đọc ô ẩn cùng form để giữ đúng giá trị
    // vừa chốt trong lượt sự kiện, kể cả khi React chưa cập nhật state.
    const date = new FormData(formRef.current!).get('expiresOn');
    void run(async () => {
      setIssued(null);
      const result = await api.issue({ machineCode, licensedTo, expiresOn: perpetual ? null : String(date || 'invalid') });
      if (!result.ok) { setError(result.error.message); setStatus(await api.status()); return; }
      setIssued(result.data); setFeedback('Đã tạo key. Bạn có thể sao chép hoặc lưu tệp gửi khách hàng.');
    });
  }
  const summary = issued ? `${issued.licensed_to} · ${issued.expires_at ? `Hết hạn ${new Date(issued.expires_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : 'Vĩnh viễn'}` : 'Mã sẽ xuất hiện tại đây sau khi tạo thành công.';
  return <main className="issuer-shell">
    <header className="head"><div><h1>Cấp mã kích hoạt</h1><p>Tạo key offline dành riêng cho từng máy sử dụng QC Lab.</p></div></header>
    <section className={`alert ${status?.key_ready ? 'ok' : 'warn'} issuer-key`} aria-label="Khoá cấp phép">
      <div className="issuer-key-info"><strong id="key-state" role="status">{status?.key_message || 'Đang kiểm tra khoá cấp phép…'}</strong><span className="hint" id="key-path">{status?.key_path}</span></div>
      <button id="choose-key" className="btn ghost" type="button" disabled={busy} onClick={() => { void run(async () => {
        const result = await api.chooseKey();
        if (!result.ok) setError(result.error.message); else if (result.data) { discard(); setStatus(result.data); }
      }); }}>Chọn khoá…</button>
    </section>
    {error && <div id="error" className="alert rej issuer-error" role="alert">{error}</div>}
    <form id="issuer-form" className="panel" noValidate ref={formRef} onSubmit={generate} onInputCapture={(event) => {
      if (event.target instanceof HTMLInputElement && event.target.classList.contains('date-text')) discard();
    }}>
      <h2 className="panel-title">Thông tin cấp mã</h2>
      <div className="issuer-fields">
        <p className="hint">Lấy mã máy từ màn hình kích hoạt của máy cần cài.</p>
        <div className="grid2">
          <div className="field"><label htmlFor="machine-code">Mã máy <span className="req">*</span></label><input id="machine-code" name="machineCode" value={machineCode} placeholder="QC-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" autoComplete="off" spellCheck={false} maxLength={60} disabled={busy} required onChange={(event) => { setMachineCode(event.target.value); discard(); }} onBlur={() => setMachineCode((value) => value.trim().toUpperCase())} /></div>
          <div className="field"><label htmlFor="customer">Tên đơn vị sử dụng <span className="req">*</span></label><input id="customer" name="licensedTo" value={licensedTo} placeholder="Ví dụ: Phòng xét nghiệm An Tâm" autoComplete="organization" maxLength={200} disabled={busy} required onChange={(event) => { setLicensedTo(event.target.value); discard(); }} /></div>
        </div>
        <div className="issuer-expiry">
          <label className="choice-card issuer-perpetual"><input id="perpetual" type="checkbox" checked={perpetual} disabled={busy} onChange={(event) => { setPerpetual(event.target.checked); closeDatePicker(); discard(); }} /> Vĩnh viễn</label>
          <DateField id="expires-on" name="expiresOn" label="Ngày hết hạn" value={expiresOn} disabled={busy || perpetual} onChange={(date) => { if (date !== expiresOn) { setExpiresOn(date); discard(); } }} />
        </div>
        <p className="hint">Nếu có thời hạn, key có hiệu lực đến hết ngày được chọn theo giờ Việt Nam.</p>
      </div>
      <div className="issuer-actions"><span className="hint">Không cần kết nối Internet</span><button id="generate" className="btn teal" type="submit" disabled={busy || !status?.key_ready} aria-busy={busy}>{busy ? 'Đang xử lý…' : 'Tạo mã kích hoạt'}</button></div>
    </form>
    <section className="panel" aria-label="Mã kích hoạt">
      <h2 className="panel-title">Mã kích hoạt</h2>
      <div className="issuer-fields"><p id="result-summary" className="hint">{summary}</p><div className="field"><label htmlFor="activation-code">Mã kích hoạt đã tạo</label><textarea id="activation-code" rows={4} readOnly value={issued?.activation_code || ''} placeholder="Chưa tạo mã kích hoạt" spellCheck={false} onFocus={(event) => event.target.select()} /></div></div>
      <div className="issuer-actions"><span id="feedback" className="hint" role="status">{feedback}</span><div className="issuer-buttons">
        <button id="copy" className="btn ghost" type="button" disabled={busy || !issued} onClick={() => { void run(async () => { const result = await api.copy(); if (!result.ok) setError(result.error.message); else setFeedback('Đã sao chép mã kích hoạt.'); }); }}>Sao chép mã</button>
        <button id="save" className="btn teal" type="button" disabled={busy || !issued} onClick={() => { void run(async () => { const result = await api.save(); if (!result.ok) setError(result.error.message); else if (result.data) setFeedback(`Đã lưu: ${result.data.path}`); }); }}>Lưu tệp .txt</button>
      </div></div>
    </section>
    <footer className="hint issuer-footer">Chỉ gửi mã kích hoạt cho khách hàng. Giữ riêng và sao lưu tệp khoá bí mật.</footer>
    <DatePickerPopup />
  </main>;
}

const root = document.getElementById('root');
if (root && window.licenseIssuer) createRoot(root).render(<Issuer api={window.licenseIssuer} />);
else if (root) root.textContent = 'Không kết nối được công cụ cấp key. Hãy đóng cửa sổ và mở lại.';
