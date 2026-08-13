const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-chart-range-source-html.ts')).href;
const program=`import { entryChartRangeSourceHtml } from ${JSON.stringify(source)};console.log(JSON.stringify([entryChartRangeSourceHtml({applied:'lab'}),entryChartRangeSourceHtml({applied:'manufacturer'})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [lab,manufacturer]=JSON.parse(output.stdout);
assert.equal(lab,'<span class="hint">Dải PXN</span>');
assert.equal(manufacturer,'<span class="hint">Dải NSX</span>');
