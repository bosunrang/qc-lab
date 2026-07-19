const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');

/**
 * Loads a sequence of app source files (in load order, same as index.html)
 * into one shared vm context and returns that context.
 *
 * Only usable for files whose top-level code has no DOM/window/localStorage
 * side effects (core.js, state.js, firebase-sync.js, data-io.js qualify - the
 * app's page-rendering modules do not, since they touch `document` at call
 * time from module-level UI state that we don't set up here).
 *
 * Seeds a couple of standard Web APIs that vm contexts don't get for free
 * (TextEncoder is used by the hand-rolled xlsx/zip builder in data-io.js).
 */
function loadSandbox(relFiles, globals = {}) {
  const context = vm.createContext({
    TextEncoder,
    TextDecoder,
    setTimeout,
    clearTimeout,
    ...globals,
  });
  const files=[...relFiles];
  const stateIndex=files.indexOf('modules/state.js');
  if(stateIndex>=0&&!files.includes('modules/analyte-catalog.js'))files.splice(stateIndex,0,'modules/analyte-catalog.js');
  files.forEach(relPath => {
    const code = fs.readFileSync(path.join(ASSETS_DIR, relPath), 'utf8');
    vm.runInContext(code, context, { filename: relPath });
  });
  return context;
}

/** Runs an extra snippet of code in an already-loaded sandbox context. */
function run(context, code) {
  return vm.runInContext(code, context);
}

module.exports = { loadSandbox, run };
