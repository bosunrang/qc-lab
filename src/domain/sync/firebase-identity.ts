export function createFirebaseIdentity() {
  const dataPath = (config:any) => 'qclab-shared/' + String(config && config.labCode || 'default').replace(/[.#$/\[\]]/g, '_');
  const statusLabel = (config:any, user:any) => (user.email || (user.isAnonymous ? 'ẩn danh' : 'đã xác thực')) + ' · ' + (config.labCode || 'default') + ' · ' + dataPath(config);
  return Object.freeze({ dataPath, statusLabel });
}
