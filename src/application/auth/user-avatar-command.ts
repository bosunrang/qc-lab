type User=Record<string,any>;
type UserManagement={setAvatar:(user:User,dataUrl:string)=>User;clearAvatar:(user:User)=>User};
type StoreUpdate={replaceById:(id:string,transform:(user:User)=>User)=>User|undefined};
/* Giai đoạn 7 (state immutable, nhóm users/settings/lab, 2026-08-30): giữ
   nguyên chữ ký công khai (nhận cả object `user`, không chỉ id) vì
   avatar-modal-controller.ts vốn đã có sẵn user đầy đủ qua deps.currentUser()
   — không cần đổi gì phía đó. Bên trong đổi hẳn cách cập nhật: không còn
   Object.assign(user,...) mutate tại chỗ (nguy hiểm vì `user` ở đây CHÍNH LÀ
   biến toàn cục currentUser — mutate nó xong renderModal() đọc lại
   deps.currentUser() sẽ tình cờ thấy đúng, nhưng NẾU sau này có nơi khác giữ
   một tham chiếu currentUser cũ trước đó, nơi đó sẽ không bao giờ biết state
   đã đổi) — dùng chung userStore.replaceById() với user-lifecycle-command.ts,
   đảm bảo LUÔN đồng bộ currentUser qua đúng MỘT chỗ (userStore), không phải
   nhờ trùng hợp cùng tham chiếu object. */
export type UserAvatarCommand=Readonly<{setAvatar:(user:User,dataUrl:string)=>User|undefined;clearAvatar:(user:User)=>User|undefined}>;

export function createUserAvatarCommand(deps:{manage:UserManagement;userStore:StoreUpdate;log:(type:string,detail:string,target:string)=>void;save:()=>void}):UserAvatarCommand{
  const setAvatar=(user:User,dataUrl:string)=>{
    const updated=deps.userStore.replaceById(user.id,current=>deps.manage.setAvatar(current,dataUrl));
    if(!updated)return undefined;
    deps.log('Cập nhật ảnh đại diện','Đổi ảnh đại diện cá nhân',updated.username);deps.save();return updated;
  };
  const clearAvatar=(user:User)=>{
    const updated=deps.userStore.replaceById(user.id,current=>deps.manage.clearAvatar(current));
    if(!updated)return undefined;
    deps.log('Cập nhật ảnh đại diện','Xóa ảnh đại diện cá nhân',updated.username);deps.save();return updated;
  };
  return Object.freeze({setAvatar,clearAvatar});
}
