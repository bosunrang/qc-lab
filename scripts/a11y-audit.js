// Real accessibility audit: injects axe-core (the WCAG rule engine most
// commercial a11y tools are built on) into every top-level page, on the
// actual rendered DOM of a seeded, logged-in session — not the static regex
// count tests/ui-accessibility.test.js does (that only proves certain
// aria-*/role strings exist somewhere in source, it can't compute contrast,
// can't tell if a label is actually reachable from its control, etc).
//
// Not part of `npm test` — needs Playwright + a Chromium download, so it's a
// separate opt-in script (see CLAUDE.md "Tests").
//
// Hard-fail ratchet (2026-07-24): every run is compared against the committed
// baseline tests/a11y-ratchet.json. Any page/modal/keyboard count ABOVE the
// baseline fails with exit 1; a surface missing from the baseline must come
// back clean; a modal that was auditable before but now won't open also fails
// (silent coverage loss). After fixing violations, tighten the ratchet with
//   node scripts/a11y-audit.js --update-baseline
// so improved counts become the new ceiling and regressions cannot return.
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
// `open` là FUNCTION (không phải chuỗi để eval): Playwright serialize hàm sang
// trang và gọi trực tiếp, nên audit vẫn chạy được dưới CSP không có 'unsafe-eval'
// (index.html đặt script-src không gồm unsafe-eval từ 2026-07-24).
const MODALS = [
  { page: 'manage', label: 'manage:add-instrument', open: () => openConfigInstrument() },
  { page: 'manage', label: 'manage:add-lot', open: () => openConfigLot() },
  { page: 'manage', label: 'manage:add-assay', open: () => openConfigAssay() },
  // "Edit" variants render extra fields (history, etc.) the "add" form
  // doesn't, so they're checked separately, not assumed identical.
  { page: 'manage', label: 'manage:edit-instrument', open: () => openConfigInstrument('I1') },
  { page: 'manage', label: 'manage:edit-lot', open: () => openConfigLot('L1101') },
  { page: 'manage', label: 'manage:edit-assay', open: () => openConfigAssay('T-NA') },
  { page: 'sigma', label: 'sigma:add-test', open: () => sgOpenAddTest() },
  { page: 'sigma', label: 'sigma:add-bias', open: () => sgOpenBias(sgData(state.tests[0].id)[0].id, 1) },
  { page: 'reagent', label: 'reagent:create-comparison', open: () => openRcCreateModal() },
  { page: 'reagent', label: 'reagent:find-existing', open: () => openRcModal() },
  { page: 'users', label: 'users:edit-permissions', open: () => openUserPerms(state.users[1].id) },
  // Shared confirm-dialog component (modals.js #dialogRoot layer, separate
  // from #modalRoot) — every delete/destructive confirmation across the app
  // renders through this one function, so testing it once covers all of
  // them rather than chasing down each individual caller.
  // confirmDialog trả Promise chờ người dùng bấm — bọc thân hàm {} để evaluate
  // không await promise đó (treo script); dialog vẫn render đồng bộ trong thân hàm.
  { page: 'dash', label: 'shared:confirm-dialog', open: () => { confirmDialog({kicker:'Kiểm tra',title:'Xác nhận thao tác',message:'Nội dung xác nhận mẫu để audit accessibility.',detail:'Chi tiết bổ sung cho ngữ cảnh.'}); } },
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
  // modal.open là hàm chính của evaluate (Playwright serialize hàm chính, không
  // serialize hàm ở vị trí tham số). Hàm chạy thẳng trong page context — không
  // qua window.eval nên không cần 'unsafe-eval' trong CSP.
  let opened;
  try {
    await page.evaluate(modal.open);
    opened = await page.evaluate(() => {
      if (document.querySelector('#modalRoot .modal')) return 'modalRoot';
      if (document.getElementById('dialogRoot') && document.getElementById('dialogRoot').innerHTML.trim()) return 'dialogRoot';
      return 'modal did not open (gate blocked it, or neither #modalRoot nor #dialogRoot got content)';
    });
  } catch (e) {
    opened = String(e);
  }
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

    // --- Hard-fail ratchet ---
    const BASELINE_PATH = path.join(__dirname, '..', 'tests', 'a11y-ratchet.json');
    if (process.argv.includes('--update-baseline')) {
      const baseline = {
        generatedAt: report.generatedAt,
        note: 'Trần vi phạm a11y cho phép. Sau khi sửa violation, chạy lại với --update-baseline để siết ratchet; không nâng tay các con số.',
        pages: Object.fromEntries(results.map((r) => [r.id, r.counts])),
        modals: Object.fromEntries(checkedModals.map((m) => [m.label, m.counts])),
        keyboard: Object.fromEntries(keyboard.map((k) => [k.page, k.issues.length])),
      };
      fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
      console.log(`Đã cập nhật baseline ratchet: ${BASELINE_PATH}`);
    } else if (fs.existsSync(BASELINE_PATH)) {
      const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
      const failures = [], improvements = [];
      const check = (scope, key, counts, base) => {
        for (const i of IMPACTS) {
          // Surface chưa có trong baseline phải sạch hoàn toàn (trần = 0).
          const b = base && Number.isFinite(base[i]) ? base[i] : 0;
          if (counts[i] > b) failures.push(`${scope} ${key}: ${i} = ${counts[i]} > baseline ${b}`);
          else if (base && counts[i] < b) improvements.push(`${scope} ${key}: ${i} ${b} → ${counts[i]}`);
        }
      };
      for (const r of results) check('Trang', r.id, r.counts, baseline.pages && baseline.pages[r.id]);
      for (const m of checkedModals) check('Modal', m.label, m.counts, baseline.modals && baseline.modals[m.label]);
      // Modal từng audit được mà giờ không mở được = mất phủ sót âm thầm, tính là hồi quy.
      for (const m of modalResults) {
        if (m.skipped && baseline.modals && baseline.modals[m.label]) failures.push(`Modal ${m.label}: trước audit được, giờ bị bỏ qua (${m.skipped})`);
      }
      for (const k of keyboard) {
        const b = baseline.keyboard && Number.isFinite(baseline.keyboard[k.page]) ? baseline.keyboard[k.page] : 0;
        if (k.issues.length > b) failures.push(`Keyboard ${k.page}: ${k.issues.length} lần Tab mất focus > baseline ${b}`);
        else if (k.issues.length < b) improvements.push(`Keyboard ${k.page}: ${b} → ${k.issues.length}`);
      }
      if (failures.length) {
        console.error('\nA11Y RATCHET FAILED — hồi quy so với baseline:');
        for (const f of failures) console.error('  ✗ ' + f);
        process.exitCode = 1;
      } else {
        console.log('\nA11y ratchet: PASS — không chỗ nào vượt baseline.');
        if (improvements.length) {
          console.log('Có cải thiện so với baseline; nên siết lại bằng node scripts/a11y-audit.js --update-baseline:');
          for (const i of improvements) console.log('  ↓ ' + i);
        }
      }
    } else {
      console.log(`\nChưa có baseline ratchet (${BASELINE_PATH}) — chạy với --update-baseline để tạo lần đầu.`);
    }
  } finally {
    await session.close();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
