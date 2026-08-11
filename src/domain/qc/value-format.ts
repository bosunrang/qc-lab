export const QC_DECIMALS_DEFAULT=2;
export const QC_DECIMALS_MAX=6;
export const QC_STAT_EXTRA_DECIMALS=2;

export type QcValueFormat={qcValueDecimals:(value:unknown)=>number;testDecimalPlaces:(test:any,point?:any)=>number;testStatDecimals:(test:any)=>number;formatValue:(test:any,value:unknown,point?:any)=>string;formatStat:(test:any,value:unknown)=>string;formatPoint:(point:any,test?:any)=>string};

export function createQcValueFormat():QcValueFormat{
  const qcValueDecimals=(value:unknown)=>{const text=String(value==null?'':value).trim(),match=/^[+-]?(?:\d+(?:[.,](\d+))?|[.,](\d+))(?:e([+-]?\d+))?$/i.exec(text);if(!match)return 0;const fraction=(match[1]||match[2]||'').length,exponent=Number(match[3]||0);return Math.max(0,Math.min(QC_DECIMALS_MAX,fraction-exponent));};
  const testDecimalPlaces=(test:any,point:any=null)=>{const raw=test&&test.decimalPlaces,configured=Number(raw);if(raw!=null&&raw!==''&&Number.isInteger(configured)&&configured>=0&&configured<=QC_DECIMALS_MAX)return configured;if(point){const saved=Number(point.valueDecimals),own=Number.isInteger(saved)&&saved>=0?saved:qcValueDecimals(point.val);return Math.min(QC_DECIMALS_MAX,Math.max(QC_DECIMALS_DEFAULT,own));}return QC_DECIMALS_DEFAULT;};
  const testStatDecimals=(test:any)=>Math.min(QC_DECIMALS_MAX,Math.max(2,testDecimalPlaces(test)+QC_STAT_EXTRA_DECIMALS));
  const formatValue=(test:any,value:unknown,point:any=null)=>{const number=Number(value);return Number.isFinite(number)?number.toFixed(testDecimalPlaces(test,point)):'—';};
  const formatStat=(test:any,value:unknown)=>{const number=Number(value);return Number.isFinite(number)?number.toFixed(testStatDecimals(test)):'—';};
  return{qcValueDecimals,testDecimalPlaces,testStatDecimals,formatValue,formatStat,formatPoint:(point:any,test:any=null)=>formatValue(test,point&&point.val,point)};
}
