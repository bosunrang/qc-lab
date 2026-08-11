export function firebaseReadyState(current: any) {
  return { ...current, initialized: true, ready: true };
}
