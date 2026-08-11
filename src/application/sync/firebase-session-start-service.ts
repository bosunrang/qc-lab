export type FirebaseSessionStartService = Readonly<{ start: (config: any) => Promise<boolean> }>;

export function createFirebaseSessionStartService(deps: {
  ensureApp: (config: any) => Promise<unknown>;
  persistAuth: () => Promise<unknown>;
  currentAuthUser: () => Promise<any>;
  signInAnonymously: () => Promise<any>;
  unauthenticated: () => void;
  setAuthUser: (user: any) => void;
  disconnect: () => void;
  createRef: () => any;
  setRef: (ref: any) => void;
  subscribe: (ref: any) => void;
  startPull: () => void;
  loading: () => void;
  failed: (error: unknown) => void;
}): FirebaseSessionStartService {
  const start = async (config: any): Promise<boolean> => {
    try {
      await deps.ensureApp(config.config);
      await deps.persistAuth();
      let user = await deps.currentAuthUser();
      if (!user && config.anonymous) user = await deps.signInAnonymously();
      if (!user) { deps.unauthenticated(); return false; }
      deps.setAuthUser(user);
      deps.disconnect();
      const ref = deps.createRef();
      deps.setRef(ref);
      deps.subscribe(ref);
      deps.startPull();
      deps.loading();
      return true;
    } catch (error) {
      deps.failed(error);
      return false;
    }
  };
  return Object.freeze({ start });
}
