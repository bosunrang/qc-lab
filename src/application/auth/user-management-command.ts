type User=Record<string,any>;
/* Giai đoạn 7 (state immutable, nhóm users/settings/lab, 2026-08-30): mọi hàm
   ở đây từng mutate TẠI CHỖ (Object.assign lên chính object user truyền vào,
   push/splice lên chính mảng users truyền vào) rồi trả lại CÙNG tham chiếu —
   đổi hẳn sang THUẦN: mỗi hàm nhận user/dữ liệu hiện tại, trả về MỘT OBJECT
   MỚI, không đụng gì tới tham số đầu vào. Nơi gọi (user-lifecycle-command.ts/
   user-avatar-command.ts) chịu trách nhiệm thay thế đúng phần tử trong mảng
   `state.users` bằng object mới này (xem user-store-update.ts) — đây là điểm
   mấu chốt tránh được bẫy "biến trung gian giữ tham chiếu cũ, đọc lại thấy dữ
   liệu stale" mà middleware immer không giải quyết được (xem kế hoạch kiến
   trúc, mục Giai đoạn 7). `add`/`remove` không còn nhận mảng `users` — chỉ
   tính đúng MỘT giá trị (user mới, hoặc thuần tuý bỏ hẳn `remove` khỏi đây vì
   "lọc bỏ một id" không cần logic riêng gì hơn `Array.prototype.filter`). */
export type UserManagementCommand=Readonly<{add:(input:User)=>User;updatePermissions:(user:User,input:User)=>User;resetPassword:(user:User,hash:string,mustChange:boolean)=>User;toggle:(user:User)=>User;setAvatar:(user:User,dataUrl:string)=>User;clearAvatar:(user:User)=>User}>;

export function createUserManagementCommand():UserManagementCommand{
  const add=(input:User):User=>({id:input.id,username:input.username,name:input.name,initials:input.initials,role:input.role,pagePerms:[...input.pagePerms],passHash:input.passHash,active:true,mustChangePassword:true});
  const updatePermissions=(user:User,input:User):User=>({...user,role:input.role,pagePerms:[...input.pagePerms]});
  const resetPassword=(user:User,hash:string,mustChange:boolean):User=>({...user,passHash:hash,mustChangePassword:mustChange});
  const toggle=(user:User):User=>({...user,active:user.active===false});
  const setAvatar=(user:User,dataUrl:string):User=>({...user,avatar:String(dataUrl||'')});
  const clearAvatar=(user:User):User=>({...user,avatar:''});
  return Object.freeze({add,updatePermissions,resetPassword,toggle,setAvatar,clearAvatar});
}
