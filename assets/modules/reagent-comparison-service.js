/* ===== REAGENT COMPARISON SERVICE ===== */
(function(root){
  const DEFAULT_SAMPLE_TYPES=['Mẫu bệnh nhân','Mẫu nội kiểm (IQC)','Mẫu ngoại kiểm (EQA)'];
  const META_KEYS=new Set(['reagent','lotOld','lotNew','date','operator','sampleType','unit','biasTarget','alpha','coverageConfirmed']);

  function blank(id,name='Hóa chất mới',unit=''){
    return{id:id||'',test:{reagent:QCCore.cleanText(name||'Hóa chất mới').trim()||'Hóa chất mới',lotOld:'',lotNew:'',date:'',operator:'',sampleType:DEFAULT_SAMPLE_TYPES[0],unit:QCCore.cleanText(unit),biasTarget:6,alpha:0.05,coverageConfirmed:false},rows:[['',''],['',''],['',''],['',''],['','']]};
  }

  function comparisons(state){
    if(!Array.isArray(state.reagentTests))state.reagentTests=[];
    return state.reagentTests;
  }

  function find(state,id){return comparisons(state).find(item=>item&&item.id===id)||null;}

  function ensureOne(state,/** @type {any} */{id}={}){
    const items=comparisons(state);
    if(items.length)return{created:false,comparison:items[0]};
    const comparison=blank(id);
    items.push(comparison);
    return{created:true,comparison};
  }

  function create(state,/** @type {any} */{id,name,unit}={}){
    const cleanId=QCCore.cleanId(id);
    if(!cleanId)return{error:'missing-id'};
    if(find(state,cleanId))return{error:'duplicate-id'};
    const comparison=blank(cleanId,name,unit);
    comparisons(state).push(comparison);
    return{comparison};
  }

  function updateMetadata(state,/** @type {any} */{id,key,value}={}){
    const comparison=find(state,id);
    if(!comparison)return{error:'not-found'};
    if(!META_KEYS.has(key))return{error:'invalid-field'};
    comparison.test=comparison.test&&typeof comparison.test==='object'?comparison.test:{};
    const clean=key==='coverageConfirmed'?!!value:(key==='biasTarget'||key==='alpha'?QCCore.finiteNumber(value,0):QCCore.cleanText(value,key==='date'?20:undefined));
    comparison.test[key]=clean;
    return{comparison,key,value:clean};
  }

  function updateCell(state,/** @type {any} */{id,rowIndex,column,value}={}){
    const comparison=find(state,id),row=Number(rowIndex),col=Number(column);
    if(!comparison)return{error:'not-found'};
    if(!Number.isInteger(row)||row<0||!Array.isArray(comparison.rows)||!comparison.rows[row])return{error:'invalid-row'};
    if(col!==0&&col!==1)return{error:'invalid-column'};
    comparison.rows[row][col]=value;
    return{comparison,rowIndex:row,column:col};
  }

  function addRow(state,/** @type {any} */{id}={}){
    const comparison=find(state,id);
    if(!comparison)return{error:'not-found'};
    if(!Array.isArray(comparison.rows))comparison.rows=[];
    comparison.rows.push(['','']);
    return{comparison,rowIndex:comparison.rows.length-1};
  }

  function removeRow(state,/** @type {any} */{id,rowIndex}={}){
    const comparison=find(state,id),row=Number(rowIndex);
    if(!comparison)return{error:'not-found'};
    if(!Number.isInteger(row)||row<0||!Array.isArray(comparison.rows)||row>=comparison.rows.length)return{error:'invalid-row'};
    const removed=comparison.rows.splice(row,1)[0];
    if(!comparison.rows.length)comparison.rows.push(['','']);
    return{comparison,removed,rowIndex:row};
  }

  function clearRows(state,/** @type {any} */{id}={}){
    const comparison=find(state,id);
    if(!comparison)return{error:'not-found'};
    comparison.rows=[['',''],['',''],['',''],['',''],['','']];
    return{comparison};
  }

  function remove(state,/** @type {any} */{id}={}){
    const items=comparisons(state),index=items.findIndex(item=>item&&item.id===id);
    if(index<0)return{error:'not-found'};
    if(items.length<=1)return{error:'last-comparison'};
    const removed=items.splice(index,1)[0],next=items[Math.min(index,items.length-1)]||null;
    return{removed,nextId:next&&next.id||''};
  }

  function quickKey(type){return type==='sampleType'?'reagentSampleTypes':type==='operator'?'reagentOperators':'';}

  function ensureQuickList(state,type){
    const key=quickKey(type);
    if(!key)return{error:'invalid-type'};
    if(!Array.isArray(state[key]))state[key]=type==='sampleType'?DEFAULT_SAMPLE_TYPES.slice():[];
    if(type==='sampleType'&&!state[key].length)state[key]=DEFAULT_SAMPLE_TYPES.slice();
    return{key,items:state[key]};
  }

  function searchKey(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim();}

  function addQuick(state,/** @type {any} */{type,value}={}){
    const list=ensureQuickList(state,type);
    if(list.error)return list;
    const clean=QCCore.cleanText(value,120).trim();
    if(!clean)return{error:'empty-value'};
    const existing=list.items.find(item=>searchKey(item)===searchKey(clean));
    if(existing)return{items:list.items,value:existing,added:false};
    list.items.push(clean);
    return{items:list.items,value:clean,added:true};
  }

  function removeQuick(state,/** @type {any} */{type,index}={}){
    const list=ensureQuickList(state,type),itemIndex=Number(index);
    if(list.error)return list;
    if(!Number.isInteger(itemIndex)||itemIndex<0||itemIndex>=list.items.length)return{error:'invalid-index'};
    return{items:list.items,removed:list.items.splice(itemIndex,1)[0]};
  }

  function pickQuick(state,/** @type {any} */{id,type,index}={}){
    const list=ensureQuickList(state,type),itemIndex=Number(index);
    if(list.error)return list;
    if(!Number.isInteger(itemIndex)||itemIndex<0||itemIndex>=list.items.length)return{error:'invalid-index'};
    return updateMetadata(state,{id,key:type==='sampleType'?'sampleType':'operator',value:list.items[itemIndex]});
  }

  root.ReagentComparisonService={blank,comparisons,find,ensureOne,create,updateMetadata,updateCell,addRow,removeRow,clearRows,remove,quickKey,ensureQuickList,addQuick,removeQuick,pickQuick};
})(typeof globalThis!=='undefined'?globalThis:this);
