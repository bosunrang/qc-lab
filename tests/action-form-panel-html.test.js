const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src','presentation','nce','action-form-panel-html.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');
const legacy=fs.readFileSync(path.join(root,'src','presentation','actions','action-form-controller.ts'),'utf8');

assert.match(source,/export function actionFormPanelHtml/,'renderer khung biểu mẫu NCE phải ở TypeScript');
assert.match(source,/action-form-body/,'renderer TypeScript phải sở hữu khung vùng nhập liệu');
assert.match(bridge,/actionFormPanelPresentation=actionFormPanelPresentation/,'bridge phải công bố renderer NCE');
assert.match(legacy,/return deps\.pres\.actionFormPanelPresentation\(\{ editing, formOpen, guideButtonHtml: deps\.btn\('Quy trình 8 bước', \{ action: 'openActionGuide' \}, 'ghost sm'\), closedHtml: actionFormClosedHtml\(issueCount\), formBodyHtml \}\)/,'route NCE phải gọi renderer TypeScript');
