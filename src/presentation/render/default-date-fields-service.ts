type Field={value:string};
export function createDefaultDateFieldsService(deps:{find:(id:string)=>Field|null}){const fill=(ids:string[],value:string)=>ids.forEach(id=>{const field=deps.find(id);if(field&&!field.value)field.value=value;});return{fill};}
