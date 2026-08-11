type Rule = { id: string };

export function createWestgardRuleTogglesHtml(deps: { button: (label: string, action: string, variant: string) => string }) {
  return (rules: Rule[], enabled: (rule: string) => boolean, canWrite: boolean) => {
    const toggles = rules.map(rule => `<span class="wg-rule-item"><label><input type="checkbox" ${enabled(rule.id) ? 'checked' : ''} ${canWrite ? '' : 'disabled'} onchange="wgSet('${rule.id}',this.checked)"> <span class="pill">${rule.id}</span></label></span>`).join('');
    return toggles + (canWrite ? `<div class="wg-rule-reset">${deps.button('Khôi phục mặc định', 'wgReset()', 'ghost sm')}</div>` : '');
  };
}
