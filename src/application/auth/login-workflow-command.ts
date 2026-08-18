type Value=Record<string,any>;
type LoginCommand={authenticate:(input:any)=>Promise<Value>};
export type LoginWorkflowCommand=Readonly<{
  authenticate:(input:{users:Value[];username:string;password:string;lock:{fails:number;until:number};now:number})=>Promise<Value>;
  logout:()=>void;
}>;
export function createLoginWorkflowCommand(deps:{login:LoginCommand;log:(action:string,detail:string,target:string)=>void;saveState:(options:Value)=>void}):LoginWorkflowCommand{
  const authenticate=async(input:{users:Value[];username:string;password:string;lock:{fails:number;until:number};now:number})=>{
    const result=await deps.login.authenticate(input);
    if(result.status==='failed'&&result.reason!=='verification-error'){
      deps.log('Đăng nhập thất bại',result.reason==='missing-or-inactive'?'Tài khoản không tồn tại hoặc đã bị khóa':'Sai mật khẩu',input.username);
      deps.saveState({cloud:false,clearDerived:false});
    }else if(result.status==='authenticated'){
      deps.log('Đăng nhập','Đăng nhập thành công','Tài khoản');
      if(result.upgradedPassword)deps.log('Nâng cấp mật khẩu','Tự động băm lại theo chuẩn mới khi đăng nhập','Tài khoản');
      deps.saveState({cloud:false,clearDerived:false});
    }
    return result;
  };
  const logout=()=>{deps.log('Đăng xuất','Đăng xuất khỏi phần mềm','Tài khoản');deps.saveState({cloud:false,clearDerived:false});};
  return Object.freeze({authenticate,logout});
}
