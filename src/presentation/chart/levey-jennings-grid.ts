export function leveyJenningsGridLines(axis:{z:number}[],mean:number,sd:number,y:(value:number)=>number){return axis.map(row=>({y:y(mean+row.z*sd),major:row.z===0}));}
