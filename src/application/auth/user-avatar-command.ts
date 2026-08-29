type User=Record<string,any>;
type UserManagement={setAvatar:(user:User,dataUrl:string)=>User;clearAvatar:(user:User)=>User};
export type UserAvatarCommand=Readonly<{setAvatar:(user:User,dataUrl:string)=>User;clearAvatar:(user:User)=>User}>;

export function createUserAvatarCommand(deps:{manage:UserManagement;log:(type:string,detail:string,target:string)=>void;save:()=>void}):UserAvatarCommand{
  const setAvatar=(user:User,dataUrl:string)=>{const updated=deps.manage.setAvatar(user,dataUrl);deps.log('Cập nhật ảnh đại diện','Đổi ảnh đại diện cá nhân',updated.username);deps.save();return updated;};
  const clearAvatar=(user:User)=>{const updated=deps.manage.clearAvatar(user);deps.log('Cập nhật ảnh đại diện','Xóa ảnh đại diện cá nhân',updated.username);deps.save();return updated;};
  return Object.freeze({setAvatar,clearAvatar});
}
