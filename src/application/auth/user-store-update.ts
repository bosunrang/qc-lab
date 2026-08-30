type User=Record<string,any>;
type State={users?:User[]};

/* Giai đoạn 7 (state immutable, nhóm users/settings/lab, 2026-08-30): điểm
   DUY NHẤT tìm-và-thay-thế một phần tử trong `state.users`, dùng chung bởi
   user-lifecycle-command.ts (đổi quyền/mật khẩu/khóa) VÀ user-avatar-command.ts
   (đổi/xóa ảnh đại diện) — tránh viết trùng logic "tìm theo id, tạo mảng mới,
   đồng bộ currentUser" ở hai nơi. `syncCurrentUser` LUÔN được gọi sau mỗi lần
   thay thế thành công (không chỉ khi biết trước đó là chính người dùng đang
   đăng nhập) — quyết định "có phải currentUser không" thuộc về phía gọi
   (modular-pilot.global.ts, nơi duy nhất biết biến `currentUser`), giữ cho
   module thuần này không cần biết gì về khái niệm "ai đang đăng nhập". Đây
   chính là bẫy rủi ro cao nhất được khảo sát trước khi làm: `currentUser` là
   một biến RIÊNG (không nằm trong `state`) giữ tham chiếu vào một phần tử của
   `state.users` — thay `state.users` bằng mảng mới mà không đồng bộ lại
   `currentUser` sẽ để nó trỏ vào object CŨ, hiện sai avatar/quyền ngay sau khi
   người dùng tự sửa hồ sơ của chính mình. */
export function createUserStoreUpdate(deps:{current:()=>State;syncCurrentUser:(user:User)=>void}){
  const replaceById=(id:string,transform:(user:User)=>User):User|undefined=>{
    const state=deps.current(),users=state.users||[],idx=users.findIndex(u=>u.id===id);
    if(idx<0)return undefined;
    const updated=transform(users[idx]);
    state.users=[...users.slice(0,idx),updated,...users.slice(idx+1)];
    deps.syncCurrentUser(updated);
    return updated;
  };
  return Object.freeze({replaceById});
}
