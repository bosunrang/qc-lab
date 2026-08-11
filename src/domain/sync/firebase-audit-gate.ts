export function createFirebaseAuditGate(verify:(entries:any[],anchor:string)=>any) {
  return (snapshot:any) => verify(snapshot && snapshot.activity || [], snapshot && snapshot.activityAnchor || '');
}
