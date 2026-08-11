export function createSyncValueCodec() {
  const clone = (value:any) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const cloudValue = (value:any) => value === undefined ? null : clone(value);
  const json = (value:any) => JSON.stringify(value === undefined ? null : value);
  return Object.freeze({ clone, cloudValue, json });
}
