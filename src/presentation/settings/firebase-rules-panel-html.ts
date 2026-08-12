export function createFirebaseRulesPanelHtml(deps: { escape: (value: unknown) => string; button: (label: string, action: string, variant: string) => string }) {
  return (guideHtml: string, rulesText: string): string => `<div class="panel"><h2 class="panel-title">Firebase Rules</h2>
     ${guideHtml}
     <div class="rules-tools"><span>Copy cố định vào Realtime Database → Rules. Không sửa <code>$labCode</code> hoặc <code>$uid</code>.</span>${deps.button('Copy rules', 'copyFirebaseRules()', 'ghost sm')}</div>
     <pre class="rules-code" tabindex="0">${deps.escape(rulesText)}</pre></div>`;
}
