type User=Record<string,any>;
type LockState={fails:number;until:number};
type LoginFailure='missing-or-inactive'|'invalid-password'|'verification-error';
export type LoginResult=
  | {status:'locked';lock:LockState;message:string}
  | {status:'failed';lock:LockState;reason:LoginFailure}
  | {status:'authenticated';lock:LockState;user:User;markedDefaultPassword:boolean;upgradedPassword:boolean};
export type LoginCommand=Readonly<{authenticate:(input:{users:User[];username:string;password:string;lock:LockState;now:number})=>Promise<LoginResult>}>;

export function createLoginCommand(deps:{isLocked:(until:number,now:number)=>boolean;lockedMessage:(until:number,now:number)=>string;recordFailure:(lock:LockState,now:number)=>LockState;resetLock:()=>LockState;verify:(password:string,stored:string)=>Promise<boolean>;hash:(password:string)=>Promise<string>;isPbkdf2:(stored:string)=>boolean;hashNeedsUpgrade:(stored:string)=>boolean}):LoginCommand{
  const authenticate=async(input:{users:User[];username:string;password:string;lock:LockState;now:number}):Promise<LoginResult>=>{
    if(deps.isLocked(input.lock.until,input.now))return {status:'locked',lock:input.lock,message:deps.lockedMessage(input.lock.until,input.now)};
    const user=input.users.find(item=>item.username===input.username);
    if(!user||user.active===false)return {status:'failed',lock:deps.recordFailure(input.lock,input.now),reason:'missing-or-inactive'};
    let valid=false;try{valid=await deps.verify(input.password,String(user.passHash||''));}catch{return {status:'failed',lock:input.lock,reason:'verification-error'};}
    if(!valid)return {status:'failed',lock:deps.recordFailure(input.lock,input.now),reason:'invalid-password'};
    const lock=deps.resetLock();
    const markedDefaultPassword=user.username==='admin'&&input.password==='admin'&&!deps.isPbkdf2(String(user.passHash||''));
    if(markedDefaultPassword)user.mustChangePassword=true;
    let upgradedPassword=false;
    if(!markedDefaultPassword&&deps.hashNeedsUpgrade(String(user.passHash||''))){try{user.passHash=await deps.hash(input.password);upgradedPassword=true;}catch{}}
    return {status:'authenticated',lock,user,markedDefaultPassword,upgradedPassword};
  };
  return Object.freeze({authenticate});
}
