import { passwordPolicyError } from './password-policy';

export interface NewUserValidationInput {
  username: unknown;
  password: unknown;
  existingUsernames: unknown;
}

export function newUserValidationError(input: NewUserValidationInput): string {
  const username = String(input.username || '').trim();
  const password = String(input.password || '');
  if (!username || !password) return 'Nhập tên đăng nhập và mật khẩu.';
  const passwordError = passwordPolicyError(password);
  if (passwordError) return passwordError;
  const existing = Array.isArray(input.existingUsernames) ? input.existingUsernames : [];
  if (existing.some(value => String(value || '') === username)) return 'Tên đăng nhập đã tồn tại.';
  return '';
}
