import { useRef, useState } from 'react';
import { MIN_PASSWORD_LENGTH } from '../../main/domain/auth-validation';
import { formError, formErrorFrom, type FieldErrorMap, type FormError } from '../lib/field-error';
import { useInvalidField } from '../lib/useInvalidField';
import { AsyncButton } from './AsyncButton';

// Tự đổi mật khẩu (`changeOwnPassword`), dùng ở hai nơi (GV5):
// - màn bắt buộc đổi mật khẩu sau khi admin tạo tài khoản hoặc đặt lại mật
//   khẩu (`must_change_password`): main chặn mọi thao tác khác tới khi đổi xong;
// - nút "Đổi mật khẩu" của chính mình ở trang Người dùng. Trước đây nút này
//   mở hộp "Đặt lại mật khẩu" của admin, tức tự bật cờ phải đổi mật khẩu.

const PASSWORD_FIELD_ERRORS: FieldErrorMap = { 'wrong-password': 'oldPassword', 'weak-password': 'newPassword' };

export function ChangePasswordForm({ onDone, submitLabel = 'Đổi mật khẩu', autoFocus = true }: { onDone: () => void | Promise<void>; submitLabel?: string; autoFocus?: boolean }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<FormError | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const errorId = useInvalidField(rootRef, err);

  async function submit() {
    if (newPassword.length < MIN_PASSWORD_LENGTH) { setErr(formError(`Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`, 'newPassword')); return; }
    if (newPassword !== confirm) { setErr(formError('Mật khẩu nhập lại không khớp.', 'confirmPassword')); return; }
    if (newPassword === oldPassword) { setErr(formError('Mật khẩu mới phải khác mật khẩu hiện tại.', 'newPassword')); return; }
    const result = await window.qcApi.changeOwnPassword({ data: { oldPassword, newPassword } });
    if (!result.ok) { setErr(formErrorFrom(result.error, PASSWORD_FIELD_ERRORS)); return; }
    setErr(null);
    await onDone();
  }

  const edit = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement>) => { setErr(null); setter(event.target.value); };
  const enter = (event: React.KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } };

  return <div className="change-password-form" ref={rootRef}>
    <div className="field"><label htmlFor="cpw-old">Mật khẩu hiện tại</label>
      <input id="cpw-old" data-field="oldPassword" type="password" autoComplete="current-password" autoFocus={autoFocus} value={oldPassword} onChange={edit(setOldPassword)} onKeyDown={enter} /></div>
    <div className="field"><label htmlFor="cpw-new">Mật khẩu mới <span className="hint-inline">(tối thiểu {MIN_PASSWORD_LENGTH} ký tự)</span></label>
      <input id="cpw-new" data-field="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={edit(setNewPassword)} onKeyDown={enter} /></div>
    <div className="field"><label htmlFor="cpw-confirm">Nhập lại mật khẩu mới</label>
      <input id="cpw-confirm" data-field="confirmPassword" type="password" autoComplete="new-password" value={confirm} onChange={edit(setConfirm)} onKeyDown={enter} /></div>
    {err && <p id={errorId} className="field-error" role="alert">{err.message}</p>}
    <div className="change-password-actions"><AsyncButton className="btn teal" onClick={submit}>{submitLabel}</AsyncButton></div>
  </div>;
}
