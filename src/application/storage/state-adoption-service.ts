export function createStateAdoptionService(deps:{validate:(value:any)=>string[];sanitize:(value:any,options:any)=>any;invariants:(value:any,options:any)=>string[]}) {
  const sanitize = (value:any) => { const errors = deps.validate(value); if (errors.length) throw new Error(errors.join('\n')); return deps.sanitize(value, { owned: true }); };
  const assertInvariants = (value:any) => { const errors = deps.invariants(value, { sanitized: true }); if (errors.length) throw new Error(errors.join('\n')); return value; };
  return Object.freeze({ sanitize, assertInvariants });
}
