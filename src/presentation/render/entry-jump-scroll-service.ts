type Wrap={scrollTo:(options:{top:number,behavior:string})=>void};type Row={offsetTop:number};
export function createEntryJumpScrollService(deps:{findWrap:()=>Wrap|null,findTodayRow:()=>Row|null}){const scroll=()=>{const wrap=deps.findWrap(),row=deps.findTodayRow();if(wrap&&row)wrap.scrollTo({top:Math.max(0,row.offsetTop-86),behavior:'smooth'});};return{scroll};}
