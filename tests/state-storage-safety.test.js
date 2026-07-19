const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox([
  'core.js',
  'modules/state.js',
  'modules/qc-domain.js',
  'modules/local-store.js',
  'modules/state-storage.js'
]);

const result = run(ctx, `
  (function(){
    var values={qclab:'{broken-json'};
    localStorage={
      getItem:function(key){return values[key]||null;},
      setItem:function(key,value){values[key]=value;}
    };
    var ok=load();
    return {ok,status:localLoadStatus,quarantine:JSON.parse(values.qclab_corrupt)};
  })()
`);

const value = JSON.parse(JSON.stringify(result));
assert.equal(value.ok, false);
assert.equal(value.status, 'invalid');
assert.equal(value.quarantine.source, 'localStorage:qclab');
assert.equal(value.quarantine.raw, '{broken-json');
assert.match(value.quarantine.message, /JSON|Unexpected|không hợp lệ/i);

console.log('state-storage-safety.test.js: ok');
