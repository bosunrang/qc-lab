export type TeaReferenceLabProfileModalInput = { title: string; bodyHtml: string; removeButtonHtml: string; cancelButtonHtml: string; saveButtonHtml: string };

export function teaReferenceLabProfileModalHtml(input: TeaReferenceLabProfileModalInput) {
  return `<div class="modal tea-lab-profile-modal"><div class="modal-h"><h3>${input.title}</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">${input.bodyHtml}</div><div class="modal-f">${input.removeButtonHtml}${input.cancelButtonHtml}${input.saveButtonHtml}</div></div>`;
}
