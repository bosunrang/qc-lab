const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

/* Cong LIS Gateway (8787) khong the gom ve MOT hang so that su: no hardcode doc lap o
   3 boi canh chay khac nhau khong the require() lan nhau — CSP tinh trong index.html
   (doc truoc khi bat ky JS nao chay), client trinh duyet TypeScript, va
   mot Node process rieng biet (lis-gateway/server.js, khong nam trong build.files cua
   Electron va khong duoc trinh duyet tai). CLAUDE.md da ghi nhan day la rui ro biet
   truoc: doi port o mot cho se loi im lang thanh "Loi ket noi." o hai cho con lai. Test
   nay la luoi an toan thay the — quet van ban ca 3 noi va doi chieu dung mot con so,
   dung kieu tests/ui-route-structure.test.js dang lam cho PAGE_SET/PAGE_DEFS. */

const index=read('index.html');
const client=read('src/application/lis/lis-client-service.ts');
const server=read('lis-gateway/server.js');

const serverMatch=server.match(/process\.env\.QCLAB_LIS_PORT\)\s*\|\|\s*(\d+)/);
assert.ok(serverMatch,'lis-gateway/server.js phai co cong mac dinh QCLAB_LIS_PORT');
const port=serverMatch[1];

const cspPorts=[...index.matchAll(/(?:127\.0\.0\.1|localhost):(\d+)/g)].map(m=>m[1]);
assert.ok(cspPorts.length>=2,'index.html phai cho phep ca 127.0.0.1 va localhost trong CSP connect-src cho LIS Gateway');
cspPorts.forEach(p=>assert.equal(p,port,`CSP connect-src cua index.html dang tro toi cong ${p}, lech voi cong mac dinh ${port} cua lis-gateway/server.js`));

const clientPorts=[...client.matchAll(/(?:127\.0\.0\.1|localhost):(\d+)/g)].map(m=>m[1]);
assert.ok(clientPorts.length>=3,'LISClientService phai tham chieu cong Gateway o URL mac dinh, danh sach origin cho phep, va thong bao loi');
clientPorts.forEach(p=>assert.equal(p,port,`LISClientService dang tham chieu cong ${p}, lech voi cong mac dinh ${port} cua lis-gateway/server.js`));

console.log('LIS Gateway port consistency tests passed');
