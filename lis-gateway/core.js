'use strict';

/*
 * HOP DONG NHAN KET QUA QC TU MIDDLEWARE LIS.
 *
 * Chieu du lieu: may xet nghiem -> middleware (phan mem trung gian san co cua phong) ->
 * gateway nay -> QC Lab. Middleware VON DA co ket qua chay mau QC vi no di chung duong
 * voi moi ket qua khac; muc tieu la lay tu noi da co thay vi bat KTV go tay lai.
 *
 * Gateway KHONG quyet dinh gi ve ket qua benh nhan. Ban dau no tung lam cong chan
 * accepted/review/held, nhung do la thu phai xin phep hang LIS sua quy trinh phat hanh —
 * gan nhu khong kha thi. Nhan them mot loai ban ghi thi de duoc chap nhan hon nhieu.
 *
 * Ket qua nhan vao KHONG tu thanh diem QC. No nam o trang thai `pending` cho toi khi KTV
 * mo QC Lab, doi chieu muc/lo roi bam nhan. Du lieu noi kiem la ho so duoc kiem soat; de
 * he thong ngoai ghi thang vao ma khong ai nhin la sai nguyen tac, va con di xuyen qua ca
 * khoa ky bao cao.
 */

const crypto = require('node:crypto');

const FORBIDDEN_PHI = ['patientId', 'patientName', 'patientDob', 'dateOfBirth', 'phone', 'address', 'specimenRef'];
const RESULT_STATUS = new Set(['pending', 'imported', 'rejected']);

class LisError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = 'LisError'; this.code = code; this.status = status; }
}

function text(value, max = 160) { return String(value == null ? '' : value).trim().slice(0, max); }
function iso(value) { const raw = text(value, 50), time = Date.parse(raw); return raw && Number.isFinite(time) ? new Date(time).toISOString() : ''; }
function canonical(value) { if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'; return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'; }
function fingerprint(value) { return crypto.createHash('sha256').update(canonical(value)).digest('hex'); }
const SEP=String.fromCharCode(0); // ngan cach khoa mapping; viet bang escape de source khong chua NUL nguyen van (grep coi file la binary)
function key(...parts) { return parts.map(p => text(p).toUpperCase()).join(SEP); }

/* Tu choi thang du lieu benh nhan thay vi lang le bo di: mot middleware cau hinh nham co
   the day ca ban ghi benh nhan sang day, va im lang nuot no nghia la PHI nam trong journal
   cua mot dich vu khong duoc thiet ke de giu PHI. specimenRef cung nam trong danh sach —
   ma mau van truy nguoc ve benh nhan duoc qua LIS. */
function assertNoPhi(input) {
  const found = FORBIDDEN_PHI.find(k => input[k] != null && String(input[k]).trim());
  if (found) throw new LisError('PHI_NOT_ALLOWED', `Ket qua QC khong duoc mang truong du lieu benh nhan: ${found}.`);
}

function normalizeQcResult(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new LisError('INVALID_RESULT', 'Ket qua phai la object JSON.');
  assertNoPhi(input);
  const out = {
    messageId: text(input.messageId, 120),
    analyzerId: text(input.analyzerId, 80),
    testCode: text(input.testCode, 80),
    qcLevel: text(input.qcLevel, 40),
    qcLotCode: text(input.qcLotCode, 80),
    value: input.value,
    unit: text(input.unit, 40),
    measuredAt: iso(input.measuredAt),
    runId: text(input.runId, 60),
    operator: text(input.operator, 80),
  };
  if (!out.messageId) throw new LisError('MESSAGE_ID_REQUIRED', 'Thieu messageId (dung de chong trung).');
  if (!out.analyzerId) throw new LisError('ANALYZER_REQUIRED', 'Thieu analyzerId.');
  if (!out.testCode) throw new LisError('TEST_CODE_REQUIRED', 'Thieu testCode.');
  if (!out.qcLevel) throw new LisError('QC_LEVEL_REQUIRED', 'Thieu qcLevel (muc QC theo ma cua may).');
  if (!out.measuredAt) throw new LisError('MEASURED_AT_INVALID', 'measuredAt phai la thoi gian ISO hop le.');
  /* Gia tri QC BAT BUOC la so. Ket qua benh nhan co the la chuoi ("duong tinh"), nhung mot
     diem noi kiem thi phai tinh duoc z-score — nhan chuoi vao day chi de no hong o tang
     sau, xa cho co the bao loi ro rang. */
  const num = Number(out.value);
  if (out.value === '' || out.value == null || !Number.isFinite(num)) throw new LisError('VALUE_INVALID', 'value phai la so (ket qua dinh luong).');
  out.value = num;
  return out;
}

/* Mapping: ma cua may/middleware -> dinh danh trong QC Lab.
   `levels` bat buoc vi so muc QC la thu middleware goi khac nhau moi hang (1/2/3, L/N/H,
   NORMAL/ABNORMAL...). `lots` khong bat buoc — khong khai thi lay nguyen qcLotCode lam so
   lo, vi nhieu noi dung chung mot ma. */
function buildMappingIndex(config) {
  const map = new Map();
  (config && config.mappings || []).forEach((row, i) => {
    const analyzerId = text(row && row.analyzerId, 80), testCode = text(row && row.testCode, 80), qclabTestId = text(row && row.qclabTestId, 120);
    if (!analyzerId || !testCode || !qclabTestId) throw new LisError('MAPPING_INVALID', `Mapping ${i + 1} thieu analyzerId, testCode hoac qclabTestId.`);
    const mapKey = key(analyzerId, testCode);
    if (map.has(mapKey)) throw new LisError('MAPPING_DUPLICATE', `Mapping trung ${analyzerId}/${testCode}.`);
    const levels = new Map();
    (Array.isArray(row.levels) ? row.levels : []).forEach((lv, j) => {
      const from = text(lv && lv.qcLevel, 40), to = Number(lv && lv.level);
      if (!from || !Number.isInteger(to) || to < 1 || to > 10) throw new LisError('MAPPING_LEVEL_INVALID', `Mapping ${i + 1}, muc ${j + 1}: qcLevel phai co va level phai la so nguyen 1..10.`);
      if (levels.has(key(from))) throw new LisError('MAPPING_LEVEL_DUPLICATE', `Mapping ${i + 1} trung qcLevel "${from}".`);
      levels.set(key(from), to);
    });
    if (!levels.size) throw new LisError('MAPPING_LEVEL_REQUIRED', `Mapping ${i + 1} (${analyzerId}/${testCode}) chua khai bao levels.`);
    const lots = new Map();
    (Array.isArray(row.lots) ? row.lots : []).forEach(l => { const from = text(l && l.qcLotCode, 80), to = text(l && l.lot, 80); if (from && to) lots.set(key(from), to); });
    map.set(mapKey, { analyzerId, testCode, qclabTestId, levels, lots, expectedUnit: text(row.expectedUnit, 40), displayName: text(row.displayName, 160) });
  });
  return map;
}

/* Khong doan bua: thieu mapping, sai muc hay lech don vi deu tra ve `held` kem ly do doc
   duoc, va ban ghi van nam trong hang cho de nguoi ta sua cau hinh roi nhan lai. Doan sai
   mot muc QC la ghi diem vao nham muc — hong ca bieu do Levey-Jennings lan Westgard. */
function resolveQcResult(result, mapping) {
  if (!mapping) return { ok: false, code: 'UNMAPPED_TEST', reason: `Chua mapping ${result.analyzerId}/${result.testCode} sang xet nghiem QC Lab.` };
  const level = mapping.levels.get(key(result.qcLevel));
  if (!level) return { ok: false, code: 'UNMAPPED_LEVEL', reason: `Chua mapping muc QC "${result.qcLevel}" cua ${result.analyzerId}/${result.testCode}.` };
  if (mapping.expectedUnit && result.unit && mapping.expectedUnit.toLowerCase() !== result.unit.toLowerCase()) {
    return { ok: false, code: 'UNIT_MISMATCH', reason: `Don vi may (${result.unit}) khac mapping (${mapping.expectedUnit}).` };
  }
  const lot = mapping.lots.get(key(result.qcLotCode)) || result.qcLotCode;
  return { ok: true, code: 'RESOLVED', qclabTestId: mapping.qclabTestId, level, lot, displayName: mapping.displayName };
}

class LisBridge {
  constructor(config = {}, store) {
    this.config = { ...config };
    this.mappings = buildMappingIndex(this.config);
    this.store = store;
    this.results = new Map();
    (store && store.load ? store.load() : []).forEach(e => this.applyEvent(e));
  }
  applyEvent(event) {
    if (!event) return;
    if (event.type === 'qc-result' && event.record) this.results.set(event.record.message.messageId, event.record);
    else if (event.type === 'qc-result-status' && event.messageId) {
      const row = this.results.get(event.messageId);
      if (row) { row.status = event.status; row.decidedAt = event.decidedAt || ''; row.decidedBy = event.decidedBy || ''; row.note = event.note || ''; }
    }
  }
  append(event) { if (this.store && this.store.append) this.store.append(event); this.applyEvent(event); }

  ingest(input, nowMs = Date.now()) {
    const message = normalizeQcResult(input), hash = fingerprint(message), existing = this.results.get(message.messageId);
    /* Middleware gui lai cung messageId la chuyen binh thuong (retry mang). Cung id ma
       KHAC noi dung thi khong: mot trong hai ban ghi sai, va am tham lay ban sau de ghi
       de nghia la khong ai biet gia tri nao that. */
    if (existing) {
      if (existing.fingerprint !== hash) throw new LisError('MESSAGE_ID_CONFLICT', 'messageId da ton tai voi noi dung khac.', 409);
      return { ...existing, duplicate: true };
    }
    const mapping = this.mappings.get(key(message.analyzerId, message.testCode)) || null;
    const resolved = resolveQcResult(message, mapping);
    const record = {
      id: 'qcr_' + hash.slice(0, 24), receivedAt: new Date(nowMs).toISOString(), fingerprint: hash,
      status: 'pending', decidedAt: '', decidedBy: '', note: '', message, resolved,
    };
    this.append({ type: 'qc-result', recordedAt: record.receivedAt, record });
    return { ...record, duplicate: false };
  }

  /* App keo ve dung nhung ban ghi con cho. `resolvable` loc them nhung ban ghi da khop
     mapping — man hinh "QC cho nhap" chi nhan duoc nhung cai nay, so con lai hien rieng
     kem ly do de nguoi ta biet phai sua cau hinh cho nao. */
  listResults({ status = 'pending', limit = 200, resolvable = null } = {}) {
    const want = RESULT_STATUS.has(status) ? status : 'pending';
    return [...this.results.values()]
      .filter(r => r.status === want)
      .filter(r => resolvable == null || r.resolved.ok === !!resolvable)
      .sort((a, b) => String(a.receivedAt).localeCompare(String(b.receivedAt)))
      .slice(0, Math.max(1, Math.min(1000, Number(limit) || 200)));
  }

  /* App bao lai da nhan hay da bo. Khong xoa ban ghi: journal la vet cho thay dieu gi da
     toi va ai quyet dinh gi voi no. */
  decide({ messageId, status, by, note } = {}) {
    const id = text(messageId, 120), next = text(status, 20);
    if (!id) throw new LisError('MESSAGE_ID_REQUIRED', 'Thieu messageId.');
    if (next !== 'imported' && next !== 'rejected') throw new LisError('STATUS_INVALID', 'status phai la imported hoac rejected.');
    const row = this.results.get(id);
    if (!row) throw new LisError('RESULT_NOT_FOUND', `Khong tim thay ket qua ${id}.`, 404);
    if (row.status !== 'pending') throw new LisError('ALREADY_DECIDED', `Ket qua ${id} da o trang thai ${row.status}.`, 409);
    const event = { type: 'qc-result-status', recordedAt: new Date().toISOString(), messageId: id, status: next, decidedAt: new Date().toISOString(), decidedBy: text(by, 120), note: text(note, 500) };
    this.append(event);
    return this.results.get(id);
  }

  status() {
    const counts = { pending: 0, imported: 0, rejected: 0 };
    let unresolved = 0;
    this.results.forEach(r => { if (counts[r.status] != null) counts[r.status]++; if (r.status === 'pending' && !r.resolved.ok) unresolved++; });
    return { results: this.results.size, mappings: this.mappings.size, counts, pendingUnresolved: unresolved };
  }
}

module.exports = { LisBridge, LisError, normalizeQcResult, buildMappingIndex, resolveQcResult, fingerprint, FORBIDDEN_PHI };
