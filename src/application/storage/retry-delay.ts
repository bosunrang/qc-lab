export function storageRetryDelay(failures:number){return Math.min(30000,1000*Math.pow(2,Math.min(Number(failures)||0,5)));}
