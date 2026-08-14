export type LotGroupToggleAction = { label: 'Kích hoạt'|'Dừng'; command: 'activate'|'stop'; variant: 'teal sm'|'ghost sm btn-stop-tint' }|null;

export function lotGroupToggleAction(archived: boolean, status: string, inUse: boolean): LotGroupToggleAction {
  if(archived)return null;
  return status==='stopped'||status==='planned'||!inUse?{label:'Kích hoạt',command:'activate',variant:'teal sm'}:{label:'Dừng',command:'stop',variant:'ghost sm btn-stop-tint'};
}
