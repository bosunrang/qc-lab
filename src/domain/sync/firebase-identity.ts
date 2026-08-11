export function createFirebaseIdentity() {
  const dataPath = (config:any) => 'qclab-shared/' + String(config && config.labCode || 'default').replace(/[.#$/\[\]]/g, '_');
  const statusLabel = (config:any, user:any) => (user.email || (user.isAnonymous ? 'áº©n danh' : 'Ä‘Ã£ xÃ¡c thá»±c')) + ' Â· ' + (config.labCode || 'default') + ' Â· ' + dataPath(config);
  return Object.freeze({ dataPath, statusLabel });
}
