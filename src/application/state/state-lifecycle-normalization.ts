type Row=Record<string,any>;
export type StateLifecycleDependencies={ensureLab:()=>void;ensureConfiguration:()=>void;repairRanges:()=>void;ensureReagent:(state:Row)=>void;reconcileSigma:()=>void;reconcileTea:()=>void;normalizePointLots:()=>void;pruneUnusedLevels:()=>void};

export function normalizeStateLifecycle(state:Row,deps:StateLifecycleDependencies){
  deps.ensureLab();deps.ensureConfiguration();deps.repairRanges();deps.ensureReagent(state);deps.reconcileSigma();deps.reconcileTea();deps.normalizePointLots();deps.pruneUnusedLevels();
  (state.tests||[]).forEach((test:Row)=>(test.levels||[]).forEach((level:Row)=>{if(level.mfgMean==null){level.mfgMean=level.mean;level.mfgSd=level.sd;level.applied='mfg';}}));
}
