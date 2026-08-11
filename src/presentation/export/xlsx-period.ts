export function xlsxPeriodNumber(value:unknown){const match=String(value||'').match(/(?:Kỳ\s*)?(\d{1,2})\/\d{4}$/i);return match?Number(match[1]):value;}
