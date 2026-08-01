'use strict';

const fs=require('node:fs');
const path=require('node:path');

class JournalStore{
  constructor(file){this.file=path.resolve(file);this.warnings=[];}
  load(){
    this.warnings=[];if(!fs.existsSync(this.file))return[];
    const lines=fs.readFileSync(this.file,'utf8').split(/\r?\n/),events=[];let lastNonEmpty=-1;for(let i=lines.length-1;i>=0;i--)if(lines[i].trim()){lastNonEmpty=i;break;}
    lines.forEach((line,index)=>{if(!line.trim())return;try{events.push(JSON.parse(line));}catch(error){if(index===lastNonEmpty){this.warnings.push(`Đã cách ly dòng cuối chưa hoàn chỉnh tại ${this.file}.`);const valid=lines.slice(0,index).join('\n'),temp=this.file+'.repair.tmp';fs.writeFileSync(temp,valid+(valid?'\n':''),'utf8');fs.renameSync(temp,this.file);}else throw new Error(`Journal hỏng ở dòng ${index+1}: ${error.message}`);}});
    return events;
  }
  append(event){fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.appendFileSync(this.file,JSON.stringify(event)+'\n',{encoding:'utf8',flag:'a'});}
}

class MemoryStore{
  constructor(events=[]){this.events=[...events];}
  load(){return[...this.events];}
  append(event){this.events.push(JSON.parse(JSON.stringify(event)));}
}

module.exports={JournalStore,MemoryStore};
