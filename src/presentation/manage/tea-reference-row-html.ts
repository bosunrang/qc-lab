type TeaReferenceRowInput = { namingTitle: string; displayName: string; unit: string; section: string; disabled: string; cliaValue: string; ricosValue: string; cliaChangeAction: string; ricosChangeAction: string; labCellHtml: string; statusHtml: string; actionHtml: string };

export function teaReferenceRowHtml(input: TeaReferenceRowInput) {
  return `<tr><td><b title="${input.namingTitle}">${input.displayName}</b></td><td>${input.unit}</td><td>${input.section}</td><td><input class="tea-ref-value" ${input.disabled} type="number" step="any" value="${input.cliaValue}" onchange="${input.cliaChangeAction}"></td><td><input class="tea-ref-value" ${input.disabled} type="number" step="any" value="${input.ricosValue}" onchange="${input.ricosChangeAction}"></td><td><div class="tea-lab-cell">${input.labCellHtml}</div></td><td><div class="tea-ref-status">${input.statusHtml}${input.actionHtml}</div></td></tr>`;
}
