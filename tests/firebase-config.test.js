const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSandbox, run } = require('./helpers/sandbox');

{
  const appMetaPath=path.join(__dirname,'..','assets','modules','app-meta.js'),source=fs.readFileSync(appMetaPath,'utf8');
  const appMetaCtx=loadSandbox(['modules/app-meta.js'],{window:{}});
  assert.equal(run(appMetaCtx,'window.QCLAB_CLOUD'),null,'bản phân phối không được tự trỏ vào Firebase của nhà phát triển');
  assert.doesNotMatch(source,/qclab1102|AIza[0-9A-Za-z_-]+/,'runtime source không được chứa project/API key của một đơn vị cụ thể');
}

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js']);
const result = run(ctx, `
  (function(){
    var stored = null;
    localStorage = {getItem:function(){return stored;}};
    stored = JSON.stringify({labCode:'labA',email:'user@example.com',config:{apiKey:'x'}});
    var legacy = getStoredFbCfg().anonymous;
    stored = JSON.stringify({labCode:'labA',anonymous:true,config:{apiKey:'x'}});
    var explicit = getStoredFbCfg().anonymous;
    stored = '{broken';
    var broken = getStoredFbCfg();
    return {legacy,explicit,broken};
  })()
`);

assert.deepEqual(JSON.parse(JSON.stringify(result)), {
  legacy: false,
  explicit: true,
  broken: null
}, 'stored Firebase config phải fail-closed với anonymous');

const switchResult = run(ctx, `
  (async function(){
    var deleted=[];
    firebase={
      apps:[],
      initializeApp:function(cfg){
        var app={options:cfg,delete:function(){deleted.push(cfg.projectId);firebase.apps=firebase.apps.filter(x=>x!==app);return Promise.resolve();}};
        firebase.apps.push(app);
        return app;
      },
      app:function(){return firebase.apps[0];}
    };
    const cfgA={apiKey:'a',authDomain:'a.firebaseapp.com',databaseURL:'https://a.firebaseio.com',projectId:'a',appId:'a'};
    const cfgA2={apiKey:'a',authDomain:'a.firebaseapp.com',databaseURL:'https://a.firebaseio.com',projectId:'a',appId:'a'};
    const cfgB={apiKey:'b',authDomain:'b.firebaseapp.com',databaseURL:'https://b.firebaseio.com',projectId:'b',appId:'b'};
    await ensureFirebaseApp(cfgA);
    await ensureFirebaseApp(cfgA2);
    const afterSame={project:firebase.apps[0].options.projectId,count:firebase.apps.length,deleted:deleted.slice()};
    await ensureFirebaseApp(cfgB);
    return{afterSame,afterSwitch:{project:firebase.apps[0].options.projectId,count:firebase.apps.length,deleted}};
  })()
`);

(async()=>{
  const value = await switchResult;
  assert.deepEqual(JSON.parse(JSON.stringify(value.afterSame)), {
    project: 'a', count: 1, deleted: [],
  }, 'same Firebase config should reuse the existing app');
  assert.deepEqual(JSON.parse(JSON.stringify(value.afterSwitch)), {
    project: 'b', count: 1, deleted: ['a'],
  }, 'changing Firebase config should delete the old app and initialize the requested project');
  console.log('firebase-config.test.js: ok');
})().catch(error=>{console.error(error);process.exitCode=1;});
