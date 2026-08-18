export function queryFocusable(container:Element):HTMLElement[]{
  return [...container.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);
}

export function createFocusTrapKeydown(deps:{activeContainer:()=>Element|null;activeElement:()=>Element|null;onEscape:()=>void}){
  return (event:KeyboardEvent)=>{
    const container=deps.activeContainer();if(!container)return;
    if(event.key==='Escape'){event.preventDefault();deps.onEscape();return;}
    if(event.key!=='Tab')return;
    const items=queryFocusable(container);if(!items.length){event.preventDefault();(container as HTMLElement).focus();return;}
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&deps.activeElement()===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&deps.activeElement()===last){event.preventDefault();first.focus();}
  };
}
