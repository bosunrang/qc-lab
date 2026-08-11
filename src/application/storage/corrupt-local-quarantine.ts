export function createCorruptLocalQuarantine(now:()=>string) {
  return (raw:any, error:any) => ({ capturedAt: now(), source: 'localStorage:qclab', message: error && error.message ? error.message : 'Dá»¯ liá»‡u cá»¥c bá»™ khÃ´ng há»£p lá»‡.', raw: String(raw || '') });
}
