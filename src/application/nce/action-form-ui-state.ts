export type ActionFormDraft = { id: string; values: Record<string, string> };
export type ActionFormSeed = Record<string, unknown>;

export class ActionFormUiState {
  editId='';
  seed: ActionFormSeed | null=null;
  draft: ActionFormDraft | null=null;
  openSections: Set<string> | null=null;

  toggleSection(key: string, open: boolean) {
    if(!this.openSections)this.openSections=new Set();
    if(open)this.openSections.add(key);else this.openSections.delete(key);
  }

  clearDraft() { this.draft=null; }

  captureDraft(values: Record<string, string>) {
    this.draft={id:this.editId||'',values};
  }

  draftValues() {
    return this.draft&&this.draft.id===(this.editId||'') ? this.draft.values : null;
  }

  reset() {
    this.editId='';this.seed=null;this.clearDraft();this.openSections=null;
  }

  startManual() {
    this.editId='';this.seed={manual:true};this.clearDraft();this.openSections=null;
  }

  startIssue(seed: ActionFormSeed) {
    this.editId='';this.seed=seed;this.clearDraft();this.openSections=null;
  }

  edit(id: string) {
    this.editId=id;this.seed=null;this.clearDraft();this.openSections=null;
  }
}
