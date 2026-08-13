/* ===== DRAW ===== */
function drawLJ(canvas,points,mean,sd){
  const{ctx,W,H}=globalThis.hiDpiCanvasSetup(canvas);
  canvas._ljCssW=W;canvas._ljCssH=H;
  const n=points.length,{padL,padT,cw,ch,markPad,y,clampY,x}=globalThis.leveyJenningsGeometry({width:W,height:H,count:n,mean,sd});

  ctx.clearRect(0,0,W,H);
  const ljColors=globalThis.leveyJenningsColors;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
  ctx.fillStyle=ljColors.okBand;ctx.fillRect(padL,padT,cw,ch);
  ctx.save();ctx.beginPath();ctx.rect(padL-markPad,padT,cw+markPad*2,ch);ctx.clip();

  globalThis.leveyJenningsBandRects({mean,sd,width:cw,y}).forEach(band=>{ctx.fillStyle=ljColors[band.color];ctx.fillRect(padL,band.top,band.width,band.height);});

  const test=state.tests.find(t=>t.id===canvas.dataset.test),yAxis=globalThis.leveyJenningsYAxisLabels(test,mean,sd),rows=yAxis.map(row=>row.z);
  globalThis.leveyJenningsGridLines(yAxis,mean,sd,y).forEach(line=>{
    ctx.strokeStyle=line.major?ljColors.mean:ljColors.grid;
    ctx.lineWidth=line.major?1.8:1.15;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(padL,line.y);ctx.lineTo(padL+cw,line.y);ctx.stroke();
  });
  ctx.restore();

  ctx.font=globalThis.canvasFont(800,'type-caption',11.5);ctx.fillStyle='#17212b';ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillText(globalThis.leveyJenningsChartTitle.single,padL+cw/2,padT-8);
  ctx.font=globalThis.canvasFont(800,'type-meta',12.5);ctx.textBaseline='middle';
  yAxis.forEach(row=>{
    const yy=y(mean+row.z*sd);
    ctx.fillStyle='#17212b';ctx.textAlign='right';ctx.fillText(row.label,padL-9,yy);
    ctx.fillStyle='#17212b';ctx.textAlign='left';ctx.fillText(row.value,padL+cw+10,yy);
  });

  if(!n){
    ctx.fillStyle='#7b838e';ctx.font=globalThis.canvasFont(600,'type-subhead',14);ctx.textAlign='center';ctx.fillText(globalThis.chartEmptyLabels.leveyJennings,padL+cw/2,padT+ch/2);
    canvas._ljHover=[];globalThis.leveyJenningsTooltipController(canvas);
    return;
  }

  const level=parseInt(canvas.dataset.level),lot=canvas.dataset.lot||(test&&lvlCfg(test,level)||{}).lot||'?';
  // Đánh giá theo cấu hình rule của từng xét nghiệm (testRuleOn) + mức độ qua
  // ruleResultLevel — nhất quán với trang Westgard và biểu đồ đa mức, thay vì
  // dùng wgOn toàn cục và mức độ cứng từ core.
  const{F,zs}=QCCore.westgard(points,mean,sd,rule=>globalThis.westgardRuleScope.within(test,rule));
  const levelText=level?`Mức ${level}`:'Mức QC';
  const pointModels=globalThis.leveyJenningsPointRenderModel({points,results:F,zs,width:cw,x, y:clampY,test,lot,levelText});
  canvas._ljHover=[];
  ctx.save();ctx.beginPath();ctx.rect(padL,padT,cw,ch);ctx.clip();
  if(points.length>1){
    ctx.strokeStyle=ljColors.line;ctx.lineWidth=2.2;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash([]);
    ctx.beginPath();
    pointModels.forEach((model,j)=>{if(j)ctx.lineTo(model.x,model.y);else ctx.moveTo(model.x,model.y);});
    ctx.stroke();
  }
  pointModels.forEach(model=>{
    ctx.fillStyle=model.style.color;ctx.beginPath();ctx.arc(model.x,model.y,model.style.radius,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=1.8;ctx.stroke();
    canvas._ljHover.push({x:model.x,y:model.y,hit:12,html:model.hover});
  });
  ctx.restore();
  const ticks=globalThis.leveyJenningsTicks(points);
  ctx.fillStyle='#536772';ctx.font=globalThis.canvasFont(700,'type-caption',11.5);ctx.textAlign='center';ctx.textBaseline='top';
  ticks.forEach(tick=>ctx.fillText(tick.label,x(tick.index),padT+ch+10));
  globalThis.leveyJenningsTooltipController(canvas);


}
function ljDataURL(points,mean,sd){return globalThis.chartDataUrl({width:1400,height:430,render:canvas=>drawLJ(canvas,points,mean,sd)});}


function drawLJMultiZ(canvas,levelViews,test,opts){
  const{ctx,W,H}=globalThis.hiDpiCanvasSetup(canvas);
  canvas._ljCssW=W;canvas._ljCssH=H;canvas._ljHover=[];
  /* padT=44 (không phải 34): chừa riêng một dòng cho chú giải Mức/lô phía trên
     dòng tiêu đề "Levey-Jennings tổng hợp theo Z-score" — lô dài (VD "TDM
     79979900") kéo chú giải đủ rộng để chạm vào tiêu đề canh giữa nếu hai dòng
     chỉ cách nhau vài px như trước (báo lỗi 2026-08-03, sau khi đã sửa khoảng
     cách GIỮA các mục chú giải ở lượt trước). */
  const{padL,padT,cw,ch,markPad,y,clampY}=globalThis.leveyJenningsMultiGeometry({width:W,height:H});
  const{levels,all,runs,runIndex,xOfRun}=globalThis.leveyJenningsMultiSeries({views:levelViews,padLeft:padL,width:cw,markPad});
  const colors=globalThis.leveyJenningsMultiColors;
  const ljColors=globalThis.leveyJenningsColors;

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
  ctx.fillStyle=ljColors.okBand;ctx.fillRect(padL,padT,cw,ch);
  ctx.save();ctx.beginPath();ctx.rect(padL-markPad,padT,cw+markPad*2,ch);ctx.clip();
  globalThis.leveyJenningsBandRects({mean:0,sd:1,width:cw,y}).forEach(band=>{ctx.fillStyle=ljColors[band.color];ctx.fillRect(padL,band.top,band.width,band.height);});
  globalThis.leveyJenningsGridLines([3,2,1,0,-1,-2,-3].map(z=>({z})),0,1,y).forEach(line=>{
    ctx.strokeStyle=line.major?ljColors.mean:ljColors.grid;ctx.lineWidth=line.major?1.8:1.15;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(padL,line.y);ctx.lineTo(padL+cw,line.y);ctx.stroke();
  });
  ctx.restore();

  ctx.font=globalThis.canvasFont(800,'type-caption',11.5);ctx.fillStyle='#17212b';ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillText(globalThis.leveyJenningsChartTitle.multi,padL+cw/2,padT-8);
  ctx.font=globalThis.canvasFont(800,'type-meta',12.5);ctx.textBaseline='middle';
  globalThis.leveyJenningsMultiYAxis().forEach(label=>{const yy=y(label.z);ctx.fillStyle='#17212b';ctx.textAlign='right';ctx.fillText(label.left,padL-9,yy);ctx.textAlign='left';ctx.fillText(label.right,padL+cw+10,yy);});
  if(!all.length){
    ctx.fillStyle='#7b838e';ctx.font=globalThis.canvasFont(600,'type-subhead',14);ctx.textAlign='center';ctx.fillText(globalThis.chartEmptyLabels.leveyJenningsMulti,padL+cw/2,padT+ch/2);
    globalThis.leveyJenningsTooltipController(canvas);return;
  }

  const cross=QCCore.westgardMultiByPoint(levels.map(v=>({level:v.level,pts:v.pts,mean:v.mean,sd:v.sd})),rule=>globalThis.westgardRuleScope.across(test,rule));
  if(opts&&opts.divider&&levels.length>1){
    ctx.save();ctx.beginPath();ctx.rect(padL,padT,cw,ch);ctx.clip();
    ctx.strokeStyle='#9aa7b0';ctx.lineWidth=1.4;ctx.setLineDash([5,4]);
    globalThis.leveyJenningsMultiDividers(levels,runs,runIndex,xOfRun).forEach(xDiv=>{ctx.beginPath();ctx.moveTo(xDiv,padT);ctx.lineTo(xDiv,padT+ch);ctx.stroke();});
    ctx.setLineDash([]);ctx.restore();
  }
  ctx.save();ctx.beginPath();ctx.rect(padL,padT,cw,ch);ctx.clip();
  levels.forEach((v,li)=>{
    const color=colors[li%colors.length],single=QCCore.westgardByPoint(v.pts,v.mean,v.sd,rule=>globalThis.westgardRuleScope.within(test,rule));
    const pointModels=globalThis.leveyJenningsMultiPointRenderModel({points:v.pts,single,cross,width:cw,levelCount:levels.length,x:xOfRun,y:clampY,test,view:v,color});
    if(v.pts.length>1){
      ctx.strokeStyle=color;ctx.lineWidth=2.1;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash([]);
      ctx.beginPath();
      pointModels.forEach((model,j)=>{if(j)ctx.lineTo(model.x,model.y);else ctx.moveTo(model.x,model.y);});
      ctx.stroke();
    }
    pointModels.forEach(model=>{
      ctx.fillStyle=model.color;ctx.beginPath();ctx.arc(model.x,model.y,model.radius,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=1.8;ctx.stroke();
      canvas._ljHover.push({x:model.x,y:model.y,hit:13,html:model.hover});
    });
  });
  ctx.restore();
  if(runs.length){
    const ticks=globalThis.leveyJenningsMultiRunTicks(runs,all);
    ctx.fillStyle='#536772';ctx.font=globalThis.canvasFont(700,'type-caption',11.5);ctx.textAlign='center';ctx.textBaseline='top';
    ticks.forEach(tick=>ctx.fillText(tick.label,xOfRun(tick.run),padT+ch+10));
  }
  /* Chú giải: khoảng cách giữa các mục PHẢI theo đúng bề rộng chữ đo được (canvas
     không tự xuống dòng/co chữ như HTML) — cố định 118px/mục từng khiến lô dài
     (VD "M1·TDM 79979900") đè lên khối màu của mục kế tiếp, đúng lỗi người dùng
     báo 2026-08-03. */
  {
    const y0=10;ctx.font=globalThis.canvasFont(800,'type-caption',11.5);ctx.textAlign='left';ctx.textBaseline='middle';
    globalThis.leveyJenningsLegendLayout(levels,colors,padL+8,ctx.measureText.bind(ctx)).forEach(item=>{
      ctx.fillStyle=item.color;ctx.fillRect(item.x,y0,18,4);
      ctx.fillStyle='#17212b';ctx.fillText(item.label,item.x+25,y0+2);
    });
  }
  globalThis.leveyJenningsTooltipController(canvas);
}
function ljMultiDataURL(levelViews,test,opts){return globalThis.chartDataUrl({width:1400,height:430,render:canvas=>drawLJMultiZ(canvas,levelViews,test,opts)});}

/* Biểu đồ CUSUM: chỉ tham khảo xu hướng (không đổi trạng thái đạt/loại QC —
   xem cusumSeries() trong qc-domain.js), nên dùng bảng màu riêng (teal/xanh
   tím) thay vì tái dùng màu ok/warn/reject của Levey-Jennings, tránh người
   dùng hiểu nhầm đây là một verdict Westgard khác. Trục X theo thứ tự điểm
   (giống drawLJ, không theo lần chạy như drawLJMultiZ vì đây là một mức/một
   xét nghiệm, không cần gộp nhiều mức). */
function drawCUSUM(canvas,points,series){
  const{ctx,W,H}=globalThis.hiDpiCanvasSetup(canvas);
  canvas._ljCssW=W;canvas._ljCssH=H;
  const n=points.length,h=(series&&series.h)||4,k=(series&&series.k)||0.5;
  const cPos=(series&&series.cPos)||[],cNeg=(series&&series.cNeg)||[],ma=(series&&series.ma)||[],flags=(series&&series.flags)||[];
  const{padL,padT,cw,ch,markPad,y,clampY,x}=globalThis.cusumChartGeometry({width:W,height:H,count:n,h,cPos,cNeg,ma});
  const refs=globalThis.cusumReferenceLines({h,y});
  const cc=globalThis.cusumColors;

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);

  ctx.save();ctx.beginPath();ctx.rect(padL-markPad,padT,cw+markPad*2,ch);ctx.clip();
  ctx.strokeStyle=cc.threshold;ctx.lineWidth=1.3;ctx.setLineDash([6,4]);
  refs.thresholds.forEach(line=>{ctx.beginPath();ctx.moveTo(padL,line.y);ctx.lineTo(padL+cw,line.y);ctx.stroke();});
  ctx.setLineDash([]);
  ctx.strokeStyle=cc.zero;ctx.lineWidth=1.6;
  ctx.beginPath();ctx.moveTo(padL,refs.zero.y);ctx.lineTo(padL+cw,refs.zero.y);ctx.stroke();
  ctx.restore();

  ctx.font=globalThis.canvasFont(800,'type-caption',11.5);ctx.fillStyle='#17212b';ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillText(globalThis.cusumChartTitle(k,h),padL+cw/2,padT-8);
  ctx.font=globalThis.canvasFont(800,'type-meta',12.5);ctx.textBaseline='middle';
  refs.labels.forEach(label=>{ctx.fillStyle='#17212b';ctx.textAlign='right';ctx.fillText(fmt(label.value,2),padL-9,label.y);});

  if(!n){
    ctx.fillStyle='#7b838e';ctx.font=globalThis.canvasFont(600,'type-subhead',14);ctx.textAlign='center';ctx.fillText(globalThis.chartEmptyLabels.cusum,padL+cw/2,padT+ch/2);
    canvas._ljHover=[];globalThis.leveyJenningsTooltipController(canvas);
    return;
  }

  canvas._ljHover=[];
  const drawIndices=globalThis.cusumDisplayPlan({count:n,width:cw,cPos,cNeg,ma,flags});
  ctx.save();ctx.beginPath();ctx.rect(padL,padT,cw,ch);ctx.clip();
  const line=(arr,color,dash)=>{
    if(n<=1)return;
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash(dash||[]);
    ctx.beginPath();
    globalThis.cusumLinePoints({indices:drawIndices,values:arr,x,clampY}).forEach((point,index)=>{if(index)ctx.lineTo(point.x,point.y);else ctx.moveTo(point.x,point.y);});
    ctx.stroke();
  };
  line(ma,cc.ma,[3,3]);
  line(cNeg,cc.cneg);
  line(cPos,cc.cpos);
  ctx.setLineDash([]);
  globalThis.cusumPointRenderModel({indices:drawIndices,points,cPos,cNeg,flags,h,x,clampY,colors:cc}).forEach(model=>{
    model.circles.forEach(circle=>{
      ctx.fillStyle=circle.color;
      ctx.beginPath();ctx.arc(circle.x,circle.y,circle.radius,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=1.4;ctx.stroke();
    });
    canvas._ljHover.push({x:model.x,y:model.hoverY,hit:12,html:globalThis.cusumHoverModel({point:model.point,cPos:model.positive,cNeg:model.negative,rejected:model.rejected})});
  });
  ctx.restore();
  globalThis.leveyJenningsTooltipController(canvas);
}
