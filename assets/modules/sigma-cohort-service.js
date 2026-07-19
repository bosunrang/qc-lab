/* ===== SIGMA COHORT SERVICE ===== */
(function(root){
  function normalizePeriod(value){
    const m=/^(\d{4})-(\d{1,2})$/.exec(String(value||'').trim());
    if(!m)return'';
    const month=Number(m[2]);
    return month>=1&&month<=12?m[1]+'-'+String(month).padStart(2,'0'):'';
  }

  function normalizeDate(value){
    const s=String(value||'').trim(),m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if(!m)return'';
    const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
    return d.getUTCFullYear()===+m[1]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[3]?s:'';
  }

  function pointRunNo(point){
    const m=/(?:^|-)(\d+)$/.exec(String(point&&point.runId||''));
    return m?Number(m[1]):1;
  }

  function pointOrder(a,b){
    return String(a.point.date||'').localeCompare(String(b.point.date||''))||pointRunNo(a.point)-pointRunNo(b.point)||a.index-b.index;
  }

  function uniqueFinite(points,key,positive=false){
    const values=[];
    points.forEach(p=>{const raw=p&&p[key];if(raw==null||String(raw).trim()==='')return;const n=Number(raw);if(Number.isFinite(n)&&(!positive||n>0)&&!values.some(v=>Object.is(v,n)))values.push(n);});
    return values;
  }

  function buildGroup(testId,level,period,lot,rows){
    const excluded={voided:0,invalidValue:0},eligible=[];
    rows.forEach(row=>{
      const p=row.point||{};
      if(p.voided){excluded.voided++;return;}
      const raw=p.val;if(raw==null||String(raw).trim()===''){excluded.invalidValue++;return;}const value=Number(raw);
      if(!Number.isFinite(value)){excluded.invalidValue++;return;}
      eligible.push({...row,value});
    });
    eligible.sort(pointOrder);
    const points=eligible.map(row=>row.point),values=eligible.map(row=>row.value),stats=QCCore.stats(values),targetMeans=uniqueFinite(points,'qcMean'),targetSds=uniqueFinite(points,'qcSd',true),issues=[];
    if(!lot)issues.push('missing-lot');
    if(targetMeans.length>1)issues.push('mixed-target-mean');
    if(targetSds.length>1)issues.push('mixed-target-sd');
    return{testId,level,period,lot,points,values,stats,n:values.length,start:points[0]&&points[0].date||'',end:points[points.length-1]&&points[points.length-1].date||'',targetMean:targetMeans.length===1?targetMeans[0]:null,targetSd:targetSds.length===1?targetSds[0]:null,targetMeans,targetSds,excluded,issues};
  }

  function assess(cohort,{minimum=20,recommended=30}={}){
    minimum=Math.max(2,Math.floor(Number(minimum)||20));recommended=Math.max(minimum,Math.floor(Number(recommended)||30));
    const n=Number(cohort&&cohort.n)||0,issues=Array.isArray(cohort&&cohort.issues)?cohort.issues:[];
    if(issues.includes('missing-lot')||issues.includes('mixed-target-mean')||issues.includes('mixed-target-sd'))return{status:'unstable',classifiable:false,qcpEligible:false,minimum,recommended};
    if(n<minimum)return{status:'insufficient',classifiable:false,qcpEligible:false,minimum,recommended};
    if(n<recommended)return{status:'provisional',classifiable:true,qcpEligible:false,minimum,recommended};
    return{status:'eligible',classifiable:true,qcpEligible:true,minimum,recommended};
  }

  /* Cohort Sigma theo vòng đời lô QC, không bị cắt ở ranh giới tháng. startDate/endDate
     là thời điểm chụp dữ liệu của lần đánh giá; các lô vẫn luôn được tách riêng. */
  function cohortsForLevelByLot(state,{testId,level,startDate='',endDate=''}={}){
    const numericLevel=Number(level),start=startDate?normalizeDate(startDate):'',end=endDate?normalizeDate(endDate):'';
    if(!state||!testId||!Number.isFinite(numericLevel)||(startDate&&!start)||(endDate&&!end)||start&&end&&start>end)return[];
    const groups=new Map();
    ((state.data&&state.data[testId])||[]).forEach((point,index)=>{
      const date=String(point&&point.date||'');
      if(Number(point&&point.level)!==numericLevel||!normalizeDate(date)||start&&date<start||end&&date>end)return;
      const lot=String(point&&point.lot||'').trim();
      if(!groups.has(lot))groups.set(lot,[]);
      groups.get(lot).push({point,index});
    });
    return[...groups.entries()].map(([lot,rows])=>buildGroup(testId,numericLevel,'',lot,rows)).sort((a,b)=>String(a.start).localeCompare(String(b.start))||String(a.lot).localeCompare(String(b.lot),'vi',{numeric:true}));
  }

  root.SigmaCohortService={normalizePeriod,normalizeDate,cohortsForLevelByLot,assess};
})(typeof globalThis!=='undefined'?globalThis:this);
