'use strict';
/*
 * Sinh va doi chieu file mapping cua LIS Gateway.
 *
 * Ly do ton tai: mapping can `qclabTestId` — ID NOI BO do app sinh (uid(), dang 'a3f9k2p'),
 * khong phai ten hien thi. Khong man hinh nao trong app hien ID nay, nen truoc do cach duy
 * nhat de lay la mo DevTools go tay. Chep sai mot ky tu thi gateway khong bao gi ca luc
 * khoi dong; moi ket qua cua xet nghiem do lang le roi vao `held / UNMAPPED_TEST` — an
 * toan nhung rat kho doan ra.
 *
 * State nam trong localStorage/IndexedDB cua trinh duyet nen script Node khong doc thang
 * duoc. Nguon offline duy nhat la file backup do chinh app xuat ra.
 *
 *   node scripts/lis-config.js <backup.json>                      # in khung ra stdout
 *   node scripts/lis-config.js <backup.json> -o <config.json>     # ghi file, khong ghi de
 *   node scripts/lis-config.js <backup.json> --check <config.json> # doi chieu config that
 */

const fs = require('node:fs');
const path = require('node:path');

const PLACEHOLDER_ANALYZER = 'SUA-MA-MAY';
const PLACEHOLDER_CODE = 'SUA-MA-XET-NGHIEM';
const PLACEHOLDER_LEVEL = 'SUA-MA-MUC-';
const PLACEHOLDER_LOT = 'SUA-MA-LO';
const DEFAULT_ORIGINS = ['null', 'http://127.0.0.1:8080', 'http://localhost:8080'];

/* Backup moi la goi {format:'qclab-backup', data:{...}}; backup cu la state tho. Nhan ca
   hai de khong bat nguoi dung phai biet minh dang cam file kieu gi. */
function readState(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const state = parsed && parsed.format === 'qclab-backup' && parsed.data ? parsed.data : parsed;
  if (!state || typeof state !== 'object' || !Array.isArray(state.tests)) {
    throw new Error(`${file} khong phai backup QC Lab (khong tim thay mang tests).`);
  }
  return state;
}

function testRows(state) {
  return (state.tests || [])
    .filter(t => t && t.id && t.active !== false)
    .map(t => ({
      qclabTestId: String(t.id),
      ten: String(t.displayName || t.name || t.id),
      may: String(t.machine || t.instrumentId || ''),
      donVi: String(t.unit || ''),
      /* Muc va so lo lay tu chinh cau hinh xet nghiem, nen khung sinh ra da dung phia
         QC Lab; nguoi dung chi con dien ma phia may. */
      mucs: (Array.isArray(t.levels) ? t.levels : []).map(l => Number(l && l.level)).filter(n => Number.isInteger(n) && n > 0),
      los: [...new Set((Array.isArray(t.levels) ? t.levels : []).map(l => String((l && l.lot) || '')).filter(Boolean))],
    }))
    .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));
}

function buildSkeleton(state) {
  const rows = testRows(state);
  return {
    _ghiChu: [
      `Sinh boi scripts/lis-config.js luc ${new Date().toISOString()}.`,
      `Thay ${PLACEHOLDER_ANALYZER}/${PLACEHOLDER_CODE}/${PLACEHOLDER_LEVEL}N bang ma that cua may.`,
      'qclabTestId, level va lot da dien san theo cau hinh QC Lab — chi can dien phia may.',
      'Bo han nhung dong chua noi may. Doi chieu lai bang: npm run lis:config -- <backup> --check <config>',
    ],
    allowedOrigins: DEFAULT_ORIGINS.slice(),
    mappings: rows.map(r => ({
      analyzerId: PLACEHOLDER_ANALYZER,
      testCode: PLACEHOLDER_CODE,
      qclabTestId: r.qclabTestId,
      displayName: r.ten,
      expectedUnit: r.donVi,
      levels: (r.mucs.length ? r.mucs : [1]).map(n => ({ qcLevel: PLACEHOLDER_LEVEL + n, level: n })),
      /* Ma mau phai DUY NHAT tung dong: hai dong cung ma thi Map cua gateway de len nhau,
         dong sau am tham thang, va nguoi dung khong thay minh mat mot lo. */
      lots: r.los.map(lot => ({ qcLotCode: `${PLACEHOLDER_LOT}-${lot}`, lot })),
    })),
  };
}

/* Doi chieu bang CHINH buildMappingIndex() cua gateway, khong viet lai luat: bat duoc dung
   nhung loi ma gateway se bat luc khoi dong, cong them nhung thu gateway KHONG the biet —
   ID khong ton tai trong state, va don vi lech so voi cau hinh xet nghiem. */
function checkConfig(state, config) {
  const errors = [];
  const warnings = [];
  const rows = testRows(state);
  const byId = new Map(rows.map(r => [r.qclabTestId, r]));
  const mappings = Array.isArray(config && config.mappings) ? config.mappings : [];

  if (!mappings.length) errors.push('config khong co mapping nao.');

  try {
    require('../lis-gateway/core').buildMappingIndex(config);
  } catch (error) {
    errors.push(`gateway se tu choi khoi dong: ${error.message}`);
  }

  mappings.forEach((m, i) => {
    const at = `mappings[${i}]`;
    const analyzer = String((m && m.analyzerId) || '');
    const code = String((m && m.testCode) || '');
    const id = String((m && m.qclabTestId) || '');
    if (analyzer === PLACEHOLDER_ANALYZER || code === PLACEHOLDER_CODE) {
      errors.push(`${at} con gia tri mau (${PLACEHOLDER_ANALYZER}/${PLACEHOLDER_CODE}) — chua dien ma may that.`);
      return;
    }
    const row = byId.get(id);
    if (!row) {
      errors.push(`${at} tro toi qclabTestId "${id}" khong co trong backup — ket qua se nam mai o hang cho voi UNMAPPED_TEST.`);
      return;
    }
    /* Muc QC la cho de sai nhat va hau qua nang nhat: doan nham mot muc la ghi diem vao
       nham muc, hong ca Levey-Jennings lan Westgard cua ca hai muc. */
    const levels = Array.isArray(m && m.levels) ? m.levels : [];
    if (!levels.length) errors.push(`${at} (${row.ten}) chua khai bao levels — gateway se tu choi khoi dong.`);
    levels.forEach((lv, j) => {
      const from = String((lv && lv.qcLevel) || ''), to = Number(lv && lv.level);
      if (from.startsWith(PLACEHOLDER_LEVEL)) { errors.push(`${at}.levels[${j}] con gia tri mau — chua dien ma muc QC cua may.`); return; }
      if (row.mucs.length && !row.mucs.includes(to)) {
        errors.push(`${at}.levels[${j}] tro toi muc ${to} nhung "${row.ten}" chi cau hinh muc ${row.mucs.join('/')}.`);
      }
    });
    (Array.isArray(m && m.lots) ? m.lots : []).forEach((l, j) => {
      const from = String((l && l.qcLotCode) || ''), to = String((l && l.lot) || '');
      if (from.startsWith(PLACEHOLDER_LOT)) { errors.push(`${at}.lots[${j}] con gia tri mau — dien ma lo cua may, hoac xoa dong nay de lay nguyen ma lo may gui.`); return; }
      if (row.los.length && to && !row.los.includes(to)) {
        warnings.push(`${at}.lots[${j}] tro toi lo "${to}" khong co trong cau hinh hien tai cua "${row.ten}" (${row.los.join(', ') || 'chua co lo'}).`);
      }
    });
    const unit = String((m && m.expectedUnit) || '');
    if (unit && row && row.donVi && unit.toLowerCase() !== row.donVi.toLowerCase()) {
      errors.push(`${at} expectedUnit "${unit}" khac don vi cua "${row.ten}" ("${row.donVi}") — moi ket qua se bi hang cho voi UNIT_MISMATCH.`);
    }
  });

  const mapped = new Set(mappings.map(m => String((m && m.qclabTestId) || '')));
  rows.filter(r => !mapped.has(r.qclabTestId)).forEach(r => {
    warnings.push(`chua mapping "${r.ten}" (${r.qclabTestId}) — ket qua cua no se bi giu lai.`);
  });

  const origins = Array.isArray(config && config.allowedOrigins) ? config.allowedOrigins : [];
  if (!origins.length) warnings.push('allowedOrigins rong — trinh duyet se khong doc duoc phan hoi.');

  return { errors, warnings, tests: rows.length, mappings: mappings.length };
}

function main(argv) {
  const args = argv.slice(2);
  if (!args.length || args.includes('-h') || args.includes('--help')) {
    console.log([
      'Cach dung:',
      '  npm run lis:config -- <backup.json>                       in khung config ra man hinh',
      '  npm run lis:config -- <backup.json> -o <config.json>      ghi ra file (khong ghi de)',
      '  npm run lis:config -- <backup.json> --check <config.json> doi chieu config dang dung',
      '',
      'Xuat backup o: Cai dat -> Quan tri du lieu -> Xuat backup.',
    ].join('\n'));
    return 0;
  }

  const backupFile = args[0];
  const state = readState(backupFile);

  const checkAt = args.indexOf('--check');
  if (checkAt >= 0) {
    const configFile = args[checkAt + 1];
    if (!configFile) throw new Error('--check can duong dan toi file config.');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    const result = checkConfig(state, config);
    console.log(`Doi chieu ${path.basename(configFile)} voi ${path.basename(backupFile)}: ${result.mappings} mapping / ${result.tests} xet nghiem dang bat.`);
    result.warnings.forEach(w => console.log(`  CANH BAO  ${w}`));
    result.errors.forEach(e => console.log(`  LOI       ${e}`));
    if (result.errors.length) {
      console.log(`\nKhong dat: ${result.errors.length} loi.`);
      return 1;
    }
    console.log(result.warnings.length ? '\nDat, nhung xem lai cac canh bao tren.' : '\nDat.');
    return 0;
  }

  const skeleton = buildSkeleton(state);
  const outAt = args.indexOf('-o');
  if (outAt >= 0) {
    const outFile = args[outAt + 1];
    if (!outFile) throw new Error('-o can duong dan file dau ra.');
    /* Khong ghi de: file config that mang mapping da dien tay, ghi de la mat cong. */
    if (fs.existsSync(outFile)) throw new Error(`${outFile} da ton tai — doi ten hoac xoa truoc, script khong ghi de file config.`);
    fs.writeFileSync(outFile, JSON.stringify(skeleton, null, 2) + '\n', 'utf8');
    console.log(`Da ghi ${outFile} voi ${skeleton.mappings.length} dong mapping cho san.`);
    console.log(`Buoc tiep: thay ${PLACEHOLDER_ANALYZER}/${PLACEHOLDER_CODE} bang ma that, roi chay lai voi --check.`);
    return 0;
  }
  console.log(JSON.stringify(skeleton, null, 2));
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv);
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = { readState, testRows, buildSkeleton, checkConfig, PLACEHOLDER_ANALYZER, PLACEHOLDER_CODE, PLACEHOLDER_LEVEL, PLACEHOLDER_LOT };
