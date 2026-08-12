export function createUnitProfileHtml(deps: { escapeAttribute: (value: unknown) => string; button: (label: string, action: string, variant: string) => string }) {
  return (lab: Record<string, unknown> | null | undefined): string => {
    const value = lab || {};
    return `<div class="panel"><h2 class="panel-title">Thông tin đơn vị</h2>
      <div class="settings-unit-fields"><div><label>Tên bệnh viện / đơn vị</label><input id="labName" aria-label="Tên bệnh viện / đơn vị" value="${deps.escapeAttribute(value.name || '')}"></div>
        <div><label>Khoa / phòng</label><input id="labDept" aria-label="Khoa / phòng" value="${deps.escapeAttribute(value.dept || '')}"></div>
        <div><label>Địa chỉ</label><input id="labAddr" aria-label="Địa chỉ" value="${deps.escapeAttribute(value.address || '')}"></div></div>
     <div class="settings-panel-actions">${deps.button('Lưu thông tin', 'saveLab()', 'teal')}</div>
    </div>`;
  };
}
