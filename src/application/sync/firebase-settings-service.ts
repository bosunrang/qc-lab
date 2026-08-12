export type FirebaseConnectionInput = { labCode: unknown; email: unknown; password: unknown; config: unknown };
export type FirebaseConnectionPlan = { ok: true; labCode: string; email: string; password: string; config: Record<string, unknown> } | { ok: false; error: 'missing-credentials' };

export function createFirebaseSettingsService(parseConfig: (value: unknown) => Record<string, unknown>) {
  const prepare = (input: FirebaseConnectionInput): FirebaseConnectionPlan => {
    const config = parseConfig(input.config);
    const labCode = String(input.labCode || '').trim() || 'default';
    const email = String(input.email || '').trim();
    const password = String(input.password || '');
    if (!email || !password) return { ok: false, error: 'missing-credentials' };
    return { ok: true, labCode, email, password, config };
  };
  return { prepare };
}
