/**
 * Tests for the hand-rolled ZIP/OOXML builder behind "Xuất Excel Sigma"
 * (SigmaXlsx in assets/modules/data-io.js).
 *
 * There is no library involved - the ZIP local/central-directory records and
 * the worksheet XML are built byte-by-byte. A single wrong offset or length
 * field would silently produce a corrupt .xlsx with no error at export time.
 * These tests independently re-parse the produced bytes (without trusting
 * any of the app's own code) and check the structural invariants a real
 * unzip/Excel would rely on.
 */
const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['modules/data-io.js']);
run(ctx, 'function __buildXlsx(rows,meta,images){return SigmaXlsx.build(rows,meta,images||[]);}');

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Minimal STORE-only (no compression) ZIP reader, independent of the app's own zip() builder. */
function parseZip(bytesFromSandbox) {
  const buf = Buffer.from(bytesFromSandbox);
  const entries = [];
  let off = 0;
  while (off + 4 <= buf.length && buf.readUInt32LE(off) === 0x04034b50) {
    const compression = buf.readUInt16LE(off + 8);
    const crc = buf.readUInt32LE(off + 14);
    const compSize = buf.readUInt32LE(off + 18);
    const uncompSize = buf.readUInt32LE(off + 22);
    const nameLen = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const nameStart = off + 30;
    const name = buf.toString('utf8', nameStart, nameStart + nameLen);
    const dataStart = nameStart + nameLen + extraLen;
    const data = Buffer.from(buf.subarray(dataStart, dataStart + compSize));
    entries.push({ name, compression, crc, compSize, uncompSize, data });
    off = dataStart + compSize;
  }
  const central = [];
  while (off + 4 <= buf.length && buf.readUInt32LE(off) === 0x02014b50) {
    const crc = buf.readUInt32LE(off + 16);
    const compSize = buf.readUInt32LE(off + 20);
    const uncompSize = buf.readUInt32LE(off + 24);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOffset = buf.readUInt32LE(off + 42);
    const nameStart = off + 46;
    const name = buf.toString('utf8', nameStart, nameStart + nameLen);
    central.push({ name, crc, compSize, uncompSize, localOffset });
    off = nameStart + nameLen + extraLen + commentLen;
  }
  assert.equal(buf.readUInt32LE(off), 0x06054b50, 'End Of Central Directory record must directly follow the central directory');
  const eocdEntryCount = buf.readUInt16LE(off + 10);
  return { buf, entries, central, eocdEntryCount };
}

function entryNames(zip) { return zip.entries.map(e => e.name); }

// --- Structural integrity: every entry's stored bytes must match its own CRC/size fields,
//     and the central directory must agree with the local headers (name, size, offset). ---
{
  const rows = [{
    name: 'Glucose', period: '07/2026', tea: 6.96,
    r1: { cv: 2, bias: 0.5, sigma: 3.23, dpmo: 1234, yld: 87.66, label: 'Cận biên', rs: { n: 45, rule: '1:3s', N: 4 } },
    r2: null,
  }];
  const meta = { title: 'BÁO CÁO TỔNG HỢP', subtitle: 'Xuất thử · 1 xét nghiệm' };
  const zip = parseZip(ctx.__buildXlsx(rows, meta, []));

  assert.ok(zip.entries.length >= 5, 'expected at least the 5 core OOXML parts without images');
  assert.equal(zip.central.length, zip.entries.length, 'central directory entry count must match local file entries');
  assert.equal(zip.eocdEntryCount, zip.entries.length, 'EOCD entry count must match the number of files actually stored');

  zip.entries.forEach((e, i) => {
    assert.equal(e.compression, 0, `${e.name}: must be STORE (uncompressed), not a bogus compression method`);
    assert.equal(e.compSize, e.uncompSize, `${e.name}: STORE entries must have compSize === uncompSize`);
    assert.equal(e.data.length, e.uncompSize, `${e.name}: stored byte count must match the declared size`);
    assert.equal(crc32(e.data), e.crc, `${e.name}: CRC32 recomputed from the actual stored bytes must match the header's CRC field`);

    const c = zip.central[i];
    assert.equal(c.name, e.name, `central directory entry ${i} name must line up with local file entry ${i}`);
    assert.equal(c.crc, e.crc, `${e.name}: central directory CRC must match local header CRC`);
    assert.equal(c.compSize, e.compSize, `${e.name}: central directory size must match local header size`);
  });

  assert.deepEqual(entryNames(zip), [
    '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels',
    'xl/styles.xml', 'xl/worksheets/sheet1.xml',
  ], 'without images, only the core OOXML parts should be present (no drawing/media parts)');
}

// --- With an embedded chart image: extra drawing/media parts appear and are wired up. ---
{
  const rows = [{ name: 'Glucose', period: '07/2026', tea: 6.96, r1: null, r2: null }];
  const meta = { title: 'BÁO CÁO', subtitle: 'sub' };
  const fakePng = { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]), dispW: 400, dispH: 200 };
  const zip = parseZip(ctx.__buildXlsx(rows, meta, [fakePng]));

  const names = entryNames(zip);
  ['xl/drawings/drawing1.xml', 'xl/drawings/_rels/drawing1.xml.rels', 'xl/worksheets/_rels/sheet1.xml.rels', 'xl/media/image1.png']
    .forEach(name => assert.ok(names.includes(name), `expected "${name}" to be present when an image is embedded`));

  const media = zip.entries.find(e => e.name === 'xl/media/image1.png');
  assert.deepEqual([...media.data], [...fakePng.bytes], 'embedded image bytes must be stored verbatim');

  const sheet = zip.entries.find(e => e.name === 'xl/worksheets/sheet1.xml').data.toString('utf8');
  assert.match(sheet, /<drawing r:id="rId1"\/>/, 'worksheet must reference the drawing part when images are present');
  assert.match(sheet, /<row r="5" ht="32"[^>]*><c r="A5"/, 'an empty report keeps only one placeholder row before the note');
  const drawing = zip.entries.find(e => e.name === 'xl/drawings/drawing1.xml').data.toString('utf8');
  assert.match(drawing, /<xdr:row>6<\/xdr:row>/, 'an empty report leaves one blank row after its note before the chart');

  const metric = { cv: 2, bias: 0.5, sigma: 4, dpmo: 6210, yld: 99.38, label: 'Tốt', n: 30 };
  const periodRows = [{ name: 'Glucose', period: '07/2026', tea: 6.96, levels: [{ level: 1, metric }, { level: 2, metric }] }];
  const periodDrawing = parseZip(ctx.__buildXlsx(periodRows, meta, [fakePng])).entries.find(e => e.name === 'xl/drawings/drawing1.xml').data.toString('utf8');
  assert.match(periodDrawing, /<xdr:row>7<\/xdr:row>/, 'a period report with its note on row 6 must begin the chart on Excel row 8');
  const secondPng = { ...fakePng, dispW: 420, dispH: 230 };
  const twoChartDrawing = parseZip(ctx.__buildXlsx(periodRows, meta, [fakePng, secondPng])).entries.find(e => e.name === 'xl/drawings/drawing1.xml').data.toString('utf8');
  assert.deepEqual([...twoChartDrawing.matchAll(/<xdr:row>(\d+)<\/xdr:row>/g)].map(m => Number(m[1])), [7, 22], 'MDC must begin after the Sigma chart height plus exactly one blank row');

  const longRows = Array.from({ length: 4 }, (_, i) => ({ name: 'Glucose', period: `0${i + 4}/2026`, tea: 6.96, levels: [{ level: 1, metric }, { level: 2, metric }] }));
  const longDrawing = parseZip(ctx.__buildXlsx(longRows, meta, [fakePng])).entries.find(e => e.name === 'xl/drawings/drawing1.xml').data.toString('utf8');
  assert.match(longDrawing, /<xdr:row>13<\/xdr:row>/, 'a combined report with its note on row 12 must begin the chart on Excel row 14');
}

// --- XML injection / escaping: hostile-looking test names must not break the worksheet XML. ---
{
  const hostileName = 'Glucose <script>&"\'';
  const rows = [{ name: hostileName, period: '07/2026', tea: 6.96, r1: null, r2: null }];
  const meta = { title: 'BÁO CÁO', subtitle: 'sub' };
  const zip = parseZip(ctx.__buildXlsx(rows, meta, []));
  const sheet = zip.entries.find(e => e.name === 'xl/worksheets/sheet1.xml').data.toString('utf8');

  assert.ok(!sheet.includes('<script>'), 'raw "<script>" must never appear unescaped inside the worksheet XML');
  assert.match(sheet, /Glucose &lt;script&gt;&amp;&quot;'/, 'special XML characters in a test name must be escaped');
}

{
  const zip = parseZip(ctx.__buildXlsx([
    { name: 'Glucose', period: '06/2026', tea: 6.96, r1: null, r2: null }
  ], { title: 'BÁO CÁO', subtitle: 'Kỳ 6', sheetName: 'Kỳ 6' }, []));
  const workbook = zip.entries.find(e => e.name === 'xl/workbook.xml').data.toString('utf8');
  assert.match(workbook, /<sheet name="Kỳ 6"/, 'sheet name should follow the export context');
}

// --- Dynamic levels: level 3 is exported and fixed run-size recommendations are absent. ---
{
  const metric = { cv: 2, bias: 0.5, biasLabel: 'Bias EQA', sigma: 4.2, dpmo: 123, yld: 99.9, label: 'Tốt', n: 24, cvSource: 'iqc-period' };
  const rows = [{ name: 'Glucose', period: '07/2026', tea: 6.96, teaLabel: 'Ricos', levels: [{ level: 1, metric }, { level: 2, metric }, { level: 3, metric }] }];
  const zip = parseZip(ctx.__buildXlsx(rows, { title: 'BÁO CÁO', subtitle: '3 mức' }, []));
  const sheet = zip.entries.find(e => e.name === 'xl/worksheets/sheet1.xml').data.toString('utf8');
  const styles = zip.entries.find(e => e.name === 'xl/styles.xml').data.toString('utf8');
  assert.match(sheet, />3<\/t>/, 'level 3 must appear in the worksheet');
  assert.doesNotMatch(sheet, /Run size|1000|450/, 'the worksheet must not prescribe a fixed QC run size from Sigma alone');
  assert.match(sheet, /Không tự quy đổi Sigma thành số bệnh nhân/, 'the risk-based QC disclaimer must be present');
  assert.match(sheet, /<c r="A\d+" s="14" t="inlineStr"><is><t xml:space="preserve">Lưu ý:/, 'the note row must use its borderless vertically centered style');
  assert.match(sheet, /<dimension ref="A1:K\d+"/, 'the report should use the compact A:K width');
  assert.doesNotMatch(sheet, /BẢNG CHÚ GIẢI XẾP LOẠI SIGMA/, 'the Sigma classification legend must be omitted');
  assert.match(styles, /<fonts count="5">/, 'unused legend font should be removed');
  assert.match(styles, /<cellXfs count="15">/, 'only the borderless vertically centered note style should be added');
  assert.match(styles, /fontId="0" fillId="0" borderId="0"[^>]*><alignment horizontal="left" vertical="center" wrapText="1"\/>/, 'the note style must be left-aligned, vertically centered, wrapped, and borderless');
  assert.doesNotMatch(styles, /fontId="5"/, 'no style should reference the removed legend font');
}

// --- The common 2-level report must match the approved vertical A:K layout. ---
//     Each QC level uses one row while the identity columns are merged vertically.
{
  const M = (cv, bias, sigma, label) => ({ cv, bias, sigma, dpmo: 123, yld: 99.9, label, n: null });
  const rows = [{ name: 'Sodium', period: 'Kỳ 07/2026', tea: 5, levels: [
    { level: 1, metric: M(1, 2, 3, 'Cận biên') },
    { level: 2, metric: M(0.5, 2, 6, 'Đẳng cấp thế giới') },
    { level: 3, metric: null },
  ] }];
  const zip = parseZip(ctx.__buildXlsx(rows, { title: 'BÁO CÁO SIX SIGMA', subtitle: 'Kỳ 07/2026' }, []));
  const sheet = zip.entries.find(e => e.name === 'xl/worksheets/sheet1.xml').data.toString('utf8');

  assert.match(sheet, /<dimension ref="A1:K6"\/>/, 'the 2-level report must occupy the compact A:K layout');
  assert.match(sheet, /<c r="B4" s="6"><v>7<\/v><\/c>/, 'the period column must show the month number like the reference workbook');
  assert.match(sheet, /<c r="D4"[^>]*>.*?>1<\/t>/, 'level 1 must occupy the first data row');
  assert.match(sheet, /<c r="D5"[^>]*>.*?>2<\/t>/, 'level 2 must occupy the second data row');
  assert.match(sheet, /<row r="6" ht="32"[^>]*><c r="A6"/, 'the disclaimer must immediately follow both level rows');
  ['A1:K1','A2:K2','A4:A5','B4:B5','C4:C5','A6:K6'].forEach(m=>assert.ok(sheet.includes('<mergeCell ref="'+m+'"/>'),'expected merge '+m));
  assert.doesNotMatch(sheet, /r="L\d+"/, 'the compact report must not emit the removed Mức B columns');
  assert.doesNotMatch(sheet, /<c r="D6"/, 'a configured level without a Sigma result must not create a dash-only row');
}

// --- Multi-level periods must read as ONE block per period, not duplicate-looking rows. ---
//     A 3-level period spans 3 data rows; the identity columns
//     (Xét nghiệm / Kỳ / TEa) must show only on the first row and be merged down, and both
//     rows must share one zebra shade — otherwise a single period looks like two periods.
{
  const M = (cv, bias, sigma, label, n) => ({ cv, bias, biasLabel: 'Bias EQA', sigma, dpmo: 1000, yld: 99, label, n, cvSource: 'iqc-period' });
  const rows = [
    { name: 'Glucose', period: 'Kỳ 07/2026', tea: 6.96, teaLabel: 'Ricos', levels: [
      { level: 1, metric: M(1.8, 0.4, 5.1, 'Xuất sắc', 32) },
      { level: 2, metric: M(2.1, 0.6, 4.3, 'Tốt', 30) },
      { level: 3, metric: M(2.6, 0.9, 3.4, 'Cận biên', 28) } ] },
    { name: 'Creatinine', period: 'Kỳ 07/2026', tea: 8.87, teaLabel: 'Ricos', levels: [
      { level: 1, metric: M(2.0, 0.5, 4.6, 'Tốt', 31) },
      { level: 2, metric: M(2.4, 0.7, 3.9, 'Tốt', 29) } ] },
  ];
  const zip = parseZip(ctx.__buildXlsx(rows, { title: 'BÁO CÁO', subtitle: '2 xét nghiệm' }, []));
  const sheet = zip.entries.find(e => e.name === 'xl/worksheets/sheet1.xml').data.toString('utf8');

  // Glucose (3 mức) chiếm 3 dòng: dòng đầu có tên + kỳ; các dòng nối để trống.
  assert.match(sheet, /<c r="A4" s="4" t="inlineStr"><is><t xml:space="preserve">Glucose<\/t>/, 'row 4 shows the test name once');
  assert.match(sheet, /<c r="B4" s="6"><v>7<\/v><\/c>/, 'row 4 shows the month once');
  assert.match(sheet, /<c r="A5" s="4" t="inlineStr"><is><t xml:space="preserve"><\/t>/, 'continuation row 5 blanks the name (no duplicate "Kỳ" row)');
  assert.match(sheet, /<c r="B5" s="6" t="inlineStr"><is><t xml:space="preserve"><\/t>/, 'continuation row 5 blanks the period');
  ['1', '2', '3'].forEach(lv => assert.ok(sheet.includes('<is><t xml:space="preserve">' + lv + '</t></is></c>'), 'level ' + lv + ' must appear'));

  // Ba cột định danh của Glucose gộp dọc qua 3 dòng -> đọc thành một khối.
  ['A4:A6', 'B4:B6', 'C4:C6'].forEach(m => assert.ok(sheet.includes('<mergeCell ref="' + m + '"/>'), 'vertical merge ' + m + ' groups the period rows'));

  // Creatinine (2 mức) là kỳ thứ hai -> zebra khác và cũng gộp dọc.
  assert.match(sheet, /<c r="A7" s="5" t="inlineStr"><is><t xml:space="preserve">Creatinine<\/t>/, 'a new period switches zebra shade (style 5 vs 4)');
  ['A7:A8', 'B7:B8', 'C7:C8'].forEach(m => assert.ok(sheet.includes('<mergeCell ref="' + m + '"/>'), 'vertical merge ' + m + ' groups the second period'));
}

// --- A combined report merges one assay name across all of its periods. ---
//     Period and TEa cells remain separate blocks so each month is still readable.
{
  const M = sigma => ({ cv: 1, bias: 1, sigma, dpmo: 100, yld: 99, label: 'Tốt', n: 30 });
  const rows = ['Kỳ 05/2026', 'Kỳ 06/2026', 'Kỳ 07/2026'].map((period, i) => ({
    name: 'Sodium', period, tea: 5, levels: [
      { level: 1, metric: M(4 + i) },
      { level: 2, metric: M(5 + i) },
    ],
  }));
  const zip = parseZip(ctx.__buildXlsx(rows, { title: 'BÁO CÁO TỔNG HỢP', subtitle: '3 kỳ' }, []));
  const sheet = zip.entries.find(e => e.name === 'xl/worksheets/sheet1.xml').data.toString('utf8');

  assert.ok(sheet.includes('<mergeCell ref="A4:A9"/>'), 'Sodium is merged once across all three periods');
  ['B4:B5', 'C4:C5', 'B6:B7', 'C6:C7', 'B8:B9', 'C8:C9'].forEach(m =>
    assert.ok(sheet.includes('<mergeCell ref="' + m + '"/>'), 'period identity merge remains ' + m));
  assert.equal((sheet.match(/>Sodium<\/t>/g) || []).length, 1, 'the combined report writes the assay name only once');
  assert.ok(!sheet.includes('<mergeCell ref="A4:A5"/>'), 'obsolete per-period assay merge is removed');
}

console.log('SigmaXlsx tests passed');
