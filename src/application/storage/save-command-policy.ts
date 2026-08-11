export type SaveCommandOptions = {
  clearDerived?: boolean;
  testId?: unknown;
  testIds?: unknown[];
  sigmaTestId?: unknown;
  cloud?: boolean;
};

export type SaveCommandPlan = Readonly<{
  derivedTestIds: unknown[] | null;
  storageTestIds: string[];
  fullDirty: boolean;
  persistSigmaDraft: boolean;
  pushCloud: boolean;
}>;

const idsFor = (options: SaveCommandOptions): unknown[] => Array.isArray(options.testIds)
  ? options.testIds : options.testId ? [options.testId] : [];

const storageIdsFor = (options: SaveCommandOptions): unknown[] => {
  const ids = idsFor(options);
  return ids.length ? ids : options.sigmaTestId ? [options.sigmaTestId] : [];
};

export function saveCommandPlan(options: SaveCommandOptions = {}): SaveCommandPlan {
  const derivedTestIds = options.clearDerived === false ? null : [...new Set(idsFor(options).filter(Boolean))];
  const storageTestIds = [...new Set(storageIdsFor(options).filter(Boolean).map(String))];
  return Object.freeze({
    derivedTestIds,
    storageTestIds,
    fullDirty: !storageTestIds.length && options.clearDerived !== false,
    persistSigmaDraft: !!options.sigmaTestId,
    pushCloud: options.cloud !== false,
  });
}
