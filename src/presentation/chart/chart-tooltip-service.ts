type TooltipElement=HTMLElement;

export function createChartTooltipService(deps:{find:()=>TooltipElement|null;create:()=>TooltipElement;append:(element:TooltipElement)=>void}){return()=>{let element=deps.find();if(!element){element=deps.create();element.id='qcTooltip';element.className='qc-tooltip';deps.append(element);}return element;};}
