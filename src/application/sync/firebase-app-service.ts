export type FirebaseAppService = Readonly<{ ensure: (config: any) => Promise<any> }>;

export function createFirebaseAppService(deps: {
  sdk: () => any;
  signature: (config: any) => string;
}): FirebaseAppService {
  const ensure = async (config: any): Promise<any> => {
    const sdk = deps.sdk();
    if (!sdk || typeof sdk.initializeApp !== 'function') throw new Error('Chưa tải được Firebase.');
    const desired = deps.signature(config), apps = sdk.apps || [];
    if (apps.length) {
      const app = typeof sdk.app === 'function' ? sdk.app() : apps[0];
      if (deps.signature(app?.options || {}) === desired) return app;
      await Promise.all(apps.slice().map((item: any) => item && typeof item.delete === 'function' ? item.delete() : Promise.resolve()));
    }
    return sdk.initializeApp(config);
  };
  return Object.freeze({ ensure });
}
