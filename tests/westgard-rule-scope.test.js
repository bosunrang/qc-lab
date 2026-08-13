'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'westgard-rule-scope.ts')).href;
const program = `
  import { createWestgardRuleScope } from ${JSON.stringify(source)};
  const fallback=createWestgardRuleScope({default:(test,rule)=>test.id===rule});
  if(!fallback.within({id:'1-2s'},'1-2s')||fallback.across({id:'1-2s'},'2-2s'))throw new Error('must use legacy default when scoped rules are absent');
  const scoped=createWestgardRuleScope({within:()=>false,across:()=>true,default:()=>true});
  if(scoped.within({},'x')||!scoped.across({},'x'))throw new Error('must preserve distinct within/across overrides');
  console.log('Westgard rule scope TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Westgard rule scope TypeScript');
console.log(result.stdout.trim());
