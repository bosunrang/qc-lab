export function sigmaPeriodTableHeadHtml(levels: Array<string | number>) {
  const groups=levels.map(level=>`<th colspan="3" class="sg-group-start">Mức ${level}</th>`).join('');
  const cells=levels.map(()=>'<th class="sg-group-start">CV IQC%</th><th>Bias EQA%</th><th>Sigma</th>').join('');
  return `<thead><tr><th rowspan="2">Kỳ / Năm</th>${groups}<th rowspan="2" class="sg-action-col">Thao tác</th></tr><tr>${cells}</tr></thead>`;
}
