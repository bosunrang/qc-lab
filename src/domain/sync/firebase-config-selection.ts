export function createFirebaseConfigSelection(keys:string[]) {
  const select = (deploy:any, stored:any) => deploy && deploy.locked ? deploy : stored || deploy;
  const signature = (config:any) => JSON.stringify(Object.fromEntries(keys.map(key => [key, String(config && config[key] || '')])));
  return Object.freeze({ select, signature });
}
