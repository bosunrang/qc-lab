export function xlsxRound(value:unknown,digits:number){return typeof value==='number'&&Number.isFinite(value)?Number(value.toFixed(digits)):'';}
