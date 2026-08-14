export function actionLevelContext<T>(testId: string, level: string | number, lot: string, tests: Array<T & { id?: string }>, levelConfig: (test: T, level: number) => unknown, levelLabel: (level: unknown, test: T) => string) {
  const test=tests.find(item=>item.id===testId);
  const config=test&&levelConfig(test,+level);
  if(lot)return `Mức ${level} · Lô ${lot} (đã ghi nhận)`;
  return config ? levelLabel(config,test) : `Mức ${level||'?'} · Chưa có lô`;
}
