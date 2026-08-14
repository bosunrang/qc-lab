export type ActionReviewNoteModalInput = { title: string; label: string; placeholder: string; errorText: string; closeButtonHtml: string; submitButtonHtml: string };

export function actionReviewNoteModalHtml(input: ActionReviewNoteModalInput) {
  return `<div class="modal"><div class="modal-h"><h3>${input.title}</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">
      <label>${input.label}</label>
      <textarea id="actionNoteInput" placeholder="${input.placeholder}" oninput="document.getElementById('actionNoteErr').style.display='none'"></textarea>
      <div id="actionNoteErr" class="hint field-error">${input.errorText}</div>
    </div><div class="modal-f">${input.closeButtonHtml}${input.submitButtonHtml}</div></div>`;
}
