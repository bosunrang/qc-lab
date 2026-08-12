export type ActionInspectionDetail = { title: string; checksHtml: string };

export function createActionInspectionDetailsHtml() {
  return (items: ActionInspectionDetail[]) => items.map(item => `<li><b>${item.title}</b>${item.checksHtml}</li>`).join('');
}
