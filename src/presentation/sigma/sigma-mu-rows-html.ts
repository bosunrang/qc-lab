export type SigmaMuRow = { level: number; uCalValue: string; basisValue: string; excludeBias: boolean };

export function sigmaMuRowsHtml(rows: SigmaMuRow[]) {
  return rows.map(row=>`<tr class="sg-mu-row" data-level="${row.level}"><td><b>Mức ${row.level}</b></td>
    <td><div class="sg-mu-number-field"><input type="number" step="any" min="0" data-f="uCal" aria-label="u(cal) phần trăm cho mức ${row.level}" value="${row.uCalValue}" placeholder="0,00" oninput="sgMuUpdatePreview()"><span aria-hidden="true">%</span></div></td>
    <td><input type="text" data-f="uCalBasis" aria-label="Nguồn CoA của u(cal) cho mức ${row.level}" value="${row.basisValue}" placeholder="VD: CoA lô 1234, mục U(k=2)" oninput="sgMuUpdatePreview()"></td>
    <td><select data-f="muBiasMode" aria-label="Cách xử lý độ chệch cho mức ${row.level}" onchange="sgMuUpdatePreview()"><option value="include" ${row.excludeBias?'':'selected'}>Cộng u(bias)</option><option value="exclude" ${row.excludeBias?'selected':''}>Đã hiệu chỉnh — không cộng</option></select></td>
    <td class="sg-mu-preview" data-sg-mu-preview="${row.level}"></td></tr>`).join('');
}
