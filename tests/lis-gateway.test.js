'use strict';
/**
 * Tests cho LIS Gateway — chieu NHAN ket qua QC tu middleware LIS.
 *
 * Chieu du lieu: may -> middleware (phan mem trung gian san co) -> gateway -> QC Lab.
 * Gateway KHONG quyet dinh gi ve ket qua benh nhan; ban dau no tung lam cong chan
 * accepted/review/held nhung do la thu phai xin hang LIS sua quy trinh phat hanh, gan nhu
 * khong kha thi. Nhan them mot loai ban ghi thi de duoc chap nhan hon nhieu.
 *
 * Hai tinh chat duoc chot o day:
 *   1. Ket qua nhan vao KHONG tu thanh diem QC — no o `pending` cho KTV duyet.
 *   2. Khong doan bua: thieu mapping / sai muc / lech don vi deu nam lai hang cho kem ly
 *      do doc duoc, thay vi ghi vao nham muc roi hong ca Levey-Jennings lan Westgard.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { LisBridge, LisError, resolveQcResult, buildMappingIndex } = require('../lis-gateway/core');
const { JournalStore, MemoryStore } = require('../lis-gateway/store');
const { createLisServer } = require('../lis-gateway/server');

const NOW = Date.parse('2026-08-02T07:00:00.000Z');
const config = {
  mappings: [{
    analyzerId: 'AU480-01', testCode: 'GLU', qclabTestId: 'T-GLU', expectedUnit: 'mmol/L',
    levels: [{ qcLevel: '1', level: 1 }, { qcLevel: '2', level: 2 }],
    lots: [{ qcLotCode: 'LOT-A', lot: 'L1' }],
  }],
};
const qc = (id, over = {}) => ({ messageId: id, analyzerId: 'AU480-01', testCode: 'GLU', qcLevel: '1', qcLotCode: 'LOT-A', value: 5.6, unit: 'mmol/L', measuredAt: '2026-08-02T06:55:00Z', runId: 'r1', ...over });

function request(server, method, url, body, headers = {}, rawOverride = null) {
  return new Promise((resolve, reject) => {
    const a = server.address(), raw = rawOverride != null ? rawOverride : (body == null ? '' : JSON.stringify(body));
    const req = http.request({ host: '127.0.0.1', port: a.port, path: url, method, headers: { ...(raw && rawOverride == null ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(raw) } : {}), ...headers } }, res => {
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => { const t = Buffer.concat(c).toString('utf8'); try { resolve({ status: res.statusCode, headers: res.headers, body: t ? JSON.parse(t) : null }); } catch (e) { reject(e); } });
    });
    req.on('error', reject); if (raw) req.write(raw); req.end();
  });
}

(async () => {
  /* --- Mapping: muc QC la bat buoc, va trung khoa thi tu choi khoi dong --- */
  assert.throws(() => buildMappingIndex({ mappings: [{ analyzerId: 'A', testCode: 'B', qclabTestId: 'T' }] }), /levels/i, 'khong khai levels thi khong duoc chay: doan muc QC la ghi diem vao nham muc');
  assert.throws(() => buildMappingIndex({ mappings: [config.mappings[0], config.mappings[0]] }), /trung/i);
  assert.throws(() => buildMappingIndex({ mappings: [{ ...config.mappings[0], levels: [{ qcLevel: '1', level: 1 }, { qcLevel: '1', level: 2 }] }] }), /trung qcLevel/i);

  /* --- Nhan vao: pending, khong tu thanh diem QC --- */
  const memory = new MemoryStore(), bridge = new LisBridge(config, memory);
  const first = bridge.ingest(qc('M1'), NOW);
  assert.equal(first.status, 'pending', 'ket qua nhan vao phai cho KTV duyet, khong tu ghi vao du lieu noi kiem');
  assert.equal(first.resolved.ok, true);
  assert.equal(first.resolved.qclabTestId, 'T-GLU');
  assert.equal(first.resolved.level, 1);
  assert.equal(first.resolved.lot, 'L1', 'qcLotCode phai duoc doi sang so lo cua QC Lab');

  /* Khong khai lots thi lay nguyen ma lo may gui — nhieu noi dung chung mot ma. */
  const passthrough = new LisBridge({ mappings: [{ ...config.mappings[0], lots: [] }] }, new MemoryStore());
  assert.equal(passthrough.ingest(qc('P1'), NOW).resolved.lot, 'LOT-A');

  /* --- Chong trung: retry mang la binh thuong, cung id khac noi dung thi khong --- */
  assert.equal(bridge.ingest(qc('M1'), NOW).duplicate, true);
  assert.equal(memory.events.filter(e => e.type === 'qc-result').length, 1, 'ban ghi trung khong duoc vao journal lan hai');
  assert.throws(() => bridge.ingest(qc('M1', { value: 9.9 }), NOW), e => e instanceof LisError && e.code === 'MESSAGE_ID_CONFLICT');

  /* --- Khong doan bua khi cau hinh chua khop --- */
  assert.equal(bridge.ingest(qc('M2', { testCode: 'LA' }), NOW).resolved.code, 'UNMAPPED_TEST');
  assert.equal(bridge.ingest(qc('M3', { qcLevel: '9' }), NOW).resolved.code, 'UNMAPPED_LEVEL');
  assert.equal(bridge.ingest(qc('M4', { unit: 'mg/dL' }), NOW).resolved.code, 'UNIT_MISMATCH');
  assert.equal(bridge.listResults({ resolvable: false }).length, 3, 'ban ghi chua khop van nam lai hang cho de con sua cau hinh roi nhan lai');
  assert.equal(bridge.listResults({ resolvable: true }).length, 1);

  /* --- Tu choi du lieu benh nhan, ke ca ma mau --- */
  ['patientId', 'patientName', 'specimenRef'].forEach(field => {
    assert.throws(() => bridge.ingest(qc('PHI-' + field, { [field]: 'X' }), NOW), e => e.code === 'PHI_NOT_ALLOWED', `${field} phai bi tu choi`);
  });

  /* --- Gia tri QC bat buoc la so --- */
  assert.throws(() => bridge.ingest(qc('S1', { value: 'duong tinh' }), NOW), e => e.code === 'VALUE_INVALID', 'diem noi kiem phai tinh duoc z-score');
  assert.throws(() => bridge.ingest(qc('S2', { value: null }), NOW), e => e.code === 'VALUE_INVALID');
  assert.throws(() => bridge.ingest(qc('S3', { qcLevel: '' }), NOW), e => e.code === 'QC_LEVEL_REQUIRED');

  /* --- Quyet dinh: mot lan, va khong xoa ban ghi --- */
  const decided = bridge.decide({ messageId: 'M1', status: 'imported', by: 'KTV A' });
  assert.equal(decided.status, 'imported');
  assert.equal(decided.decidedBy, 'KTV A');
  assert.throws(() => bridge.decide({ messageId: 'M1', status: 'rejected' }), e => e.code === 'ALREADY_DECIDED', 'da quyet dinh roi thi khong duoc lat lai am tham');
  assert.throws(() => bridge.decide({ messageId: 'KHONG-CO', status: 'imported' }), e => e.code === 'RESULT_NOT_FOUND');
  assert.throws(() => bridge.decide({ messageId: 'M2', status: 'xoa' }), e => e.code === 'STATUS_INVALID');
  /* 4 = M1..M4. Cac ban ghi PHI va gia tri hong deu NEM LOI nen khong bao gio vao journal
     — do la chu y: journal chi chua thu da qua chuan hoa. */
  assert.equal(bridge.status().results, 4, 'ban ghi da quyet dinh van con trong journal lam vet');
  assert.equal(bridge.status().counts.imported, 1);

  /* --- Khoi dong lai: journal dung lai duoc ca ban ghi lan quyet dinh --- */
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qclab-lis-'));
  try {
    const file = path.join(temp, 'events.ndjson');
    const disk = new LisBridge(config, new JournalStore(file));
    disk.ingest(qc('PERSIST'), NOW);
    disk.decide({ messageId: 'PERSIST', status: 'imported', by: 'KTV B' });
    const restarted = new LisBridge(config, new JournalStore(file));
    assert.equal(restarted.status().counts.imported, 1, 'quyet dinh phai song sot qua khoi dong lai');
    assert.equal(restarted.ingest(qc('PERSIST'), NOW).duplicate, true, 'chong trung phai song sot qua khoi dong lai');

    fs.appendFileSync(file, '{"type":');
    const repairStore = new JournalStore(file), repaired = new LisBridge(config, repairStore);
    assert.equal(repaired.status().results, 1);
    assert.equal(repairStore.warnings.length, 1, 'dong cuoi bi cat do mat dien phai duoc cach ly');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }

  /* --- HTTP --- */
  assert.throws(() => createLisServer({ bridge: new LisBridge(config, new MemoryStore()) }), /token/i, 'khong co token thi phai tu choi khoi tao, khong duoc chay o che do mo');

  const TOKEN = 'tok-' + 'a'.repeat(28), auth = { authorization: `Bearer ${TOKEN}` };
  const apiBridge = new LisBridge(config, new MemoryStore());
  const server = createLisServer({ bridge: apiBridge, token: TOKEN });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const health = await request(server, 'GET', '/health');
    assert.equal(health.status, 200);
    assert.equal('results' in health.body, false, '/health khong xac thuc thi khong duoc lo so lieu van hanh');
    assert.equal((await request(server, 'GET', '/api/v1/qc-results')).status, 401, 'thieu token phai bi tu choi');
    assert.equal((await request(server, 'GET', '/api/v1/status', null, { authorization: 'Bearer sai' })).status, 401);

    assert.equal((await request(server, 'OPTIONS', '/api/v1/qc-results', null, { origin: 'https://evil.example' })).status, 403);
    assert.equal((await request(server, 'OPTIONS', '/api/v1/qc-results', null, { origin: 'http://localhost:8080' })).status, 204);

    /* CSRF: POST kem text/plain la "simple request" nen trinh duyet KHONG preflight. Doi
       application/json bien no thanh non-simple, buoc preflight, ma preflight thi da bi
       allowlist chan o tren. */
    const raw = JSON.stringify(qc('CSRF'));
    const csrf = await request(server, 'POST', '/api/v1/qc-results', null, { ...auth, 'content-type': 'text/plain', 'content-length': Buffer.byteLength(raw), origin: 'https://evil.example' }, raw);
    assert.equal(csrf.status, 415);
    assert.equal(apiBridge.status().results, 0, 'request CSRF khong duoc de lai dau vet nao');

    const one = await request(server, 'POST', '/api/v1/qc-results', qc('H1'), auth);
    assert.equal(one.status, 201);
    assert.equal(one.body.status, 'pending');

    const batch = await request(server, 'POST', '/api/v1/qc-results', { items: [qc('H2', { qcLevel: '2' }), qc('H3')] }, auth);
    assert.equal(batch.status, 201);
    assert.equal(batch.body.nhan, 2);
    const again = await request(server, 'POST', '/api/v1/qc-results', { items: [qc('H2', { qcLevel: '2' })] }, auth);
    assert.equal(again.body.trung, 1, 'middleware gui lai ca lo la binh thuong — phai dem rieng so trung');

    const pending = await request(server, 'GET', '/api/v1/qc-results?status=pending', null, auth);
    assert.equal(pending.body.items.length, 3);
    assert.deepEqual(pending.body.items.map(x => x.message.messageId), ['H1', 'H2', 'H3'], 'hang cho xep theo thu tu nhan de KTV duyet tuan tu');

    const decide = await request(server, 'POST', '/api/v1/qc-results/decide', { messageId: 'H1', status: 'imported', by: 'KTV A' }, auth);
    assert.equal(decide.status, 200);
    assert.equal(decide.body.record.status, 'imported');
    assert.equal((await request(server, 'GET', '/api/v1/qc-results?status=pending', null, auth)).body.items.length, 2, 'da nhan roi thi khong con trong hang cho');
    assert.equal((await request(server, 'POST', '/api/v1/qc-results/decide', { messageId: 'H1', status: 'rejected' }, auth)).status, 409);

    const stats = await request(server, 'GET', '/api/v1/status', null, auth);
    assert.equal(stats.body.counts.pending, 2);
    assert.equal(stats.body.counts.imported, 1);
  } finally { await new Promise(r => server.close(r)); }

  /* --- resolveQcResult thuan: goi truc tiep khong can bridge --- */
  /* Lay qua values() chu khong go tay khoa: dinh dang khoa la chi tiet noi bo cua
     buildMappingIndex(), test khong nen chot vao no. */
  const mapping = [...buildMappingIndex(config).values()][0];
  assert.equal(resolveQcResult({ analyzerId: 'AU480-01', testCode: 'GLU', qcLevel: '2', qcLotCode: '', unit: '' }, mapping).level, 2);
  assert.equal(resolveQcResult({ qcLevel: '1' }, null).code, 'UNMAPPED_TEST');

  console.log('LIS Gateway (nhan ket qua QC) tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
