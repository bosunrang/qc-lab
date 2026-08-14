export type ActivityAuditRowInput = { sequenceHtml: string; timeHtml: string; userHtml: string; roleHtml: string; usernameHtml: string; typeHtml: string; targetHtml: string; detailHtml: string };

export function activityAuditRowHtml(input: ActivityAuditRowInput) {
  const target=input.targetHtml||'<span class="hint">—</span>';
  const detail=input.detailHtml||'<span class="hint">—</span>';
  return `<tr><td><div class="audit-time-cell"><span class="audit-seq">${input.sequenceHtml}</span><span class="audit-time">${input.timeHtml}</span></div></td><td><b>${input.userHtml}</b><div class="hint">${input.roleHtml}${input.usernameHtml}</div></td><td><span class="pill">${input.typeHtml}</span></td><td>${target}</td><td class="audit-detail">${detail}</td></tr>`;
}
