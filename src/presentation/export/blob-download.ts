export type BlobDownloadDependencies={createUrl:(blob:Blob)=>string;revokeUrl:(url:string)=>void;download:(url:string,name:string)=>void;schedule:(work:()=>void,delay:number)=>unknown};
export function createBlobDownload(deps:BlobDownloadDependencies){return(name:string,blob:Blob)=>{const url=deps.createUrl(blob);deps.download(url,name);deps.schedule(()=>deps.revokeUrl(url),1000);};}
