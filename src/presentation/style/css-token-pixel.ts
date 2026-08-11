export function cssTokenPixel(token:string,fallback:number,readToken:(token:string)=>unknown){const value=parseFloat(String(readToken(token)||''));return Number.isFinite(value)?value:fallback;}
