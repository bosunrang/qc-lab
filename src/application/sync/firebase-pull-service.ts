export function createFirebasePullService(deps:{read:(ref:any)=>Promise<any>;handle:(value:any,options:any)=>void;canPull:(connection:any)=>boolean}) {
  const pull = async (connection:any) => {
    if (!deps.canPull(connection)) return false;
    try { const snapshot = await deps.read(connection.ref); deps.handle(snapshot.val(), { silent: true }); return true; } catch { return false; }
  };
  return Object.freeze({ pull });
}
