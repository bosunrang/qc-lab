export function localRecoverySlots(preferred:any) { return preferred === 'a' ? ['a','b'] : preferred === 'b' ? ['b','a'] : [preferred, preferred === 'a' ? 'b' : 'a']; }
