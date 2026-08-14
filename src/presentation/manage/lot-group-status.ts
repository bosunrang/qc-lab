export type LotGroupStatus = { cls: 'rej'|'warn'|'ok'|'none'; text: string };

export function lotGroupStatus(archived: boolean, status: string, inUse: boolean): LotGroupStatus {
  if(archived)return {cls:'rej',text:'Đã lưu trữ'};
  if(status==='stopped')return {cls:'rej',text:'Đã dừng'};
  if(status==='planned')return {cls:'warn',text:'Dự kiến'};
  return inUse?{cls:'ok',text:'Đang hoạt động'}:{cls:'none',text:'Chưa dùng'};
}
