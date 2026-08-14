export type ActionFormRenderStateInput<TAction, TTest, TForm> = {
  actions: TAction[]; tests: TTest[]; editId: string; seed: Record<string, unknown> | null; currentUser: unknown; draft: Record<string, string> | null;
  buildModel: (editing: TAction | undefined, tests: TTest[], seed: Record<string, unknown> | null, user: unknown, draft: Record<string, string> | null) => TForm;
  defaultModel: (tests: TTest[], seed: Record<string, unknown> | null, user: unknown) => TForm;
  protocol: (form: TForm) => unknown; defaultOpen: (editing: TAction | undefined, protocol: unknown) => Set<string>; openSections: Set<string> | null; actionId: (action: TAction) => string;
};

export function actionFormRenderState<TAction, TTest, TForm>(input: ActionFormRenderStateInput<TAction, TTest, TForm>) {
  const editing=input.editId ? input.actions.find(action=>input.actionId(action)===input.editId) : undefined;
  const form=input.buildModel(editing,input.tests,input.seed,input.currentUser,input.draft)||input.defaultModel(input.tests,input.seed,input.currentUser);
  const protocol=input.protocol(form);
  return {editing,form,protocol,formOpen:!!(editing||input.seed),openSet:input.openSections||input.defaultOpen(editing,protocol)};
}
