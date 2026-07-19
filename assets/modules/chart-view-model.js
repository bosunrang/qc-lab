/* ===== CHART VIEW MODEL ===== */
(function(root){
  function filterPoints(points,{start='',end='',lot}={}){
    return(Array.isArray(points)?points:[]).filter(point=>{
      const date=String(point&&point.date||'');
      return(!start||date>=start)&&(!end||date<=end)&&(lot===undefined||(point&&point.lot||'')===lot);
    });
  }

  function buildLeveyJennings({points=[],mean,sd,start='',end='',lot}={}){
    return{points:filterPoints(points,{start,end,lot}),mean:Number(mean),sd:Number(sd)};
  }

  function buildCusum({points=[],series}={}){
    return{points:Array.isArray(points)?points:[],series:series||{cPos:[],cNeg:[],ma:[],flags:[]}};
  }

  function buildMultiLevel({views=[]}={}){
    return(Array.isArray(views)?views:[]).map(view=>({...view,pts:Array.isArray(view.pts)?view.pts:[]}));
  }

  /* Reduce only the pixels/markers drawn on canvas. Domain calculations continue
     to use every point. Each bucket keeps its minimum and maximum so short spikes
     survive, while callers can force important indices (for example violations). */
  function sampleIndices({length=0,maxPoints=600,valueAt,preserve=[]}={}){
    const n=Math.max(0,Math.floor(Number(length)||0)),limit=Math.max(2,Math.floor(Number(maxPoints)||600));
    if(!n)return[];
    if(n<=limit)return Array.from({length:n},(_,i)=>i);
    const kept=new Set([0,n-1]);
    for(const raw of preserve||[]){const i=Math.floor(Number(raw));if(i>=0&&i<n)kept.add(i);}
    const budget=Math.max(2,limit-kept.size),bucketCount=Math.max(1,Math.floor(budget/2)),bucketSize=n/bucketCount;
    for(let bucket=0;bucket<bucketCount;bucket++){
      const start=Math.floor(bucket*bucketSize),end=Math.min(n,Math.floor((bucket+1)*bucketSize));
      let minI=-1,maxI=-1,min=Infinity,max=-Infinity;
      for(let i=start;i<end;i++){
        const value=Number(typeof valueAt==='function'?valueAt(i):i);if(!Number.isFinite(value))continue;
        if(value<min){min=value;minI=i;}if(value>max){max=value;maxI=i;}
      }
      if(minI>=0)kept.add(minI);if(maxI>=0)kept.add(maxI);
    }
    return[...kept].sort((a,b)=>a-b);
  }

  root.ChartViewModel={filterPoints,buildLeveyJennings,buildCusum,buildMultiLevel,sampleIndices};
})(typeof globalThis!=='undefined'?globalThis:this);
