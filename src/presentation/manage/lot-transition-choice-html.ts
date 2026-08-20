export type LotTransitionChoiceInput = { inputId: string; selectedId: string; value: string; optionsHtml: string };

export function lotTransitionChoiceHtml(input: LotTransitionChoiceInput) {
  return `<input id="${input.inputId}" list="${input.inputId}List" autocomplete="off" role="combobox" aria-autocomplete="list" placeholder="Gõ số lô hoặc chọn danh sách" value="${input.value}" data-lot-id="${input.selectedId}" data-input-action="lotTransitionChoiceInput" data-change-action="lotTransitionChoiceInput" data-change-args="[true]"><datalist id="${input.inputId}List">${input.optionsHtml}</datalist>`;
}
