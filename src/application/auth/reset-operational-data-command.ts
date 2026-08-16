export type ResetOperationalDataCommand=Readonly<{execute:(options?:{keepUsers?:boolean;keepAudit?:boolean;log?:boolean;save?:boolean;render?:boolean})=>Promise<void>}>;

export function createResetOperationalDataCommand(deps:{current:()=>any;clearPersistence:()=>void;blank:(users:any[])=>any;replace:(state:any)=>void;normalize:()=>void;ensureAdmin:()=>unknown;log:()=>void;save:()=>void;render:()=>void}):ResetOperationalDataCommand{
  const execute=async(options:{keepUsers?:boolean;keepAudit?:boolean;log?:boolean;save?:boolean;render?:boolean}={})=>{const current=deps.current(),users=options.keepUsers===false?[]:(current.users||[]).length?current.users:[],activity=options.keepAudit===false?[]:[...(current.activity||[])],anchor=options.keepAudit===false?'':current.activityAnchor||'';deps.clearPersistence();const next=deps.blank(users);next.activity=activity;next.activityAnchor=anchor;deps.replace(next);deps.normalize();await deps.ensureAdmin();if(options.log!==false)deps.log();if(options.save!==false)deps.save();if(options.render!==false)deps.render();};
  return Object.freeze({execute});
}
