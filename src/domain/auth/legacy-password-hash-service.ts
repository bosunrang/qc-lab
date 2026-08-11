export interface LegacyPasswordHashService {
  hash(password: unknown): Promise<string>;
}

export function createLegacyPasswordHashService(dependencies: {
  crypto: () => Pick<Crypto, 'subtle'> | null;
  textEncoder: () => TextEncoder;
}): LegacyPasswordHashService {
  const fallback = (password: unknown): string => {
    let hash = 0;
    const text = `qclab::${String(password || '')}`;
    for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    return `f${hash.toString(16)}`;
  };
  return {
    async hash(password) {
      try {
        const crypto = dependencies.crypto();
        if (!crypto?.subtle) return fallback(password);
        const digest = await crypto.subtle.digest('SHA-256', dependencies.textEncoder().encode(`qclab::${String(password || '')}`));
        return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      } catch {
        return fallback(password);
      }
    },
  };
}
