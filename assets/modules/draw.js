/* ===== DRAW ===== */
function drawRuleWithin(test,rule){return typeof testRuleOnWithin==='function'?testRuleOnWithin(test,rule):testRuleOn(test,rule);}
function drawRuleAcross(test,rule){return typeof testRuleOnAcross==='function'?testRuleOnAcross(test,rule):testRuleOn(test,rule);}
function qcTooltip(){let el=document.getElementById('qcTooltip');if(!el){el=document.createElement('div');el.id='qcTooltip';el.className='qc-tooltip';document.body.appendChild(el);}return el;}
function bindLJTooltip(canvas){
  if(canvas._ljTipBound)return;canvas._ljTipBound=true;
  const hide=()=>{const tip=document.getElementById('qcTooltip');if(tip)tip.style.display='none';};
  canvas.addEventListener('mouseleave',hide);
  canvas.addEventListener('mousemove',e=>{
    const pts=canvas._ljHover||[];if(!pts.length)return hide();
    const r=canvas.getBoundingClientRect(),scaleX=(canvas._ljCssW||r.width)/r.width,scaleY=(canvas._ljCssH||r.height)/r.height;
    const mx=(e.clientX-r.left)*scaleX,my=(e.clientY-r.top)*scaleY;
    let hit=null,best=999;
    pts.forEach(p=>{const d=Math.hypot(mx-p.x,my-p.y);if(d<best&&d<=p.hit){best=d;hit=p;}});
    if(!hit)return hide();
    const tip=qcTooltip();tip.innerHTML=hit.html;tip.style.display='block';
    const pad=12,tw=tip.offsetWidth||220,th=tip.offsetHeight||70;
    let left=e.clientX+14,top=e.clientY+14;
    if(left+tw+pad>innerWidth)left=e.clientX-tw-14;
    if(top+th+pad>innerHeight)top=e.clientY-th-14;
    tip.style.left=Math.max(pad,left)+'px';tip.style.top=Math.max(pad,top)+'px';
  });
}
/* Chuẩn hoá canvas theo devicePixelRatio (nét trên màn hình retina) và co giãn theo bề
   rộng thực tế đang hiển thị — dùng chung cho drawLJ()/drawLJMultiZ() vì hai hàm vẽ
   Levey-Jennings này cần setup canvas giống hệt nhau, chỉ khác nội dung vẽ bên trong. */
function setupHiDPICanvas(canvas){
  if(!canvas.dataset.baseW){canvas.dataset.baseW=canvas.getAttribute('width')||canvas.width;canvas.dataset.baseH=canvas.getAttribute('height')||canvas.height;}
  const baseW=parseFloat(canvas.dataset.baseW)||1400,baseH=parseFloat(canvas.dataset.baseH)||430;
  const cssW=Math.max(760,Math.round(canvas.clientWidth||baseW)),cssH=Math.round(cssW*baseH/baseW);
  /* Match the real screen density instead of forcing supersampling on every
     display. Capping at 3x still bounds backing-pixel memory on very high-DPI
     screens while looking sharp on today's common 2x/3x Windows scaling. */
  const renderScale=Math.min(2,Math.max(1,Number(canvas.dataset.renderScale)||1)),dpr=Math.min(3,Math.max(renderScale,window.devicePixelRatio||1)),pxW=Math.round(cssW*dpr),pxH=Math.round(cssH*dpr);
  if(canvas.width!==pxW||canvas.height!==pxH){canvas.width=pxW;canvas.height=pxH;canvas.style.height=cssH+'px';}
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
  return{ctx,W:cssW,H:cssH};
}
function drawLJ(canvas,points,mean,sd){
  const{ctx,W,H}=setupHiDPICanvas(canvas);
  canvas._ljCssW=W;canvas._ljCssH=H;
  const padL=56,padR=78,padT=34,padB=48,cw=W-padL-padR,ch=H-padT-padB;
  const n=points.length,top=mean+3.25*sd,bot=mean-3.25*sd;
  const y=v=>padT+(top-v)/(top-bot)*ch,markPad=10;
  const clampY=v=>Math.max(padT,Math.min(padT+ch,y(v)));
  const x=i=>n<=1?padL+cw/2:padL+markPad+i/(n-1)*(cw-markPad*2);

  ctx.clearRect(0,0,W,H);
  const ljColors={
    okBand:'#e8f6ef',
    okMid:'#ffffff',
    warnBand:'#fff3cf',
    rejectBand:'#f9d6d5',
    grid:'#5d6b76',
    mean:'#17212b',
    line:'#0e8f8f',
    okPoint:'#0e8f8f',
    warnPoint:'#dd8b1f',
    rejectPoint:'#c5221f'
  };
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
  ctx.fillStyle=ljColors.okBand;ctx.fillRect(padL,padT,cw,ch);
  ctx.save();ctx.beginPath();ctx.rect(padL-markPad,padT,cw+markPad*2,ch);ctx.clip();

  const band=(lo,hi,color)=>{ctx.fillStyle=color;ctx.fillRect(padL,y(mean+hi*sd),cw,y(mean+lo*sd)-y(mean+hi*sd));};
  band(3,3.25,ljColors.rejectBand);band(-3.25,-3,ljColors.rejectBand);
  band(2,3,ljColors.warnBand);band(-3,-2,ljColors.warnBand);
  band(-2,2,ljColors.okBand);
  band(-1,1,ljColors.okMid);

  const test=state.tests.find(t=>t.id===canvas.dataset.test),rows=[3,2,1,0,-1,-2,-3];
  rows.forEach(k=>{
    const yy=y(mean+k*sd),major=k===0;
    ctx.strokeStyle=major?ljColors.mean:ljColors.grid;
    ctx.lineWidth=major?1.8:1.15;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(padL,yy);ctx.lineTo(padL+cw,yy);ctx.stroke();
  });
  ctx.restore();

  ctx.font='800 11px Manrope, Arial, sans-serif';ctx.fillStyle='#17212b';ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillText('Levey-Jennings',padL+cw/2,padT-8);
  ctx.font='800 12px Manrope, Arial, sans-serif';ctx.textBaseline='middle';
  rows.forEach(k=>{
    const yy=y(mean+k*sd);
    ctx.fillStyle='#17212b';ctx.textAlign='right';ctx.fillText(k===3?'> +3':k===-3?'< -3':String(k),padL-9,yy);
    ctx.fillStyle='#17212b';ctx.textAlign='left';ctx.fillText(fmtTestValue(test,mean+k*sd),padL+cw+10,yy);
  });

  if(!n){
    ctx.fillStyle='#7b838e';ctx.font='600 14px Manrope, Arial, sans-serif';ctx.textAlign='center';ctx.fillText('Chưa có điểm QC',padL+cw/2,padT+ch/2);
    canvas._ljHover=[];bindLJTooltip(canvas);
    return;
  }

  const level=parseInt(canvas.dataset.level),lot=canvas.dataset.lot||(test&&lvlCfg(test,level)||{}).lot||'?';
  // Đánh giá theo cấu hình rule của từng xét nghiệm (testRuleOn) + mức độ qua
  // ruleResultLevel — nhất quán với trang Westgard và biểu đồ đa mức, thay vì
  // dùng wgOn toàn cục và mức độ cứng từ core.
  const{F,zs}=QCCore.westgard(points,mean,sd,rule=>drawRuleWithin(test,rule));
  const important=[];F.forEach((f,i)=>{if(f&&f.rules&&f.rules.length)important.push(i);});
  const drawIndices=ChartViewModel.sampleIndices({length:n,maxPoints:Math.max(240,Math.floor(cw/2)),valueAt:i=>points[i]&&points[i].val,preserve:important});
  const levelText=level?`Mức ${level}`:'Mức QC';
  canvas._ljHover=[];
  ctx.save();ctx.beginPath();ctx.rect(padL,padT,cw,ch);ctx.clip();
  if(points.length>1){
    ctx.strokeStyle=ljColors.line;ctx.lineWidth=2.2;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash([]);
    ctx.beginPath();
    drawIndices.forEach((i,j)=>{const p=points[i],px=x(i),py=clampY(p.val);if(j)ctx.lineTo(px,py);else ctx.moveTo(px,py);});
    ctx.stroke();
  }
  drawIndices.forEach(i=>{const p=points[i],px=x(i),py=clampY(p.val);
    const rules=[...new Set((F[i]&&F[i].rules)||[])],z=zs[i],zTxt=(z>=0?'+':'')+fmt(z)+'s';
    const status=ruleResultLevel(test,rules),pointColor=status==='rej'?ljColors.rejectPoint:status==='warn'?ljColors.warnPoint:ljColors.okPoint;
    ctx.fillStyle=pointColor;ctx.beginPath();ctx.arc(px,py,status==='ok'?4:5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=1.8;ctx.stroke();
    canvas._ljHover.push({x:px,y:py,hit:12,html:`<b>${vnDate(p.date)} · ${levelText}</b><div>Lô: <b style="display:inline">${esc(p.lot||lot)}</b></div><div>Giá trị: ${fmtPointValue(p,test)}${test&&test.unit?' '+esc(test.unit):''}</div><div>Z: ${zTxt}</div><div class="muted">Luật: ${rules.length?esc(rules.join(', ')):'Đạt'}</div>`});
  });
  ctx.restore();
  const tickTotal=Math.min(5,n),tickIndices=tickTotal===1?[0]:[...new Set(Array.from({length:tickTotal},(_,i)=>Math.round(i*(n-1)/(tickTotal-1))))];
  ctx.fillStyle='#536772';ctx.font='700 11px Manrope, Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
  tickIndices.forEach(i=>{const raw=String(points[i].date||''),label=/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw.slice(8,10)+'/'+raw.slice(5,7):String(vnDate(points[i].date)||'').slice(0,5);ctx.fillText(label,x(i),padT+ch+10);});
  bindLJTooltip(canvas);


}
function ljDataURL(points,mean,sd){const c=document.createElement('canvas');c.width=1400;c.height=430;drawLJ(c,points,mean,sd);return c.toDataURL('image/png');}


function drawLJMultiZ(canvas,levelViews,test,opts){
  const{ctx,W,H}=setupHiDPICanvas(canvas);
  canvas._ljCssW=W;canvas._ljCssH=H;canvas._ljHover=[];
  /* padT=44 (không phải 34): chừa riêng một dòng cho chú giải Mức/lô phía trên
     dòng tiêu đề "Levey-Jennings tổng hợp theo Z-score" — lô dài (VD "TDM
     79979900") kéo chú giải đủ rộng để chạm vào tiêu đề canh giữa nếu hai dòng
     chỉ cách nhau vài px như trước (báo lỗi 2026-08-03, sau khi đã sửa khoảng
     cách GIỮA các mục chú giải ở lượt trước). */
  const padL=56,padR=78,padT=44,padB=46,cw=W-padL-padR,ch=H-padT-padB,markPad=10;
  const levels=(levelViews||[]).filter(v=>v&&v.pts&&v.pts.length&&Number.isFinite(+v.mean)&&Number.isFinite(+v.sd)&&+v.sd>0).slice(0,6);
  const all=levels.flatMap(v=>v.pts.map((p,i)=>({view:v,p,i,z:(Number(p.val)-Number(v.mean))/Number(v.sd),run:String(p.runId||p.date||''),date:p.date||''})));
  const runs=[...new Set(all.map(o=>o.run||o.date))].sort((a,b)=>String(a).localeCompare(String(b),'vi',{numeric:true})),runIndex=new Map(runs.map((run,i)=>[run,i]));
  const xOfRun=run=>runs.length<=1?padL+cw/2:padL+markPad+(runIndex.get(run)||0)/(runs.length-1)*(cw-markPad*2);
  const y=z=>padT+(3.25-z)/(6.5)*ch,clampY=z=>Math.max(padT,Math.min(padT+ch,y(z)));
  const colors=['#0e8f8f','#7a4f9a','#c47d12','#2f7d5b','#5369a6','#9a5b3c'];
  const ljColors={okBand:'#e8f6ef',okMid:'#ffffff',warnBand:'#fff3cf',rejectBand:'#f9d6d5',grid:'#5d6b76',mean:'#17212b',warnPoint:'#dd8b1f',rejectPoint:'#c5221f'};

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
  ctx.fillStyle=ljColors.okBand;ctx.fillRect(padL,padT,cw,ch);
  ctx.save();ctx.beginPath();ctx.rect(padL-markPad,padT,cw+markPad*2,ch);ctx.clip();
  const band=(lo,hi,color)=>{ctx.fillStyle=color;ctx.fillRect(padL,y(hi),cw,y(lo)-y(hi));};
  band(3,3.25,ljColors.rejectBand);band(-3.25,-3,ljColors.rejectBand);
  band(2,3,ljColors.warnBand);band(-3,-2,ljColors.warnBand);
  band(-2,2,ljColors.okBand);band(-1,1,ljColors.okMid);
  [-3,-2,-1,0,1,2,3].forEach(k=>{
    const yy=y(k),major=k===0;
    ctx.strokeStyle=major?ljColors.mean:ljColors.grid;ctx.lineWidth=major?1.8:1.15;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(padL,yy);ctx.lineTo(padL+cw,yy);ctx.stroke();
  });
  ctx.restore();

  ctx.font='800 11px Manrope, Arial, sans-serif';ctx.fillStyle='#17212b';ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillText('Levey-Jennings tổng hợp theo Z-score',padL+cw/2,padT-8);
  ctx.font='800 12px Manrope, Arial, sans-serif';ctx.textBaseline='middle';
  [-3,-2,-1,0,1,2,3].forEach(k=>{const yy=y(k);ctx.fillStyle='#17212b';ctx.textAlign='right';ctx.fillText(k===3?'> +3':k===-3?'< -3':String(k),padL-9,yy);ctx.textAlign='left';ctx.fillText((k>=0?'+':'')+k+'s',padL+cw+10,yy);});
  if(!all.length){
    ctx.fillStyle='#7b838e';ctx.font='600 14px Manrope, Arial, sans-serif';ctx.textAlign='center';ctx.fillText('Chưa có điểm QC để vẽ tích hợp',padL+cw/2,padT+ch/2);
    bindLJTooltip(canvas);return;
  }

  const cross=QCCore.westgardMultiByPoint(levels.map(v=>({level:v.level,pts:v.pts,mean:v.mean,sd:v.sd})),rule=>drawRuleAcross(test,rule));
  if(opts&&opts.divider&&levels.length>1){
    ctx.save();ctx.beginPath();ctx.rect(padL,padT,cw,ch);ctx.clip();
    ctx.strokeStyle='#9aa7b0';ctx.lineWidth=1.4;ctx.setLineDash([5,4]);
    for(let li=1;li<levels.length;li++){
      const prevIdx=levels[li-1].pts.map(p=>runIndex.get(String(p.runId||p.date||''))).filter(i=>i!=null),curIdx=levels[li].pts.map(p=>runIndex.get(String(p.runId||p.date||''))).filter(i=>i!=null);
      if(!prevIdx.length||!curIdx.length)continue;
      const xDiv=(xOfRun(runs[Math.max(...prevIdx)])+xOfRun(runs[Math.min(...curIdx)]))/2;
      ctx.beginPath();ctx.moveTo(xDiv,padT);ctx.lineTo(xDiv,padT+ch);ctx.stroke();
    }
    ctx.setLineDash([]);ctx.restore();
  }
  ctx.save();ctx.beginPath();ctx.rect(padL,padT,cw,ch);ctx.clip();
  levels.forEach((v,li)=>{
    const color=colors[li%colors.length],single=QCCore.westgardByPoint(v.pts,v.mean,v.sd,rule=>drawRuleWithin(test,rule));
    const important=[];v.pts.forEach((p,i)=>{if((single.F[i]&&single.F[i].rules&&single.F[i].rules.length)||(cross.get(p)||[]).length)important.push(i);});
    const drawIndices=ChartViewModel.sampleIndices({length:v.pts.length,maxPoints:Math.max(180,Math.floor(cw/Math.max(2,levels.length))),valueAt:i=>single.zs[i],preserve:important});
    if(v.pts.length>1){
      ctx.strokeStyle=color;ctx.lineWidth=2.1;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash([]);
      ctx.beginPath();
      drawIndices.forEach((i,j)=>{const p=v.pts[i],px=xOfRun(String(p.runId||p.date||'')),py=clampY(single.zs[i]);if(j)ctx.lineTo(px,py);else ctx.moveTo(px,py);});
      ctx.stroke();
    }
    drawIndices.forEach(i=>{const p=v.pts[i];
      const z=single.zs[i],rules=[...new Set([...(single.F[i]&&single.F[i].rules||[]),...(cross.get(p)||[])])],level=ruleResultLevel(test,rules);
      const px=xOfRun(String(p.runId||p.date||'')),py=clampY(z),pointColor=level==='rej'?ljColors.rejectPoint:level==='warn'?ljColors.warnPoint:color;
      ctx.fillStyle=pointColor;ctx.beginPath();ctx.arc(px,py,level==='ok'?4.2:5.4,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=1.8;ctx.stroke();
      canvas._ljHover.push({x:px,y:py,hit:13,html:`<b>${vnDate(p.date)} · Mức ${v.level}</b><div>Lần chạy: <b style="display:inline">${esc(p.runId||'—')}</b></div><div>Lô: <b style="display:inline">${esc(p.lot||v.lot||'?')}</b></div><div>Giá trị: ${fmtPointValue(p,test)}${test&&test.unit?' '+esc(test.unit):''}</div><div>Z: ${(z>=0?'+':'')+fmt(z)}s</div><div class="muted">Luật: ${rules.length?esc(rules.join(', ')):'Đạt'}</div>`});
    });
  });
  ctx.restore();
  /* Chú giải: khoảng cách giữa các mục PHẢI theo đúng bề rộng chữ đo được (canvas
     không tự xuống dòng/co chữ như HTML) — cố định 118px/mục từng khiến lô dài
     (VD "M1·TDM 79979900") đè lên khối màu của mục kế tiếp, đúng lỗi người dùng
     báo 2026-08-03. */
  {
    const y0=10;ctx.font='800 11px Manrope, Arial, sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
    let legendX=padL+8;
    levels.forEach((v,li)=>{
      const color=colors[li%colors.length],label=v.label||`Mức ${v.level}`;
      ctx.fillStyle=color;ctx.fillRect(legendX,y0,18,4);
      ctx.fillStyle='#17212b';ctx.fillText(label,legendX+25,y0+2);
      legendX+=25+ctx.measureText(label).width+20;
    });
  }
  bindLJTooltip(canvas);
}
function ljMultiDataURL(levelViews,test,opts){const c=document.createElement('canvas');c.width=1400;c.height=430;drawLJMultiZ(c,levelViews,test,opts);return c.toDataURL('image/png');}

/* Biểu đồ CUSUM: chỉ tham khảo xu hướng (không đổi trạng thái đạt/loại QC —
   xem cusumSeries() trong qc-domain.js), nên dùng bảng màu riêng (teal/xanh
   tím) thay vì tái dùng màu ok/warn/reject của Levey-Jennings, tránh người
   dùng hiểu nhầm đây là một verdict Westgard khác. Trục X theo thứ tự điểm
   (giống drawLJ, không theo lần chạy như drawLJMultiZ vì đây là một mức/một
   xét nghiệm, không cần gộp nhiều mức). */
function drawCUSUM(canvas,points,series){
  const{ctx,W,H}=setupHiDPICanvas(canvas);
  canvas._ljCssW=W;canvas._ljCssH=H;
  const padL=56,padR=78,padT=34,padB=32,cw=W-padL-padR,ch=H-padT-padB,markPad=10;
  const n=points.length,h=(series&&series.h)||4,k=(series&&series.k)||0.5;
  const cPos=(series&&series.cPos)||[],cNeg=(series&&series.cNeg)||[],ma=(series&&series.ma)||[],flags=(series&&series.flags)||[];
  let peak=h;[cPos,cNeg,ma].forEach(arr=>(arr||[]).forEach(value=>{if(Number.isFinite(value))peak=Math.max(peak,Math.abs(value));}));
  const top=peak*1.15,bot=-top;
  const y=v=>padT+(top-v)/(top-bot)*ch,clampY=v=>Math.max(padT,Math.min(padT+ch,y(v)));
  const x=i=>n<=1?padL+cw/2:padL+markPad+i/(n-1)*(cw-markPad*2);
  const cc={cpos:'#0e8f8f',cneg:'#5369a6',ma:'#9aa7b0',threshold:'#c5221f',zero:'#17212b',reject:'#c5221f'};

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);

  ctx.save();ctx.beginPath();ctx.rect(padL-markPad,padT,cw+markPad*2,ch);ctx.clip();
  ctx.strokeStyle=cc.threshold;ctx.lineWidth=1.3;ctx.setLineDash([6,4]);
  [h,-h].forEach(v=>{const yy=y(v);ctx.beginPath();ctx.moveTo(padL,yy);ctx.lineTo(padL+cw,yy);ctx.stroke();});
  ctx.setLineDash([]);
  ctx.strokeStyle=cc.zero;ctx.lineWidth=1.6;
  const y0=y(0);ctx.beginPath();ctx.moveTo(padL,y0);ctx.lineTo(padL+cw,y0);ctx.stroke();
  ctx.restore();

  ctx.font='800 11px Manrope, Arial, sans-serif';ctx.fillStyle='#17212b';ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillText(`CUSUM xu hướng (k=${fmt(k,2)}, h=${fmt(h,2)})`,padL+cw/2,padT-8);
  ctx.font='800 12px Manrope, Arial, sans-serif';ctx.textBaseline='middle';
  [h,0,-h].forEach(v=>{const yy=y(v);ctx.fillStyle='#17212b';ctx.textAlign='right';ctx.fillText(fmt(v,2),padL-9,yy);});

  if(!n){
    ctx.fillStyle='#7b838e';ctx.font='600 14px Manrope, Arial, sans-serif';ctx.textAlign='center';ctx.fillText('Chưa có điểm QC',padL+cw/2,padT+ch/2);
    canvas._ljHover=[];bindLJTooltip(canvas);
    return;
  }

  canvas._ljHover=[];
  const important=[];flags.forEach((flag,i)=>{if(flag==='rej')important.push(i);});
  const perSeries=Math.max(80,Math.floor(Math.max(240,cw/2)/3));
  const drawIndices=[...new Set([
    ...ChartViewModel.sampleIndices({length:n,maxPoints:perSeries,valueAt:i=>cPos[i],preserve:important}),
    ...ChartViewModel.sampleIndices({length:n,maxPoints:perSeries,valueAt:i=>cNeg[i],preserve:important}),
    ...ChartViewModel.sampleIndices({length:n,maxPoints:perSeries,valueAt:i=>ma[i],preserve:important})
  ])].sort((a,b)=>a-b);
  ctx.save();ctx.beginPath();ctx.rect(padL,padT,cw,ch);ctx.clip();
  const line=(arr,color,dash)=>{
    if(n<=1)return;
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash(dash||[]);
    ctx.beginPath();
    let started=false;
    drawIndices.forEach(i=>{const v=arr[i];if(!Number.isFinite(v))return;const px=x(i),py=clampY(v);if(started)ctx.lineTo(px,py);else{ctx.moveTo(px,py);started=true;}});
    ctx.stroke();
  };
  line(ma,cc.ma,[3,3]);
  line(cNeg,cc.cneg);
  line(cPos,cc.cpos);
  ctx.setLineDash([]);
  drawIndices.forEach(i=>{const p=points[i];
    const vp=cPos[i],vn=cNeg[i],flagged=flags[i]==='rej';
    const px=x(i);
    [[vp,cc.cpos],[vn,cc.cneg]].forEach(([v,color])=>{
      if(!Number.isFinite(v))return;
      const py=clampY(v),isEdge=flagged&&Math.abs(v)>=h-1e-9;
      ctx.fillStyle=isEdge?cc.reject:color;
      ctx.beginPath();ctx.arc(px,py,isEdge?5:3,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=1.4;ctx.stroke();
    });
    canvas._ljHover.push({x:px,y:clampY(Number.isFinite(vp)?vp:0),hit:12,html:`<b>${vnDate(p.date)}</b><div>CUSUM+: ${fmt(vp,2)}</div><div>CUSUM−: ${fmt(vn,2)}</div><div class="muted">${flagged?'Vượt ngưỡng h — nghi ngờ trôi/shift':'Trong tầm kiểm soát'}</div>`});
  });
  ctx.restore();
  bindLJTooltip(canvas);
}
