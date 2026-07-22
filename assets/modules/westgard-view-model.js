/* ===== WESTGARD VIEW MODEL ===== */
(function(root){
  function getVerdict(verdicts,point){
    if(verdicts&&typeof verdicts.get==='function')return verdicts.get(point&&point.id)||{};
    return{};
  }

  function summarizeTestStatus(/** @type {{views?:any[],verdicts?:any,today?:string}} */{views=[],verdicts,today=''}={}){
    const order={none:-1,ok:0,warn:1,rej:2};
    let status='none',todayCount=0,totalPoints=0;
    const lastPoints=[],alerts=[];
    (Array.isArray(views)?views:[]).forEach(view=>{
      const levelConfig=view&&view.l||view&&view.levelConfig||{},points=Array.isArray(view&&view.pts)?view.pts:[];
      if(points.some(point=>point.date===today))todayCount++;
      totalPoints+=points.length;
      points.forEach(point=>lastPoints.push({...point,_level:levelConfig.level}));
      if(!points.length)return;
      const point=points[points.length-1],verdict=getVerdict(verdicts,point),level=verdict.level||'ok';
      if(order[level]>order[status])status=level;
      if(level!=='ok')alerts.push({level,point,rules:Array.isArray(verdict.rules)?verdict.rules:[],levelConfig});
    });
    return{status,todayCount,totalPoints,lastPoints,alerts};
  }

  function buildMultiViews(/** @type {{levels?:any[],previousByLevel?:any,openLevels?:any[]}} */{levels=[],previousByLevel={},openLevels=[]}={}){
    const open=new Set(openLevels),getPrevious=level=>previousByLevel&&typeof previousByLevel.get==='function'?previousByLevel.get(level)||[]:(previousByLevel&&previousByLevel[level])||[],views=[];
    (Array.isArray(levels)?levels:[]).forEach(level=>{
      views.push({level:level.level,lot:level.lot,mean:level.mean,sd:level.sd,pts:Array.isArray(level.pts)?level.pts:[],label:`M${level.level}·${level.lot||'?'}`});
      if(open.has(level.level))getPrevious(level.level).forEach(previous=>views.push({level:level.level,lot:previous.lot,mean:previous.mean,sd:previous.sd,pts:previous.pts,label:`M${level.level}·cũ ${previous.lot}`}));
    });
    return views;
  }

  function buildPointRows(/** @type {{points?:any[],verdicts?:any,zs?:any[],mean?:number,sd?:number}} */{points=[],verdicts,zs=[],mean,sd}={}){
    const source=Array.isArray(points)?points:[];
    const getVerdict=(point,index)=>{
      if(verdicts&&typeof verdicts.get==='function')return verdicts.get(point.id)||{};
      return Array.isArray(verdicts)?verdicts[index]||{}:{};
    };
    return source.map((point,index)=>{
      const verdict=getVerdict(point,index),value=Number(point&&point.val),targetMean=Number(mean),targetSd=Number(sd);
      const verdictZ=Number(verdict.z),seriesZ=Number(zs[index]);
      const z=Number.isFinite(verdictZ)?verdictZ:Number.isFinite(seriesZ)?seriesZ:Number.isFinite(value)&&Number.isFinite(targetMean)&&Number.isFinite(targetSd)&&targetSd!==0?(value-targetMean)/targetSd:NaN;
      const rules=[...new Set(Array.isArray(verdict.rules)?verdict.rules:[])];
      return{index:index+1,id:point&&point.id,date:point&&point.date,value:point&&point.val,z,level:verdict.level||'ok',rules,supportRules:[...new Set(Array.isArray(verdict.supportRules)?verdict.supportRules:[])].filter(rule=>!rules.includes(rule))};
    });
  }

  root.WestgardViewModel={buildPointRows,summarizeTestStatus,buildMultiViews};
})(typeof globalThis!=='undefined'?globalThis:this);
