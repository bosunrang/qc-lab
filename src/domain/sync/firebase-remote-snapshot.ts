export function createFirebaseRemoteSnapshot(validate:(value:any)=>string[], sanitize:(value:any)=>any) {
  return (value:any) => { const errors = validate(value); return { errors, remote: errors.length ? null : sanitize(value) }; };
}
