type Lab=Record<string,any>;
type ProfileService={updateLab:(current:Lab,input:Lab)=>Lab;updateBrand:(current:Lab,input:Lab)=>Lab;updateLogo:(current:Lab,logoData:unknown)=>Lab;clearLogo:(current:Lab)=>Lab;};
type SettingsProfileDeps={current:()=>Lab;set:(lab:Lab)=>void;profile:ProfileService;save:()=>void;renderBrand:()=>void;render:()=>void;};
export type SettingsProfileCommand=Readonly<{saveLab:(input:Lab)=>void;saveBrand:(input:Lab)=>void;saveLogo:(input:Lab,logoData:unknown)=>void;clearLogo:()=>void;updateDraft:(input:Lab)=>void}>;

export function createSettingsProfileCommand(deps:SettingsProfileDeps):SettingsProfileCommand{
  const lab=()=>deps.current()||{};
  const persist=()=>{deps.save();deps.renderBrand();deps.render();};
  const saveLab=(input:Lab)=>{deps.set(deps.profile.updateLab(lab(),input));deps.save();};
  const updateDraft=(input:Lab)=>deps.set(deps.profile.updateBrand(lab(),input));
  const saveBrand=(input:Lab)=>{updateDraft(input);persist();};
  const saveLogo=(input:Lab,logoData:unknown)=>{updateDraft(input);deps.set(deps.profile.updateLogo(lab(),logoData));persist();};
  const clearLogo=()=>{deps.set(deps.profile.clearLogo(lab()));persist();};
  return Object.freeze({saveLab,saveBrand,saveLogo,clearLogo,updateDraft});
}
