export function firebaseCanPull(connection:any) { return !!(connection && connection.ref && connection.authUser); }
