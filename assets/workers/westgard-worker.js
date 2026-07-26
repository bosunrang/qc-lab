(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory(require('../core.js'));
    return;
  }
  if(typeof importScripts==='function'&&typeof root.QCCore==='undefined')importScripts('../core.js?v=seven-t-zscan-20260726-1');
  const api=factory(root.QCCore);
  root.onmessage=function(event){
    const job=event&&event.data;
    if(!job||job.type!=='compute')return;
    try{root.postMessage({type:'result',...api.computeWestgardJob(job)});}
    catch(error){root.postMessage({type:'error',generation:job.generation,revision:job.revision,testId:job.testId,message:error&&error.message||'Westgard worker failed'});}
  };
})(typeof self!=='undefined'?self:globalThis,function(QCCore){
  'use strict';

  function ruleAction(job,rule){
    const explicit=job.ruleActions&&job.ruleActions[rule];
    if(explicit==='inactive'||explicit==='alert'||explicit==='reject')return explicit;
    const on=!job.globalRules||job.globalRules[rule]!==false;
    return on?(rule==='1-2s'||rule==='6x'||rule==='7T'?'alert':'reject'):'inactive';
  }
  function verdictLevel(job,rules){
    return rules.some(rule=>ruleAction(job,rule)==='reject')?'rej':rules.some(rule=>ruleAction(job,rule)==='alert')?'warn':'ok';
  }
  function defaultRuleScope(job,rule){
    const levels=(job.levels||[]).length;
    if(levels<2||['1-2s','1-3s','7T'].includes(rule))return'within';
    if(rule==='R4s')return'across';
    if(['2of3-2s','3-1s'].includes(rule))return levels>=3?'across':'within';
    if(['6x','8x','9x','10x','12x'].includes(rule))return'across';
    return'both';
  }
  function ruleScope(job,rule){const scope=job.ruleScopes&&job.ruleScopes[rule];return ['within','across','both'].includes(scope)?scope:defaultRuleScope(job,rule);}
  function ruleOnIn(job,rule,channel){if(ruleAction(job,rule)==='inactive')return false;const scope=ruleScope(job,rule);return scope==='both'||scope===channel;}
  function pointRunNo(point){const match=/-(\d+)$/.exec(String(point&&point.runId||''));return match?parseInt(match[1]):1;}
  function pointOrder(a,b){return String(a.date||'').localeCompare(String(b.date||''))||pointRunNo(a)-pointRunNo(b);}
  function computeWestgardJob(job){
    if(!QCCore)throw new Error('QCCore unavailable');
    const within=rule=>ruleOnIn(job,rule,'within'),across=rule=>ruleOnIn(job,rule,'across');
    const source=job.points||[];
    const sets=(job.levels||[]).map(level=>({
      level:level.level,mean:level.mean,sd:level.sd,
      pts:(Array.isArray(level.points)?level.points:source.filter(point=>+point.level===+level.level&&(point.lot||'')===(level.lot||''))).sort(pointOrder)
    }));
    const singles=sets.map(set=>QCCore.westgardByPoint(set.pts,set.mean,set.sd,within));
    const cross=QCCore.westgardMultiByPoint(sets,across);
    const levels=sets.map((set,levelIndex)=>({
      level:set.level,
      points:set.pts.map((point,pointIndex)=>{
        const singleVerdict=singles[levelIndex].F[pointIndex]||{},singleRules=singleVerdict.rules||[],singleSupportRules=singleVerdict.supportRules||[];
        const crossRules=cross.get(point)||[];
        const crossSupportRules=(cross.support&&cross.support.get(point))||[],rules=[...new Set([...singleRules,...crossRules])],supportRules=[...new Set([...singleSupportRules,...crossSupportRules])].filter(rule=>!rules.includes(rule));
        return{id:point.id,z:singles[levelIndex].zs[pointIndex],singleRules,crossRules,singleSupportRules,crossSupportRules,rules,supportRules,level:verdictLevel(job,rules)};
      })
    }));
    return{generation:job.generation,revision:job.revision,testId:job.testId,levels};
  }

  return{computeWestgardJob,ruleAction,verdictLevel,ruleScope};
});
