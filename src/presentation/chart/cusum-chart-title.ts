export function createCusumChartTitle({format}:{format:(value:number,digits:number)=>string}){return(k:number,h:number)=>`CUSUM xu hướng (k=${format(k,2)}, h=${format(h,2)})`;}
