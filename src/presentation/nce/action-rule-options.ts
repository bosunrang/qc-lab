export function actionRuleOptions(rules: string[]) {
  return [['','Không có luật Westgard'],...rules.map(rule=>[rule,rule])];
}
