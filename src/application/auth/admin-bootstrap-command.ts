type User=Record<string,any>;
type State={users?:User[]};
export type AdminBootstrapCommand=Readonly<{ensure:()=>Promise<{created:boolean;user?:User}>}>;

export function createAdminBootstrapCommand(deps:{current:()=>State;id:()=>string;hashDefault:()=>Promise<string>;createDefault:(id:string,passHash:string)=>User;save:()=>void}):AdminBootstrapCommand{
  const ensure=async()=>{
    const state=deps.current();
    if(state.users&&state.users.length)return {created:false};
    const user=deps.createDefault(deps.id(),await deps.hashDefault());
    state.users=[user];deps.save();
    return {created:true,user};
  };
  return Object.freeze({ensure});
}
