type User=Record<string,any>;
export type RequiredPasswordResult={status:'invalid';error:string}|{status:'updated';user:User};
export type RequiredPasswordCommand=Readonly<{complete:(input:{user:User|undefined;password:string;confirmation:string})=>Promise<RequiredPasswordResult>}>;

export function createRequiredPasswordCommand(deps:{validate:(password:string,confirmation:string)=>string;hash:(password:string)=>Promise<string>}):RequiredPasswordCommand{
  const complete=async(input:{user:User|undefined;password:string;confirmation:string}):Promise<RequiredPasswordResult>=>{
    const error=deps.validate(input.password,input.confirmation);
    if(error)return {status:'invalid',error};
    if(!input.user)return {status:'invalid',error:'Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.'};
    input.user.passHash=await deps.hash(input.password);
    input.user.mustChangePassword=false;
    return {status:'updated',user:input.user};
  };
  return Object.freeze({complete});
}
