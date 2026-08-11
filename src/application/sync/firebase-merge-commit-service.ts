export type FirebaseMergeCommitService = Readonly<{ commit: (input: { base: any; mergeFirstConnect: boolean; remote: any; hadLocalChanges: boolean }) => boolean }>;

export function createFirebaseMergeCommitService(deps: {
  state: () => any;
  replaceState: (value: any) => void;
  merge: (base: any, mergeFirstConnect: boolean, local: any, remote: any) => any;
  relinkAudit: (state: any) => void;
  clearDerived: () => void;
  ensureShape: () => void;
  invariantErrors: (state: any) => string[];
  rejected: (previous: any, hadLocalChanges: boolean, error: string) => void;
  accepted: (state: any, remote: any) => void;
}): FirebaseMergeCommitService {
  const commit = (input: { base: any; mergeFirstConnect: boolean; remote: any; hadLocalChanges: boolean }): boolean => {
    const previous = deps.state();
    const next = deps.merge(input.base, input.mergeFirstConnect, previous, input.remote);
    deps.replaceState(next);
    deps.relinkAudit(next);
    deps.clearDerived();
    deps.ensureShape();
    const errors = deps.invariantErrors(deps.state());
    if (errors.length) {
      deps.replaceState(previous);
      deps.clearDerived();
      deps.rejected(previous, input.hadLocalChanges, errors[0]);
      return false;
    }
    deps.accepted(deps.state(), input.remote);
    return true;
  };
  return Object.freeze({ commit });
}
