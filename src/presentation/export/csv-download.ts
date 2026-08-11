export type CsvDownloadDependencies={createBlob:(text:string)=>Blob;createUrl:(blob:Blob)=>string;revokeUrl:(url:string)=>void;download:(url:string,name:string)=>void;schedule:(work:()=>void,delay:number)=>unknown};

export function createCsvDownload(deps:CsvDownloadDependencies){return(name:string,rows:any[][],encode:(value:any)=>string)=>{const blob=deps.createBlob('\ufeff'+rows.map(row=>row.map(encode).join(',')).join('\r\n')),url=deps.createUrl(blob);deps.download(url,name);deps.schedule(()=>deps.revokeUrl(url),1000);};}
