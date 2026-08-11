export function passwordPolicyError(value: unknown): string {
  const password = String(value || '');
  if (!password) return 'Mật khẩu không được để trống.';
  if (password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự.';
  return '';
}

export function passwordChangeError(password: unknown, confirmation: unknown): string {
  const policyError = passwordPolicyError(password);
  if (policyError) return policyError;
  if (String(password || '') !== String(confirmation || '')) return 'Hai mật khẩu không khớp.';
  return '';
}
