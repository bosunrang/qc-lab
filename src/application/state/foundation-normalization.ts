type Row=Record<string,any>;
export type StateFoundationDependencies={defaults:()=>Row;sanitize:(state:Row)=>Row;schemaVersion:number;teaRegistryVersion:number;westgardDefaults:Row};

export function normalizeStateFoundation(input:Row|undefined,options:Row,deps:StateFoundationDependencies){
  const previousSchema=Number(input&&input.schemaVersion||1),merged={...deps.defaults(),...(input||{})},state=options.sanitized?merged:deps.sanitize(merged);
  if(previousSchema<2)state.periodLocks=Array.isArray(state.periodLocks)?state.periodLocks:[];
  delete state.archiveRegistry;
  if(state.lab&&typeof state.lab==='object')delete state.lab.kpiTargets;
  if(previousSchema<3||!state.teaRegistryVersion||state.teaRegistryVersion<deps.teaRegistryVersion)state.teaRegistryVersion=deps.teaRegistryVersion;
  state.schemaVersion=deps.schemaVersion;
  if(!state.westgardProfileVersion){state.westgardRules={...deps.westgardDefaults};state.westgardProfileVersion=2;}
  return{state,previousSchema};
}
