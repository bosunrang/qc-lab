const paths: Record<string, string> = { search:'<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>', print:'<path d="M6 9V2h12v7"/>', report:'<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/>', trash:'<path d="M3 6h18"/>' };
export function reagentToolIcon(type:string){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[type]||''}</svg>`;}
export const reagentToolIconPresentation=Object.freeze({icon:reagentToolIcon});
