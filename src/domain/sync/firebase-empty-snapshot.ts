export function firebaseEmptySnapshotPlan(initialized:boolean, dirty:boolean, hasLocalContent:boolean) {
  const firstSnapshot = !initialized;
  return { firstSnapshot, push: dirty || firstSnapshot && hasLocalContent };
}
