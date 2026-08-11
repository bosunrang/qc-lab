export function createFirebasePollingService(clock:{setInterval:(fn:()=>void,ms:number)=>any;clearInterval:(timer:any)=>void}) {
  const stop = (timer:any) => { if (timer) clock.clearInterval(timer); return null; };
  const start = (timer:any, pull:()=>void, interval=8000) => { stop(timer); return clock.setInterval(pull, interval); };
  return Object.freeze({ stop, start });
}
