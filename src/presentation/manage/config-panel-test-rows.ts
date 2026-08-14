export type ConfigPanelTestRow = { id: string; name: string; instrument: string; unit: string; selected?: boolean };

export function configPanelTestRows(rows: ConfigPanelTestRow[]) {
  return rows.map(row => `<label><input class="cfg-panel-test" type="checkbox" value="${row.id}" ${row.selected ? 'checked' : ''}><span><b>${row.name}</b><small>${row.instrument} · ${row.unit || 'Chưa có đơn vị'}</small></span></label>`).join('') || '<div class="empty cfg-panel-empty">Máy này chưa có xét nghiệm.</div>';
}
