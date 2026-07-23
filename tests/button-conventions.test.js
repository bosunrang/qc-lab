const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Enforces the button color convention documented in CLAUDE.md/AGENTS.md:
// teal = primary action, ghost = secondary/cancel, danger = destructive.
// router-render.js:178 has a shared btn() helper that always picks a valid
// variant; as of 2026-07-23 every hand-written `<button class="btn ...">`
// in assets/modules/*.js (previously ~140 of them, across 10 files) has been
// converted to call it, including the ones that needed `disabled`/data-*/
// style attributes — btn()'s `opts.{disabled,attrs}` covers those, so there's
// no longer a legitimate reason to hand-write one. This test enforces that
// stays true: any new hand-written `<button class="btn ...">` is rejected
// outright, not just counted.
//
// Buttons whose variant is chosen dynamically at runtime (e.g.
// `class="btn ${danger?'danger':'teal'}"`) aren't matched by the static
// regex below and are intentionally not counted — they already follow the
// convention (teal/ghost/danger, just not statically readable from source),
// and btn()'s `cls` param already accepts such expressions directly.

const modulesDir = path.join(__dirname, '..', 'assets', 'modules');
const VARIANTS = new Set(['teal', 'ghost', 'danger']);

const files = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js'));
for (const file of files) {
  const src = fs.readFileSync(path.join(modulesDir, file), 'utf8');
  const matches = [...src.matchAll(/<button class="btn ([a-zA-Z0-9_ -]+)"/g)];
  assert.equal(
    matches.length, 0,
    `${file}: ${matches.length} hand-written <button class="btn ...">. ` +
    `Call btn() from router-render.js instead — it now supports disabled/style/data-* via its opts param.`
  );

  for (const [, classList] of matches) {
    const tokens = classList.trim().split(/\s+/);
    const variant = tokens.find(t => VARIANTS.has(t));
    if (!variant) {
      assert.fail(`${file}: button class "btn ${classList}" has no teal/ghost/danger variant. Pick one.`);
    } else {
      assert.equal(
        tokens[0], variant,
        `${file}: button class "btn ${classList}" — the teal/ghost/danger variant must be the first token after "btn".`
      );
    }
  }
}

console.log('Button convention tests passed');
