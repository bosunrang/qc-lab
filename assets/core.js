(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.QCCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const TEXT_LIMIT=500;
  const LONG_TEXT_LIMIT=5000;
  const STATE_SCHEMA_VERSION=4;
  const ID_RE=/^[A-Za-z0-9_-]{1,80}$/;
  const ROLE_SET=new Set(['admin','technician','viewer']);
  const PAGE_SET=new Set(['dash','entry','westgard','sigma','reagent','actions','report','manage','users','audit','settings']);
  const WG_RULES=['1-2s','1-3s','2-2s','R4s','3-1s','4-1s','6x','8x','9x','10x','12x','7T','2of3-2s'];
  /* 1_3s/2_2s/R_4s/4_1s/10x là bộ multirule kinh điển Westgard (1981) cho QC
     2 mức; 1-2s đi kèm chỉ để cảnh báo sàng lọc (không tự loại bỏ — xem
     westgard() bên dưới), không phải một trong 5 rule loại bỏ cốt lõi. */
  const WG_DEFAULT_ON=new Set(['1-2s','1-3s','2-2s','R4s','4-1s','6x','10x']);

  /* Họ rule "N điểm liên tiếp cùng phía" dùng chung cho westgard() (chuỗi thời
     gian 1 mức) và westgardMulti() (chuỗi level×run): [tên,N,vị-từ dương,vị-từ
     âm] trên z. 2-2s = "2 điểm z>2 HOẶC 2 điểm z<-2"; multi KHÔNG dùng bản 2-2s
     này (nó xét 2-2s chéo level trong cùng run), nên lọc bỏ khi gọi từ multi. */
  /** @type {[string,number,(z:number)=>boolean,(z:number)=>boolean][]} */
  const WG_RUN_RULES=[['2-2s',2,z=>z>2,z=>z<-2],['3-1s',3,z=>z>1,z=>z<-1],['4-1s',4,z=>z>1,z=>z<-1],['6x',6,z=>z>0,z=>z<0],['8x',8,z=>z>0,z=>z<0],['9x',9,z=>z>0,z=>z<0],['10x',10,z=>z>0,z=>z<0],['12x',12,z=>z>0,z=>z<0]];
  /* Quét zs[]: mỗi rule bật, mọi cửa sổ N liên tiếp mà TẤT CẢ thỏa pos (hoặc tất
     cả thỏa neg) → onHit(mảngChỉSố,tên). Không biết phần tử là điểm hay item —
     caller tự map chỉ số về dữ liệu của mình. */
  function wgScanRuns(zs,rules,isOn,onHit){
    rules.forEach(([rule,n,pos,neg])=>{if(!isOn(rule))return;
      let posRun=0,negRun=0;
      for(let i=0;i<zs.length;i++){
        posRun=pos(zs[i])?posRun+1:0;negRun=neg(zs[i])?negRun+1:0;
        const run=Math.max(posRun,negRun);
        if(run===n){const w=[];for(let k=i-n+1;k<=i;k++)w.push(k);onHit(w,rule);}
        else if(run>n)onHit([i],rule);
      }
    });
  }

  function cleanText(value,max=TEXT_LIMIT){
    if(value==null||value==='')return'';
    const text=String(value);
    if(text.length<=max&&!/[\u0000-\u0008\u000B\u000C\u000D\u000E-\u001F\u007F<>]/.test(text))return text;
    return text
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'')
      .replace(/\r\n?/g,'\n')
      .replace(/</g,'‹')
      .replace(/>/g,'›')
      .slice(0,max);
  }
  function cleanId(value){
    const id=cleanText(value,80).trim();
    return ID_RE.test(id)?id:'';
  }
  function finiteNumber(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }
  function numericCell(value){
    if(value==null||String(value).trim()==='')return'';
    const n=Number(value);
    return Number.isFinite(n)?n:'';
  }
  function cleanDate(value){
    const s=cleanText(value,10);
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if(!m)return'';
    const y=+m[1],mo=+m[2],d=+m[3],leap=y%4===0&&(y%100!==0||y%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
    return y>=1000&&mo>=1&&mo<=12&&d>=1&&d<=days[mo-1]?s:'';
  }
  function cleanPeriod(value){
    const s=cleanText(value,7),m=/^(\d{4})-(\d{2})$/.exec(s);
    if(!m)return'';
    const mo=+m[2];
    return +m[1]>=1000&&mo>=1&&mo<=12?s:'';
  }
  function cleanRole(value){
    return ROLE_SET.has(value)?value:'viewer';
  }
  function cleanSigmaRounds(rows){
    return (Array.isArray(rows)?rows:[]).slice(0,200).map(r=>({lab:numericCell(r&&r.lab),target:numericCell(r&&r.target)})).filter(r=>r.lab!==''&&r.target!==''&&r.target!==0);
  }
  function cleanSigmaLevel(raw){
    raw=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    const out={};
    const cv=numericCell(raw.cv),biasEqa=numericCell(raw.biasEqa),legacyBias=numericCell(raw.bias);if(cv!=='')out.cv=cv;if(biasEqa!=='')out.biasEqa=biasEqa;else if(legacyBias!=='')out.biasEqa=legacyBias;
    if(['manual','rms'].includes(raw.biasEqaMethod))out.biasEqaMethod=raw.biasEqaMethod;
    /* 'iqc-period' là tàn dư của bản gom CV theo tháng (đã bỏ cùng cohortsForLevel).
       Code hiện tại chỉ còn sinh 'manual' hoặc 'iqc-cohort' — giữ ở đây CHỈ để dữ
       liệu cũ đã lưu không bị mất cvSource, không phải một đường auto-CV đang sống. */
    if(['manual','iqc-period','iqc-cohort'].includes(raw.cvSource))out.cvSource=raw.cvSource;
    const n=Number(raw.n);if(Number.isFinite(n)&&n>=0)out.n=Math.floor(n);
    if(['insufficient','provisional','eligible','unstable'].includes(raw.cohortStatus))out.cohortStatus=raw.cohortStatus;
    const cohortIssues=Array.isArray(raw.cohortIssues)?raw.cohortIssues.filter(x=>['missing-lot','mixed-target-mean','mixed-target-sd'].includes(x)).slice(0,10):[];
    if(cohortIssues.length)out.cohortIssues=[...new Set(cohortIssues)];
    ['sourceExcludedVoided','sourceExcludedInvalid'].forEach(k=>{const v=Number(raw[k]);if(Number.isFinite(v)&&v>=0)out[k]=Math.floor(v);});
    const sourceTargetMean=numericCell(raw.sourceTargetMean),sourceTargetSd=numericCell(raw.sourceTargetSd);if(sourceTargetMean!=='')out.sourceTargetMean=sourceTargetMean;if(sourceTargetSd!==''&&sourceTargetSd>0)out.sourceTargetSd=sourceTargetSd;
    ['tea','teaTarget','teaCriterionPercent','teaCriterionAbsolute'].forEach(k=>{const v=numericCell(raw[k]);if(v!==''&&(k==='teaTarget'||v>0))out[k]=v;});
    if(['percent','absolute','greater-of'].includes(raw.teaCriterionRule))out.teaCriterionRule=raw.teaCriterionRule;
    const teaCriterionUnit=cleanText(raw.teaCriterionUnit,40);if(teaCriterionUnit)out.teaCriterionUnit=teaCriterionUnit;
    const sourceStart=cleanDate(raw.sourceStart),sourceEnd=cleanDate(raw.sourceEnd);
    if(sourceStart)out.sourceStart=sourceStart;if(sourceEnd)out.sourceEnd=sourceEnd;
    const sourceLot=cleanText(raw.sourceLot,120);if(sourceLot)out.sourceLot=sourceLot;
    const eqaRounds=cleanSigmaRounds(raw.eqaRounds);
    if(eqaRounds.length)out.eqaRounds=eqaRounds;
    const eqaBatchId=cleanId(raw.eqaBatchId);if(eqaBatchId)out.eqaBatchId=eqaBatchId;
    return out;
  }

  function stats(values){
    const vals=(values||[]).map(Number).filter(Number.isFinite),n=vals.length;
    if(!n)return null;
    const m=vals.reduce((a,b)=>a+b,0)/n;
    const sd=n>1?Math.sqrt(vals.reduce((a,b)=>a+(b-m)**2,0)/(n-1)):0;
    return{n,m,sd,cv:m?sd/Math.abs(m)*100:0};
  }

  /** @param {(rule:string)=>boolean} [isOn] */
  function westgard(points,mean,sd,isOn=()=>true){
    mean=Number(mean);sd=Number(sd);
    if(!Number.isFinite(mean)||!Number.isFinite(sd)||sd<=0)return{F:(points||[]).map(()=>({level:'ok',rules:[],supportRules:[]})),zs:(points||[]).map(()=>NaN)};
    const zs=(points||[]).map(p=>(Number(p.val)-mean)/sd);
    const F=zs.map(()=>({level:'ok',rules:[],supportRules:[]})),ord={ok:0,warn:1,rej:2};
    const set=(i,l,r)=>{if(i<0||i>=F.length)return;if(!F[i].rules.includes(r))F[i].rules.push(r);if(ord[l]>ord[F[i].level])F[i].level=l;};
    const support=(i,r)=>{if(i<0||i>=F.length||F[i].rules.includes(r))return;if(!F[i].supportRules.includes(r))F[i].supportRules.push(r);};
    for(let i=0;i<zs.length;i++){
      const a=Math.abs(zs[i]);
      if(isOn('1-3s')&&a>3)set(i,'rej','1-3s');else if(isOn('1-2s')&&a>2)set(i,'warn','1-2s');
      if(isOn('2of3-2s')&&i>=2){
        // Điểm hiện tại (i) BẮT BUỘC phải tự vượt ±2SD — nếu chỉ 2 điểm CŨ trong cửa sổ
        // từng vi phạm còn i thì bình thường, không được reject "dội" theo cửa sổ trôi.
        const pos=[],neg=[];for(let k=i-2;k<i;k++){if(zs[k]>2)pos.push(k);if(zs[k]<-2)neg.push(k);}
        if(zs[i]>2&&pos.length>=1){set(i,'rej','2of3-2s');pos.forEach(k=>support(k,'2of3-2s'));}
        if(zs[i]<-2&&neg.length>=1){set(i,'rej','2of3-2s');neg.forEach(k=>support(k,'2of3-2s'));}
      }
      /* 7T = 7 điểm QC liên tiếp tăng/giảm, tương ứng 6 bước chuyển. Quét trên z để cùng
         hệ quy chiếu với biểu đồ LJ, nhưng không được nối chuỗi qua hai target:
         westgardByPoint gắn trendTarget theo snapshot Mean/SD của từng điểm.
         z=NaN (thiếu target), plateau hoặc đổi target đều cắt đứt xu hướng. */
      if(isOn('7T')&&i>=6&&sameTrendTarget(points,i-6,i)){let inc=true,dec=true;for(let k=i-5;k<=i;k++){if(!(zs[k]>zs[k-1]))inc=false;if(!(zs[k]<zs[k-1]))dec=false;}if(inc||dec){set(i,'warn','7T');for(let k=i-6;k<i;k++)support(k,'7T');}}
    }
    // 2-2s/3-1s/4-1s/6x..12x: quét "N liên tiếp cùng phía" dùng chung với multi
    wgScanRuns(zs,WG_RUN_RULES,isOn,(idx,rule)=>{const trigger=idx[idx.length-1];set(trigger,'rej',rule);idx.slice(0,-1).forEach(k=>support(k,rule));});
    return{F,zs};
  }

  /** @param {(rule:string)=>boolean} [isOn] */
  function westgardMulti(levelSets,isOn=()=>true){
    /** @type {any} */
    const flags=new Map(),supportFlags=new Map(),runs={};
    (levelSets||[]).forEach(s=>(s.pts||[]).forEach(p=>{
      if(!Number.isFinite(+s.sd)||+s.sd<=0)return;
      const run=cleanText(p.runId||p.date,120),item={p,z:(Number(p.val)-Number(s.mean))/Number(s.sd),level:s.level,run};
      (runs[run]=runs[run]||[]).push(item);
    }));
    const add=(items,rule)=>items.forEach(o=>{const a=flags.get(o.p)||[];if(!a.includes(rule))a.push(rule);flags.set(o.p,a);});
    const addEvidence=(items,rule,triggerRun)=>items.forEach(o=>{const target=o.run===triggerRun?flags:supportFlags,a=target.get(o.p)||[];if(!a.includes(rule))a.push(rule);target.set(o.p,a);});
    const runOrder=Object.keys(runs).sort((a,b)=>String(a).localeCompare(String(b),'vi',{numeric:true}));
    Object.values(runs).forEach(runItems=>{
      const items=[...new Map(runItems.map(o=>[o.level,o])).values()];if(items.length<2)return;
      const pos2=items.filter(o=>o.z>2),neg2=items.filter(o=>o.z<-2);
      if(isOn('R4s')){let lo=items[0],hi=items[0];items.forEach(o=>{if(o.z<lo.z)lo=o;if(o.z>hi.z)hi=o;});if(hi.z>2&&lo.z<-2&&hi.z-lo.z>4)add([lo,hi],'R4s');}
      if(isOn('2-2s')){if(pos2.length>=2)add(pos2,'2-2s');if(neg2.length>=2)add(neg2,'2-2s');}
      if(items.length>=3){
        if(isOn('2of3-2s')){if(pos2.length>=2)add(pos2,'2of3-2s');if(neg2.length>=2)add(neg2,'2of3-2s');}
        if(isOn('3-1s')){const pos1=items.filter(o=>o.z>1),neg1=items.filter(o=>o.z<-1);if(pos1.length>=3)add(pos1,'3-1s');if(neg1.length>=3)add(neg1,'3-1s');}
      }
    });
    const seq=runOrder.flatMap(run=>[...new Map(runs[run].map(o=>[o.level,o])).values()].sort((a,b)=>Number(a.level)-Number(b.level)));
    // 3-1s/4-1s/6x..12x: "N liên tiếp cùng phía" qua chuỗi level×run; loại 2-2s
    // vì multi đã xử lý 2-2s chéo level trong run (khối per-run ở trên)
    wgScanRuns(seq.map(o=>o.z),WG_RUN_RULES.filter(r=>r[0]!=='2-2s'),isOn,(idx,rule)=>{const items=idx.map(k=>seq[k]);addEvidence(items,rule,items[items.length-1].run);});
    flags.support=supportFlags;
    return flags;
  }

  function pointTarget(point,fallbackMean,fallbackSd){
    const savedMean=Number(point&&point.qcMean),savedSd=Number(point&&point.qcSd);
    const hasSnapshot=Number.isFinite(savedMean)&&Number.isFinite(savedSd)&&savedSd>0;
    const mean=hasSnapshot?savedMean:Number(fallbackMean);
    const sd=hasSnapshot?savedSd:Number(fallbackSd);
    const key=Number.isFinite(mean)&&Number.isFinite(sd)&&sd>0?mean+'\u0000'+sd:'';
    return{mean,sd,key,z:key?(Number(point&&point.val)-mean)/sd:NaN};
  }
  function pointZ(point,fallbackMean,fallbackSd){
    return pointTarget(point,fallbackMean,fallbackSd).z;
  }
  function sameTrendTarget(points,start,end){
    const first=points&&points[start]&&points[start].trendTarget;
    for(let i=start+1;i<=end;i++)if((points[i]&&points[i].trendTarget)!==first)return false;
    return true;
  }

  /** @param {(rule:string)=>boolean} [isOn] */
  function westgardByPoint(points,mean,sd,isOn=()=>true){
    const normalized=(points||[]).map(p=>{const target=pointTarget(p,mean,sd);return{val:target.z,trendTarget:target.key};});
    return westgard(normalized,0,1,isOn);
  }

  /* Đánh giá riêng điểm cuối của một cửa sổ ngắn. Kết quả tương đương
     westgardByPoint(...).F.at(-1), nhưng không clone toàn bộ điểm, không tạo
     bảng verdict trung gian và không quét lại các cửa sổ không thể chứa điểm
     cuối. Dùng khi lần lượt chọn điểm QC được chấp nhận theo lần chạy. */
  /** @param {(rule:string)=>boolean} [isOn] */
  function westgardLatestRulesFromZ(values,isOn=()=>true,trendTargets=null){
    const source=values||[],start=Math.max(0,source.length-12),zs=source.slice(start),targets=Array.isArray(trendTargets)?trendTargets.slice(start):null;
    if(!zs.length)return[];
    const i=zs.length-1,z=zs[i],rules=[],add=rule=>{if(!rules.includes(rule))rules.push(rule);};
    const abs=Math.abs(z);
    if(isOn('1-3s')&&abs>3)add('1-3s');else if(isOn('1-2s')&&abs>2)add('1-2s');
    if(isOn('2of3-2s')&&i>=2){
      // z (điểm mới nhất) phải tự vượt ±2SD — cùng lý do như westgard() ở trên.
      const a=zs[i-2],b=zs[i-1];
      if(z>2&&(a>2||b>2))add('2of3-2s');else if(z<-2&&(a<-2||b<-2))add('2of3-2s');
    }
    if(isOn('7T')&&i>=6&&(!targets||targets.slice(i-6,i+1).every(key=>key===targets[i]))){
      let inc=true,dec=true;
      for(let k=i-5;k<=i;k++){if(!(zs[k]>zs[k-1]))inc=false;if(!(zs[k]<zs[k-1]))dec=false;}
      if(inc||dec)add('7T');
    }
    WG_RUN_RULES.forEach(([rule,n,pos,neg])=>{
      if(!isOn(rule)||zs.length<n)return;
      let allPos=true,allNeg=true;
      for(let k=zs.length-n;k<zs.length;k++){if(!pos(zs[k]))allPos=false;if(!neg(zs[k]))allNeg=false;}
      if(allPos||allNeg)add(rule);
    });
    return rules;
  }

  /** @param {(rule:string)=>boolean} [isOn] */
  function westgardLatestRules(points,mean,sd,isOn=()=>true){
    const rows=points||[],start=Math.max(0,rows.length-12),zs=[],targets=[];
    for(let i=start;i<rows.length;i++){const target=pointTarget(rows[i],mean,sd);zs.push(target.z);targets.push(target.key);}
    return westgardLatestRulesFromZ(zs,isOn,targets);
  }

  /** @param {(rule:string)=>boolean} [isOn] */
  function westgardMultiByPoint(levelSets,isOn=()=>true){
    const sourceByNormalized=new Map();
    const normalized=(levelSets||[]).map(s=>({
      ...s,mean:0,sd:1,pts:(s.pts||[]).map(p=>{
        const np={val:pointZ(p,s.mean,s.sd),runId:p.runId,date:p.date};
        sourceByNormalized.set(np,p);
        return np;
      })
    }));
    /** @type {any} */
    const raw=westgardMulti(normalized,isOn);
    /** @type {any} */
    const flags=new Map(),supportFlags=new Map();
    raw.forEach((rules,np)=>flags.set(sourceByNormalized.get(np),rules));
    if(raw.support)raw.support.forEach((rules,np)=>supportFlags.set(sourceByNormalized.get(np),rules));
    flags.support=supportFlags;
    return flags;
  }

  /* Tabular CUSUM (two-sided) trên chuỗi z-score đã chuẩn hóa qua pointZ — bắt
     drift/shift nhỏ kéo dài mà rule Westgard đơn điểm (1-3s...) khó thấy, vì
     CUSUM cộng dồn độ lệch qua nhiều điểm thay vì chỉ xét từng điểm riêng lẻ.
     k = biên độ lệch cho phép trước khi tích lũy (mặc định 0.5 SD, chuẩn ARL
     tốt cho phát hiện shift ~1 SD); h = ngưỡng cảnh báo (mặc định 4 SD). Điểm
     không tính được z (thiếu mean/sd) giữ nguyên tổng tích lũy thay vì reset,
     để không "xóa" một trục trôi đang hình thành chỉ vì một điểm hỏng xen giữa. */
  function cusum(points,mean,sd,k=0.5,h=4){
    mean=Number(mean);sd=Number(sd);
    k=Math.abs(Number(k));k=Number.isFinite(k)&&k>0?k:0.5;
    h=Math.abs(Number(h));h=Number.isFinite(h)&&h>0?h:4;
    let cPos=0,cNeg=0;
    const cPosArr=[],cNegArr=[],flags=[];
    (points||[]).forEach(p=>{
      const z=pointZ(p,mean,sd);
      if(!Number.isFinite(z)){cPosArr.push(cPos);cNegArr.push(cNeg);flags.push('ok');return;}
      cPos=Math.max(0,cPos+z-k);
      cNeg=Math.min(0,cNeg+z+k);
      cPosArr.push(cPos);cNegArr.push(cNeg);
      flags.push(cPos>=h||cNeg<=-h?'rej':'ok');
    });
    return{cPos:cPosArr,cNeg:cNegArr,flags,k,h};
  }

  /* Trung bình động của z-score (cửa sổ trượt, mặc định 5 điểm) — chỉ để vẽ
     đường xu hướng trực quan cạnh CUSUM, không có ngưỡng cảnh báo riêng.
     Cửa sổ đầu chuỗi ngắn hơn window vẫn tính trên số điểm đang có (không
     chờ đủ window mới bắt đầu vẽ). */
  function movingAverage(points,mean,sd,window=5){
    window=Math.max(1,Math.round(Number(window))||5);
    const zs=(points||[]).map(p=>pointZ(p,mean,sd));
    return zs.map((_,i)=>{
      const w=zs.slice(Math.max(0,i-window+1),i+1).filter(Number.isFinite);
      return w.length?w.reduce((a,b)=>a+b,0)/w.length:NaN;
    });
  }

  function erf(x){
    const sign=x<0?-1:1;x=Math.abs(x);
    const a1=.254829592,a2=-.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=.3275911,t=1/(1+p*x);
    return sign*(1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x));
  }
  function normalCdf(z){return .5*(1+erf(z/Math.SQRT2));}
  function dpmoFromSigma(sigma){return Math.max(0,(1-normalCdf(Number(sigma)-1.5))*1e6);}
  function sigmaMetric(tea,bias,cv){
    tea=Number(tea);bias=Number(bias);cv=Number(cv);
    if(!Number.isFinite(tea)||tea<=0||!Number.isFinite(bias)||!Number.isFinite(cv)||cv<=0)return null;
    const sigma=(tea-Math.abs(bias))/cv,dpmo=dpmoFromSigma(sigma);
    return{tea,bias,cv,sigma,dpmo,yieldPercent:100-dpmo/1e4};
  }
  /* Westgard Sigma Rules — chọn THIẾT KẾ QC (bộ quy tắc + số điểm N mỗi lần chạy
     và số lần chạy R) theo Sigma đo được, cho QC 2 mức. Bảng kinh điển của
     Westgard: Sigma càng cao thì càng ít quy tắc / N nhỏ (giảm báo động giả);
     Sigma thấp cần đa quy tắc + N lớn. Ngưỡng chia theo bậc σ nguyên; các bản
     công bố có khác nhau đôi chút ở vùng 3–4σ nên nhãn 'marginal' được đánh dấu
     riêng. <3σ: phương pháp KHÔNG đủ năng lực — QC không bù được, phải khắc phục
     phương pháp, không có thiết kế QC nào hợp thức hóa được. N tính theo tổng số
     điểm QC mỗi lần chạy (2 mức → N=2 là 1 điểm/mức, N=4 là 2 điểm/mức, ...). */
  function westgardSigmaRules(sigma){
    sigma=Number(sigma);
    if(!Number.isFinite(sigma))return null;
    if(sigma>=6)return{tier:'≥6',rules:['1-3s'],n:2,r:1,capable:true,single:true,marginal:false};
    if(sigma>=5)return{tier:'5–6',rules:['1-3s','2-2s','R4s','4-1s'],n:4,r:1,capable:true,single:false,marginal:false};
    if(sigma>=4)return{tier:'4–5',rules:['1-3s','2-2s','R4s','4-1s','8x'],n:8,r:1,capable:true,single:false,marginal:false};
    if(sigma>=3)return{tier:'3–4',rules:['1-3s','2-2s','R4s','4-1s','6x'],n:8,r:1,capable:true,single:false,marginal:true};
    return{tier:'<3',rules:['1-3s','2-2s','R4s','4-1s','6x'],n:8,r:1,capable:false,single:false,marginal:false};
  }
  function targetFromLimits(low,high,k=2){
    if(low==null||high==null||String(low).trim()===''||String(high).trim()==='')return null;
    low=Number(low);high=Number(high);k=Number(k);
    if(!Number.isFinite(low)||!Number.isFinite(high)||high<=low||!Number.isFinite(k)||k<=0)return null;
    return{low,high,mean:(low+high)/2,sd:(high-low)/(2*k),k};
  }
  function limitsFromTarget(mean,sd,k=2){
    if(mean==null||sd==null||String(mean).trim()===''||String(sd).trim()==='')return null;
    mean=Number(mean);sd=Number(sd);k=Number(k);
    if(!Number.isFinite(mean)||!Number.isFinite(sd)||sd<=0||!Number.isFinite(k)||k<=0)return null;
    return{mean,sd,low:mean-k*sd,high:mean+k*sd,k};
  }

  function validateBackup(x){
    if(!x||typeof x!=='object'||Array.isArray(x))return['Dữ liệu gốc phải là object.'];
    /* Firebase RTDB LƯỢC BỎ mảng/đối tượng rỗng khi ghi (đọc về thành undefined). Vì vậy
       một nhánh VẮNG MẶT (null/undefined) phải được coi là "rỗng hợp lệ", chỉ báo lỗi khi
       nhánh CÓ mặt nhưng sai kiểu — nếu không, một phòng vừa xóa hết nhật ký (actions=[])
       hoặc chưa nhập QC (data={}) sẽ bị từ chối và chặn đồng bộ toàn hệ thống. */
    const errors=[],obj=(v,n)=>{if(v!=null&&(typeof v!=='object'||Array.isArray(v)))errors.push(n+' phải là object.');},arr=(v,n)=>{if(v!=null&&!Array.isArray(v))errors.push(n+' phải là mảng.');};
    const schema=Number(x.schemaVersion);
    if(Number.isFinite(schema)&&schema>STATE_SCHEMA_VERSION)errors.push(`schemaVersion ${schema} cao hơn phiên bản app hỗ trợ (${STATE_SCHEMA_VERSION}).`);
    obj(x.lab,'lab');arr(x.tests,'tests');obj(x.data,'data');arr(x.actions,'actions');arr(x.activity,'activity');arr(x.users,'users');
    if(x.machines!=null)arr(x.machines,'machines');if(x.instruments!=null)arr(x.instruments,'instruments');if(x.assayGroups!=null)arr(x.assayGroups,'assayGroups');if(x.qcPanels!=null)arr(x.qcPanels,'qcPanels');if(x.lotTransitions!=null)arr(x.lotTransitions,'lotTransitions');if(x.lotGroups!=null)arr(x.lotGroups,'lotGroups');if(x.qcLots!=null)arr(x.qcLots,'qcLots');if(x.reagentTests!=null)arr(x.reagentTests,'reagentTests');if(x.reagentOperators!=null)arr(x.reagentOperators,'reagentOperators');if(x.reagentSampleTypes!=null)arr(x.reagentSampleTypes,'reagentSampleTypes');if(x.sigmaData!=null)obj(x.sigmaData,'sigmaData');if(x.teaRefs!=null)arr(x.teaRefs,'teaRefs');
    (Array.isArray(x.tests)?x.tests:[]).forEach((t,i)=>{
      if(!t||typeof t!=='object'||!cleanId(t.id)||!cleanText(t.name).trim())errors.push(`tests[${i}] thiếu id hoặc tên hợp lệ.`);
      if(!Array.isArray(t&&t.levels)||!t.levels.length||t.levels.length>10)errors.push(`tests[${i}].levels không hợp lệ.`);
    });
    (Array.isArray(x.users)?x.users:[]).forEach((u,i)=>{if(!u||!cleanText(u.username,80).trim()||!ROLE_SET.has(u.role)||!cleanText(u.passHash,500).trim())errors.push(`users[${i}] không hợp lệ.`);});
    if(Array.isArray(x.tests)&&x.tests.length>5000)errors.push('Backup có quá nhiều xét nghiệm.');
    if(Array.isArray(x.users)&&x.users.length>1000)errors.push('Backup có quá nhiều người dùng.');
    return errors.slice(0,20);
  }

  function validateStateInvariants(x,opts={}){
    const sanitized=opts.sanitized===true;
    const errors=[],seen=(rows,label)=>{
      const ids=new Set();
      (Array.isArray(rows)?rows:[]).forEach((row,i)=>{
        const id=String(row&&row.id||'');
        if(!id)return;
        if(ids.has(id))errors.push(`${label}[${i}] trùng id ${id}.`);else ids.add(id);
      });
      return ids;
    };
    if(!x||typeof x!=='object'||Array.isArray(x))return['State không phải object.'];
    const testIds=seen(x.tests,'tests');
    seen(x.users,'users');
    seen(x.instruments,'instruments');
    seen(x.qcPanels,'qcPanels');
    seen(x.lotGroups,'lotGroups');
    seen(x.qcLots,'qcLots');
    seen(x.teaRefs,'teaRefs');
    const usernames=new Set();
    (Array.isArray(x.users)?x.users:[]).forEach((u,i)=>{
      const name=String(u&&u.username||'').trim().toLowerCase();
      if(name&&usernames.has(name))errors.push(`users[${i}] trùng tên đăng nhập ${name}.`);else if(name)usernames.add(name);
    });
    Object.entries(x.data&&typeof x.data==='object'?x.data:{}).forEach(([tid,rows])=>{
      if(!testIds.has(tid)){errors.push(`data.${tid} không tham chiếu xét nghiệm tồn tại.`);return;}
      const pointIds=new Set();
      (Array.isArray(rows)?rows:[]).forEach((p,i)=>{
        if(!p||typeof p!=='object'){errors.push(`data.${tid}[${i}] không phải object.`);return;}
        if(!(sanitized?String(p.id||''):cleanId(p.id)))errors.push(`data.${tid}[${i}] thiếu id điểm QC.`);
        else if(pointIds.has(p.id))errors.push(`data.${tid}[${i}] trùng id điểm QC ${p.id}.`);else pointIds.add(p.id);
        if(!(sanitized?String(p.date||''):cleanDate(p.date))||!Number.isFinite(Number(p.val)))errors.push(`data.${tid}[${i}] có ngày hoặc giá trị không hợp lệ.`);
        if(!String(p.runId||'').trim())errors.push(`data.${tid}[${i}] thiếu runId.`);
      });
    });
    const lockPeriods=new Set();
    (Array.isArray(x.periodLocks)?x.periodLocks:[]).forEach((lock,i)=>{
      const ym=cleanPeriod(lock&&lock.ym);
      if(!ym)return;
      if(lockPeriods.has(ym))errors.push(`periodLocks[${i}] trùng kỳ ${ym}.`);else lockPeriods.add(ym);
    });
    return errors.slice(0,20);
  }

  function sanitizeBackup(input,opts={}){
    /* JSON.parse/import vừa tạo object riêng nên loader có thể chuyển quyền sở hữu
       để tránh stringify+parse thêm một lần. Các caller thông thường vẫn nhận
       clone sâu như trước, giữ nguyên contract không mutate input. */
    const source=opts.owned&&input&&typeof input==='object'&&!Array.isArray(input)?input:JSON.parse(JSON.stringify(input));
    source.lab={
      name:cleanText(source.lab&&source.lab.name),
      dept:cleanText(source.lab&&source.lab.dept),
      address:cleanText(source.lab&&source.lab.address,LONG_TEXT_LIMIT),
      brandTitle:cleanText(source.lab&&source.lab.brandTitle,80),
      brandSub:cleanText(source.lab&&source.lab.brandSub,120),
      logoText:cleanText(source.lab&&source.lab.logoText,8).slice(0,4),
      logoData:cleanText(source.lab&&source.lab.logoData,120000)
    };
    source.machines=(source.machines||[]).slice(0,1000).map(v=>cleanText(v)).filter(Boolean);
    source.instruments=(source.instruments||[]).slice(0,1000).map(x=>({...x,id:cleanId(x.id),name:cleanText(x.name),manufacturer:cleanText(x.manufacturer),model:cleanText(x.model),serial:cleanText(x.serial),section:cleanText(x.section),active:x.active!==false})).filter(x=>x.id&&x.name);
    source.assayGroups=(source.assayGroups||[]).slice(0,2000).map(x=>({...x,id:cleanId(x.id),name:cleanText(x.name),testIds:(x.testIds||[]).slice(0,5000).map(cleanId).filter(Boolean),note:cleanText(x.note,LONG_TEXT_LIMIT),active:x.active!==false})).filter(x=>x.id&&x.name);
    source.qcPanels=(source.qcPanels||[]).slice(0,2000).map(x=>({...x,id:cleanId(x.id),name:cleanText(x.name),instrumentId:cleanId(x.instrumentId),testIds:(x.testIds||[]).slice(0,5000).map(cleanId).filter(Boolean),note:cleanText(x.note,LONG_TEXT_LIMIT),active:x.active!==false})).filter(x=>x.id&&x.name);
    source.lotTransitions=(source.lotTransitions||[]).slice(0,10000).map(x=>({...x,id:cleanId(x.id),panelId:cleanId(x.panelId),fromLotId:cleanId(x.fromLotId),toLotId:cleanId(x.toLotId),startDate:cleanDate(x.startDate),status:x.status==='completed'?'active':['planned','active','accepted','rejected'].includes(x.status)?x.status:'planned',criteria:cleanText(x.criteria,LONG_TEXT_LIMIT),conclusion:cleanText(x.conclusion,LONG_TEXT_LIMIT),approvedAt:cleanText(x.approvedAt,40),approvedBy:cleanText(x.approvedBy,120),note:cleanText(x.note,LONG_TEXT_LIMIT)})).filter(x=>x.id&&x.fromLotId&&x.toLotId);
    source.lotGroups=(source.lotGroups||[]).slice(0,2000).map(x=>({...x,id:cleanId(x.id),name:cleanText(x.name),lotIds:(x.lotIds||[]).slice(0,100).map(cleanId).filter(Boolean),manufacturer:cleanText(x.manufacturer),material:cleanText(x.material),catalog:cleanText(x.catalog),note:cleanText(x.note,LONG_TEXT_LIMIT),active:x.active!==false})).filter(x=>x.id&&x.name);
    source.qcLots=(source.qcLots||[]).slice(0,10000).map(x=>({...x,id:cleanId(x.id),groupId:cleanId(x.groupId),lotNo:cleanText(x.lotNo),level:finiteNumber(x.level,1),description:cleanText(x.description),supplier:cleanText(x.supplier),program:cleanText(x.program),exp:cleanDate(x.exp),opened:cleanDate(x.opened),active:x.active!==false,depleted:x.depleted===true,note:cleanText(x.note,LONG_TEXT_LIMIT)})).filter(x=>x.id&&x.lotNo);
    source.tests=(source.tests||[]).slice(0,5000).map(t=>({
      ...t,id:cleanId(t.id),analyteId:cleanId(t.analyteId),name:cleanText(t.name),displayName:cleanText(t.displayName,160),standardName:cleanText(t.standardName,160),abbreviation:cleanText(t.abbreviation,40),aliases:(Array.isArray(t.aliases)?t.aliases:[]).slice(0,30).map(v=>cleanText(v,120)).filter(Boolean),matrix:cleanText(t.matrix,80),unit:cleanText(t.unit),machine:cleanText(t.machine),instrumentId:cleanId(t.instrumentId),method:cleanText(t.method),reagent:cleanText(t.reagent),reagentSupplier:cleanText(t.reagentSupplier),temperature:finiteNumber(t.temperature,0),genNo:cleanText(t.genNo),performanceLimit:cleanText(t.performanceLimit),tea:finiteNumber(t.tea,0),teaSource:['eflm','clia','ricos'].includes(t.teaSource)?t.teaSource:'ricos',teaRef:cleanText(t.teaRef,240),teaDoc:cleanText(t.teaDoc,240),teaApprovedBy:cleanText(t.teaApprovedBy,120),teaApprovedDate:cleanDate(t.teaApprovedDate),teaEffectiveDate:cleanDate(t.teaEffectiveDate),teaNote:cleanText(t.teaNote,LONG_TEXT_LIMIT),eflmAnalyte:cleanText(t.eflmAnalyte,160),eflmAps:['minimum','desirable','optimum'].includes(t.eflmAps)?t.eflmAps:(t.teaSource==='eflm'?'desirable':''),eflmLookupDate:cleanDate(t.eflmLookupDate),eflmRef:cleanText(t.eflmRef,500),active:t.active!==false,closed:!!t.closed,
      ruleActions:Object.fromEntries(WG_RULES.map(r=>[r,['inactive','alert','reject'].includes(t.ruleActions&&t.ruleActions[r])?t.ruleActions[r]:''])),
      ruleScopes:Object.fromEntries(WG_RULES.map(r=>[r,['protocol','within','across','both'].includes(t.ruleScopes&&t.ruleScopes[r])?t.ruleScopes[r]:''])),
      cusum:{on:!!(t.cusum&&t.cusum.on),k:Number.isFinite(+(t.cusum&&t.cusum.k))&&+(t.cusum&&t.cusum.k)>0?+t.cusum.k:0.5,h:Number.isFinite(+(t.cusum&&t.cusum.h))&&+(t.cusum&&t.cusum.h)>0?+t.cusum.h:4},
      levels:(t.levels||[]).slice(0,10).map(l=>({...l,level:finiteNumber(l.level,1),qcLotId:cleanId(l.qcLotId),mean:finiteNumber(l.mean,0),sd:Math.max(0,finiteNumber(l.sd,0)),low:l.low==null?null:finiteNumber(l.low,0),high:l.high==null?null:finiteNumber(l.high,0),rangeK:finiteNumber(l.rangeK,2),lot:cleanText(l.lot),exp:cleanDate(l.exp),mfgMean:finiteNumber(l.mfgMean,l.mean),mfgSd:Math.max(0,finiteNumber(l.mfgSd,l.sd)),applied:l.applied==='lab'?'lab':'mfg',
        meanSdHistory:(l.meanSdHistory||[]).slice(-1000).map(h=>({id:cleanId(h.id),qcLotId:cleanId(h.qcLotId),lot:cleanText(h.lot),mean:finiteNumber(h.mean,0),sd:Math.max(0,finiteNumber(h.sd,0)),low:h.low==null?null:finiteNumber(h.low,0),high:h.high==null?null:finiteNumber(h.high,0),effectiveFrom:cleanDate(h.effectiveFrom),effectiveTo:cleanDate(h.effectiveTo),source:h.source==='lab'?'lab':'mfg',planned:!!h.planned,note:cleanText(h.note,LONG_TEXT_LIMIT)})).filter(h=>h.id&&h.sd>0)
      }))
    }));
    const ids=new Set(source.tests.map(t=>t.id));
    source.data=Object.fromEntries(Object.entries(source.data||{}).filter(([id,v])=>ids.has(id)&&Array.isArray(v)).map(([id,rows])=>[id,rows.slice(0,100000).map(p=>{
      if(!p||typeof p!=='object')return null;
      const val=Number(p.val),date=cleanDate(p.date);
      if(!Number.isFinite(val)||!date)return null; /* loại điểm hỏng (val không phải số / ngày sai) thay vì ép về 0 */
      const qm=Number(p.qcMean),qs=Number(p.qcSd),snap=Number.isFinite(qm)&&Number.isFinite(qs)&&qs>0; /* snapshot Mean/SD chỉ giữ khi trọn vẹn */
      return{...p,id:cleanId(p.id),date,runId:cleanText(p.runId,120),lot:cleanText(p.lot),level:finiteNumber(p.level,1),val,qcMean:snap?qm:0,qcSd:snap?qs:0,note:cleanText(p.note,LONG_TEXT_LIMIT),operatorId:cleanId(p.operatorId),operatorUsername:cleanText(p.operatorUsername,80).trim().toLowerCase(),operatorName:cleanText(p.operatorName,120),operatorCode:cleanText(p.operatorCode,12).toUpperCase(),voided:!!p.voided,voidReason:cleanText(p.voidReason,LONG_TEXT_LIMIT),voidedAt:cleanText(p.voidedAt,40),voidedBy:cleanText(p.voidedBy,120)};
    }).filter(Boolean)]));
    source.actions=(source.actions||[]).slice(-100000).map(a=>({...a,id:cleanId(a.id)||undefined,date:cleanDate(a.date),createdAt:cleanText(a.createdAt,40),createdByUserId:cleanId(a.createdByUserId),createdByUsername:cleanText(a.createdByUsername,80).trim().toLowerCase(),testId:cleanId(a.testId),level:finiteNumber(a.level,0),lot:cleanText(a.lot),pointId:cleanId(a.pointId),rule:cleanText(a.rule),errorType:cleanText(a.errorType),action:cleanText(a.action,LONG_TEXT_LIMIT),by:cleanText(a.by),approvalStatus:['pending','approved','returned'].includes(a.approvalStatus)?a.approvalStatus:'pending',approvedAt:cleanText(a.approvedAt,40),approvedBy:cleanText(a.approvedBy,120),approvalNote:cleanText(a.approvalNote,LONG_TEXT_LIMIT),autoCreated:!!a.autoCreated})).filter(a=>!a.autoCreated&&a.rule!=='Cập nhật Mean/SD');
    source.activity=(source.activity||[]).map(a=>{const row={...a,id:cleanId(a.id),seq:finiteNumber(a.seq,0),ts:cleanText(a.ts,40),user:cleanText(a.user),username:cleanText(a.username,80),userId:cleanId(a.userId),role:cleanRole(a.role),type:cleanText(a.type),detail:cleanText(a.detail,LONG_TEXT_LIMIT),target:cleanText(a.target),clientId:cleanText(a.clientId,80),prevHash:cleanText(a.prevHash,80),hash:cleanText(a.hash,80)};if(Array.isArray(a.mergePrevHashes))row.mergePrevHashes=[...new Set(a.mergePrevHashes.slice(0,32).map(x=>cleanText(x,80)).filter(Boolean))];else delete row.mergePrevHashes;return row;});
    source.users=(source.users||[]).slice(0,1000).map(u=>({...u,id:cleanId(u.id),username:cleanText(u.username,80).trim().toLowerCase(),name:cleanText(u.name),initials:cleanText(u.initials,12).toUpperCase(),externalCode:cleanText(u.externalCode,40),role:cleanRole(u.role),pagePerms:Array.isArray(u.pagePerms)?[...new Set(u.pagePerms.map(cleanId).filter(id=>PAGE_SET.has(id)))]:null,passHash:cleanText(u.passHash,500),active:u.active!==false,mustChangePassword:!!u.mustChangePassword}));
    source.reagentTests=(source.reagentTests||[]).slice(0,5000).map(d=>{const{reviewStatus:_rs,reviewedBy:_rb,reviewedAt:_ra,reviewNote:_rn,...tRest}=(d.test||{});return{...d,id:cleanId(d.id),test:{...tRest,reagent:cleanText(d.test&&d.test.reagent),lotOld:cleanText(d.test&&d.test.lotOld),lotNew:cleanText(d.test&&d.test.lotNew),date:cleanDate(d.test&&d.test.date),operator:cleanText(d.test&&d.test.operator),sampleType:cleanText(d.test&&d.test.sampleType),unit:cleanText(d.test&&d.test.unit),biasTarget:finiteNumber(d.test&&d.test.biasTarget,6),alpha:finiteNumber(d.test&&d.test.alpha,.05),coverageConfirmed:!!(d.test&&d.test.coverageConfirmed)},rows:(d.rows||[]).slice(0,10000).map(r=>[numericCell(r&&r[0]),numericCell(r&&r[1])])};});
    source.reagentOperators=(source.reagentOperators||[]).slice(0,1000).map(v=>cleanText(v,120)).filter(Boolean);
    source.reagentSampleTypes=(source.reagentSampleTypes||['Mẫu bệnh nhân','Mẫu nội kiểm (IQC)','Mẫu ngoại kiểm (EQA)']).slice(0,1000).map(v=>cleanText(v,120)).filter(Boolean);
    source.periodLocks=(source.periodLocks||[]).slice(-1000).map((x,i)=>({id:cleanId(x.id)||('lock_'+i),ym:cleanPeriod(x.ym),lockedAt:cleanText(x.lockedAt,40),lockedBy:cleanText(x.lockedBy,120),note:cleanText(x.note,LONG_TEXT_LIMIT)})).filter(x=>x.ym);
    source.teaRefs=(source.teaRefs||[]).slice(0,2000).map((x,i)=>{const num=v=>{const n=Number(v);return String(v==null?'':v).trim()!==''&&Number.isFinite(n)&&n>0?n:null;},rule=['percent','absolute','greater-of'].includes(x.cliaRule)?x.cliaRule:null,meta=v=>{v=v&&typeof v==='object'&&!Array.isArray(v)?v:{};const status=['reference','reviewed','retired','dynamic'].includes(v.status)?v.status:'reference',url=/^https:\/\//i.test(String(v.url||''))?cleanText(v.url,1000):'';return{id:cleanId(v.id),version:cleanText(v.version,120),document:cleanText(v.document,500),url,effectiveDate:cleanDate(v.effectiveDate),reviewedDate:cleanDate(v.reviewedDate),reviewedBy:cleanText(v.reviewedBy,120),status,note:cleanText(v.note,LONG_TEXT_LIMIT)};},out={id:cleanId(x.id)||('tref_'+i),analyteId:cleanId(x.analyteId),name:cleanText(x.name,120),displayName:cleanText(x.displayName,160),standardName:cleanText(x.standardName,160),abbreviation:cleanText(x.abbreviation,40),aliases:(Array.isArray(x.aliases)?x.aliases:[]).slice(0,30).map(v=>cleanText(v,120)).filter(Boolean),matrix:cleanText(x.matrix,80),unit:cleanText(x.unit,40),section:cleanText(x.section,80),clia:num(x.clia),ricos:num(x.ricos),sources:{clia:meta(x.sources&&x.sources.clia),ricos:meta(x.sources&&x.sources.ricos)}},absolute=num(x.cliaAbsolute),absoluteUnit=cleanText(x.cliaAbsoluteUnit,40);if(rule)out.cliaRule=rule;if(absolute!=null)out.cliaAbsolute=absolute;if(absoluteUnit)out.cliaAbsoluteUnit=absoluteUnit;return out;}).filter(x=>x.id&&x.name);
    source.teaRegistryVersion=Math.max(1,Math.floor(finiteNumber(source.teaRegistryVersion,1)));
    source.sigmaData=source.sigmaData&&typeof source.sigmaData==='object'&&!Array.isArray(source.sigmaData)?Object.fromEntries(Object.entries(source.sigmaData).filter(([id,v])=>ids.has(id)&&Array.isArray(v)).map(([id,rows])=>[id,rows.slice(-1000).map((e,i)=>{
      e=e&&typeof e==='object'&&!Array.isArray(e)?e:{};
      /* Firebase Realtime Database trả object có khóa số liên tiếp ("1", "2", ...)
         thành mảng thưa [null, level1, level2]. Chấp nhận cả hai dạng rồi chuẩn
         hóa lại về object khóa mức để dữ liệu Sigma không rơi mất sau reload. */
      const lvSource=e.lv&&typeof e.lv==='object'?e.lv:{};
      const lv=Object.fromEntries(Object.entries(lvSource).filter(([level])=>Number.isFinite(Number(level))&&Number(level)>0).slice(0,20).map(([level,raw])=>[String(Number(level)),cleanSigmaLevel(raw)]));
      const tea=Number(e.tea),teaSource=['eflm','clia','ricos'].includes(e.teaSource)?e.teaSource:'',teaLabel=cleanText(e.teaLabel,160),teaReference=cleanText(e.teaReference,500),teaCapturedAt=cleanText(e.teaCapturedAt,40),teaSourceId=cleanId(e.teaSourceId),teaSourceVersion=cleanText(e.teaSourceVersion,120),teaSourceUrl=/^https:\/\//i.test(String(e.teaSourceUrl||''))?cleanText(e.teaSourceUrl,1000):'',teaEffectiveDate=cleanDate(e.teaEffectiveDate),teaReviewedDate=cleanDate(e.teaReviewedDate),teaReviewedBy=cleanText(e.teaReviewedBy,120);
      return{id:cleanId(e.id)||('sg_'+i),period:cleanPeriod(e.period),...(Number.isFinite(tea)&&tea>0?{tea}:{}),...(teaSource?{teaSource}:{}),...(teaLabel?{teaLabel}:{}),...(teaReference?{teaReference}:{}),...(teaCapturedAt?{teaCapturedAt}:{}),...(teaSourceId?{teaSourceId}:{}),...(teaSourceVersion?{teaSourceVersion}:{}),...(teaSourceUrl?{teaSourceUrl}:{}),...(teaEffectiveDate?{teaEffectiveDate}:{}),...(teaReviewedDate?{teaReviewedDate}:{}),...(teaReviewedBy?{teaReviewedBy}:{}),lv};
    })])):{};
    source.westgardRules=Object.fromEntries(WG_RULES.map(r=>[r,source.westgardRules&&Object.prototype.hasOwnProperty.call(source.westgardRules,r)?source.westgardRules[r]!==false:WG_DEFAULT_ON.has(r)]));
    source.configMigrationVersion=Number.isFinite(+source.configMigrationVersion)?Math.max(0,+source.configMigrationVersion):0;
    return source;
  }

  /* ===== Phân loại sai số (thuần, không phụ thuộc state) — đặt ở core để
     unit-test được; qc-domain.js re-export lại các tên này cho phần UI. Hai
     danh sách SE/RE là NGUỒN DUY NHẤT, dùng chung cho errorType và fixHint. ===== */
  const WG_RE_RULES=['1-3s','R4s'];                                                    // sai số ngẫu nhiên
  const WG_SE_RULES=['2-2s','2of3-2s','3-1s','4-1s','6x','8x','9x','10x','12x','7T'];   // sai số hệ thống
  const WG_RULE_DESCRIPTIONS={
    '1-2s':'1 điểm QC vượt ±2SD',
    '1-3s':'1 điểm QC vượt ±3SD',
    '2-2s':'2 điểm liên tiếp hoặc 2 mức cùng lần chạy, cùng phía vượt ±2SD',
    'R4s':'Cùng lần chạy có 1 mức > +2SD và 1 mức < -2SD, chênh nhau trên 4SD',
    '2of3-2s':'Trong 3 kết quả, có ít nhất 2 điểm cùng phía vượt ±2SD',
    '3-1s':'3 điểm liên tiếp hoặc 3 mức cùng phía vượt ±1SD',
    '4-1s':'4 điểm liên tiếp cùng phía vượt ±1SD',
    '6x':'6 điểm liên tiếp nằm cùng một phía so với Mean',
    '8x':'8 điểm liên tiếp nằm cùng một phía so với Mean',
    '9x':'9 điểm liên tiếp nằm cùng một phía so với Mean',
    '10x':'10 điểm liên tiếp nằm cùng một phía so với Mean',
    '12x':'12 điểm liên tiếp nằm cùng một phía so với Mean',
    '7T':'7 điểm QC liên tiếp tăng dần hoặc giảm dần'
  };
  function primaryErrorRule(rules){const priority=['1-3s','R4s','2-2s','2of3-2s','3-1s','4-1s','6x','8x','9x','10x','12x','7T','1-2s'];return priority.find(r=>(rules||[]).includes(r))||((rules||[])[0]||'');}
  function errorType(rules){rules=rules||[];if(rules.some(r=>WG_SE_RULES.includes(r)))return'SE — Sai số hệ thống';if(rules.some(r=>WG_RE_RULES.includes(r)))return'RE — Sai số ngẫu nhiên';return'—';}
  function fixHint(rules){rules=rules||[];if(rules.some(r=>WG_SE_RULES.includes(r)))return'Hướng hệ thống: kiểm tra hiệu chuẩn, lô hóa chất/QC mới, nhiệt độ, đầu hút, đèn quang.';if(rules.some(r=>WG_RE_RULES.includes(r)))return'Hướng ngẫu nhiên: bọt khí, thể tích hút, mẫu QC pha/bảo quản, điện áp, thao tác.';return'';}

  return{STATE_SCHEMA_VERSION,WG_RULES,WG_DEFAULT_ON,WG_RULE_DESCRIPTIONS,cleanText,cleanId,finiteNumber,stats,westgard,westgardMulti,pointZ,westgardByPoint,westgardLatestRules,westgardLatestRulesFromZ,westgardMultiByPoint,cusum,movingAverage,erf,normalCdf,dpmoFromSigma,sigmaMetric,westgardSigmaRules,targetFromLimits,limitsFromTarget,primaryErrorRule,errorType,fixHint,validateBackup,validateStateInvariants,sanitizeBackup};
});
