export type Guidance = { version: string; identityId: string; role: string; title: string; steps: {module:string;title:string;detail:string}[]; checks: string[]; fees: {label:string;feeFen:number;note:string}[]; limits: string[] }
export function validGuidance(value: unknown, identity: string): value is Guidance {
 if(!value||typeof value!=='object')return false
 const g=value as Guidance
 return g.version==='stakeholder-v1'&&g.identityId===identity&&typeof g.role==='string'&&typeof g.title==='string'&&
  Array.isArray(g.steps)&&g.steps.every(s=>s&&typeof s.module==='string'&&typeof s.title==='string'&&typeof s.detail==='string')&&
  Array.isArray(g.checks)&&g.checks.every(s=>typeof s==='string')&&Array.isArray(g.limits)&&g.limits.every(s=>typeof s==='string')&&
  Array.isArray(g.fees)&&g.fees.every(f=>f&&typeof f.label==='string'&&Number.isSafeInteger(f.feeFen)&&f.feeFen>=0&&typeof f.note==='string')
}
