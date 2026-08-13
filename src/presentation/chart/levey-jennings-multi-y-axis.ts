export function leveyJenningsMultiYAxis(){return[-3,-2,-1,0,1,2,3].map(z=>({z,left:z===3?'> +3':z===-3?'< -3':String(z),right:(z>=0?'+':'')+z+'s'}));}
