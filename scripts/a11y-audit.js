// Real accessibility audit: injects axe-core (the WCAG rule engine most
// commercial a11y tools are built on) into every top-level page, on the
// actual rendered DOM of a seeded, logged-in session — not the static regex
// count tests/ui-accessibility.test.js does (that only proves certain
// aria-*/role strings exist somewhere in source, it can't compute contrast,
// can't tell if a label is actually reachable from its control, etc).
//
// Not part of `npm test` — needs Playwright + a Chromium download, so it's a
// separate opt-in script (see CLAUDE.md "Tests"). This first run is a
// baseline: it always exits 0 and just writes the report. Once a human has
// reviewed tests/__a11y__/report.json and decided what to fix, a follow-up
// pass can turn specific counts into a ratchet (same pattern as
// tests/button-conventions.test.js) — doing that *before* seeing real
// results would mean guessing at a threshold nobody has looked at yet.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { openSeededSession } = require('./lib/seed-browser-session');

const OUT_DIR = path.join(__dirname, '..', 'tests', '__a11y__');
const AXE_SOURCE = fs.readFileSync(require.resolve('axe-core'), 'utf8');
const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];
const KEYBOARD_PAGES = ['dash', 'entry'];
const KEYBOARD_STEPS = 25;

// The 2026-07-23 baseline run only ever saw each page in its default,
// just-loaded state — no modal was ever opened, and the Sigma page was
// scanned empty (no test tracked there yet) since seed-browser-session.js
// only seeds operational QC data, not Sigma tracking. That baseline came
// back 0/0/0/0 everywhere, which said nothing about the modals or Sigma's
// real content — most of this app's forms live in a modal (#modalRoot),
// not the page body. These are the primary "add new X" modals per page
// (the most complex, most-used form in each area) — not every dialog in the
// app, but enough to stop auditing a hollow shell.
const MODALS = [
  { page: 'manage', label: 'manage:add-instrument', open: 'openConfigInstrument()' },
  { page: 'manage', label: 'manage:add-lot', open: 'openConfigLot()' },
  { page: 'manage', label: 'manage:add-assay', open: 'openConfigAssay()' },
  // "Edit" variants render extra fields (history, etc.) the "add" form
  // doesn't, so they're checked separately, not assumed identical.
  { page: 'manage', label: 'manage:edit-instrument', open: "openConfigInstrument('I1')" },
  { page: 'manage', label: 'manage:edit-lot', open: "openConfigLot('L1101')" },
  { page: 'manage', label: 'manage:edit-assay', open: "openConfigAssay('T-NA')" },
  { page: 'sigma', label: 'sigma:add-test', open: 'sgOpenAddTest()' },
  { page: 'sigma', label: 'sigma:add-bias', open: "sgOpenBias(sgData(state.tests[0].id)[0].id, 1)" },
  { page: 'reagent', label: 'reagent:create-comparison', open: 'openRcCreateModal()' },
  { page: 'reagent', label: 'reagent:find-existing', open: 'openRcModal()' },
  { page: 'users', label: 'users:edit-permissions', open: 'openUserPerms(state.users[1].id)' },
  // Shared confirm-dialog component (modals.js #dialogRoot layer, separate
  // from #modalRoot) — every delete/destructive confirmation across the app
  // renders through this one function, so testing it once covers all of
  // them rather than chasing down each individual caller.
  { page: 'dash', label: 'shared:confirm-dialog', open: "confirmDialog({kicker:'Kiểm tra',title:'Xác nhận thao tác',message:'Nội dung xác nhận mẫu để audit accessibility.',detail:'Chi tiết bổ sung cho ngữ cảnh.'})" },
];

async function runAxe(page) {
  const violations = await page.evaluate(async () => {
    const r = await axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map((n) => ({ target: n.target, html: n.html.slice(0, 200), failureSummary: n.failureSummary })),
    }));
  });
  const counts = Object.fromEntries(IMPACTS.map((i) => [i, violations.filter((v) => v.impact === i).length]));
  return { violations, counts };
}

async function auditPage(page, id, title) {
  await page.evaluate((pageId) => go(pageId), id);
  await page.waitForTimeout(150); // let rerender()/chart draws settle
  const { violations, counts } = await runAxe(page);
  return { id, title, violations, counts };
}

// Opens one modal (via its real trigger function, not a synthetic click —
// exercises the same requireAdmin()/requireWrite() gates a real user hits),
// audits the DOM with it open, then closes it so the next modal isn't
// stacked on top (modals.js: single slot, opening one replaces the last).
async function auditModal(page, modal) {
  await page.evaluate((pageId) => go(pageId), modal.page);
  await page.waitForTimeout(150);
  const opened = await page.evaluate((expr) => {
    try { window.eval(expr); } catch (e) { return String(e); }
    if (document.querySelector('#modalRoot .modal')) return 'modalRoot';
    if (document.getElementById('dialogRoot') && document.getElementById('dialogRoot').innerHTML.trim()) return 'dialogRoot';
    return 'modal did not open (gate blocked it, or neither #modalRoot nor #dialogRoot got content)';
  }, modal.open);
  if (opened !== 'modalRoot' && opened !== 'dialogRoot') return { label: modal.label, skipped: opened };
  // #dialogRoot's confirm/info dialogs run a 160ms `dialog-enter` opacity
  // animation (components.css) — scanning mid-animation makes axe compute
  // color-contrast against a partially-transparent element and report a
  // false failure that has nothing to do with the actual (fully-opaque)
  // rendered color. 300ms clears it with margin.
  await page.waitForTimeout(300);
  const { violations, counts } = await runAxe(page);
  await page.evaluate((layer) => {
    if (layer === 'dialogRoot' && typeof closeDialogOverlay === 'function') closeDialogOverlay(false);
    else if (typeof closeModal === 'function') closeModal();
  }, opened);
  return { label: modal.label, violations, counts };
}

// Tabs through the page KEYBOARD_STEPS times and flags any step where focus
// lands on something with zero on-screen size (a control a sighted mouse
// user can reach but a keyboard user effectively can't, since they'd have no
// visible indication where focus went).
async function keyboardSmoke(page, id) {
  await page.evaluate((pageId) => go(pageId), id);
  await page.waitForTimeout(150);
  await page.evaluate(() => document.body.focus());
  const issues = [];
  for (let i = 0; i < KEYBOARD_STEPS; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { tag: 'BODY', visible: true, text: '' };
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, visible: r.width > 0 && r.height > 0, text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40) };
    });
    if (!info.visible) issues.push({ step: i + 1, tag: info.tag, text: info.text });
  }
  return issues;
}

async function main() {
  const session = await openSeededSession({ headless: true });
  try {
    await session.page.addScriptTag({ content: AXE_SOURCE });

    // seed-browser-session.js only seeds operational QC data, not Sigma
    // tracking — without this the Sigma page audits empty (no content to
    // even have a violation). Track the seeded test and add one period via
    // the app's own sgTrackTest()/sgAddPeriod(), not a hand-built
    // state.sigmaData shape, so this stays valid if that shape ever changes.
    await session.page.evaluate(() => {
      const t = state.tests[0];
      sgTrackTest(t.id);
      sgAddPeriod();
    });

    const pages = await session.page.evaluate(() => PAGES.map((p) => ({ id: p[0], title: p[1] })));

    const results = [];
    for (const p of pages) results.push(await auditPage(session.page, p.id, p.title));

    const modalResults = [];
    for (const m of MODALS) modalResults.push(await auditModal(session.page, m));

    const keyboard = [];
    for (const id of KEYBOARD_PAGES) keyboard.push({ page: id, issues: await keyboardSmoke(session.page, id) });

    const checkedModals = modalResults.filter((m) => !m.skipped);
    const totals = Object.fromEntries(IMPACTS.map((i) => [
      i,
      results.reduce((n, r) => n + r.counts[i], 0) + checkedModals.reduce((n, m) => n + m.counts[i], 0),
    ]));
    const report = { generatedAt: new Date().toISOString(), totals, pages: results, modals: modalResults, keyboard };

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

    console.log('Trang'.padEnd(12), IMPACTS.map((i) => i.padStart(9)).join(''));
    for (const r of results) console.log(r.id.padEnd(12), IMPACTS.map((i) => String(r.counts[i]).padStart(9)).join(''));
    console.log('-'.repeat(12 + 9 * IMPACTS.length));
    console.log('TOTAL'.padEnd(12), IMPACTS.map((i) => String(totals[i]).padStart(9)).join(''));

    console.log('\nModal (' + checkedModals.length + '/' + MODALS.length + ' mở được):');
    console.log('Modal'.padEnd(28), IMPACTS.map((i) => i.padStart(9)).join(''));
    for (const m of modalResults) {
      if (m.skipped) console.log(m.label.padEnd(28), '(bỏ qua: ' + m.skipped + ')');
      else console.log(m.label.padEnd(28), IMPACTS.map((i) => String(m.counts[i]).padStart(9)).join(''));
    }

    for (const k of keyboard) {
      if (k.issues.length) console.log(`\nKeyboard [${k.page}]: ${k.issues.length}/${KEYBOARD_STEPS} Tab bị mất focus (không thấy vị trí):`, k.issues.map((i) => `#${i.step} <${i.tag}> "${i.text}"`).join(', '));
      else console.log(`\nKeyboard [${k.page}]: OK, ${KEYBOARD_STEPS} lần Tab đều thấy rõ vị trí focus.`);
    }

    console.log(`\nBáo cáo đầy đủ: ${path.join(OUT_DIR, 'report.json')}`);
  } finally {
    await session.close();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
