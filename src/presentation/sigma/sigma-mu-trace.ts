type Value = Record<string, any>;

export function createSigmaMuTrace(deps:{escape:(value:any)=>string;formatDate:(value:any)=>string}) {
  return (row:Value, levels:any[]) => {
    const trace:string[] = [];
    (levels || []).forEach(level => { const item = (row.e.lv && row.e.lv[level]) || {}; if (item.uCalBasis) trace.push('Má»©c ' + level + ' Â· nguá»“n u(cal): ' + deps.escape(item.uCalBasis)); });
    const signed = (levels || []).map(level => (row.e.lv && row.e.lv[level]) || {}).find(item => item.muReviewedBy || item.muReviewedDate);
    if (signed) trace.push('NgÆ°á»i rÃ  soÃ¡t ngÃ¢n sÃ¡ch MU: ' + deps.escape(signed.muReviewedBy || 'â€”') + (signed.muReviewedDate ? ' Â· ' + deps.formatDate(signed.muReviewedDate) : ''));
    return trace;
  };
}
