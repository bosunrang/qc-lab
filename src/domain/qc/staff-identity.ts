export type QcStaffIdentity={initials:(name:unknown)=>string;point:(point:any)=>{name:string;code:string}};

export function createQcStaffIdentity():QcStaffIdentity{
  const initials=(name:unknown)=>String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').split(/[^A-Za-z0-9]+/).filter(Boolean).map(value=>value.charAt(0)).join('').toUpperCase().slice(0,8)||'—';
  return{initials,point:(point:any)=>{const name=String(point&&point.operatorName||'').trim(),code=String(point&&point.operatorCode||'').trim().toUpperCase()||(name?initials(name):'');return{name,code};}};
}
