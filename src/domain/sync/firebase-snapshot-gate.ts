export function firebaseSnapshotGate(seenSignature:any, nextSignature:any) { return { handle: !(nextSignature && nextSignature === seenSignature), seenSignature: nextSignature }; }
