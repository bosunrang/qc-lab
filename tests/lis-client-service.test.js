'use strict';
/**
 * Tests cho lis-client-service.js — phia app KEO ket qua QC tu gateway ve.
 *
 * Hai thu duoc chot o day, deu la loai loi im lang:
 *
 * 1. NGAY cua diem QC phai theo gio DIA PHUONG. Mot ket qua do luc 06:05 sang gio Viet
 *    Nam co measuredAt = 23:05Z hom truoc; cat chuoi UTC se ghi diem LUI MOT NGAY, lam
 *    lech ca chuoi Westgard va bao cao thang. Khong ai phat hien ra tru khi doi chieu tay.
 *
 * 2. Chi bao `imported` ve gateway SAU KHI ghi diem thanh cong. Bao truoc thi ban ghi bien
 *    khoi hang cho ma chua co diem QC nao tuong ung — mat du lieu noi kiem, khong dau vet.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSandbox, run } = require('./helpers/sandbox');

(async () => {
  const storage = new Map(), requests = [];
  let pendingItems = [], failDecide = false;
  const ctx = loadSandbox(['modules/lis-client-service.js'], {
    URL, AbortController, setInterval, clearInterval,
    fetch: async (url, opts = {}) => {
      requests.push({ url, opts });
      if (url.endsWith('/health')) return { ok: true, status: 200, json: async () => ({ ok: true }) };
      if (url.includes('/qc-results/decide')) {
        if (failDecide) return { ok: false, status: 500, json: async () => ({ message: 'Gateway loi' }) };
        return { ok: true, status: 200, json: async () => ({ record: {} }) };
      }
      return { ok: true, status: 200, json: async () => ({ items: pendingItems }) };
    },
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    document: { getElementById: () => null },
  });

  /* --- Chi cho phep dung hai origin, khop voi CSP connect-src --- */
  assert.equal(ctx.lisNormalizeGatewayUrl('http://127.0.0.1:8787/path'), 'http://127.0.0.1:8787');
  assert.equal(ctx.lisNormalizeGatewayUrl('http://localhost:8787'), 'http://localhost:8787');
  assert.equal(ctx.lisNormalizeGatewayUrl('https://example.com'), '', 'khong duoc keu goi toi host tuy y');
  assert.equal(ctx.lisNormalizeGatewayUrl('http://127.0.0.1:9999'), '', 'doi cong thi CSP chan, phai tu choi ngay tu day');

  /* --- Ngay theo gio dia phuong, khong cat chuoi UTC --- */
  const rec = (over = {}) => ({ message: { messageId: 'M1', value: 5.6, runId: 'r1', operator: 'KTV A', measuredAt: '2026-08-01T23:05:00Z', ...(over.message || {}) }, resolved: { ok: true, qclabTestId: 'T1', level: 1, lot: 'L1', ...(over.resolved || {}) } });
  const local = JSON.parse(JSON.stringify(run(ctx, `lisResultToPointInput(${JSON.stringify(rec())})`)));
  const expected = new Date('2026-08-01T23:05:00Z');
  const expectedDate = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;
  assert.equal(local.date, expectedDate, 'ngay phai theo gio dia phuong cua may chay app');
  assert.equal(local.tid, 'T1'); assert.equal(local.level, 1); assert.equal(local.lot, 'L1');
  assert.equal(local.value, 5.6); assert.equal(local.staff, 'KTV A');
  assert.equal(run(ctx, `lisResultToPointInput(${JSON.stringify(rec({ message: { measuredAt: 'khong-phai-ngay' } }))})`), null, 'thoi gian hong phai tra null chu khong dung ngay hom nay');

  /* --- Keo ve: tach nhom da khop va chua khop mapping --- */
  storage.set('qclab_lis_gateway', JSON.stringify({ enabled: true, url: 'http://127.0.0.1:8787', token: 'tok-abc' }));
  pendingItems = [rec(), { message: { messageId: 'M2' }, resolved: { ok: false, code: 'UNMAPPED_LEVEL' } }];
  const pull = JSON.parse(JSON.stringify(await run(ctx, 'lisGatewayPull()')));
  assert.equal(pull.ok, true); assert.equal(pull.pending, 1); assert.equal(pull.unresolved, 1, 'ban ghi chua khop mapping phai tach rieng, khong tron vao danh sach cho nhan');
  assert.equal(requests.find(r => r.url.includes('/qc-results')).opts.headers.authorization, 'Bearer tok-abc', 'moi request phai mang token');

  /* --- Nhan vao: chi bao gateway SAU khi ghi diem thanh cong --- */
  let recorded = null, saved = null, audit = '';
  run(ctx, `
    requireWrite=function(){return true;};userName=function(){return'KTV A';};
    fmt=function(v){return String(v);};rerender=function(){};
    state={tests:[{id:'T1',name:'Glucose',levels:[{level:1,lot:'L1'}]}]};
    lvlCfg=function(t,l){return (t&&t.levels||[]).find(x=>x.level===l);};
    logAct=function(a,b){globalThis.__audit=a+'|'+b;};
    save=function(o){globalThis.__saved=o;};
    EntryService={recordPoint:function(s,input){globalThis.__recorded=input;return{ok:true,point:{id:'p1'}};}};
  `);
  const ok = JSON.parse(JSON.stringify(await run(ctx, `lisImportResult('M1')`)));
  recorded = JSON.parse(JSON.stringify(ctx.__recorded)); saved = JSON.parse(JSON.stringify(ctx.__saved)); audit = ctx.__audit;
  assert.equal(ok.ok, true);
  assert.equal(recorded.tid, 'T1'); assert.equal(recorded.date, expectedDate);
  assert.equal(saved.testId, 'T1', 'phai luu theo phan vung dung xet nghiem');
  assert.match(audit, /^Nhận QC từ LIS\|/, 'nhan tu LIS phai de lai vet audit');
  const decideAt = requests.findIndex(r => r.url.includes('/decide'));
  assert.ok(decideAt >= 0, 'phai bao imported ve gateway');

  /* Khoa ky chan thi KHONG duoc bao imported — ban ghi phai o lai hang cho. */
  requests.length = 0;
  run(ctx, `EntryService={recordPoint:function(){return{ok:false,error:'period-locked'};}};infoDialog=async function(m){globalThis.__msg=m;};`);
  pendingItems = [rec()]; await run(ctx, 'lisGatewayPull()'); requests.length = 0;
  const locked = JSON.parse(JSON.stringify(await run(ctx, `lisImportResult('M1')`)));
  assert.equal(locked.ok, false); assert.equal(locked.error, 'period-locked');
  assert.equal(requests.some(r => r.url.includes('/decide')), false, 'ghi diem that bai thi TUYET DOI khong duoc bao imported — ban ghi se bien khoi hang cho ma khong co diem QC nao');
  assert.match(String(ctx.__msg), /kỳ này đã chốt/i);

  /* Ghi duoc nhung bao gateway hong: diem van con, va phai noi ro cho nguoi dung. */
  requests.length = 0; failDecide = true;
  run(ctx, `EntryService={recordPoint:function(s,i){globalThis.__recorded=i;return{ok:true,point:{id:'p2'}};}};`);
  pendingItems = [rec()]; await run(ctx, 'lisGatewayPull()'); requests.length = 0;
  const partial = JSON.parse(JSON.stringify(await run(ctx, `lisImportResult('M1')`)));
  assert.equal(partial.ok, true, 'diem da ghi thi ket qua van la thanh cong');
  assert.match(String(ctx.__msg), /chưa báo được về Gateway/i, 'phai noi ro trang thai nua voi de nguoi dung kiem lai truoc khi nhan lan nua');
  failDecide = false;

  /* --- Dang nhap thi bat dau hoi dinh ky; save() KHONG con day gi di --- */
  const users = fs.readFileSync(path.join(__dirname, '../assets/modules/users-auth.js'), 'utf8');
  const stateStorage = fs.readFileSync(path.join(__dirname, '../assets/modules/state-storage.js'), 'utf8');
  assert.match(users, /setTimeout\(lisGatewayStart,0\)/, 'dang nhap phai bat dau kiem tra hang cho');
  assert.doesNotMatch(stateStorage, /scheduleLisQcSync/, 'save() khong con day trang thai QC ra ngoai — chieu do da bi bo');
  run(ctx, 'clearInterval(lisGatewayRuntime.pollT);');

  /* ============================================================================
   * MAN HINH "QC CHO NHAP" — man hinh nay khong ton tai o commit truoc do: chi co
   * lisImportResult()/lisRejectResult() ma khong co UI nao goi toi, nen cach duy
   * nhat de nhan mot ban ghi la go tay vao DevTools console. Cac ham duoi day
   * (lisQueueRowHtml/lisQueueSectionHtml/lisRenderQueueModal/lisOpenQueueModal)
   * dung THAT esc/escAttr/jsq/btn tu reports.js/entry-routes.js/router-render.js
   * — khong stub — vi day chinh la lop thoat HTML can chot lai (xem hoi quy XSS
   * ben duoi), stub rieng se khong bat duoc regresion that trong cac ham do.
   * ========================================================================= */
  const openCalls = [];
  const ctx2 = loadSandbox(['modules/router-render.js', 'modules/entry-routes.js', 'modules/reports.js', 'modules/lis-client-service.js'], {
    URL, AbortController, setInterval, clearInterval,
    window: { QCLAB_APP: { name: 'QC Lab', version: 'test' } },
    document: { getElementById: () => null, addEventListener: () => {}, removeEventListener: () => {} },
    openModal: (html) => { openCalls.push(html); },
    fmt: (v) => Number(v).toFixed(1),
    formatDateTimeVN: () => '10:00 02/08/2026',
    fmtTestValue: (t, v) => Number(v).toFixed(1),
    testDisplayName: (t) => t && t.name || '',
    emptyState: (title, body) => `<div class="empty"><div class="empty-title">${title}</div><div>${body}</div></div>`,
  });
  run(ctx2, `state={tests:[{id:'T-NA',name:'Sodium (Na)',unit:'mmol/L',levels:[{level:1,lot:'1101'}]}]};`);

  const okRecord = { message: { messageId: 'M-OK', analyzerId: 'EASYLYTE-01', testCode: 'NA', qcLevel: '1', value: 141.2, unit: 'mmol/L', measuredAt: '2026-08-02T03:00:00Z', runId: 'lan-1', operator: 'KTV A' }, resolved: { ok: true, qclabTestId: 'T-NA', level: 1, lot: '1101', displayName: '' } };
  const badRecord = { message: { messageId: 'M-BAD', analyzerId: 'MAY-LA', testCode: 'XX', qcLevel: '1', value: 5, measuredAt: '2026-08-02T03:00:00Z' }, resolved: { ok: false, code: 'UNMAPPED_TEST', reason: 'Chưa mapping mã máy sang xét nghiệm QC Lab.' } };

  {
    const row = run(ctx2, `lisQueueRowHtml(${JSON.stringify(okRecord)})`);
    assert.match(row, /Sodium \(Na\)/, 'dong da khop mapping phai hien ten xet nghiem');
    assert.match(row, /M1/, 'phai hien muc QC');
    assert.match(row, /1101/, 'phai hien so lo');
    assert.match(row, /141\.2/, 'phai hien gia tri');
    assert.match(row, />Nhận</, 'dong da khop phai co nut Nhan');
    assert.match(row, />Bỏ</, 'va nut Bo');
  }
  {
    const row = run(ctx2, `lisQueueRowHtml(${JSON.stringify(badRecord)})`);
    assert.match(row, /MAY-LA\/XX/, 'dong chua khop phai hien ma may\/ma xet nghiem tho');
    assert.match(row, /Chưa mapping mã máy/, 'phai hien ly do gateway tra ve de biet sua cau hinh cho nao');
    assert.doesNotMatch(row, />Nhận</, 'dong CHUA khop KHONG duoc co nut Nhan — resolved.qclabTestId rong se lam EntryService nhan diem rac');
    assert.match(row, />Bỏ</);
  }
  {
    const empty = run(ctx2, `lisQueueSectionHtml('Sẵn sàng nhận',[],'Trống')`);
    assert.match(empty, /Sẵn sàng nhận/); assert.match(empty, /Trống/); assert.doesNotMatch(empty, /<table/, 'danh sach rong khong duoc dung table rong');
    const withRows = run(ctx2, `lisQueueSectionHtml('Sẵn sàng nhận',[${JSON.stringify(okRecord)}],'')`);
    assert.match(withRows, /Sẵn sàng nhận \(1\)/, 'tieu de phai dem dung so dong');
    assert.match(withRows, /<table/);
  }

  /* --- HOI QUY XSS: messageId la du lieu tu MIDDLEWARE BEN NGOAI (LIS Gateway
     normalizeQcResult() chi trim + cat do dai, KHONG loc ky tu) — khac moi cho dung
     jsq() con lai trong app, luon la id noi bo do uid()/cleanId() sinh ra. Ban dau
     lisQueueRowHtml() dung jsq() suong (jsq khong escape dau ngoac kep ") nen mot
     messageId nhu 'X" onmouseover="...' THOAT duoc khoi thuoc tinh onclick="...",
     tiem duoc thuoc tinh/HTML tuy y vao trinh duyet cua quan tri vien — da xac minh
     bang DOM parser that (Chromium): thuoc tinh onmouseover THAT su duoc tao tren
     the <button>. Sua bang lisOnclick() boc escAttr() quanh CA chuoi onclick, khong
     chi rieng id. Chot lai o day bang DOM parser that (khong so khop chuoi tho —
     chuoi da escape van CHUA nguyen van "onmouseover=" duoi dang van ban vo hai,
     so sanh chuoi se bao am tinh sai). */
  {
    const evilId = 'X" onmouseover="window.__pwned=true" data-x="';
    const evilRecord = JSON.parse(JSON.stringify(okRecord));
    evilRecord.message.messageId = evilId;
    const row = run(ctx2, `lisQueueRowHtml(${JSON.stringify(evilRecord)})`);
    // Dung 1 DOM that trong sandbox Node? khong co — dung phep giai ma HTML entity
    // deu quy y het cac truong hop can, roi kiem tra thuoc tinh onmouseover KHONG
    // con nam ngoai pham vi chuoi JS (tuong duong voi kiem tra bang trinh duyet that
    // da lam o buoc phat trien — o day chot lai bang dac diem HTML: gia tri thuoc
    // tinh onclick khong duoc chua ky tu " chua duoc entity-hoa).
    const onclickValues = [...row.matchAll(/onclick="([^"]*)"/g)].map(m => m[1]);
    // Neu messageId thoat duoc khoi thuoc tinh, regex /onclick="([^"]*)"/ se dung lai
    // O DAU " THAT (khong phai " ma ung dung sinh ra), tuc so match se KHAC 2 hoac
    // gia tri bat duoc se rat ngan (chi phan truoc dau " dau tien trong messageId).
    assert.equal(onclickValues.length, 2, 'phai co dung 2 thuoc tinh onclick (Nhan + Bo) — neu messageId pha duoc thuoc tinh, regex se bat sai so luong hoac sai noi dung');
    onclickValues.forEach(v => {
      assert.doesNotMatch(v, /"/, 'gia tri thuoc tinh onclick khong duoc con ky tu " song — do la dieu kien de KHONG thoat duoc khoi thuoc tinh HTML');
      // Giai ma dung nhung gi trinh duyet giai ma khi doc thuoc tinh HTML, roi kiem
      // tra JS nguon con lai la MOT loi goi ham hop le voi DUNG 1 tham so — khong bi
      // tach thanh nhieu tham so hay chen them ma.
      const decoded = v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      assert.match(decoded, /^lis(QueueImport|QueueReject)\('X" onmouseover="window\.__pwned=true" data-x="'\)$/, 'sau khi giai ma, JS nguon phai la DUNG mot loi goi ham voi nguyen van messageId lam tham so, khong bi phan manh');
    });
    assert.equal(row.match(/<button/g).length, 2, 'DOM van chi co dung 2 <button>, khong bi tiem the/thuoc tinh moi');
  }

  console.log('LIS client service tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
