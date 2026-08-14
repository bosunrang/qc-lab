export function validIsoDate(value: unknown) {
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));
  if(!match)return '';
  const year=+match[1],month=+match[2],day=+match[3],date=new Date(Date.UTC(year,month-1,day));
  return year>=1000&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?String(value):'';
}

export function parseVnDate(value: unknown) {
  if(!value)return '';
  const text=String(value).trim(),match=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(text);
  if(match)return validIsoDate(`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`);
  return /^\d{4}-\d{2}-\d{2}$/.test(text)?validIsoDate(text):'';
}
