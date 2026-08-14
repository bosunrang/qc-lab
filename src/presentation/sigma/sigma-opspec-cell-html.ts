export type SigmaOpSpec = { capable: boolean; rules: string[]; n: number; r?: number; single?: boolean; marginal?: boolean };

export function sigmaOpSpecCellHtml(spec?: SigmaOpSpec | null) {
  if(!spec)return '<span class="muted">—</span>';
  if(!spec.capable)return '<span style="color:var(--red);font-weight:700">Phương pháp chưa đủ năng lực (&lt;3σ)</span>';
  const run=`N=${spec.n}${(spec.r||0)>1?` · R=${spec.r}`:''} điểm/lần chạy`;
  return `<b>${spec.rules.join(' / ')}</b><div style="font-size:var(--type-caption);color:var(--muted)">${run}${spec.single?' · chỉ 1 quy tắc':''}${spec.marginal?' · tối đa + cải thiện PP':''}</div>`;
}
