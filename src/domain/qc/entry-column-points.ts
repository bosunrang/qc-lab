export function selectEntryColumnPoints(column:any,operational:()=>any[],lot:()=>any[]){return column?.parallel?lot():operational();}
