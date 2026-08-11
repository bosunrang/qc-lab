export function createCanvasFont(tokenPx:(token:string,fallback:number)=>number){return(weight:string,token:string,fallback:number)=>`${weight?weight+' ':''}${tokenPx(token,fallback)}px Arial`;}
