export type SigmaMuShares = Record<string, number | undefined>;

const labels:Record<string,string>={uRw:'u(Rw)',uBias:'u(bias)',uCal:'u(cal)'};

export function sigmaMuDominantText(shares:SigmaMuShares | undefined, format:(value:number,decimals:number)=>string) {
  const entries=Object.entries(shares||{}).filter((entry):entry is [string,number]=>Number.isFinite(entry[1]));
  if(entries.length<2)return '';
  const top=entries.sort((a,b)=>b[1]-a[1])[0];
  return top[1]>.5?`${labels[top[0]]||top[0]} chiếm ${format(top[1]*100,0)}%`:'';
}
