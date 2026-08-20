const assert = require('node:assert/strict');
const { loadSandbox } = require('./helpers/sandbox');

function context2d() {
  const noop = () => {};
  return {
    setTransform:noop,clearRect:noop,fillRect:noop,save:noop,restore:noop,beginPath:noop,rect:noop,clip:noop,
    moveTo:noop,lineTo:noop,stroke:noop,fillText(text){drawnLabels.push(String(text));},arc:noop,fill:noop,setLineDash:noop,
  };
}

const drawnLabels = [];

const ctx = loadSandbox(['core.js', 'generated/modular-pilot.js'], {
  window: { devicePixelRatio: 1 },
  // addEventListener: vnDatePickerController.bind() chạy ngay khi generated/modular-pilot.js
  // nạp (trước đây chỉ chạy nếu sandbox nạp router-render.js, thứ file này chưa từng nạp).
  document: { getElementById: () => null, addEventListener: () => {} },
});
ctx.state = { tests: [{ id:'T1', unit:'U', westgardRules:{} }] };
ctx.lvlCfg = () => ({ lot:'L1' });
ctx.testRuleOn = () => false;
// qc-domain.js retiré vào bundle (Pha G nhóm C lát 5): testRuleOnWithin/testRuleOnAcross giờ
// là hàm thật (gọi westgardRulePolicy), không còn undefined như khi testRuleOn là stub DUY NHẤT
// legacyWestgardRuleScope rơi vào — phải chặn luôn hai hàm within/across để bộ dữ liệu hình sin
// 20 000 điểm không bị Westgard đánh dấu vi phạm hàng loạt, làm hỏng phép lấy mẫu hiển thị.
ctx.testRuleOnWithin = () => false;
ctx.testRuleOnAcross = () => false;
ctx.ruleResultLevel = () => 'ok';
ctx.vnDate = value => value;
ctx.esc = value => String(value);
ctx.fmt = value => Number(value).toFixed(2);
ctx.fmtTestValue = (test,value) => Number(value).toFixed(test&&Number.isInteger(test.decimalPlaces)?test.decimalPlaces:2);
ctx.fmtPointValue = (point,test) => ctx.fmtTestValue(test,point.val);

const canvas = {
  dataset:{ test:'T1', level:'1', lot:'L1' },style:{},width:1400,height:430,clientWidth:1400,
  getAttribute(name){ return name==='width'?'1400':'430'; },
  getContext(){ return context2d(); },
  addEventListener(){},
};
const points = Array.from({ length:20000 }, (_, i) => ({ id:'p'+i,date:'2026-01-01',runId:String(i),lot:'L1',level:1,val:100+Math.sin(i/17),qcMean:100,qcSd:1 }));
ctx.drawLJ(canvas, points, 100, 1);

assert(canvas._ljHover.length < 1000, 'large series only creates markers/tooltips for the display sample');
assert.equal(canvas.width, 1400, 'DPR 1 no longer forces a 2x backing canvas');
assert.equal(canvas._ljHover[0].x < canvas._ljHover[canvas._ljHover.length-1].x, true, 'sample keeps chronological endpoints');
assert.ok(drawnLabels.some(label => /^\d{2}\/\d{2}$/.test(label)), 'Levey-Jennings draws compact date labels on the x-axis');

const sharpCanvas = {
  dataset:{ test:'T1', level:'1', lot:'L1', renderScale:'2' },style:{},width:1400,height:430,clientWidth:1000,
  getAttribute(name){ return name==='width'?'1400':'430'; },
  getContext(){ return context2d(); },
  addEventListener(){},
};
ctx.drawLJ(sharpCanvas, points.slice(0,20), 100, 1);
assert.equal(sharpCanvas.width, 2000, 'entry chart requests a 2x backing canvas without changing its CSS width');

console.log('Render downsampling tests passed');
