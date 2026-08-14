export type SigmaGoverningRule = { capable: boolean; single?: boolean; marginal?: boolean; rules: string[]; n: number; r?: number };

export function sigmaGoverningRuleBlockHtml(spec: SigmaGoverningRule | null, sigmaText: string) {
  if(!spec)return '';
  const kind=spec.capable?(spec.single?'ok':'info'):'warn';
  const ruleText=spec.capable?`<b>${spec.rules.join(' / ')} · N=${spec.n}${(spec.r||0)>1?` · R=${spec.r}`:''}</b>. `:'';
  const guidance=spec.single?'Sigma cao → chỉ cần 1 quy tắc <b>1-3s</b>, giảm báo động giả không cần thiết.':spec.marginal?'Hiệu năng cận biên (3–4σ): dùng bộ đa quy tắc tối đa và <b>ưu tiên cải thiện phương pháp</b>.':spec.capable?'Dùng bộ đa quy tắc theo Sigma đo được.':'Phương pháp <b>&lt;3σ</b>: QC không bù được sai số — phải khắc phục phương pháp trước khi tin cậy kết quả.';
  return `<div class="alert alert-block flow-item ${kind}">Bộ quy tắc nên áp cho xét nghiệm — theo mức Sigma thấp nhất đủ điều kiện (${sigmaText}σ): ${ruleText}${guidance}</div>`;
}
