'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'src','presentation','actions','actions-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(route,/deps\.ActionListPresentation\.levelShort\(t, level, lotSnap\)/,'Danh sách NCE phải dùng presentation TypeScript');
assert.match(route,/deps\.ActionStatusPresentation\.sideChips\(/,'Trạng thái NCE phải dùng presentation TypeScript');
assert.match(route,/deps\.ActionReviewPresentation\.buttons\(a, \{/,'Duyệt NCE phải dùng presentation TypeScript');
assert.match(route,/deps\.ActionDetailPresentation\.meta\(a, \{/,'Chi tiết NCE phải dùng presentation TypeScript');
assert.match(route,/deps\.ActionEvidencePresentation\.timeline\(a, rr\)/,'Bằng chứng NCE phải dùng presentation TypeScript');
assert.match(bridge,/ActionListPresentation: ActionListPresentation;/,'Danh sách NCE phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/ActionStatusPresentation: ActionStatusPresentation;/,'Trạng thái NCE phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/ActionReviewPresentation: ActionReviewPresentation;/,'Duyệt NCE phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/ActionDetailPresentation: ActionDetailPresentation;/,'Chi tiết NCE phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/ActionEvidencePresentation: ActionEvidencePresentation;/,'Bằng chứng NCE phải là hợp đồng bridge bắt buộc');

console.log('Action presentation TypeScript bridge tests passed');
