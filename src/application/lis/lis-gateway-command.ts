type Settings={enabled:boolean;url:string;token:string};
type PullResult={ok:boolean;pending?:number;unresolved?:number};
type Deps={store:(settings:Settings)=>void;clearToken:()=>void;disable:()=>void;start:()=>void;pull:()=>Promise<PullResult>};
export type LisGatewayCommand=Readonly<{apply:(settings:Settings)=>Promise<{status:'disabled'}|{status:'pulled';result:PullResult}>}>;
export function createLisGatewayCommand(deps:Deps):LisGatewayCommand{
  const apply=async(settings:Settings)=>{deps.store(settings);deps.clearToken();if(!settings.enabled){deps.disable();return {status:'disabled'} as const;}deps.start();return {status:'pulled' as const,result:await deps.pull()};};
  return Object.freeze({apply});
}
