const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx=loadSandbox(['core.js','generated/modular-pilot.js']);
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
// Combobox Lô cũ/Lô mới (Giai đoạn 3) đã chuyển sang component React thật
// (LotTransitionModal.tsx's LotComboInput) — không còn lotTransitionChoiceHtml()
// dựng chuỗi HTML, nên soi thẳng JSX cho cùng bất biến: mỗi input gắn đúng
// list={`${inputId}List`} (datalist riêng theo id) và không có nút xổ xuống rời.
const comboSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'modals', 'LotTransitionModal.tsx'), 'utf8');
assert.match(comboSource, /list=\{`\$\{inputId\}List`\}/, 'Lô cũ/Lô mới phải là combobox có danh sách gắn theo đúng id');
assert.match(comboSource, /role="combobox"/, 'combobox lô phải khai đúng role');
assert.doesNotMatch(comboSource, /lot-choice-toggle/, 'không được gắn nút xổ xuống rời làm vỡ bố cục ô Lô cũ/Lô mới');
console.log('Lot transition searchable picker tests passed');
