type User=Record<string,any>;
type UserManagement={add:(users:User[],input:User)=>User;updatePermissions:(user:User,input:User)=>User;resetPassword:(user:User,hash:string,mustChange:boolean)=>User;toggle:(user:User)=>User;remove:(users:User[],id:string)=>User|undefined};
type State={users?:User[]};
export type UserLifecycleCommand=Readonly<{add:(input:User&{auditDetail:string})=>Promise<User>;updatePermissions:(user:User,input:User&{auditDetail:string})=>User;resetPassword:(user:User,password:string,mustChange:boolean)=>Promise<User>;toggle:(user:User)=>User;remove:(id:string)=>User|undefined}>;

export function createUserLifecycleCommand(deps:{current:()=>State;manage:UserManagement;hash:(password:string)=>Promise<string>;log:(type:string,detail:string,target:string)=>void;save:()=>void}):UserLifecycleCommand{
  const users=()=>{const state=deps.current();return state.users||(state.users=[]);};
  const add=async(input:User&{auditDetail:string})=>{const user=deps.manage.add(users(),{...input,passHash:await deps.hash(String(input.password||''))});deps.log('Thêm người dùng',input.auditDetail,user.username);deps.save();return user;};
  const updatePermissions=(user:User,input:User&{auditDetail:string})=>{const updated=deps.manage.updatePermissions(user,input);deps.log('Cập nhật quyền người dùng',input.auditDetail,updated.username);deps.save();return updated;};
  const resetPassword=async(user:User,password:string,mustChange:boolean)=>{const updated=deps.manage.resetPassword(user,await deps.hash(password),mustChange);deps.log('Đổi mật khẩu',updated.mustChangePassword?'Đặt mật khẩu tạm và yêu cầu đổi lại':'Người dùng đổi mật khẩu',updated.username);deps.save();return updated;};
  const toggle=(user:User)=>{const updated=deps.manage.toggle(user);deps.log(updated.active?'Mở khóa người dùng':'Khóa người dùng','Cập nhật trạng thái tài khoản',updated.username);deps.save();return updated;};
  const remove=(id:string)=>{const removed=deps.manage.remove(users(),id);if(!removed)return undefined;deps.log('Xóa người dùng','Xóa tài khoản khỏi hệ thống',removed.username);deps.save();return removed;};
  return Object.freeze({add,updatePermissions,resetPassword,toggle,remove});
}
