export function createDashboardMissingTargetListHtml({render}:{render:(item:any)=>string}){return(items:any[])=>items.slice(0,4).map(render).join('');}
