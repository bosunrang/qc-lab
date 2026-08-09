const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx=loadSandbox(['core.js','generated/modular-pilot.js','modules/state.js','modules/manage-tests-actions.js']);
run(ctx, `function searchText(s){return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();} function vnDate(s){return s;} function lotTransitionToNo(){return'';} function escAttr(s){return String(s==null?'':s);} function btn(label,onclick){return '<button onclick="'+onclick+'">'+label+'</button>';} state.qcLots=[
  {id:'L1',lotNo:'1101',level:1,exp:'2026-08-31'},
  {id:'L2',lotNo:'1102',level:2,exp:'2026-09-30'},
  {id:'L3',lotNo:'220425',level:2,exp:'2028-04-30'},
  {id:'L4',lotNo:'321025',level:3,exp:'2028-10-31'},
  {id:'LD',lotNo:'OLD-1',level:1,depleted:true}
];`);
assert.equal(run(ctx, `lotTransitionChoiceMatch('220425').id`),'L3','gõ đúng số lô phải chọn được ngay');
assert.equal(run(ctx, `lotTransitionChoiceMatch('2204').id`),'L3','chuỗi chỉ khớp một lô phải được nhận');
assert.equal(run(ctx, `lotTransitionChoiceMatch('110')`),null,'chuỗi còn khớp nhiều lô không được tự chọn nhầm');
assert.equal(run(ctx, `lotTransitionChoiceMatch('OLD-1')`),null,'lô đã hết không xuất hiện khi tạo mới');
assert.equal(run(ctx, `lotTransitionChoiceMatch('OLD-1','LD').id`),'LD','hồ sơ cũ vẫn mở được lô đã chuyển tiếp của chính nó');
const fromHtml=run(ctx, `lotTransitionChoiceHtml('cfgTransFrom','L1')`),toHtml=run(ctx, `lotTransitionChoiceHtml('cfgTransTo','')`);
assert.match(fromHtml,/id="cfgTransFrom" list="cfgTransFromList"/,'Lô cũ phải là combobox có danh sách');
assert.match(toHtml,/id="cfgTransTo" list="cfgTransToList"/,'Lô mới phải là combobox có danh sách');
assert.doesNotMatch(fromHtml,/lot-choice-toggle/,'không được gắn nút xổ xuống rời làm vỡ bố cục ô Lô cũ');
assert.doesNotMatch(toHtml,/lot-choice-toggle/,'không được gắn nút xổ xuống rời làm vỡ bố cục ô Lô mới');
console.log('Lot transition searchable picker tests passed');
