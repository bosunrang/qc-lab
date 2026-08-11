export function firebaseOwnSnapshotPlan(snapshot:any, clientId:any) { return { own: !!(snapshot && snapshot._client && snapshot._client === clientId) }; }
