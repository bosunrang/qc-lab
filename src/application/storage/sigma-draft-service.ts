type Value = Record<string, any>;

export function createSigmaDraftService(deps:{get:(key:string)=>string|null;set:(key:string,value:string)=>void;remove:(key:string)=>void;now:()=>number;clone:(value:any)=>any;key:string;savedAtKey:string}) {
  const read = ():Value|null => { try { const value = JSON.parse(deps.get(deps.key) || 'null'); return value && typeof value === 'object' && value.branches && typeof value.branches === 'object' ? value : null; } catch { return null; } };
  const stamp = () => Number(read()?.savedAt || 0);
  const persist = (testId:any, sigmaData:Value, path:string) => { if (!testId) return false; try { const persistedAt = Number(deps.get(deps.savedAtKey) || 0), previous = read(), branches = previous && Number(previous.savedAt || 0) > persistedAt ? { ...previous.branches } : {}; branches[String(testId)] = deps.clone(sigmaData && sigmaData[testId] || []); const savedAt = Math.max(deps.now(), Number(previous?.savedAt || 0) + 1); deps.set(deps.key, JSON.stringify({ savedAt, path, branches })); return true; } catch { return false; } };
  const clearThrough = (value:any) => { try { const current = read(); if (current && Number(current.savedAt || 0) <= Number(value || 0)) deps.remove(deps.key); } catch {} };
  return Object.freeze({ read, stamp, persist, clearThrough });
}
