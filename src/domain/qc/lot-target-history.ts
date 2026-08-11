export type LotTargetHistoryService={dedupe:(target:any)=>any[];upsert:(target:any,lot:any,values:any)=>any};

export function createLotTargetHistory(id:()=>string):LotTargetHistoryService{
  const dedupe=(target:any)=>{const rows=Array.isArray(target&&target.meanSdHistory)?target.meanSdHistory:[],out:any[]=[],indexes=new Map<string,number>();rows.forEach((row:any)=>{const key=row&&row.qcLotId?'id:'+row.qcLotId:row&&row.lot?'lot:'+row.lot:'';if(!key){out.push(row);return;}if(indexes.has(key))out[indexes.get(key)!]=row;else{indexes.set(key,out.length);out.push(row);}});if(target)target.meanSdHistory=out;return out;};
  const upsert=(target:any,lot:any,values:any)=>{target.meanSdHistory=Array.isArray(target.meanSdHistory)?target.meanSdHistory:[];const matches=(row:any)=>row&&(row.qcLotId?row.qcLotId===lot.id:(row.lot||'')===(lot.lotNo||'')),existing=target.meanSdHistory.slice().reverse().find(matches),entry={...(existing||{}),...values,id:existing&&existing.id||id(),qcLotId:lot.id,lot:lot.lotNo};target.meanSdHistory=target.meanSdHistory.filter((row:any)=>!matches(row));target.meanSdHistory.push(entry);return entry;};
  return{dedupe,upsert};
}
