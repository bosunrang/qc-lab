export type FirebaseRemoteRenderSafetyService = Readonly<{ unsafe: () => boolean }>;

export function createFirebaseRemoteRenderSafetyService(deps: {
  modalOpen: () => boolean;
  editingFieldFocused: () => boolean;
}): FirebaseRemoteRenderSafetyService {
  const unsafe = (): boolean => deps.modalOpen() || deps.editingFieldFocused();
  return Object.freeze({ unsafe });
}
