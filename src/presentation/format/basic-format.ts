export type BasicFormat={number:(value:unknown,digits?:number)=>string;safeName:(value:unknown)=>string};

export function createBasicFormat():BasicFormat{return{number:(value:unknown,digits=2)=>(value==null||isNaN(value as any))?'—':Number(value).toFixed(digits),safeName:(value:unknown)=>String(value||'file').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w.-]+/g,'_').replace(/^_+|_+$/g,'')||'file'};}
