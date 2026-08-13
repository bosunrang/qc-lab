export function entryVoidReasonErrorState(valid: boolean) {
  return valid ? { showError: false, focusReason: false } : { showError: true, focusReason: true };
}
