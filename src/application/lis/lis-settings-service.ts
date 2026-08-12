export type LisSettingsInput = { enabled: unknown; url: unknown; token: unknown; savedToken: unknown };
export type LisSettingsResult = { ok: true; settings: { enabled: boolean; url: string; token: string } } | { ok: false; error: 'invalid-url' | 'missing-token' };

export function createLisSettingsService(normalizeGatewayUrl: (value: unknown) => string) {
  const prepare = (input: LisSettingsInput): LisSettingsResult => {
    const enabled = !!input.enabled;
    const url = normalizeGatewayUrl(input.url);
    const token = String(input.token || '').trim() || String(input.savedToken || '');
    if (!url) return { ok: false, error: 'invalid-url' };
    if (enabled && !token) return { ok: false, error: 'missing-token' };
    return { ok: true, settings: { enabled, url, token } };
  };
  return { prepare };
}
