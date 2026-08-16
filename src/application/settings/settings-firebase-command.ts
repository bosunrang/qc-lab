type Plan={labCode:string;email:string;password:string;config:Record<string,unknown>};
type Deps={available:()=>boolean;ensureApp:(config:Record<string,unknown>)=>Promise<unknown>;persist:()=>Promise<unknown>;signIn:(email:string,password:string)=>Promise<unknown>;store:(plan:Plan)=>void;disconnect:()=>void;connected:(plan:Plan)=>void;clearPassword:()=>void;init:()=>Promise<unknown>;hasRemote:()=>boolean;remoteExists:()=>Promise<boolean>;remoteReady:()=>void;sync:()=>Promise<unknown>;clearStore:()=>void;signOut:()=>Promise<unknown>;local:()=>void;};
export type SettingsFirebaseCommand=Readonly<{connect:(plan:Plan)=>Promise<void>;clear:()=>Promise<void>}>;
export function createSettingsFirebaseCommand(deps:Deps):SettingsFirebaseCommand{
  const connect=async(plan:Plan)=>{if(!deps.available())throw new Error('Chưa tải được Firebase Authentication.');await deps.ensureApp(plan.config);await deps.persist();await deps.signIn(plan.email,plan.password);deps.store(plan);deps.disconnect();deps.connected(plan);deps.clearPassword();await deps.init();if(deps.hasRemote()){if(await deps.remoteExists())return;deps.remoteReady();await deps.sync();}};
  const clear=async()=>{deps.clearStore();deps.disconnect();try{await deps.signOut();}catch(error){}deps.local();};
  return Object.freeze({connect,clear});
}
