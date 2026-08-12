export function createBrandPanelHtml(deps: { escapeAttribute: (value: unknown) => string; button: (label: string, action: string, variant: string, title?: string, options?: unknown) => string }) {
  return (input: { title?: unknown; subtitle?: unknown; markText?: unknown; previewHtml?: string }): string => `<div class="panel"><h2 class="panel-title">Logo & tên phần mềm</h2>
     <div class="grid2">
       <div>
         <label>Tên hiển thị trên thanh bên</label><input id="brandTitle" aria-label="Tên hiển thị trên thanh bên" value="${deps.escapeAttribute(input.title || '')}">
         <label>Dòng phụ</label><input id="brandSub" aria-label="Dòng phụ" value="${deps.escapeAttribute(input.subtitle || '')}">
         <label>Chữ trong logo khi chưa dùng ảnh</label><input id="logoText" aria-label="Chữ trong logo khi chưa dùng ảnh" maxlength="4" value="${deps.escapeAttribute(input.markText || '')}">
       </div>
       <div>
         <label>Logo hiện tại</label>${input.previewHtml || ''}
         <label>Chọn ảnh logo</label>
         <div class="file-pick">${deps.button('Chọn tệp', "document.getElementById('logoFile').click()", 'ghost sm', '', {attrs:{type:'button'}})}<span id="logoFileName" class="hint">Chưa chọn tệp</span></div>
         <input id="logoFile" type="file" accept="image/*" style="display:none" onchange="pickLogo(event)">
         <div class="hint settings-brand-note">Nên dùng ảnh vuông PNG/JPG, dung lượng nhỏ. Logo được lưu cùng dữ liệu phần mềm.</div>
       </div>
     </div>
     <div class="settings-panel-actions">${deps.button('Lưu logo', 'saveBrand()', 'teal')}${deps.button('Bỏ ảnh logo', 'clearLogo()', 'ghost')}</div>
    </div>`;
}
