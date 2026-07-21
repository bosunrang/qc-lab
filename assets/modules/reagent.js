/* ===== REAGENT LOT COMPARISON ===== */
const RC_MIN_PAIRS=5;
/* palette khớp design token trong app.css; dùng cho SVG/báo cáo (in ở document riêng, không đọc được var()) */
const RCC={teal:'#0c6f78',tealDeep:'#0a5d65',ink:'#172833',muted:'#667b89',line:'#d4dde3',grid:'#e9eff3',red:'#a43a33',amber:'#a36f15',green:'#087044',okBg:'#e3f3f0',okFg:'#0a5e67',midBg:'#fbf0db',midFg:'#a36f15',noBg:'#f7e4e2',noFg:'#a43a33'};
const RCPAD={l:54,r:18,t:18,b:46};
const reagentUiState=ReagentUIState;
function rcBlank(){return {id:uid(),test:{reagent:'Hóa chất mới',lotOld:'',lotNew:'',date:'',operator:'',sampleType:'Mẫu bệnh nhân',unit:'',biasTarget:6,alpha:0.05,coverageConfirmed:false},rows:[['',''],['',''],['',''],['',''],['','']]};}
function rcLabel(d){const t=d.test;let s=teaAnalyteDisplay(t.reagent)||t.reagent||'Hóa chất mới';if(t.lotOld||t.lotNew)s+=' — '+(t.lotOld||'?')+'→'+(t.lotNew||'?');return s;}
function rcAct(){return state.reagentTests.find(d=>d.id===rcId);}
function rcSaveSoon(){clearTimeout(rcSaveT);rcSaveT=setTimeout(save,600);}
/* stats */
function rcBetacf(a,b,x){const MAXIT=200,EPS=3e-12,FP=1e-300;let qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap;if(Math.abs(d)<FP)d=FP;d=1/d;let h=d;
  for(let mm=1;mm<=MAXIT;mm++){let m2=2*mm,aa=mm*(b-mm)*x/((qam+m2)*(a+m2));d=1+aa*d;if(Math.abs(d)<FP)d=FP;c=1+aa/c;if(Math.abs(c)<FP)c=FP;d=1/d;h*=d*c;aa=-(a+mm)*(qab+mm)*x/((a+m2)*(qap+m2));d=1+aa*d;if(Math.abs(d)<FP)d=FP;c=1+aa/c;if(Math.abs(c)<FP)c=FP;d=1/d;let del=d*c;h*=del;if(Math.abs(del-1)<EPS)break;}return h;}
function rcLgamma(x){const c=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];let y=x,t=x+5.5;t-=(x+0.5)*Math.log(t);let s=1.000000000190015;for(let j=0;j<6;j++){y++;s+=c[j]/y;}return -t+Math.log(2.5066282746310005*s/x);}
function rcBetai(a,b,x){if(x<=0)return 0;if(x>=1)return 1;let bt=Math.exp(rcLgamma(a+b)-rcLgamma(a)-rcLgamma(b)+a*Math.log(x)+b*Math.log(1-x));return x<(a+1)/(a+b+2)?bt*rcBetacf(a,b,x)/a:1-bt*rcBetacf(b,a,1-x)/b;}
function rcPTwo(t,df){return rcBetai(df/2,0.5,df/(df+t*t));}
function rcTCrit(df,alpha){let lo=0,hi=1000;for(let i=0;i<200;i++){let mid=(lo+hi)/2;if(rcPTwo(mid,df)>alpha)lo=mid;else hi=mid;}return(lo+hi)/2;}
function rcMean(a){return a.reduce((s,v)=>s+v,0)/a.length;}
function rcVar(a){const mu=rcMean(a);return a.reduce((s,v)=>s+(v-mu)**2,0)/(a.length-1);}
function rcPearson(x,y){const n=x.length;let sx=0,sy=0,sxy=0,sx2=0,sy2=0;for(let i=0;i<n;i++){sx+=x[i];sy+=y[i];sxy+=x[i]*y[i];sx2+=x[i]*x[i];sy2+=y[i]*y[i];}const den=Math.sqrt((n*sx2-sx*sx)*(n*sy2-sy*sy));return den===0?0:(n*sxy-sx*sy)/den;}
function rcOls(x,y){const n=x.length,mx=rcMean(x),my=rcMean(y);let sxy=0,sxx=0;for(let i=0;i<n;i++){sxy+=(x[i]-mx)*(y[i]-my);sxx+=(x[i]-mx)**2;}const b=sxx===0?0:sxy/sxx,a=my-b*mx,r=rcPearson(x,y);return{a,b,r2:r*r};}
function rcMedian(a){const s=[...a].sort((p,q)=>p-q),n=s.length;return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2;}
function rcPB(x,y){const sl=[],n=x.length;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const dx=x[j]-x[i],dy=y[j]-y[i];if(dx===0)continue;const s=dy/dx;if(s===-1)continue;sl.push(s);}if(!sl.length)return{a:0,b:1};sl.sort((p,q)=>p-q);const K=sl.filter(s=>s<-1).length,N=sl.length;let b;if(N%2)b=sl[(N+1)/2-1+K];else b=(sl[N/2-1+K]+sl[N/2+K])/2;return{a:rcMedian(x.map((xi,i)=>y[i]-b*xi)),b};}
function rcValid(ds){const o=[],n=[];ds.rows.forEach(r=>{const a=parseFloat(r[0]),b=parseFloat(r[1]);if(!isNaN(a)&&!isNaN(b)){o.push(a);n.push(b);}});return{o,n};}
function rcPairCalc(r){const a=parseFloat(r&&r[0]),b=parseFloat(r&&r[1]);return Number.isFinite(a)&&Number.isFinite(b)?{avg:(a+b)/2,dif:a-b}:null;}
function rcCalc(ds){const {o,n}=rcValid(ds);if(o.length<RC_MIN_PAIRS)return null;
  const N=o.length,df=N-1,d=o.map((v,i)=>v-n[i]);const mO=rcMean(o),mN=rcMean(n),vO=rcVar(o),vN=rcVar(n),md=rcMean(d),sdd=Math.sqrt(rcVar(d));
  const dRange=Math.max(...d)-Math.min(...d),degenerate=dRange<1e-9*(Math.abs(mO)+Math.abs(mN)+1);
  const tStat=degenerate?(md===0?0:(md>0?Infinity:-Infinity)):md/(sdd/Math.sqrt(N)),r=rcPearson(o,n);
  const alpha=parseFloat(ds.test.alpha)||0.05,p2=isFinite(tStat)?rcPTwo(tStat,df):0;
  const bias=mO?Math.abs((mO-mN)/Math.abs(mO))*100:(mN?Infinity:0),biasT=parseFloat(ds.test.biasTarget)||6,coverage=!!ds.test.coverageConfirmed,enoughN=N>=20;
  const fit=rcOls(o,n),pb=rcPB(o,n);
  const relPairs=o.map((v,i)=>{const s=(v+n[i])/2;return s!==0?Math.abs((v-n[i])/s):null;}).filter(x=>x!=null);const mard=relPairs.length?rcMean(relPairs)*100:NaN;
  const passP=p2>alpha,passBias=bias<biasT,passR2=fit.r2>0.95,passSlope=fit.b>=0.9&&fit.b<=1.1;
  const passScreen=enoughN&&coverage&&passBias;
  let level;if(!passBias)level='no';else if(passScreen)level='ok';else level='mid';
  return{o,n,N,df,d,mO,mN,vO,vN,md,sdd,tStat,r,alpha,p2,p1:p2/2,tc2:rcTCrit(df,alpha),tc1:rcTCrit(df,2*alpha),bias,biasT,fit,pb,mard,passP,passBias,passR2,passSlope,coverage,enoughN,passScreen,level};}
/* charts */
function rcAxis(W,H,xmin,xmax,ymin,ymax,xlab,ylab){const px=v=>RCPAD.l+(v-xmin)/(xmax-xmin)*(W-RCPAD.l-RCPAD.r),py=v=>H-RCPAD.b-(v-ymin)/(ymax-ymin)*(H-RCPAD.t-RCPAD.b);
  let g='';for(let i=0;i<=5;i++){const xv=xmin+(xmax-xmin)*i/5,yv=ymin+(ymax-ymin)*i/5;
    g+=`<line x1="${px(xv)}" y1="${RCPAD.t}" x2="${px(xv)}" y2="${H-RCPAD.b}" stroke="${RCC.grid}"/><line x1="${RCPAD.l}" y1="${py(yv)}" x2="${W-RCPAD.r}" y2="${py(yv)}" stroke="${RCC.grid}"/>`;
    g+=`<text x="${px(xv)}" y="${H-RCPAD.b+15}" font-size="10" fill="${RCC.muted}" text-anchor="middle">${+xv.toFixed(2)}</text>`;
    g+=`<text x="${RCPAD.l-7}" y="${py(yv)+3}" font-size="10" fill="${RCC.muted}" text-anchor="end">${+yv.toFixed(2)}</text>`;}
  g+=`<line x1="${RCPAD.l}" y1="${H-RCPAD.b}" x2="${W-RCPAD.r}" y2="${H-RCPAD.b}" stroke="${RCC.ink}" stroke-width="1.3"/><line x1="${RCPAD.l}" y1="${RCPAD.t}" x2="${RCPAD.l}" y2="${H-RCPAD.b}" stroke="${RCC.ink}" stroke-width="1.3"/>`;
  g+=`<text x="${(RCPAD.l+W-RCPAD.r)/2}" y="${H-7}" font-size="10.5" fill="${RCC.ink}" text-anchor="middle" font-weight="600">${esc(xlab)}</text>`;
  g+=`<text transform="translate(13,${(RCPAD.t+H-RCPAD.b)/2}) rotate(-90)" font-size="10.5" fill="${RCC.ink}" text-anchor="middle" font-weight="600">${esc(ylab)}</text>`;
  return{g,px,py};}
function rcPadr(min,max){const r=(max-min)||Math.abs(max)||1;return[min-r*0.08,max+r*0.08];}
function rcToolIcon(type){
  const p={
    search:'<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    print:'<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    report:'<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8.5 13h7"/><path d="M8.5 17h7"/>',
    trash:'<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>'
  }[type]||'';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}
function rcMiniIcon(type){
  if(type==='sample')return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h6"/><path d="M9 3h6v4H9z"/><rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 11h6M9 15h6"/></svg>';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 11a4 4 0 1 0-8 0"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M17.5 7.5a3 3 0 0 1 2.6 4.5"/><path d="M20.5 21a6 6 0 0 0-3-5.2"/></svg>';
}
function rcScatterSVG(R,t){const W=460,H=380;let lo=Math.min(...R.o,...R.n),hi=Math.max(...R.o,...R.n);[lo,hi]=rcPadr(lo,hi);
  const A=rcAxis(W,H,lo,hi,lo,hi,'Lô cũ ('+(t.lotOld||'cũ')+')','Lô mới ('+(t.lotNew||'mới')+')');let g=A.g;
  g+=`<line x1="${A.px(lo)}" y1="${A.py(lo)}" x2="${A.px(hi)}" y2="${A.py(hi)}" stroke="${RCC.muted}" stroke-width="1.4" stroke-dasharray="5 4"/>`;
  g+=`<line x1="${A.px(lo)}" y1="${A.py(R.pb.a+R.pb.b*lo)}" x2="${A.px(hi)}" y2="${A.py(R.pb.a+R.pb.b*hi)}" stroke="${RCC.teal}" stroke-width="2"/>`;
  R.o.forEach((v,i)=>g+=`<circle cx="${A.px(v)}" cy="${A.py(R.n[i])}" r="4.5" fill="${RCC.teal}" fill-opacity="0.78" stroke="#fff" stroke-width="1.2"/>`);
  return`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;}
function rcBlandSVG(R){const W=460,H=380,av=R.o.map((v,i)=>(v+R.n[i])/2),up=R.md+1.96*R.sdd,low=R.md-1.96*R.sdd;
  let xlo=Math.min(...av),xhi=Math.max(...av);[xlo,xhi]=rcPadr(xlo,xhi);let ylo=Math.min(...R.d,low),yhi=Math.max(...R.d,up);[ylo,yhi]=rcPadr(ylo,yhi);
  const A=rcAxis(W,H,xlo,xhi,ylo,yhi,'Trung bình (cũ + mới)/2','Hiệu số (cũ − mới)');let g=A.g;
  const ln=(yv,col,dash,txt)=>`<line x1="${A.px(xlo)}" y1="${A.py(yv)}" x2="${A.px(xhi)}" y2="${A.py(yv)}" stroke="${col}" stroke-width="1.6"${dash?' stroke-dasharray="5 4"':''}/><text x="${A.px(xhi)}" y="${A.py(yv)-4}" font-size="10" fill="${col}" text-anchor="end">${txt} ${+yv.toFixed(3)}</text>`;
  g+=`<line x1="${A.px(xlo)}" y1="${A.py(0)}" x2="${A.px(xhi)}" y2="${A.py(0)}" stroke="${RCC.line}"/>`;
  g+=ln(R.md,RCC.amber,false,'Bias')+ln(up,RCC.red,true,'+1.96SD')+ln(low,RCC.red,true,'−1.96SD');
  av.forEach((v,i)=>g+=`<circle cx="${A.px(v)}" cy="${A.py(R.d[i])}" r="4.5" fill="${RCC.amber}" fill-opacity="0.8" stroke="#fff" stroke-width="1.2"/>`);
  return`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;}
/* page */
function rcSelectOptions(){return state.reagentTests.map(d=>`<option value="${escAttr(d.id)}"${d.id===rcId?' selected':''}>${esc(rcLabel(d))}</option>`).join('');}
function pageReagent(){
  if(!state.reagentTests.length)state.reagentTests.push(rcBlank());
  if(!rcId||!state.reagentTests.find(d=>d.id===rcId))rcId=state.reagentTests[0].id;
  const ds=rcAct(),t=ds.test,ro=!canWrite()?'disabled':'';
  const oldLotHead='Lô cũ'+(t.lotOld?`: ${esc(t.lotOld)}`:''),newLotHead='Lô mới'+(t.lotNew?`: ${esc(t.lotNew)}`:'');
  const rows=ds.rows.map((r,i)=>{const c=rcPairCalc(r);return `<div class="rc-pair-row" data-rc-row="${i}"><div class="rc-idx">${i+1}</div><input ${ro} value="${r[0]}" oninput="rcCell(${i},0,this.value)" type="number" step="any" placeholder="–"><input ${ro} value="${r[1]}" oninput="rcCell(${i},1,this.value)" type="number" step="any" placeholder="–"><div class="rc-calc avg">${c?fmt(c.avg,3):'–'}</div><div class="rc-calc dif ${c&&c.dif<0?'neg':''}">${c?fmt(c.dif,3):'–'}</div>${canWrite()?`<button class="x" onclick="rcRmRow(${i})" title="Xóa dòng">✕</button>`:'<span></span>'}</div>`;}).join('');
  return headOnly('So sánh 2 lô hóa chất','Sàng lọc định lượng · hồi quy mô tả · Bland-Altman · phê duyệt theo SOP')+
   `<div class="panel rc-toolbar-panel"><h3>Thiết lập so sánh</h3><div class="rc-toolbar">
     <div class="rc-toolbar-selcol"><label>Chọn hóa chất</label><select id="rcSel" onchange="rcSwitch(this.value)">${rcSelectOptions()}</select></div>
     ${canWrite()?`<div class="rc-toolbar-primary"><div><button class="btn teal rc-add-btn" onclick="openRcCreateModal()">+ Thêm</button><button class="btn danger rc-delete-btn" onclick="rcDeleteCurrent()">${rcToolIcon('trash')} Xóa</button></div></div>`:''}
     <div class="rc-toolbar-secondary">${canWrite()?`<button class="btn ghost rc-find-btn" onclick="openRcModal()">${rcToolIcon('search')} Tìm</button>`:''}<button class="btn ghost rc-report-btn" onclick="rcPrint()">${rcToolIcon('print')} In hóa chất này</button><button class="btn teal rc-report-main" onclick="rcPrintSummary()">${rcToolIcon('report')} Báo cáo tổng hợp</button></div></div></div>
   <div class="rc-entry-grid"><div class="panel rc-info-panel"><h3>Thông tin đánh giá</h3><div class="rc-info-grid">
     <div class="rc-field"><label>Tên hóa chất</label><input ${ro} value="${escAttr(t.reagent)}" oninput="rcMeta('reagent',this.value)" placeholder="Tên hóa chất / xét nghiệm"></div>
     <div class="rc-field"><label>Đơn vị</label><input ${ro} value="${escAttr(t.unit)}" oninput="rcMeta('unit',this.value)" placeholder="mmol/L..."></div>
     <div class="rc-field"><label>Số lô cũ</label><input ${ro} value="${escAttr(t.lotOld)}" oninput="rcMeta('lotOld',this.value)"></div>
     <div class="rc-field"><label>Số lô mới</label><input ${ro} value="${escAttr(t.lotNew)}" oninput="rcMeta('lotNew',this.value)"></div>
     <div class="rc-field rc-date-field"><label>Ngày thực hiện</label>${dateBox('rcDate',t.date||'','',`${ro} onchange="rcMeta('date',this.value)"`)}</div>
     <div class="rc-field"><label>Người thực hiện</label><div class="rc-quick-field"><input ${ro} value="${escAttr(t.operator)}" oninput="rcMeta('operator',this.value)" placeholder="Họ tên"><button class="rc-icon-btn" ${canWrite()?'':'disabled'} onclick="rcOpenQuick('operator')" title="Chọn nhanh người thực hiện" aria-label="Chọn nhanh người thực hiện">${rcMiniIcon('user')}</button></div></div>
     <div class="rc-field"><label>Loại mẫu</label><div class="rc-quick-field"><input ${ro} value="${escAttr(t.sampleType)}" oninput="rcMeta('sampleType',this.value)" placeholder="Loại mẫu"><button class="rc-icon-btn" ${canWrite()?'':'disabled'} onclick="rcOpenQuick('sampleType')" title="Chọn nhanh loại mẫu" aria-label="Chọn nhanh loại mẫu">${rcMiniIcon('sample')}</button></div></div>
     <div class="rc-field"><label>Bias mong muốn (%)</label><input ${ro} type="number" step="any" value="${t.biasTarget}" oninput="rcMeta('biasTarget',this.value)"></div>
     <div class="rc-field"><label>Mức ý nghĩa (α, alpha)</label><input ${ro} type="number" step="any" value="${t.alpha}" oninput="rcMeta('alpha',this.value)"></div>
     <div class="rc-field rc-coverage-cell"><label class="rc-coverage-check"><input ${ro} type="checkbox" ${t.coverageConfirmed?'checked':''} onchange="rcMeta('coverageConfirmed',this.checked)"><span>Mẫu đã bao phủ khoảng đo và/hoặc điểm quyết định lâm sàng theo SOP</span></label></div></div></div>
   <div class="panel rc-pair-panel"><h3>Dữ liệu đo bắt cặp</h3><div class="rc-pair-wrap"><div class="rc-pair-head"><div>Mẫu</div><div id="rcOldLotHead">${oldLotHead}</div><div id="rcNewLotHead">${newLotHead}</div><div>Trung bình</div><div>Hiệu số (cũ − mới)</div><div></div></div>${rows}</div>
     ${canWrite()?`<div class="rc-pair-actions"><button class="btn ghost sm" onclick="rcAddRow()">+ Thêm mẫu</button> <button class="btn ghost sm" onclick="rcClearRows()">Xóa dữ liệu</button></div>`:''}
     <div class="hint" style="margin:8px 16px 16px">Nhập tối thiểu ${RC_MIN_PAIRS} cặp để tính mô tả; để phần mềm đánh dấu “đạt sàng lọc” cần ≥20 cặp hợp lệ, bao phủ khoảng đo/điểm quyết định lâm sàng và %bias trong giới hạn SOP. Không dùng p-value để tự chấp nhận lô.</div></div></div>
   <div class="panel rc-stats-panel"><h3>Kết quả thống kê</h3><div id="rcStats"></div></div>
   <div class="panel rc-crit-panel"><h3>Tiêu chí chấp nhận &amp; kết luận</h3><div id="rcCrit"></div><div id="rcVerdict"></div></div>
   <div class="panel rc-chart-panel"><h3>Biểu đồ</h3><div class="rc-charts">
     <div class="rc-chart-box"><h4>Biểu đồ tương quan</h4><p>Lô cũ (trục X) so với Lô mới (trục Y)</p><div id="rcScatter"></div><div class="rc-chart-legend"><span><i class="reg"></i>Đường hồi quy</span><span><i class="ideal"></i>Đường lý tưởng y = x</span></div></div>
     <div class="rc-chart-box"><h4>Biểu đồ Bland-Altman</h4><p>Hiệu số (cũ − mới) so với giá trị trung bình</p><div id="rcBland"></div><div class="rc-chart-legend"><span><i class="bias"></i>Bias trung bình</span><span><i class="limit"></i>±1.96 SD</span></div></div></div></div>`;
}
function rcCompute(){
  const ds=rcAct();if(!ds)return;const R=rcCalc(ds);
  const f=rcFmt,ft=rcFmtT;
  const st=document.getElementById('rcStats'),cr=document.getElementById('rcCrit'),vd=document.getElementById('rcVerdict'),sc=document.getElementById('rcScatter'),bl=document.getElementById('rcBland');
  if(!st)return;
  if(!R){st.innerHTML=`<div class="empty">Nhập tối thiểu ${RC_MIN_PAIRS} cặp giá trị hợp lệ để xem thống kê mô tả; khuyến nghị ≥20 cặp cho sàng lọc phần mềm.</div>`;cr.innerHTML='';vd.innerHTML='';sc.innerHTML='';bl.innerHTML='';return;}
  const eq=(b,a)=>`y = ${f(b,4)}x ${a>=0?'+':'−'} ${f(Math.abs(a),4)}`;
  const row=(label,val)=>`<div class="rc-stat-row"><span>${label}</span><b>${val}</b></div>`;
  st.innerHTML=`<div class="rc-stat-kpis">
      <div class="rc-stat-card"><div class="rc-stat-label">Hệ số tương quan (Pearson r)</div><div class="rc-stat-value">${f(R.r,4)}</div><div class="rc-stat-sub">R² = ${f(R.fit.r2,4)}</div></div>
      <div class="rc-stat-card"><div class="rc-stat-label">%Bias</div><div class="rc-stat-value ${R.passBias?'ok':'bad'}">${f(R.bias,3)}%</div><div class="rc-stat-sub">Mong muốn &lt; ${f(R.biasT,3)}%</div></div>
      <div class="rc-stat-card"><div class="rc-stat-label">P (hai phía / two-tail)</div><div class="rc-stat-value">${f(R.p2,4)}</div><div class="rc-stat-sub">α = ${f(R.alpha,4)}</div></div>
    </div>
    <div class="rc-stat-section">
      <h4>Kiểm định t bắt cặp (t-Test: Paired Two Sample for Means)</h4>
      <div class="rc-stat-columns">
        <div>${row('Trung bình (Mean) – Lô cũ / Lô mới',`${f(R.mO,3)} / ${f(R.mN,3)}`)}
          ${row('Phương sai (Variance) – cũ / mới',`${f(R.vO,3)} / ${f(R.vN,3)}`)}
          ${row('Số quan sát (Observations), n',R.N)}
          ${row('Tương quan Pearson (Pearson Correlation)',f(R.r,5))}
          ${row('Chênh lệch TB giả định (Hypothesized Mean Diff.)','0')}</div>
        <div>${row('Bậc tự do (df)',R.df)}
          ${row('Giá trị t (t Stat)',ft(R.tStat))}
          ${row('P(T≤t) một phía (one-tail)',f(R.p1,5))}
          ${row('t tới hạn một phía (t Critical one-tail)',f(R.tc1,4))}
          ${row('P(T≤t) hai phía (two-tail)',f(R.p2,4))}
          ${row('t tới hạn hai phía (t Critical two-tail)',f(R.tc2,4))}</div>
      </div>
    </div>
    <div class="rc-stat-section">
      <h4>Hồi quy &amp; độ chệch (Regression &amp; bias)</h4>
      <div class="rc-stat-columns">
        <div>${row('Hồi quy tuyến tính (OLS)',eq(R.fit.b,R.fit.a))}
          ${row('R² (OLS)',f(R.fit.r2,5))}</div>
        <div>${row('Passing-Bablok',eq(R.pb.b,R.pb.a))}
          ${row('Chênh lệch tương đối TB theo cặp (Mean abs. rel. diff.)',`${f(R.mard,3)}%`)}</div>
      </div>
    </div>`;
  const C=[
    {ok:R.passBias,decision:true,t:'Độ chệch trong giới hạn cho phép (tiêu chí quyết định)',why:`%Bias = ${f(R.bias,3)}% ${R.passBias?'<':'≥'} ${f(R.biasT,3)}% mong muốn`},
    {ok:R.enoughN,decision:true,t:'Đủ cỡ mẫu sàng lọc (tiêu chí quyết định)',why:`n = ${R.N} ${R.enoughN?'≥':'<'} 20 cặp hợp lệ`},
    {ok:R.coverage,decision:true,t:'Bao phủ khoảng đo / điểm quyết định (tiêu chí quyết định)',why:R.coverage?'Đã xác nhận theo SOP':'Chưa xác nhận theo SOP'},
    {ok:R.passP,t:'Không khác biệt có ý nghĩa thống kê (mô tả)',why:`P(two-tail) = ${f(R.p2,4)} ${R.passP?'>':'≤'} α = ${f(R.alpha,4)}; không dùng riêng để chấp nhận lô`},
    {ok:R.passR2,t:'Tương quan chặt chẽ (mô tả)',why:`R² = ${f(R.fit.r2,4)}; cần ≥ 0,95 để xem là tương quan chặt`},
    {ok:R.passSlope,t:'Độ dốc hồi quy chấp nhận được (mô tả)',why:`Slope = ${f(R.fit.b,4)}; mục tiêu trong khoảng [0,90 - 1,10]`}];
  cr.innerHTML=C.map(c=>{const cls=c.decision?(c.ok?'pass':'fail'):(c.ok?'info':'note'),txt=c.decision?(c.ok?'ĐẠT':'KHÔNG ĐẠT'):(c.ok?'TỐT':'LƯU Ý');return`<div class="rc-crit-item"><span class="rc-crit-badge ${cls}">${txt}</span><div class="rc-crit-text">${c.t}<div>${c.why}</div></div></div>`;}).join('');
  let vcls,vicon,vtitle,vdesc;const calib=!R.passR2||!R.passSlope;
  if(R.level==='ok'){vcls='ok';vicon='✓';vtitle='Kết luận: Đạt tiêu chí sàng lọc phần mềm';vdesc='Độ chệch trong giới hạn, đủ cỡ mẫu (n≥20) và đã xác nhận bao phủ khoảng đo/điểm quyết định. Lô mới đủ điều kiện trình phê duyệt theo SOP trước khi đưa vào sử dụng cho mẫu bệnh nhân.'+(calib||!R.passP?' Lưu ý: một số chỉ số mô tả (P-value/R²/độ dốc) chưa lý tưởng, cần ghi nhận khi phê duyệt.':'');}
  else if(R.level==='mid'){vcls='mid';vicon='!';vtitle='Kết luận: Chưa đủ điều kiện sàng lọc';vdesc='Độ chệch (%Bias) nằm trong giới hạn cho phép, song chưa đủ cỡ mẫu (n≥20) và/hoặc chưa xác nhận bao phủ khoảng đo/điểm quyết định theo SOP.'+(calib?' Ngoài ra hệ số tương quan và/hoặc độ dốc hồi quy chưa đạt, nên kiểm tra hiệu chuẩn.':'')+' Bổ sung dữ liệu hoặc ghi nhận ngoại lệ theo SOP trước khi phê duyệt.';}
  else{vcls='no';vicon='✕';vtitle='Kết luận: Hai lô hóa chất có khác biệt';vdesc='Độ chệch (%Bias) vượt giới hạn cho phép. Không đưa lô mới vào sử dụng cho mẫu bệnh nhân; tiến hành điều tra, xử lý theo quy trình.';}
  vd.innerHTML=`<div class="rc-verdict ${vcls}"><div class="rc-verdict-icon">${vicon}</div><div><div class="rc-verdict-title">${vtitle}</div><div class="rc-verdict-desc">${vdesc}</div></div></div>`;
  sc.innerHTML=rcScatterSVG(R,ds.test);bl.innerHTML=rcBlandSVG(R);
}
function rcMeta(k,v){if(!requireWrite())return;const ds=rcAct();ds.test[k]=k==='coverageConfirmed'?!!v:(['biasTarget','alpha'].includes(k)?QCCore.finiteNumber(v,0):(k==='date'?(parseVN(v)||QCCore.cleanText(v,20)):QCCore.cleanText(v)));rcSaveSoon();rcCompute();if(k==='reagent'||k==='lotOld'||k==='lotNew'){const d=document.getElementById('rcCmpDisp');if(d)d.textContent=rcLabel(rcAct());const s=document.getElementById('rcSel');if(s){const o=[...s.options].find(o=>o.value===rcId);if(o)o.textContent=rcLabel(rcAct());}const oh=document.getElementById('rcOldLotHead'),nh=document.getElementById('rcNewLotHead');if(oh)oh.textContent='Lô cũ'+(ds.test.lotOld?': '+ds.test.lotOld:'');if(nh)nh.textContent='Lô mới'+(ds.test.lotNew?': '+ds.test.lotNew:'');}}
function rcUpdateRowCalc(i){
  const row=document.querySelector(`[data-rc-row="${i}"]`),ds=rcAct();if(!row||!ds||!ds.rows[i])return;
  const c=rcPairCalc(ds.rows[i]),avg=row.querySelector('.rc-calc.avg'),dif=row.querySelector('.rc-calc.dif');
  if(avg)avg.textContent=c?fmt(c.avg,3):'–';
  if(dif){dif.textContent=c?fmt(c.dif,3):'–';dif.classList.toggle('neg',!!(c&&c.dif<0));}
}
function rcCell(i,w,v){if(!requireWrite())return;const ds=rcAct();ds.rows[i][w]=v;rcSaveSoon();rcUpdateRowCalc(i);rcCompute();}
function rcAddRow(){if(!requireWrite())return;rcAct().rows.push(['','']);save({clearDerived:false});rerender();}
function rcRmRow(i){if(!requireWrite())return;const a=rcAct();a.rows.splice(i,1);if(!a.rows.length)a.rows.push(['','']);save({clearDerived:false});rerender();}
function rcClearRows(){if(!requireWrite())return;rcAct().rows=[['',''],['',''],['',''],['',''],['','']];save({clearDerived:false});rerender();}
function rcSwitch(id){rcId=id;rerender();}
async function rcDelete(id,keepModal=false){if(!requireWrite())return;if(state.reagentTests.length<=1){await infoDialog('Phải còn ít nhất 1 phép so sánh.');return;}
  if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa phép so sánh',message:'Xóa phép so sánh này?',confirmLabel:'Xóa',cancelLabel:'Hủy'}))return;
  state.reagentTests=state.reagentTests.filter(d=>d.id!==id);if(rcId===id)rcId=state.reagentTests[0].id;save({clearDerived:false});if(keepModal)renderRcModal();rerender();}
function rcDeleteCurrent(){rcDelete(rcId);}
function rcQuickKey(type){return type==='sampleType'?'reagentSampleTypes':'reagentOperators';}
function rcQuickLabel(type){return type==='sampleType'?'loại mẫu':'người thực hiện';}
function rcQuickField(type){return type==='sampleType'?'sampleType':'operator';}
function rcQuickList(type){
  const key=rcQuickKey(type);
  if(!Array.isArray(state[key]))state[key]=type==='sampleType'?['Mẫu bệnh nhân','Mẫu nội kiểm (IQC)','Mẫu ngoại kiểm (EQA)']:[];
  if(type==='sampleType'&&!state[key].length)state[key]=['Mẫu bệnh nhân','Mẫu nội kiểm (IQC)','Mẫu ngoại kiểm (EQA)'];
  return state[key];
}
function rcOpenQuick(type){if(!requireWrite())return;rcQuickType=type;rcRenderQuickModal();}
function rcRenderQuickModal(){
  const type=rcQuickType||'operator',items=rcQuickList(type),label=rcQuickLabel(type);
  const rows=items.length?items.map((name,i)=>`<div class="mrow"><span><b>${esc(name)}</b></span><span class="acts"><button class="btn teal sm" onclick="rcPickQuick(${i})">Chọn</button><button class="x" onclick="rcDelQuick(${i})" title="Xóa">✕</button></span></div>`).join(''):`<div class="empty">Chưa có ${esc(label)} trong danh sách.</div>`;
  openModal(`<div class="modal"><div class="modal-h"><h3>Chọn nhanh ${esc(label)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b">${rows}<div class="rc-quick-add"><input id="rcQuickNew" placeholder="Thêm ${escAttr(label)} mới" onkeydown="if(event.key==='Enter'){event.preventDefault();rcAddQuick()}"><button class="btn teal sm" onclick="rcAddQuick()">Thêm</button></div></div>
    <div class="modal-f"><button class="btn ghost" onclick="closeModal()">Đóng</button></div></div>`);
  setTimeout(()=>{const e=document.getElementById('rcQuickNew');if(e)e.focus();},0);
}
function rcPickQuick(i){
  const ds=rcAct(),items=rcQuickList(rcQuickType),v=items[i];if(!ds||!v)return;
  ds.test[rcQuickField(rcQuickType)]=v;save({clearDerived:false});closeModal();rerender();
}
function rcAddQuick(){
  const input=document.getElementById('rcQuickNew'),v=QCCore.cleanText(input&&input.value,120).trim();if(!v)return;
  const items=rcQuickList(rcQuickType);if(!items.some(x=>searchText(x)===searchText(v)))items.push(v);
  save({clearDerived:false});rcRenderQuickModal();
}
async function rcDelQuick(i){
  const items=rcQuickList(rcQuickType),v=items[i];if(!v)return;
  if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa khỏi danh sách',message:`Xóa "${v}" khỏi danh sách?`,confirmLabel:'Xóa',cancelLabel:'Hủy'}))return;
  items.splice(i,1);save({clearDerived:false});rcRenderQuickModal();
}
function openRcModal(){rcModalQ='';renderRcModal();}
function rcModalSearchSet(v){
  rcModalQ=v;
  scheduleSearchRender(rcModalSearchSet,renderRcModal,'rcModalSearch');
}
function renderRcModal(){
  const q=searchText(rcModalQ);
  const hit=d=>!q||[rcLabel(d),d.test.reagent,d.test.lotOld,d.test.lotNew,d.test.unit,d.test.operator].some(v=>searchText(v).includes(q));
  const rows=state.reagentTests.filter(hit).map(d=>`<div class="mrow ${d.id===rcId?'on':''}"><span><b>${esc(rcLabel(d))}</b><div style="font-size:12px;color:var(--muted);font-family:var(--sans);margin-top:2px">${esc(d.test.unit||'')} ${d.rows&&d.rows.length?'· '+d.rows.length+' dòng':''}</div></span><span class="acts"><button class="btn ${d.id===rcId?'teal':'ghost'} sm" onclick="rcPick('${d.id}')">${d.id===rcId?'Đang chọn':'Chọn'}</button>${canWrite()?`<button class="x" onclick="rcDeleteFromModal('${d.id}')" title="Xóa">✕</button>`:''}</span></div>`).join('')||'<div class="empty">Không có phép so sánh phù hợp.</div>';
  openModal(`<div class="modal"><div class="modal-h"><h3>Chọn phép so sánh</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b"><input id="rcModalSearch" placeholder="Tìm phép so sánh..." value="${escAttr(rcModalQ)}" oninput="rcModalSearchSet(this.value)">
      <div style="margin-top:10px">${rows}</div></div>
    <div class="modal-f"><button class="btn ghost" onclick="closeModal()">Đóng</button></div></div>`);
  setTimeout(()=>{const e=document.getElementById('rcModalSearch');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length);}},0);
}
function rcPick(id){rcId=id;closeModal();rerender();}
function rcDeleteFromModal(id){rcDelete(id,true);}
function openRcCreateModal(){rcCreateModalQ='';renderRcCreateModal();}
function rcCreateSearchSet(v){
  rcCreateModalQ=v;
  scheduleSearchRender(rcCreateSearchSet,renderRcCreateModal,'rcCreateSearch');
}
function renderRcCreateModal(){
  const q=rcCreateModalQ.trim(),ql=searchText(q);
  const cats={};REFTESTS.forEach(r=>{if(ql&&![r[0],r[1],r[4],teaAnalyteDisplay(r[0])].some(v=>searchText(v).includes(ql)))return;(cats[r[4]]=cats[r[4]]||[]).push(r);});
  let refs='';Object.keys(cats).forEach(cat=>{refs+=`<div class="refcat">${esc(cat)}</div>`;cats[cat].forEach(r=>{refs+=`<button class="refrow" onclick="rcCreateFrom('${jsq(r[0])}','${jsq(r[1]||'')}')">${esc(teaAnalyteDisplay(r[0]))}</button>`;});});
  const createTyped=q?`<button class="refrow" onclick="rcCreateFrom('${jsq(q)}','')">+ Tạo "${esc(q)}"</button>`:'<button class="refrow" onclick="rcCreateFrom(\'Hóa chất mới\',\'\')">+ Tạo hóa chất trống</button>';
  openModal(`<div class="modal"><div class="modal-h"><h3>Thêm hóa chất</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b"><input id="rcCreateSearch" placeholder="Tìm xét nghiệm hoặc gõ tên hóa chất mới..." value="${escAttr(rcCreateModalQ)}" oninput="rcCreateSearchSet(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();rcCreateFrom(this.value,'')}">
      <div style="margin-top:10px">${createTyped}</div>
      <div class="refcat">Danh mục chuẩn</div>${refs||'<div class="empty" style="padding:18px">Không tìm thấy trong danh mục chuẩn.</div>'}</div>
    <div class="modal-f"><button class="btn ghost" onclick="closeModal()">Đóng</button></div></div>`);
  setTimeout(()=>{const e=document.getElementById('rcCreateSearch');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length);}},0);
}
function rcCreateFrom(name,unit){if(!requireWrite())return;const d=rcBlank();d.test.reagent=QCCore.cleanText(name||'Hóa chất mới').trim()||'Hóa chất mới';if(unit)d.test.unit=QCCore.cleanText(unit);state.reagentTests.push(d);rcId=d.id;save({clearDerived:false});closeModal();rerender();}
function rcFmt(x,k=4){return isFinite(x)?Number(x.toFixed(k)).toString():'—';}
function rcFmtT(x){return isFinite(x)?Number(x.toFixed(4)).toString():(x>0?'+∞':'−∞');}
function rcDateText(v){return v?esc(vnDate(v)):formatDateTimeVN(new Date().toISOString()).split(' ').slice(1).join(' ');}
function rcReportVerdict(R){
  if(!R)return{text:'Thiếu dữ liệu',cls:'mid',bg:RCC.midBg,fg:RCC.midFg};
  if(R.level==='ok')return{text:'Đạt sàng lọc',cls:'ok',bg:RCC.okBg,fg:RCC.okFg};
  if(R.level==='mid')return{text:'Chưa đủ điều kiện',cls:'mid',bg:RCC.midBg,fg:RCC.midFg};
  return{text:'Có khác biệt',cls:'no',bg:RCC.noBg,fg:RCC.noFg};
}
function rcReportPill(R){
  const v=rcReportVerdict(R);
  return `<span style="display:inline-block;border-radius:999px;padding:3px 9px;font-weight:800;font-size:10.5px;background:${v.bg};color:${v.fg}">${esc(v.text)}</span>`;
}
function rcReportHeader(title,sub){
  return reportHeader(title)+`<div style="color:${RCC.muted};font-size:12px;margin:-8px 0 14px;text-align:center">${esc(sub||'')}</div>`;
}
function rcReportSummaryTable(items){
  let h='<table><thead><tr><th>STT</th><th>Hóa chất</th><th>Lô cũ → Lô mới</th><th class="num">n</th><th class="num">r</th><th class="num">%Bias</th><th class="num">P hai phía</th><th>Kết luận</th></tr></thead><tbody>';
  items.forEach((it,i)=>{const t=it.ds.test,R=it.R;h+=`<tr><td class="num">${i+1}</td><td><b>${esc(t.reagent||'Hóa chất mới')}</b>${t.unit?' <span style="color:${RCC.muted}">('+esc(t.unit)+')</span>':''}</td><td>${esc(t.lotOld||'?')} → ${esc(t.lotNew||'?')}</td><td class="num">${R?R.N:'—'}</td><td class="num">${R?rcFmt(R.r,4):'—'}</td><td class="num">${R?rcFmt(R.bias,2)+'%':'—'}</td><td class="num">${R?rcFmt(R.p2,4):'—'}</td><td>${rcReportPill(R)}</td></tr>`;});
  return h+'</tbody></table>';
}
function rcReportDetail(ds,i=0,pagebreak=false){
  const R=rcCalc(ds),t=ds.test;
  let h=`<div class="rpt-card" style="${pagebreak?'break-before:page;':''}"><h3>${i+1}. ${esc(t.reagent||'Hóa chất mới')} ${rcReportPill(R)}</h3><div class="body">`;
  h+=`<div style="font-size:12px;color:${RCC.muted};margin-bottom:10px">Lô cũ: <b>${esc(t.lotOld||'—')}</b> · Lô mới: <b>${esc(t.lotNew||'—')}</b> · Ngày: ${rcDateText(t.date)} · Người thực hiện: ${esc(t.operator||'—')} · Loại mẫu: ${esc(t.sampleType||'—')} · Giới hạn chênh lệch &lt; ${esc(t.biasTarget||6)}% · α = ${esc(t.alpha||0.05)}</div>`;
  if(!R){h+=`<p><i>Chưa đủ dữ liệu (cần tối thiểu ${RC_MIN_PAIRS} cặp).</i></p></div></div>`;return h;}
  h+='<table><thead><tr><th>Mẫu</th><th class="num">Lô cũ</th><th class="num">Lô mới</th><th class="num">Trung bình</th><th class="num">Hiệu số</th></tr></thead><tbody>';
  R.o.forEach((o,k)=>{const n=R.n[k];h+=`<tr><td>${k+1}</td><td class="num">${o}</td><td class="num">${n}</td><td class="num">${((o+n)/2).toFixed(3)}</td><td class="num">${(o-n).toFixed(3)}</td></tr>`;});
  h+='</tbody></table>';
  h+=`<div style="display:flex;flex-wrap:wrap;gap:6px 24px;font-size:12px;margin:10px 0 12px">
    <span>Trung bình: <b>${rcFmt(R.mO,2)} / ${rcFmt(R.mN,2)}</b></span>
    <span>Pearson r: <b>${rcFmt(R.r,5)}</b></span>
    <span>t Stat: <b>${rcFmtT(R.tStat)}</b> (df ${R.df})</span>
    <span>P hai phía: <b>${rcFmt(R.p2,5)}</b></span>
    <span>%Bias: <b>${rcFmt(R.bias,3)}%</b></span>
    <span>OLS: <b>y=${rcFmt(R.fit.b,3)}x${R.fit.a>=0?'+':'−'}${rcFmt(Math.abs(R.fit.a),3)}</b>, R²=${rcFmt(R.fit.r2,4)}</span>
    <span>Passing-Bablok: <b>y=${rcFmt(R.pb.b,3)}x${R.pb.a>=0?'+':'−'}${rcFmt(Math.abs(R.pb.a),3)}</b></span>
  </div>`;
  const note=R.level==='ok'?'Không khác biệt có ý nghĩa theo tiêu chí sàng lọc phần mềm; trình phê duyệt theo SOP trước khi dùng lô mới.':R.level==='mid'?'Chưa đủ điều kiện sàng lọc phần mềm; cần bổ sung dữ liệu/xác nhận bao phủ hoặc ghi nhận ngoại lệ theo SOP.':'Có khác biệt vượt giới hạn; không dùng lô mới trước khi điều tra và xử lý.';
  h+=`<p><b>Kết luận:</b> ${esc(note)}</p><p style="color:${RCC.muted}"><i>P-value, R² và slope là thông tin mô tả; không dùng riêng các chỉ số này để tự chấp nhận lô mới.</i></p>`;
  h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${rcScatterSVG(R,t)}${rcBlandSVG(R)}</div>`;
  h+='</div></div>';
  return h;
}
function rcReportItems(){return(state.reagentTests||[]).map(ds=>({ds,R:rcCalc(ds)}));}
async function rcPrintSummary(){
  const items=rcReportItems();
  if(!items.length){await infoDialog('Chưa có phép so sánh hóa chất.');return;}
  const valid=items.filter(x=>x.R).length;
  let body=rcReportHeader('BÁO CÁO SO SÁNH 2 LÔ HÓA CHẤT',`Tổng hợp ${items.length} hóa chất · ${valid} phép đủ dữ liệu · Ngày xuất: ${formatDateTimeVN(new Date().toISOString())}`);
  body+=rcReportSummaryTable(items);
  items.forEach((it,i)=>body+=rcReportDetail(it.ds,i,i>0));
  body+=signBlock();
  await openPrint('Báo cáo so sánh hóa chất tổng hợp',body);
}
async function rcPrint(){const ds=rcAct(),R=rcCalc(ds);if(!R){await infoDialog(`Chưa đủ dữ liệu (tối thiểu ${RC_MIN_PAIRS} cặp).`);return;}
  let body=rcReportHeader('BÁO CÁO SO SÁNH 2 LÔ HÓA CHẤT','Tổng hợp 1 hóa chất · Ngày xuất: '+formatDateTimeVN(new Date().toISOString()));
  body+=rcReportSummaryTable([{ds,R}]);
  body+=rcReportDetail(ds,0,false);
  body+=signBlock();
  await openPrint('So sánh lô — '+(ds.test.reagent||''),body);
}
