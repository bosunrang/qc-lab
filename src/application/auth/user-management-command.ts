type User=Record<string,any>;
export type UserManagementCommand=Readonly<{add:(users:User[],input:User)=>User;updatePermissions:(user:User,input:User)=>User;resetPassword:(user:User,hash:string,mustChange:boolean)=>User;toggle:(user:User)=>User;remove:(users:User[],id:string)=>User|undefined;setAvatar:(user:User,dataUrl:string)=>User;clearAvatar:(user:User)=>User}>;

export function createUserManagementCommand():UserManagementCommand{
  const add=(users:User[],input:User)=>{const user={id:input.id,username:input.username,name:input.name,initials:input.initials,role:input.role,pagePerms:[...input.pagePerms],passHash:input.passHash,active:true,mustChangePassword:true};users.push(user);return user;};
  const updatePermissions=(user:User,input:User)=>Object.assign(user,{role:input.role,pagePerms:[...input.pagePerms]});
  const resetPassword=(user:User,hash:string,mustChange:boolean)=>Object.assign(user,{passHash:hash,mustChangePassword:mustChange});
  const toggle=(user:User)=>Object.assign(user,{active:user.active===false});
  const remove=(users:User[],id:string)=>{const user=users.find(item=>item.id===id);if(!user)return undefined;users.splice(users.indexOf(user),1);return user;};
  const setAvatar=(user:User,dataUrl:string)=>Object.assign(user,{avatar:String(dataUrl||'')});
  const clearAvatar=(user:User)=>Object.assign(user,{avatar:''});
  return Object.freeze({add,updatePermissions,resetPassword,toggle,remove,setAvatar,clearAvatar});
}
