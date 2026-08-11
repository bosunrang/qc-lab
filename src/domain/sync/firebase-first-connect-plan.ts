export function firebaseFirstConnectPlan(base:any, dirty:boolean, localHasContent:boolean, statesEqual:boolean) {
  const sameFirstConnectData = !base && !dirty && localHasContent && statesEqual;
  return { mergeFirstConnect: dirty || sameFirstConnectData, confirmConflict: !base && !dirty && localHasContent && !sameFirstConnectData };
}
