const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Enforces the button color convention documented in CLAUDE.md/AGENTS.md:
// teal = primary action, ghost = secondary/cancel, danger = destructive.
// src/presentation/shared/ui-primitives.ts has a shared btn() helper (bridged
// as root.btn) that always picks a valid variant; as of 2026-07-23 every
// hand-written `<button class="btn ...">` in the classic codebase (previously
// ~140 of them, across 10 files) had been converted to call it, including the
// ones that needed `disabled`/data-*/style attributes — btn()'s
// `opts.{disabled,attrs}` covers those, so there's no longer a legitimate
// reason to hand-write one. This test enforces that stays true: any new
// hand-written `<button class="btn ...">` is rejected outright, not just
// counted. Retargeted 2026-08-20 (Pha H2 lát 1) from assets/modules/*.js (now
// permanently empty, Pha G nhóm C) to src/presentation/**/*.ts, where all the
// HTML-building code actually lives today — scanning the empty directory had
// silently become a no-op check.
//
// Buttons whose variant is chosen dynamically at runtime (e.g.
// `class="btn ${danger?'danger':'teal'}"`) aren't matched by the static
// regex below and are intentionally not counted — they already follow the
// convention (teal/ghost/danger, just not statically readable from source),
// and btn()'s `cls` param already accepts such expressions directly.

const presentationDir = path.join(__dirname, '..', 'src', 'presentation');
const VARIANTS = new Set(['teal', 'ghost', 'danger']);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(presentationDir).filter(f => f.endsWith('.ts'));
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const matches = [...src.matchAll(/<button class="btn ([a-zA-Z0-9_ -]+)"/g)];
  assert.equal(
    matches.length, 0,
    `${path.relative(path.join(__dirname, '..'), file)}: ${matches.length} hand-written <button class="btn ...">. ` +
    `Call btn() from ui-primitives.ts instead — it now supports disabled/style/data-* via its opts param.`
  );

  const relFile = path.relative(path.join(__dirname, '..'), file);
  for (const [, classList] of matches) {
    const tokens = classList.trim().split(/\s+/);
    const variant = tokens.find(t => VARIANTS.has(t));
    if (!variant) {
      assert.fail(`${relFile}: button class "btn ${classList}" has no teal/ghost/danger variant. Pick one.`);
    } else {
      assert.equal(
        tokens[0], variant,
        `${relFile}: button class "btn ${classList}" — the teal/ghost/danger variant must be the first token after "btn".`
      );
    }
  }
}

console.log('Button convention tests passed');
