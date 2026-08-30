type User=Record<string,any>;
type UserManagement={add:(input:User)=>User;updatePermissions:(user:User,input:User)=>User;resetPassword:(user:User,hash:string,mustChange:boolean)=>User;toggle:(user:User)=>User};
type State={users?:User[]};
type StoreUpdate={replaceById:(id:string,transform:(user:User)=>User)=>User|undefined};
/* Giai đoạn 7 (state immutable, nhóm users/settings/lab, 2026-08-30): API đổi
   từ "nhận thẳng tham chiếu user đã find() sẵn ở nơi gọi" sang "nhận id, tự
   tìm và thay thế qua userStore.replaceById()" — nơi gọi (modular-pilot.global.ts)
   vốn đã có sẵn id (đọc từ DOM/tham số hàm) trước khi từng phải find() ra user
   chỉ để truyền tiếp, nên đây không phải thêm việc, chỉ bỏ một bước gián tiếp
   không cần thiết — và quan trọng hơn, đảm bảo LUÔN thao tác trên bản MỚI NHẤT
   của user thay vì một tham chiếu có thể đã cũ nếu có thao tác khác xen giữa. */
export type UserLifecycleCommand=Readonly<{add:(input:User&{auditDetail:string})=>Promise<User>;updatePermissions:(id:string,input:User&{auditDetail:string})=>User|undefined;resetPassword:(id:string,password:string,mustChange:boolean)=>Promise<User|undefined>;toggle:(id:string)=>User|undefined;remove:(id:string)=>User|undefined}>;

export function createUserLifecycleCommand(deps:{current:()=>State;manage:UserManagement;userStore:StoreUpdate;hash:(password:string)=>Promise<string>;log:(type:string,detail:string,target:string)=>void;save:()=>void}):UserLifecycleCommand{
  const add=async(input:User&{auditDetail:string})=>{
    const state=deps.current(),users=state.users||(state.users=[]);
    const user=deps.manage.add({...input,passHash:await deps.hash(String(input.password||''))});
    state.users=[...users,user];
    deps.log('Thêm người dùng',input.auditDetail,user.username);deps.save();return user;
  };
  const updatePermissions=(id:string,input:User&{auditDetail:string})=>{
    const updated=deps.userStore.replaceById(id,user=>deps.manage.updatePermissions(user,input));
    if(!updated)return undefined;
    deps.log('Cập nhật quyền người dùng',input.auditDetail,updated.username);deps.save();return updated;
  };
  const resetPassword=async(id:string,password:string,mustChange:boolean)=>{
    const hash=await deps.hash(password);
    const updated=deps.userStore.replaceById(id,user=>deps.manage.resetPassword(user,hash,mustChange));
    if(!updated)return undefined;
    deps.log('Đổi mật khẩu',updated.mustChangePassword?'Đặt mật khẩu tạm và yêu cầu đổi lại':'Người dùng đổi mật khẩu',updated.username);deps.save();return updated;
  };
  const toggle=(id:string)=>{
    const updated=deps.userStore.replaceById(id,user=>deps.manage.toggle(user));
    if(!updated)return undefined;
    deps.log(updated.active?'Mở khóa người dùng':'Khóa người dùng','Cập nhật trạng thái tài khoản',updated.username);deps.save();return updated;
  };
  const remove=(id:string)=>{
    const state=deps.current(),users=state.users||[],removed=users.find(u=>u.id===id);
    if(!removed)return undefined;
    state.users=users.filter(u=>u.id!==id);
    deps.log('Xóa người dùng','Xóa tài khoản khỏi hệ thống',removed.username);deps.save();return removed;
  };
  return Object.freeze({add,updatePermissions,resetPassword,toggle,remove});
}
