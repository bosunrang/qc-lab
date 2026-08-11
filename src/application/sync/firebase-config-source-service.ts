export type FirebaseConfigSourceService = Readonly<{ deploy: () => any; stored: () => any }>;

export function createFirebaseConfigSourceService(deps: {
  cloud: () => any;
  readStored: () => string | null;
}): FirebaseConfigSourceService {
  const deploy = (): any => {
    const cloud = deps.cloud();
    if (!cloud || !cloud.config) return null;
    return { labCode:cloud.labCode || 'khoaXN', email:cloud.email || (cloud.anonymous ? 'anonymous' : ''), anonymous:cloud.anonymous !== false, config:cloud.config, deploy:true, locked:cloud.locked === true };
  };
  const stored = (): any => {
    try {
      const value = JSON.parse(deps.readStored() || 'null');
      return value && typeof value === 'object' ? { ...value, anonymous:value.anonymous === true } : null;
    } catch { return null; }
  };
  return Object.freeze({ deploy, stored });
}
