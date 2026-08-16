const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createSettingsProfileCommand} from './src/application/settings/settings-profile-command.ts';
let state={lab:{name:'Cũ',logoData:'old'}},saved=0,brand=0,rendered=0;
const profile={updateLab:(current,input)=>({...current,...input,kind:'lab'}),updateBrand:(current,input)=>({...current,...input,kind:'brand'}),updateLogo:(current,logoData)=>({...current,logoData}),clearLogo:current=>({...current,logoData:''})};
const command=createSettingsProfileCommand({current:()=>state.lab,set:lab=>{state.lab=lab;},profile,save:()=>saved++,renderBrand:()=>brand++,render:()=>rendered++});
command.saveLab({name:'Mới'});const afterLab={...state.lab};command.updateDraft({brandTitle:'QC mới'});const afterDraft={...state.lab};command.saveBrand({brandSub:'Nội kiểm mới'});command.saveLogo({logoText:'L'},'data:image/png;base64,x');command.clearLogo();console.log(JSON.stringify({state,afterLab,afterDraft,saved,brand,rendered}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const value=JSON.parse(output.stdout);
assert.deepEqual(value.afterLab,{name:'Mới',logoData:'old',kind:'lab'});assert.deepEqual(value.afterDraft,{name:'Mới',logoData:'old',kind:'brand',brandTitle:'QC mới'});assert.equal(value.state.lab.logoData,'');assert.equal(value.state.lab.brandSub,'Nội kiểm mới');assert.equal(value.state.lab.logoText,'L');assert.deepEqual([value.saved,value.brand,value.rendered],[4,3,3]);
console.log('Settings profile command TypeScript tests passed');
