export interface DefaultAdminUserInput {
  id: unknown;
  passHash: unknown;
}

export const DEFAULT_ADMIN_MUST_CHANGE_PASSWORD = true;

export function createDefaultAdminUser(input: DefaultAdminUserInput): Record<string, any> {
  return {
    id: input.id, username: 'admin', name: 'Quản trị viên', role: 'admin', passHash: input.passHash,
    active: true, mustChangePassword: DEFAULT_ADMIN_MUST_CHANGE_PASSWORD,
  };
}
