type Input={tests:number,totalPoints:number,rejected:number,todayPoints:number};
export function dashboardKpiItems(input:Input){return[{label:'Xét nghiệm',value:input.tests},{label:'Điểm QC',value:input.totalPoints},{label:'Vi phạm',value:input.rejected,color:'var(--red)'},{label:'QC hôm nay',value:input.todayPoints,color:'var(--teal)'}];}
