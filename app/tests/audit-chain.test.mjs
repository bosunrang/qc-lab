import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { auditCanonical, auditSha256, auditEntryHash, verifyAuditChain, relinkAuditChain } = require('../../app-dist/main/domain/audit-chain.js');
const canonical = (v) => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
const hash = (v) => createHash('sha256').update(v).digest('hex');
assert.equal(auditCanonical({ b: 2, a: ['Đông máu'] }), canonical({ b: 2, a: ['Đông máu'] }));
assert.equal(auditSha256('Đông máu'), hash('Đông máu'));
let previous = '';
const entries = [1, 2, 3].map((seq) => { const entry = { id: `e${seq}`, seq, ts: `2026-09-0${seq}T00:00:00.000Z`, user: 'KTV', username: 'ktv', userId: 'u1', role: 'technician', type: 'Nhập QC', detail: String(seq), target: 'GLU', clientId: 'desktop', prevHash: previous, hash: '' }; entry.hash = auditEntryHash(entry); previous = entry.hash; return entry; });
assert.deepEqual(verifyAuditChain(entries).ok, true);
assert.equal(verifyAuditChain(entries.map((entry, i) => i === 1 ? { ...entry, detail: 'sửa' } : entry)).ok, false);
assert.deepEqual(relinkAuditChain(entries), entries);
console.log('app audit-chain tests passed');


