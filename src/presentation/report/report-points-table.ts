type Value = Record<string, any>;

export function createReportPointsTable(deps:{formatDate:(value:any)=>string;escape:(value:any)=>string;pointValue:(point:Value,test:Value)=>string;format:(value:any,decimals?:number)=>string;verdict:(value:any)=>string;staff:(point:Value)=>Value}) {
  return (items:Value[], test:Value) => {
    if (!items.length) return '<p><i>Không có điểm nào trong khoảng ngày đã chọn.</i></p>';
    const rows = items.map(item => {
      const rules = [...new Set(item.f.rules || [])], support = [...new Set(item.f.supportRules || [])].filter(rule => !rules.includes(rule));
      const ruleText = rules.join(', ') || (support.length ? 'Bằng chứng: ' + support.join(', ') : '—'), verdict = deps.verdict(item.f.level), staff = deps.staff(item.p);
      return '<tr><td>' + deps.formatDate(item.p.date) + '</td><td>' + deps.escape(item.p.runId || '—') + '</td><td>' + deps.escape(staff.code || '—') + '</td><td class="num">' + deps.pointValue(item.p, test) + '</td><td class="num">' + (item.z >= 0 ? '+' : '') + deps.format(item.z) + 's</td><td>' + deps.escape(verdict) + '</td><td>' + deps.escape(ruleText) + '</td></tr>';
    }).join('');
    return '<table><tr><th>Ngày</th><th>Lần chạy</th><th>NV</th><th class="num">Giá trị</th><th class="num">Z</th><th>Kết luận</th><th>Luật / bằng chứng</th></tr>' + rows + '</table>';
  };
}
