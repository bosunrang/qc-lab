import type { SaveCommandOptions, SaveCommandPlan } from './save-command-policy';

export type SaveService = Readonly<{ save: (options?: SaveCommandOptions) => void }>;

export function createSaveService(deps: {
  plan: (options: SaveCommandOptions) => SaveCommandPlan;
  invalidate: (derivedTestIds: unknown[] | null) => void;
  captureState: () => void;
  touchCloud: () => void;
  prepareStorage: (plan: SaveCommandPlan, options: SaveCommandOptions) => void;
  beginLocalSave: () => void;
  scheduleCloud: () => void;
}): SaveService {
  const save = (options: SaveCommandOptions = {}): void => {
    const plan = deps.plan(options);
    deps.invalidate(plan.derivedTestIds);
    deps.captureState();
    if (plan.pushCloud) deps.touchCloud();
    deps.prepareStorage(plan, options);
    deps.beginLocalSave();
    if (plan.pushCloud) deps.scheduleCloud();
  };
  return Object.freeze({ save });
}
