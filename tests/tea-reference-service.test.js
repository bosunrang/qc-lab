'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'application', 'manage', 'tea-reference-service.ts')).href;
const program = `
  import { createTeaReferenceService } from ${JSON.stringify(source)};
  const refs = [['Glucose', 'mmol/L', 10, 8, 'Hoa sinh', '', 'glucose', null]];
  const service = createTeaReferenceService({
    key: value => String(value || '').trim().toLowerCase(),
    analyteMeta: name => ({ analyteId: String(name).toLowerCase() === 'glucose' ? 'glucose' : '', displayName: name, standardName: name, abbreviation: '', aliases: [], matrix: 'Serum' }),
    effectiveReferences: () => refs, defaultReferences: () => refs,
    sourceRegistry: () => ({ clia: { version: 'CLIA 2024', document: '42 CFR' }, ricos: { version: 'Ricos' } }),
    createId: () => 'tea-1', todayIso: () => '2026-08-11', userName: () => 'KTV A',
  });
  const state = {};
  const first = service.ensure(state, 'glucose');
  const edit = service.edit(state, 'glucose', 'clia', '12.5');
  const blank = service.edit(state, 'glucose', 'ricos', '');
  const lab = service.saveLabProfile(state, 'glucose', { value: 9, source: 'regulation', sourceLabel: 'CLIA', reference: 'Noi bo', reason: 'Da danh gia phu hop', effective: '2026-08-01', nextReview: '2027-08-01', prepared: 'KTV B', approved: 'TP C', approvedDate: '2026-08-01' }); state.teaRefs[0].cliaRule = 'absolute';
  const restored = service.restoreOrRemove(state, 'glucose', true);
  const custom = service.ensure(state, 'Custom assay');
  const removed = service.restoreOrRemove(state, 'Custom assay', false);
  const added = service.addCustomReference(state, { name: 'CK-MB', abbreviation: 'CKMB', matrix: 'Serum', unit: 'U/L', section: 'Tim mach', clia: '15', ricos: '' });
  const labState = { teaRefs: [{ analyteId: 'glucose', name: 'Glucose', unit: 'mmol/L', clia: 10, ricos: 8, section: 'Hoa sinh', lab: 8, sources: { lab: { document: 'Noi bo' } } }] };
  const labRemoved = service.removeLabProfile(labState, 'glucose', true);
  console.log(JSON.stringify({ first, edit, blank, lab, record: state.teaRefs[0], restored, custom, removed, added, labRemoved, labState, number: [service.numberOrNull('0'), service.numberOrNull('4.2')] }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TeaReferenceService TypeScript');
const output = JSON.parse(result.stdout);
assert.equal(output.first.created, true);
assert.equal(output.edit.before, 10);
assert.equal(output.edit.record.clia, 10, 'Khôi phục phải trả CLIA về giá trị mặc định');
assert.equal(output.blank.record.ricos, 8, 'Khôi phục phải trả Ricos về giá trị mặc định');
assert.equal(output.edit.source.version, 'CLIA 2024');
assert.equal(output.edit.source.reviewedBy, 'KTV A');
assert.equal(output.lab.before, null);
assert.equal(output.lab.record.lab, 9);
assert.equal(output.lab.record.sources.lab.document, 'Noi bo');
assert.deepEqual(output.number, [null, 4.2]);
assert.equal(output.restored.restored, true);
assert.equal(output.record.sources.lab.document, 'Noi bo');
assert.equal(output.record.sources.lab.reviewedBy, 'TP C');
assert.equal(output.record.cliaRule, undefined);
assert.equal(output.custom.created, true);
assert.equal(output.removed.restored, false);
assert.equal(output.removed.record.name, 'Custom assay');
assert.equal(output.added.record.displayName, 'CK-MB (CKMB)');
assert.equal(output.added.record.clia, 15);
assert.equal(output.added.record.ricos, null);
assert.equal(output.added.record.sources.clia.reviewedBy, 'KTV A');
assert.equal(output.labRemoved.before, 8);
assert.equal(output.labRemoved.removedRecord, true);
assert.equal(output.labState.teaRefs.length, 0);
console.log('Tea reference service TypeScript tests passed');
