export function managePanelFormState(id: unknown) { const editing=!!id; return {editing,title:editing?'Sửa Panel QC':'Thêm Panel QC',submitLabel:editing?'Lưu thay đổi':'Thêm Panel QC'}; }
