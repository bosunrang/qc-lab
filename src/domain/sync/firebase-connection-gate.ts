export function createFirebaseConnectionGate() {
  const canWrite = (connection:any) => !!(connection.ready && connection.initialized && connection.ref);
  const networkOnline = (online:any) => online !== false;
  return Object.freeze({ canWrite, networkOnline });
}
