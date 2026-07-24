// TEa provenance: every measurand in analyte-catalog.js must be traceable to
// docs/tea-sources.md. The catalog's clia/ricos/cliaAbsolute figures drive
// Sigma scoring and QC design suggestions, so a value without a cited source
// is an audit finding waiting to happen (ISO 15189 traceability). This test
// blocks the two failure modes:
//   1. an analyte added to the catalog without updating the source doc
//      ("orphan" provenance);
//   2. the source doc silently losing its references or review record.
// Same enforcement pattern as button-conventions.test.js — a flat ban, not a
// ratchet. Only Node core modules (pre-commit runs on cold checkouts).
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const catalogSrc = fs.readFileSync(path.join(ROOT, 'assets', 'modules', 'analyte-catalog.js'), 'utf8');
const catalog = vm.runInNewContext(catalogSrc + ';TEA_ANALYTE_CATALOG', {});
assert.ok(catalog.length > 50, `catalog quá ít measurand (${catalog.length}) — có thể parse hỏng`);

const docPath = path.join(ROOT, 'docs', 'tea-sources.md');
assert.ok(fs.existsSync(docPath), 'thiếu docs/tea-sources.md — hồ sơ truy xuất nguồn TEa');
const doc = fs.readFileSync(docPath, 'utf8');

// 1. Mọi measurand trong catalog phải có đúng một dòng trong bảng truy xuất.
for (const a of catalog) {
  const rowCount = doc.split('\n').filter((line) => line.startsWith(`| ${a.analyteId} | `)).length;
  assert.equal(rowCount, 1, `${a.analyteId} (${a.name}) phải có đúng 1 dòng trong docs/tea-sources.md, thấy ${rowCount}`);
  assert.ok(doc.includes(a.name), `tên measurand "${a.name}" không có trong docs/tea-sources.md`);
}

// 2. Tài liệu nguồn tối thiểu phải còn nguyên: CLIA 2024 (42 CFR 493 + văn bản
//    CMS), EFLM BV database, và biên bản rà soát có ngày.
assert.match(doc, /42 CFR Part 493/, 'thiếu trích dẫn CLIA 42 CFR Part 493');
assert.match(doc, /QSO-24-15-CLIA/, 'thiếu trích dẫn văn bản CMS QSO-24-15-CLIA (Final Rule 2024)');
assert.match(doc, /biologicalvariation\.eu/, 'thiếu trích dẫn EFLM Biological Variation Database');
assert.match(doc, /Ricos/, 'thiếu trích dẫn Ricos et al. cho cột ricos');
assert.match(doc, /\*\*\d{4}-\d{2}-\d{2}\*\*:/, 'thiếu biên bản rà soát kèm ngày (YYYY-MM-DD)');

// 3. Mỗi nguồn được catalog dùng phải được giải thích trong quy ước áp dụng.
assert.match(doc, /cliaAbsoluteUnit/, 'thiếu quy ước về giới hạn tuyệt đối cliaAbsolute/cliaAbsoluteUnit');

console.log(`TEa sources tests passed (${catalog.length} measurand đều truy xuất được nguồn)`);
