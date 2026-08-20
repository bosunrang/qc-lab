const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');

/**
 * Loads a sequence of app source files (in load order, same as index.html)
 * into one shared vm context and returns that context.
 *
 * Only usable for files whose top-level code has no DOM/window/localStorage
 * side effects (core.js qualifies - the app's page-rendering modules do not,
 * since they touch `document` at call time from module-level UI state that we
 * don't set up here).
 *
 * `assets/modules/` is empty as of 2026-08-20 (Pha G nhóm C lát 6 - state.js +
 * analyte-catalog.js retired into generated/modular-pilot.js, the last classic
 * files there) - every sandbox needing state/domain logic must list
 * 'generated/modular-pilot.js' explicitly now; there is no more auto-append.
 *
 * Seeds a couple of standard Web APIs that vm contexts don't get for free
 * (TextEncoder is used by the hand-rolled xlsx/zip builder ported to
 * src/presentation/export/data-io-controller.ts).
 */
function loadSandbox(relFiles, globals = {}) {
  const context = vm.createContext({
    TextEncoder,
    TextDecoder,
    setTimeout,
    clearTimeout,
    ...globals,
  });
  relFiles.forEach(relPath => {
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
