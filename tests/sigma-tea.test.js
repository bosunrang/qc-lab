/**
 * Lớp giải TEa của trang Six Sigma (assets/modules/sigma-tea.js), tách khỏi
 * sigma.js ngày 2026-08-01.
 *
 * tests/sigma-comp.test.js đã phủ phần lớn hành vi TEa, nhưng nó nạp CẢ sigma.js
 * — nên nó không chứng minh được điều mà việc tách file hứa: lớp này đứng MỘT
 * MÌNH được, không cần trang Sigma, không cần DOM. Sandbox ở đây cố ý chỉ nạp
 * core.js + state.js + sigma-tea.js; nếu ai kéo một hàm dựng giao diện vào file
 * đó, test này sẽ đổ ngay ở bước nạp.
 *
 * Phần khẳng định tập trung vào những nhánh mà bản đồ độ phủ
 * (`npm run coverage-map`) chỉ ra là chưa ai chạm tới sau khi tách, cộng các
 * quy ước dễ vỡ âm thầm: chuẩn hóa đơn vị, thứ tự ưu tiên TEa của một kỳ, và
 * hình dạng tuple mà effectiveTeaRefs() trả về.
 */
const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

// fmt/vnDate là hàm định dạng của lớp UI; lớp TEa chỉ gọi chúng lúc xuất chuỗi.
const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/sigma-tea.js'], {
  fmt: (v, d) => Number(v).toFixed(d),
  vnDate: v => String(v),
});

// --- Chuẩn hóa đơn vị: đây là cái quyết định giới hạn tuyệt đối CLIA có được áp
//     hay không, và nó sai thì không có lỗi nào hiện ra, chỉ có TEa khác đi. ---
assert.equal(ctx.sgUnitsMatch('µmol/L', 'umol/l'), true, 'micro ký hiệu µ/μ và u là một');
assert.equal(ctx.sgUnitsMatch('mmol/Liter', 'mmol/L'), true, 'liter/litre viết đầy đủ vẫn là L');
assert.equal(ctx.sgUnitsMatch(' g/L ', 'g/L'), true, 'khoảng trắng thừa không tạo ra đơn vị khác');
assert.equal(ctx.sgUnitsMatch('mg/dL', 'mmol/L'), false);
assert.equal(ctx.sgUnitsMatch('', 'mmol/L'), false, 'đơn vị rỗng KHÔNG được coi là khớp — nếu không, mọi xét nghiệm chưa khai đơn vị đều ăn giới hạn tuyệt đối');
assert.equal(ctx.sgUnitsMatch(null, null), false);

// --- sgTea(): TEa theo đúng nguồn mà xét nghiệm khai, mặc định về Ricos khi
//     trường teaSource rỗng/lạ (dữ liệu cũ hoặc bản backup hỏng). ---
assert.equal(ctx.sgTea({ name: 'Glucose', teaSource: 'ricos' }), 6.96);
assert.equal(ctx.sgTea({ name: 'Glucose', teaSource: 'clia' }), 8);
assert.equal(ctx.sgTea({ name: 'Glucose' }), 6.96, 'thiếu teaSource → Ricos, không phải 0');
assert.equal(ctx.sgTea({ name: 'Glucose', teaSource: 'nguồn-lạ' }), 6.96, 'teaSource lạ → Ricos, không được nhận nguyên giá trị lạ');
assert.equal(ctx.sgTea({ name: 'Không có trong bảng', teaSource: 'ricos' }), 0);

// --- testDisplayName(): tên hiện trên giao diện. displayName do người dùng đặt
//     phải thắng; nếu không có thì lấy tên chuẩn kèm viết tắt của catalog. ---
assert.equal(ctx.testDisplayName({ name: 'Sodium', displayName: 'Natri máu' }), 'Natri máu');
assert.equal(ctx.testDisplayName({ name: 'Sodium' }), 'Sodium (Na)', 'không đặt tên riêng thì dùng tên quốc tế kèm viết tắt');
assert.equal(ctx.testDisplayName({ name: 'Xét nghiệm nhà làm' }), 'Xét nghiệm nhà làm', 'tên ngoài catalog giữ nguyên');
assert.equal(ctx.testDisplayName(null), '');

// --- effectiveTeaRefs(): hình dạng tuple là hợp đồng với sgRef()/sigma.js —
//     criterion ở [5], analyteId ở [6]. Đổi thứ tự cột là hỏng im lặng. ---
{
  const refs = ctx.effectiveTeaRefs();
  const glucose = refs.find(r => r[6] === 'qclab-glucose');
  assert.ok(glucose, 'Glucose phải có trong bảng TEa hiệu lực mặc định');
  assert.equal(glucose[2], 8, 'cột [2] là CLIA %');
  assert.equal(glucose[3], 6.96, 'cột [3] là Ricos %');
  assert.equal(typeof glucose[5], 'object', 'cột [5] là criterion đã dựng sẵn');
  assert.ok(['percent', 'absolute', 'greater-of'].includes(glucose[5].rule));
  assert.equal(refs.length, run(ctx, 'REFTESTS.length'), 'không có teaRefs của người dùng thì bảng hiệu lực đúng bằng bảng mặc định');
}

// --- Người dùng ghi đè theo analyteId, kể cả khi đổi hẳn tên hiển thị. Đây là
//     lý do registry v2 chuyển sang analyteId: đổi tên không được làm mất TEa. ---
{
  run(ctx, "state.teaRefs=[{id:'u1',analyteId:'qclab-glucose',name:'Đường huyết',unit:'mmol/L',clia:9,ricos:7.5,section:'Hóa sinh'}]");
  const refs = ctx.effectiveTeaRefs(), row = refs.find(r => r[6] === 'qclab-glucose');
  assert.equal(refs.length, run(ctx, 'REFTESTS.length'), 'ghi đè một dòng có sẵn KHÔNG được sinh thêm dòng mới');
  assert.equal(row[0], 'Đường huyết');
  assert.equal(row[2], 9);
  assert.equal(ctx.sgRef({ analyteId: 'qclab-glucose', name: 'Đường huyết' })[2], 9, 'sgRef vẫn bám theo analyteId sau khi đổi tên');
  assert.equal(ctx.sgTea({ name: 'Đường huyết', teaSource: 'ricos' }), 7.5);
  run(ctx, 'state.teaRefs=[]');
}

// --- CLIA có giới hạn tuyệt đối thì cần giá trị target để quy ra %; không có
//     target phải nói rõ needsTarget thay vì lẳng lặng trả một con số. ---
{
  const calcium = { name: 'Calcium', unit: 'mmol/L', teaSource: 'clia' };
  const noTarget = ctx.sgTeaInfo(calcium, 'clia');
  assert.equal(noTarget.needsTarget, true, 'thiếu target thì phải báo, vì % quy đổi phụ thuộc nồng độ');
  const withTarget = ctx.sgTeaInfo(calcium, 'clia', 2.5);
  assert.equal(withTarget.needsTarget, false);
  assert.ok(withTarget.tea > 0, 'có target thì quy được giới hạn tuyệt đối về %');
  assert.equal(withTarget.criterion.unit, 'mmol/L');
}

// --- sgEntryTea(): thứ tự ưu tiên TEa của một kỳ. Mức đã chốt TEa thắng cả kỳ,
//     kỳ đã chốt thắng bảng tham chiếu hiện hành — nếu không, một lần sửa bảng
//     TEa hôm nay sẽ viết lại Sigma của những kỳ đã rà soát xong. ---
{
  const t = { name: 'Glucose', teaSource: 'ricos', levels: [{ level: 1, mean: 5.5 }] };
  assert.equal(ctx.sgEntryTea(t, { lv: { 1: { tea: 4.2 } }, tea: 8 }, 1), 4.2, 'TEa chốt ở mức thắng tất cả');
  assert.equal(ctx.sgEntryTea(t, { lv: { 1: {} }, tea: 8 }, 1), 8, 'kế đến là TEa chốt ở kỳ');
  assert.equal(ctx.sgEntryTea(t, { lv: { 1: {} } }, 1), 6.96, 'không có gì chốt thì mới tính từ bảng hiện hành');
}

// --- Ảnh chụp truy vết: một kỳ phải giữ đủ nguồn/phiên bản/ngày hiệu lực để về
//     sau còn trả lời được "con số TEa này lấy ở đâu ra". ---
{
  const snap = ctx.sgTeaSnapshot({ name: 'Glucose', teaSource: 'ricos' });
  assert.equal(snap.teaSource, 'ricos');
  assert.equal(snap.tea, 6.96);
  assert.equal(snap.teaSourceId, 'ricos-bv-2014');
  assert.ok(snap.teaCapturedAt, 'phải ghi thời điểm chụp');
  // Glucose theo CLIA là tiêu chí "lớn hơn giữa % và giới hạn tuyệt đối" nên chưa
  // có target thì CHƯA quy ra được %. Ảnh chụp vẫn ghi đủ truy vết nguồn nhưng
  // KHÔNG được đóng dấu một con số TEa mà nó không tính được.
  const pending = ctx.sgTeaSnapshot({ name: 'Glucose', teaSource: 'clia' });
  assert.equal(pending.tea, undefined, 'chưa đủ dữ kiện thì không đóng dấu TEa');
  assert.equal(pending.teaSourceId, 'clia-cms-3355-f-2024');
  assert.equal(pending.teaEffectiveDate, '2024-07-11');
  const e = { teaSource: 'ricos', tea: 1 };
  assert.equal(ctx.sgEnsureTeaSnapshot({ name: 'Glucose' }, e).tea, 1, 'kỳ đã có nguồn TEa thì không bị chụp đè');
}

console.log('Sigma TEa layer tests passed');
