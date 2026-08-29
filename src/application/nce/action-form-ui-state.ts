export type ActionFormDraft = { id: string; values: Record<string, string> };
export type ActionFormSeed = Record<string, unknown>;

export class ActionFormUiState {
  editId='';
  seed: ActionFormSeed | null=null;
  draft: ActionFormDraft | null=null;
  openSections: Set<string> | null=null;
  /* Đếm dần mỗi lần startManual()/startIssue()/edit() mở một hồ sơ — dùng làm một phần
     khoá remount (formKey) ở trang React (ActionsPage.tsx). seed của startManual() luôn
     là CÙNG một hình dạng {manual:true}, nên nếu chỉ khoá theo seed/editId thì mở form
     thủ công, gõ dở, đóng lại, rồi mở form thủ công LẦN NỮA sẽ không remount — React
     giữ nguyên DOM cũ và nội dung đã gõ (đã bị clearDraft()) vẫn còn trên các ô
     defaultValue chưa từng được áp lại. Bộ đếm này đảm bảo mỗi lần MỞ là một khoá khác
     nhau dù seed giống hệt. */
  openSeq=0;

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
    this.editId='';this.seed={manual:true};this.clearDraft();this.openSections=null;this.openSeq++;
  }

  startIssue(seed: ActionFormSeed) {
    this.editId='';this.seed=seed;this.clearDraft();this.openSections=null;this.openSeq++;
  }

  edit(id: string) {
    this.editId=id;this.seed=null;this.clearDraft();this.openSections=null;this.openSeq++;
  }
}
