const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const QCCore = require('../assets/core.js');

// Bảng đăng ký luật Westgard (WG_RULE_REGISTRY trong core.js) là NGUỒN DUY NHẤT
// cho danh sách luật. Trước 2026-08-01 danh sách này nằm rải ở 8 file: core.js
// giữ 5 mảng riêng (WG_RULES, WG_DEFAULT_ON, WG_ALERT_RULES, WG_SE/RE_RULES,
// WG_RULE_DESCRIPTIONS, thứ tự ưu tiên của primaryErrorRule, họ WG_RUN_RULES) và
// westgard-routes.js gõ tay lại cả 13 dòng bảng hướng dẫn kèm cột kết luận —
// nghĩa là mô tả/kết luận hiện cho người dùng có thể lệch với engine mà không
// test nào thấy. Test này chốt hai nửa:
//   (1) mọi mảng dẫn xuất phải khớp bảng đăng ký (nửa hành vi);
//   (2) không file nguồn nào ngoài core.js được liệt kê lại danh sách luật
//       (nửa cấu trúc — đây là quét văn bản, giống button-conventions.test.js).
// Thiếu nửa (2), một bản liệt kê thứ hai chép đúng tại thời điểm chép vẫn qua
// sạch, rồi lệch âm thầm ở lần sửa sau.

const REG = QCCore.WG_RULE_REGISTRY;
const IDS = REG.map(r => r.id);

/* ===== Nửa 1: hình dạng bảng và các mảng dẫn xuất ===== */

assert.ok(Array.isArray(REG) && REG.length >= 13, 'WG_RULE_REGISTRY phải là mảng đủ bộ luật');
assert.equal(new Set(IDS).size, IDS.length, 'id luật trong bảng đăng ký phải duy nhất');
for (const r of REG) {
  assert.ok(r.id && typeof r.id === 'string', 'mỗi luật phải có id');
  assert.ok(r.desc && typeof r.desc === 'string', `${r.id}: thiếu mô tả điều kiện`);
  assert.ok(['SE', 'RE', ''].includes(r.err), `${r.id}: err phải là 'SE' | 'RE' | ''`);
  assert.equal(typeof r.defaultOn, 'boolean', `${r.id}: defaultOn phải là boolean`);
  assert.equal(typeof r.alert, 'boolean', `${r.id}: alert phải là boolean`);
  assert.ok(QCCore.RULE_SCOPES.includes(r.scope), `${r.id}: scope phải nằm trong RULE_SCOPES`);
  assert.ok(r.scopeMin >= 2, `${r.id}: scopeMin phải >= 2`);
  assert.ok(Number.isFinite(r.priority), `${r.id}: thiếu priority cho primaryErrorRule`);
  assert.ok(r.fix && typeof r.fix === 'string', `${r.id}: thiếu gợi ý xử lý cho bảng hướng dẫn`);
  if (r.run !== null) {
    assert.ok(Number.isInteger(r.run[0]) && r.run[0] >= 2, `${r.id}: run[0] phải là số điểm liên tiếp`);
    assert.equal(typeof r.run[1], 'function', `${r.id}: run[1] phải là vị-từ dương`);
    assert.equal(typeof r.run[2], 'function', `${r.id}: run[2] phải là vị-từ âm`);
  }
}
assert.equal(new Set(REG.map(r => r.priority)).size, REG.length, 'priority phải duy nhất, nếu không thứ tự primaryErrorRule không xác định');

// Bảng được export ra ngoài và cả app lẫn worker đọc nó để kết luận Đạt/Loại — một
// dòng mã lỡ tay sửa `alert`/`scope` là đổi verdict toàn hệ thống, im lặng.
assert.ok(Object.isFrozen(REG), 'WG_RULE_REGISTRY phải đóng băng');
REG.forEach((r) => {
  assert.ok(Object.isFrozen(r), `${r.id}: dòng luật phải đóng băng`);
  if (r.run) assert.ok(Object.isFrozen(r.run), `${r.id}: bộ vị-từ run phải đóng băng`);
});

assert.deepEqual(QCCore.WG_RULES, IDS, 'WG_RULES phải là danh sách id của bảng đăng ký, đúng thứ tự');
assert.deepEqual([...QCCore.WG_DEFAULT_ON].sort(), REG.filter(r => r.defaultOn).map(r => r.id).sort(), 'WG_DEFAULT_ON phải dẫn xuất từ cột defaultOn');
assert.deepEqual(QCCore.WG_ALERT_RULES.slice().sort(), REG.filter(r => r.alert).map(r => r.id).sort(), 'WG_ALERT_RULES phải dẫn xuất từ cột alert');
assert.deepEqual(Object.keys(QCCore.WG_RULE_DESCRIPTIONS).sort(), IDS.slice().sort(), 'WG_RULE_DESCRIPTIONS phải phủ đúng bộ luật của bảng đăng ký');
for (const r of REG) assert.equal(QCCore.WG_RULE_DESCRIPTIONS[r.id], r.desc, `${r.id}: mô tả trong WG_RULE_DESCRIPTIONS phải lấy từ bảng đăng ký`);

// Hành động/phạm vi mặc định phải đọc được từ chính hai cột của bảng.
for (const r of REG) {
  assert.equal(QCCore.defaultRuleAction(r.id, true), r.alert ? 'alert' : 'reject', `${r.id}: defaultRuleAction không khớp cột alert`);
  assert.equal(QCCore.defaultRuleAction(r.id, false), 'inactive', `${r.id}: luật tắt phải là inactive`);
  assert.equal(QCCore.defaultRuleScope(r.id, 1), 'within', `${r.id}: dưới 2 mức QC luôn phải là within`);
  assert.equal(QCCore.defaultRuleScope(r.id, r.scopeMin), r.scope, `${r.id}: đủ scopeMin mức phải dùng scope của bảng`);
  if (r.scopeMin > 2) assert.equal(QCCore.defaultRuleScope(r.id, r.scopeMin - 1), 'within', `${r.id}: dưới scopeMin phải lùi về within`);
}

// Phân loại SE/RE và luật đại diện đều phải đi ra từ cột err/priority.
const byPriority = REG.slice().sort((a, b) => a.priority - b.priority).map(r => r.id);
assert.equal(QCCore.primaryErrorRule(IDS), byPriority[0], 'primaryErrorRule phải chọn luật có priority nhỏ nhất');
for (const r of REG) {
  const expected = r.err === 'SE' ? 'SE — Sai số hệ thống' : r.err === 'RE' ? 'RE — Sai số ngẫu nhiên' : '—';
  assert.equal(QCCore.errorType([r.id]), expected, `${r.id}: errorType không khớp cột err`);
}

/* ===== Nửa 2: quét nguồn — không ai được liệt kê lại danh sách luật ===== */

// Một file chứa từ 3 id luật trở lên dưới dạng chuỗi hằng = một bản liệt kê
// thứ hai. 1–2 id là logic một-luật hợp lệ (vd. `rule==='1-2s'`), không chặn.
const MAX_IDS_PER_FILE = 2;
const assetsDir = path.join(__dirname, '..', 'assets');
function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? jsFiles(full) : (e.name.endsWith('.js') ? [full] : []);
  });
}
for (const file of jsFiles(assetsDir)) {
  const rel = path.relative(assetsDir, file).replace(/\\/g, '/');
  if (rel === 'core.js') continue;                      // chính là bảng đăng ký
  const src = fs.readFileSync(file, 'utf8');
  const found = IDS.filter(id => src.includes(`'${id}'`) || src.includes(`"${id}"`));
  assert.ok(
    found.length <= MAX_IDS_PER_FILE,
    `${rel}: liệt kê lại ${found.length} id luật Westgard (${found.join(', ')}). ` +
    `Danh sách luật chỉ được nằm ở WG_RULE_REGISTRY trong core.js — đọc WG_RULES/WG_RULE_REGISTRY thay vì gõ lại.`
  );
}

// core.js phải khai đúng một dòng registry cho mỗi luật (không có mảng phụ nào
// còn sót lại liệt kê song song).
const coreSrc = fs.readFileSync(path.join(assetsDir, 'core.js'), 'utf8');
// Escape kiểu danh-sách-trắng: id luật hiện chỉ có chữ/số/gạch ngang, nhưng một id
// tương lai kiểu "1-3.5s" mà không escape thì dấu chấm thành ký tự đại diện và phép
// đếm "đúng 1 dòng" âm thầm hết chặt. Escape MỌI ký tự ngoài [\w-] nên không phải
// nhớ cho đủ bảng ký tự đặc biệt của regex.
const reEscape = s => s.replace(/[^\w-]/g, m => '\\' + m);
for (const id of IDS) {
  const rows = [...coreSrc.matchAll(new RegExp(`\\{id:'${reEscape(id)}'`, 'g'))];
  assert.equal(rows.length, 1, `core.js: luật ${id} phải có đúng 1 dòng trong WG_RULE_REGISTRY, thấy ${rows.length}`);
}

console.log('Westgard rule registry tests passed');
