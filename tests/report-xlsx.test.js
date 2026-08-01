/**
 * Tests for the general-purpose ZIP/OOXML builder behind "Xuất Excel (.xlsx)"
 * on the report page (ReportXlsx in assets/modules/data-io.js), and the shared
 * low-level core (XlsxCore) it now shares with SigmaXlsx.
 *
 * Like the Sigma writer, there is no library: the ZIP records and worksheet XML
 * are built byte-by-byte, so a single wrong offset/length silently yields a
 * corrupt .xlsx. These tests re-parse the produced bytes independently (without
 * trusting any of the app's own zip() code) and check the structural invariants
 * a real unzip/Excel relies on. reportXlsxDoc() itself needs the DOM (chart
 * rendering) so it is not exercised here — only the pure ReportXlsx.build().
 */
const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['modules/data-io.js']);
run(ctx, 'function __buildReport(doc){return ReportXlsx.build(doc);} function __RXST(){return RXST;}');

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Minimal STORE-only ZIP reader, independent of the app's own zip() builder. */
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
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOffset = buf.readUInt32LE(off + 42);
    const nameStart = off + 46;
    const name = buf.toString('utf8', nameStart, nameStart + nameLen);
    central.push({ name, crc, compSize, localOffset });
    off = nameStart + nameLen + extraLen + commentLen;
  }
  assert.equal(buf.readUInt32LE(off), 0x06054b50, 'End Of Central Directory record must directly follow the central directory');
  const eocdEntryCount = buf.readUInt16LE(off + 10);
  return { buf, entries, central, eocdEntryCount };
}

const entryNames = zip => zip.entries.map(e => e.name);

function sampleDoc(overrides = {}) {
  return Object.assign({
    sheetName: 'Báo cáo nội kiểm',
    cols: [14, 12, 11, 11, 10, 10, 13, 12, 14, 26],
    rowHeights: { 1: 26 },
    merges: ['A1:J1', 'A2:J2'],
    rows: [
      [{ v: 'BÁO CÁO NỘI KIỂM', s: 1 }],
      [{ v: 'phụ đề', s: 2 }],
      [{ v: 'n', s: 6 }, { v: 'Mean thực', s: 6 }, { v: 'SD', s: 6 }],
      [{ v: 5, s: 7, num: true }, { v: 10.12, s: 7, num: true }, { v: 0.5, s: 7, num: true }],
    ],
    images: [],
  }, overrides);
}

// --- Structural integrity: stored bytes match their own CRC/size fields, and the
//     central directory agrees with the local headers. ---
{
  const zip = parseZip(ctx.__buildReport(sampleDoc()));

  assert.ok(zip.entries.length >= 5, 'expected at least the core OOXML parts without images');
  assert.equal(zip.central.length, zip.entries.length, 'central directory entry count must match local file entries');
  assert.equal(zip.eocdEntryCount, zip.entries.length, 'EOCD entry count must match the number of files actually stored');

  zip.entries.forEach((e, i) => {
    assert.equal(e.compression, 0, `${e.name}: must be STORE (uncompressed)`);
    assert.equal(e.compSize, e.uncompSize, `${e.name}: STORE entries must have compSize === uncompSize`);
    assert.equal(e.data.length, e.uncompSize, `${e.name}: stored byte count must match the declared size`);
    assert.equal(crc32(e.data), e.crc, `${e.name}: recomputed CRC32 must match the header CRC`);
    const c = zip.central[i];
    assert.equal(c.name, e.name, `central directory entry ${i} name must line up with local file entry ${i}`);
    assert.equal(c.crc, e.crc, `${e.name}: central directory CRC must match local header CRC`);
  });

  assert.deepEqual(entryNames(zip), [
    '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels',
    'xl/styles.xml', 'xl/worksheets/sheet1.xml',
  ], 'without images, only the core OOXML parts should be present (no drawing/media parts)');

  const sheet = zip.entries.find(e => e.name === 'xl/worksheets/sheet1.xml').data.toString('utf8');
  assert.match(sheet, /<dimension ref="A1:J4"\/>/, 'dimension must span the widest declared column (J) and the last row');
  assert.match(sheet, /<mergeCells count="2">/, 'both requested merges must be emitted');
  assert.match(sheet, /<c r="A3" s="6" t="inlineStr">/, 'string cells carry their style id and inlineStr type');
  assert.match(sheet, /<c r="A4" s="7"><v>5<\/v><\/c>/, 'numeric cells are emitted as <v> without a type attribute');
  assert.ok(!/<drawing /.test(sheet), 'no <drawing> reference when there are no images');

  const styles = zip.entries.find(e => e.name === 'xl/styles.xml').data.toString('utf8');
  const cellXfsCount = Number(/<cellXfs count="(\d+)">/.exec(styles)[1]);
  const st = ctx.__RXST();
  const maxStyleIdx = Math.max(...Object.values(st));
  assert.ok(maxStyleIdx < cellXfsCount, `every RXST style id (max ${maxStyleIdx}) must index into cellXfs (count ${cellXfsCount})`);
  const xfBlock = /<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/.exec(styles)[1];
  assert.equal((xfBlock.match(/wrapText="1"/g)||[]).length,9,'mọi style bảng có nội dung dài, gồm TD/REJ/WARN, phải bật wrap text');
}

// --- With embedded chart images: extra drawing/media parts appear and are wired up,
//     one media part + one relationship + one anchor per image. ---
{
  const png = n => ({ bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, n]), dispW: 760, dispH: 233, row0: 5 + n });
  const zip = parseZip(ctx.__buildReport(sampleDoc({ images: [png(1), png(2)] })));

  const names = entryNames(zip);
  ['xl/drawings/drawing1.xml', 'xl/drawings/_rels/drawing1.xml.rels', 'xl/worksheets/_rels/sheet1.xml.rels',
    'xl/media/image1.png', 'xl/media/image2.png'].forEach(name =>
    assert.ok(names.includes(name), `expected "${name}" when images are embedded`));

  const media2 = zip.entries.find(e => e.name === 'xl/media/image2.png');
  assert.deepEqual([...media2.data], [0x89, 0x50, 0x4e, 0x47, 2], 'embedded image bytes must be stored verbatim');

  const drawing = zip.entries.find(e => e.name === 'xl/drawings/drawing1.xml').data.toString('utf8');
  assert.equal((drawing.match(/<xdr:oneCellAnchor>/g) || []).length, 2, 'one anchor per image');
  assert.match(drawing, /<xdr:row>6<\/xdr:row>/, 'first image anchors at its requested 0-based row (row0=6)');
  assert.match(drawing, /<xdr:row>7<\/xdr:row>/, 'second image anchors at its own requested row');

  const drels = zip.entries.find(e => e.name === 'xl/drawings/_rels/drawing1.xml.rels').data.toString('utf8');
  assert.match(drels, /image1\.png/, 'drawing rels point at image1');
  assert.match(drels, /image2\.png/, 'drawing rels point at image2');

  const sheet = zip.entries.find(e => e.name === 'xl/worksheets/sheet1.xml').data.toString('utf8');
  assert.match(sheet, /<drawing r:id="rId1"\/>/, 'worksheet references the drawing part when images are present');
}

// --- XML injection / escaping: hostile text in cells and the sheet name must not break XML. ---
{
  const doc = sampleDoc({
    sheetName: 'BC <x>&"',
    rows: [[{ v: 'Glucose <script>&"\'', s: 1 }]],
    merges: [], rowHeights: {},
  });
  const zip = parseZip(ctx.__buildReport(doc));
  const sheet = zip.entries.find(e => e.name === 'xl/worksheets/sheet1.xml').data.toString('utf8');
  assert.ok(!sheet.includes('<script>'), 'raw "<script>" must never appear unescaped in the worksheet XML');
  assert.match(sheet, /Glucose &lt;script&gt;&amp;&quot;'/, 'special XML chars in cell text must be escaped');
  const workbook = zip.entries.find(e => e.name === 'xl/workbook.xml').data.toString('utf8');
  assert.ok(!/name="BC <x>/.test(workbook), 'sheet name must be escaped in workbook.xml');
  assert.match(workbook, /name="BC &lt;x&gt;&amp;&quot;"/, 'sheet name special chars escaped');
}

// --- NCE form parity: Excel uses the same compact summary + seven-section appendix
//     as the PDF, and the shared checkbox can suppress only the appendix. ---
{
  run(ctx, `
    window={QCLAB_APP:{name:'QC Lab',version:'test'}};
    state={lab:{name:'PXN',dept:'Hóa sinh'},westgardRules:{'1-3s':true},tests:[{id:'T1',name:'Sodium (Na)',unit:'mmol/L',machine:'EasyLyte',levels:[]}],actions:[{id:'A1',protocolVersion:3,nceId:'NCE-20260729-DIG4',testId:'T1',date:'2026-07-17',level:1,lot:'1101',rule:'1-3s',errorType:'Sai số ngẫu nhiên',eventSource:'iqc',processPhase:'exam',by:'Quản trị viên',dueDate:'2026-07-24',containmentStatus:'held',containmentNote:'Giữ kết quả từ 08:00',correction:'Vệ sinh kim hút, loại bọt khí',riskLevel:'high',riskSeverity:4,riskOccurrence:3,riskDetectability:5,riskBasis:'SOP-QC-07',qcMaterialStatus:'ok',qcMaterialNote:'Đạt',instrumentStatus:'abnormal',instrumentNote:'Kim hút có bọt khí',reagentStatus:'ok',reagentNote:'Đạt',calibrationStatus:'ok',calibrationNote:'Đạt',lotToLotStatus:'ok',lotToLotNote:'Không cần',causeCategory:'instrument',cause:'Bọt khí tại kim hút',action:'Vệ sinh kim hút và kiểm tra lại đường ống',actionCompletedDate:'2026-07-17',releaseStatus:'released',releaseDate:'2026-07-17',releaseBy:'Phụ trách khoa',releaseNote:'QC chạy lại được chấp nhận',patientImpact:'none',patientAction:'Không có kết quả cần thu hồi',effectivenessStatus:'effective',effectivenessDate:'2026-07-29',effectivenessBy:'Quản trị viên',effectivenessNote:'Không tái diễn trong 10 lần chạy',residualRiskLevel:'low',residualSeverity:2,residualOccurrence:2,residualDetectability:2,residualRiskBasis:'Theo dõi sau CAPA',approvalStatus:'approved',approvedBy:'Trưởng khoa',approvedAt:'2026-07-29T10:00:00Z',approvalNote:'Đủ bằng chứng'}]};
    ACTION_LABELS={source:{iqc:'Nội kiểm IQC'},phase:{exam:'Trong xét nghiệm'},risk:{high:'Cao',low:'Thấp'},containment:{held:'Đã dừng/giữ kết quả liên quan'},patient:{none:'Không ảnh hưởng'},release:{released:'Cho phép trở lại'},cause:{instrument:'Máy phân tích'},check:{ok:'Đạt',abnormal:'Bất thường'}};
    operationalLevels=()=>[];activeWestgard=()=>({});sgTea=()=>5;sgTeaSource=()=>'';sgTeaLabel=()=>'';sgTeaRefText=()=>'';formatDateTimeVN=v=>String(v);userName=()=>'Tester';reportRangeText=()=>'17/07/2026 - 29/07/2026';testDisplayName=t=>t.name;actionEventDate=a=>a.date;actionWorkflowStatus=()=>({label:'Đã khép vòng'});actionRerunStatus=()=>({label:'QC đạt lại',point:{val:140.2,date:'2026-07-17',runId:'2'}});actionLevelShort=()=> 'M1 - Lô 1101';actionApprovalLabel=()=> 'Đã duyệt';actionEffectivenessStatus=()=>({label:'Có hiệu lực'});actionRiskScore=()=>60;actionResidualRiskScore=()=>8;vnDate=v=>String(v);fmt=v=>String(v);
  `);
  const withAppendix = JSON.parse(run(ctx, `JSON.stringify(reportXlsxDoc('T1','','',true))`));
  const withoutAppendix = JSON.parse(run(ctx, `JSON.stringify(reportXlsxDoc('T1','','',false))`));
  const texts = doc => doc.rows.flat().filter(Boolean).map(cell => String(cell.v || ''));
  const all = texts(withAppendix), summary = all.find(x => x.startsWith('Tức thời:'));
  assert.match(summary, /Nguyên nhân: Máy phân tích - Bọt khí tại kim hút/);
  assert.match(summary, /Khắc phục: Vệ sinh kim hút và kiểm tra lại đường ống/);
  for (const label of ['Phụ lục - Hồ sơ NCE chi tiết','Phiếu NCE NCE-20260729-DIG4 · Đã khép vòng','1. Kiểm soát và xử lý tức thời','2. Đánh giá nguy cơ ban đầu','3. Checklist điều tra','4. Nguyên nhân và hành động khắc phục','5. Bằng chứng QC chạy lại và cho phép trở lại','6. Ảnh hưởng người bệnh','7. Hiệu lực, nguy cơ còn lại và phê duyệt']) assert.ok(all.includes(label), `Excel phải có mục "${label}"`);
  assert.ok(all.includes('SOP-QC-07'), 'phụ lục Excel giữ căn cứ SOP đầy đủ');
  assert.ok(!texts(withoutAppendix).includes('Phụ lục - Hồ sơ NCE chi tiết'), 'bỏ chọn phụ lục phải ẩn phần chi tiết khỏi Excel');
  assert.ok(texts(withoutAppendix).some(x => x.startsWith('Tức thời:')), 'bảng tóm tắt NCE vẫn phải còn khi ẩn phụ lục');
  const st = ctx.__RXST(), summaryRow = withAppendix.rows.find(row => row.some(cell => cell && String(cell.v || '').startsWith('NCE-20260729-DIG4\n')));
  assert.deepEqual(summaryRow.map(cell => cell && cell.s), [st.TD,st.TD,st.TD,st.TDL,st.TDL,st.TDL,st.TD,st.TD,st.TD,st.TD], 'mọi cột hành động phải căn giữa, riêng tóm tắt xử lý căn trái');
  for (const label of ['1. Kiểm soát và xử lý tức thời','2. Đánh giá nguy cơ ban đầu','3. Checklist điều tra','4. Nguyên nhân và hành động khắc phục','5. Bằng chứng QC chạy lại và cho phép trở lại','6. Ảnh hưởng người bệnh','7. Hiệu lực, nguy cơ còn lại và phê duyệt']) {
    const index=withAppendix.rows.findIndex(row=>row.some(cell=>cell&&cell.v===label));
    assert.ok(index>0&&withAppendix.rows[index-1].length===0, `phải có một hàng trống trước mục "${label}"`);
  }
}

console.log('ReportXlsx tests passed');
