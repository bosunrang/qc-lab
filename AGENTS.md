# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

QC Lab — a Vietnamese-language internal-quality-control (IQC) management app for
clinical lab testing: Westgard multi-rules, Six Sigma metrics, Levey-Jennings
charts, reagent lot comparison, CUSUM, ISO 15189-style QC workflow. All UI
strings and code comments are in Vietnamese.

## Running it

No build step, no bundler, no runtime npm dependencies — the browser app is
plain static files. Serve `index.html` with any static file server and open it,
e.g.:

```
python -m http.server
```

(`.claude/launch.json` defines a `qc-lab-static` config doing exactly that on
port 8080, for Claude Code's browser preview.)

`package.json` also carries Electron desktop packaging (`npm start` →
`electron .`, `npm run dist` → NSIS installer via electron-builder, with
`scripts/patch-7za-symlink.js` as a pre-step). The `electron/` folder is part of
the repo (`main.js`, `preload.js`, `license.js`, `activation.html`,
`auto-update.js` — main process, license activation with a 30-day unactivated
trial: first-run timestamp kept in its own `qclab-trial.dat`, separate from
the license file; F12 toggles DevTools since the app menu is disabled), so
those scripts work here once `npm install` has run; for development use the
static server. `index.html`'s Electron-only branch (`window.qcDialog`,
routing `alert()`/`confirm()` through a native dialog) no-ops in a plain
browser.

`electron/auto-update.js` (`initAutoUpdate()`, wired in `main.js` after
`app.whenReady()`) checks GitHub Releases on the public `bosunrang/qc-lab`
repo (`build.publish` in `package.json`) on every launch, silently
downloads in the background, and only interrupts the user once the update is
ready — asking to restart now or later; picking "later" still installs it on
the next natural quit (`autoInstallOnAppQuit`). It no-ops when
`!app.isPackaged` (dev runs). `npm run dist` only builds locally (no token
needed); `npm run dist:publish` additionally uploads the installer to GitHub
Releases, which requires a `GH_TOKEN` env var (a GitHub personal access token
with `repo` scope) — don't run it without one configured, and never commit
that token.

## Tests

No test framework. Each file under `tests/*.test.js` is a plain Node script
that runs top-level `assert` calls and throws on failure — compatible with
Node's built-in test runner but not written using `test()`/`describe()`.

Run everything (`npm test`, or the glob directly — `node --test tests/` fails
on Node ≥23, which tries to `require` the folder):
```
npm test
node --test tests/*.test.js
```

Run one file (either works):
```
node --test tests/qccore.test.js
node tests/qccore.test.js
```

`tests/helpers/sandbox.js` loads real `assets/*.js` files into a `vm` context
(in `index.html` load order; it auto-inserts `analyte-catalog.js` before
`state.js`) to test them without a browser. The requirement is that the file's
*top level* is side-effect-free — no DOM/`window`/`localStorage` at load time —
which nearly every module satisfies: existing tests sandbox everything from
`core.js`/`state.js`/`qc-domain.js`/`qc-rules.js`/the services, view-models and
`*-ui-state.js` files up to render modules (`draw.js`, `sigma.js`,
`reports.js`, `settings.js`), passing stub globals for whatever the function
under test touches. What can't run in the sandbox is *calling* the
DOM-rendering functions themselves — tests against render modules exercise
only their pure helpers.

A pre-commit hook (`.githooks/pre-commit`, installed into `.git/hooks/`) runs
`node --test tests/*.test.js` and blocks the commit on failure; needs no `npm
install` since tests only use Node core modules. `.github/workflows/test.yml`
reruns the same command on every push/PR once the repo has a GitHub remote.

### Visual/print and accessibility checks

`npm run visual-check` and `npm run a11y-audit` are real-browser checks (need
`npm install` + `npx playwright install chromium` first — unlike everything
above, so they're deliberately **not** in `npm test` or the pre-commit hook,
and run in their own `visual-and-a11y` CI job instead of the fast one).
`scripts/lib/seed-browser-session.js` boots the static app in headless
Chromium with a minimal valid QC dataset and an already-authenticated admin
session (no login/password-change UI to fight through), shared by both:

- `scripts/visual-check.js` captures the actual HTML `openPrint()`
  (`reports.js`) writes for the Westgard and Báo cáo reports, renders it
  under `@media print`, and asserts every header box with a background color
  has `print-color-adjust:exact` — this is the property that keeps a header's
  fill printing regardless of the browser's own "print backgrounds" setting;
  checking `backgroundColor` instead would not have caught the 2026-07-23 bug
  this exists for, since that computed value doesn't change based on the
  property. Screenshots go to `tests/__visual__/*.png` (gitignored) for human
  review only — not pixel-diffed, since font rendering varies across
  machines.
- `scripts/a11y-audit.js` runs axe-core against every page in `PAGES`
  (`router-render.js`), the primary "add new X" modal on each page that has
  one (`MODALS` in the script — manage's lot/instrument/assay modals, Sigma's
  add-test modal, reagent's create-comparison modal, users' edit-permissions
  modal), and a keyboard-Tab smoke pass on `dash`/`entry`, writing
  `tests/__a11y__/report.json` (gitignored). The 2026-07-23 baseline run only
  ever saw each page in its default just-loaded state with no modal open and
  Sigma untracked/empty — 0 violations there said nothing about the modals or
  Sigma's real content, since most of this app's forms live in a modal, not
  the page body; `seed-browser-session.js`'s seed only covers operational QC
  data, so `a11y-audit.js` separately calls `sgTrackTest()`/`sgAddPeriod()`
  itself before auditing. `MODALS` is a representative sample (the biggest
  form per area), not exhaustive — extend it if you add a major new modal.
  Since 2026-07-24 the audit is a hard-fail ratchet (same pattern as
  `tests/button-conventions.test.js`): every run is compared against the
  committed `tests/a11y-ratchet.json`; any page/modal/keyboard count above
  the baseline, a new surface with any violation, or a previously-auditable
  modal that no longer opens fails the script with exit 1. After fixing
  violations, tighten the baseline with
  `node scripts/a11y-audit.js --update-baseline` — never raise a number by
  hand. `MODALS.open` entries are real functions (not eval'd strings) so the
  audit works under the CSP, which has no `unsafe-eval`.

## Type checking

`npm run typecheck` (`tsc --noEmit`, config in `tsconfig.json`) runs
TypeScript's `checkJs` over `assets/**/*.js` — no code is written in
TypeScript, this only catches typos/wrong-arity calls/etc. ahead of runtime.
This is a no-module, one-global-scope codebase (see "Architecture" below) that
also *constructs* several of its globals at runtime instead of declaring them
syntactically — `*-ui-state.js` accessor fields, a couple of
`Object.assign(root, {...})` service exports, `core.js`'s UMD `window.QCCore`.
`global.d.ts` declares all of these ambiently so real typos still get caught
instead of drowning in "Cannot find name" noise — **update it when you add a
new field to a `*-ui-state.js` state bag or a new bare-global export**, or
`npm run typecheck` will report a false positive for every reference to it.
`global.d.ts` also loosens `Document#getElementById`/`Element`/`EventTarget`
to `any`, since this codebase reads `.value`/`.dataset`/`.checked`/etc.
straight off DOM query results everywhere without casting — that's expected
here, not something to "fix" by re-tightening those types.

## Benchmarks and release gate

`benchmarks/` holds Node performance scripts; `benchmarks/README.md` documents
methodology, recorded baselines, and which optimizations they justified — read
it before touching startup, storage, Westgard, or chart-render hot paths.

- `node benchmarks/verify-release.js` — pre-release gate: runs all functional
  tests, then `performance-regression.js` against budgets in
  `performance-budget.json`. Ratio/structural checks are the real regression
  signal; absolute ms budgets are intentionally generous — don't tighten them
  from a single fast local run.
- `node benchmarks/performance-baseline.js [--quick]` — full/smoke benchmark.
- `startup-pipeline.js`, `partitioned-startup.js`, `render-pipeline.js` —
  focused profiles; `worker-smoke.html` (served over HTTP alongside the app)
  smoke-tests the real Web Worker.

## Architecture

**No modules, no bundler — one shared global scope.** `index.html` loads
`assets/core.js` then every file in `assets/modules/` via plain
`<script defer>` tags, in a fixed, load-bearing order. Every file (except
`core.js`) declares top-level `function`/`const`/`let` directly into global
scope; later files freely call functions and read state defined by earlier
ones. There is no namespacing — when adding a function, check the existing
global name isn't already taken by another module. If you reorder or split
`<script>` tags in `index.html`, you can break forward references.

`assets/core.js` is the one exception: it's wrapped in a UMD shim
(`(function(root, factory){...})`) so it also works via `require()` — that's
what makes it usable from both the browser (as `window.QCCore`) and Node test
files (`require('../assets/core.js')`). It holds pure, side-effect-free domain
math (stats, Westgard rule evaluation, Sigma metric, CUSUM, backup
validation/sanitization) with no DOM or state dependency — new pure
calculations belong here, not in `state.js`/`qc-domain.js`.

**Code style is dense/minified-looking by convention, not generated.** Most
`assets/*.js` files are hand-written with minimal whitespace (multiple
statements per line, short names). Match the existing density when editing
these files rather than reformatting; a diff that just reflows a file makes
review harder and pollutes the `?v=` cache-busting query strings (see below).

**Cache-busting via query strings.** Every `<script>`/`<link>` tag in
`index.html` has a `?v=<tag>-<date>-<n>` suffix. Bump the version suffix on
any file you edit so browsers pick up the change (there's no build hash). The
Westgard worker URL in `qc-domain.js` (`new Worker('assets/workers/...')`)
carries its own `?v=` — bump it there when editing the worker.

**CSP + SRI (2026-07-24).** `index.html` sets a `<meta>` Content-Security-Policy:
scripts limited to self + inline + `www.gstatic.com`, connections limited to the
Firebase Auth/RTDB endpoints, fonts/images/workers to self. The three Firebase
CDN tags carry `integrity="sha384-..."` + `crossorigin="anonymous"` — when
bumping the Firebase version, recompute each hash
(`curl -sf <url> | openssl dgst -sha384 -binary | openssl base64 -A`) or the
browser will refuse to load the SDK. The CSP deliberately has no `unsafe-eval`;
dev scripts (a11y audit) call app functions directly via Playwright instead of
`window.eval`. The print window (`openPrint()` in `reports.js`) inherits this
CSP and loads Manrope from self-hosted `assets/tokens.css` — do not reintroduce
the Google Fonts link, offline labs must print with correct metrics.

### Module roles (load order matters — see `index.html`)

- `core.js` — pure domain math, UMD (see above). Also
  `validateStateInvariants()`, run at every load/merge/import gateway
  (`state-storage.js`, `firebase-sync.js`, `data-io.js`), and
  `STATE_SCHEMA_VERSION` (currently 4). Holds the pure error-classification
  helpers too (`errorType`, `primaryErrorRule`, `fixHint`,
  `WG_RULE_DESCRIPTIONS`); `qc-domain.js` re-exports them under the same global
  names for the UI.
- `app-meta.js` — loads right after `core.js`, before `state.js`. Sets
  `window.QCLAB_APP` (name/version/build) and `window.QCLAB_CLOUD` (Firebase
  config, `labCode`, `anonymous`/`locked` flags). Contains the live Firebase
  project keys — treat edits here as deploy/config changes, not routine code
  changes.
- `state.js` — the single in-memory `state` object (tests, instruments, QC
  lots/panels, QC data points, actions, users, etc.) plus `ensureShape()`
  migration/normalization logic run after every load/merge. `ensureShape()`
  stamps `STATE_SCHEMA_VERSION` (from `core.js`) onto `state.schemaVersion`.
  It also reconciles Sigma levels with lot-group membership: removing a live
  lot level from every group unlinks that level and deletes its stale
  `sigmaData[testId][].lv[level]`, while stopped/planned groups retain history.
- `analyte-catalog.js` — `TEA_ANALYTE_CATALOG`, a frozen built-in measurand
  registry (one international name + abbreviation per analyte, with CLIA/Ricos
  TEa values). Provenance lives in `docs/tea-sources.md` (CLIA 2024 final rule
  + EFLM BV database references, per-measurand trace table, review log) —
  treat any edit to a `clia`/`ricos`/`cliaAbsolute` figure as a data change
  needing its own justification recorded there, not a routine code edit.
  `tests/tea-sources.test.js` fails if any measurand loses its source row.
- `qc-domain.js` — Westgard rule wiring, error-type classification (thin
  re-exports of the pure helpers in `core.js`), point derivation helpers
  (`pointsOf`, `derived()`, lot/panel lookups) built on top of `state`, and
  the Westgard background worker plumbing: at ≥3000 points
  (`WG_WORKER_POINT_THRESHOLD`) the dashboard offloads Westgard evaluation to
  `assets/workers/westgard-worker.js`, hydrating results only when the
  generation/revision still matches current state, and falls back to the
  synchronous engine if Workers are unavailable or error out. Also owns the
  parallel-lot machinery for lot transitions (`parallelLotForLevel()`,
  `parallelWestgard()` — see the parallel-run decision below). Each rule's
  action (`inactive`/`alert`/`reject`) and scope (`within`/`across`/`both`
  run) can be overridden per test via `t.ruleActions`/`t.ruleScopes`
  (`testRuleAction()`/`testRuleScope()`), layered on top of the global
  defaults in `state.westgardRules`.
- `local-store.js` — IIFE `LocalStore`: an IndexedDB snapshot mirror used as a
  recovery fallback for `localStorage`. Writes are partitioned (boot shell +
  per-test records) and rotate between slots A/B with a manifest — the active
  marker flips only after all records are written, so an interrupted save
  leaves the previous slot recoverable; legacy single-record snapshots migrate
  on the next save.
- `firebase-sync.js` — optional Firebase Realtime Database sync. Per-branch,
  per-element 3-way merge (list branches merge by `id`/content key; scalar
  branches like `lab`/`westgardRules` replace wholesale). Failed pushes retry
  via `fbScheduleRetry()` with exponential backoff (1s doubling to a 30s cap),
  and `online`/`offline` listeners re-trigger push/pull. Merge semantics are
  covered by `tests/firebase-merge.test.js`/`firebase-offline.test.js` — keep
  them in step with any merge change.
- `state-storage.js` — `localStorage` load/save. `loadBootState()` tries
  `localStorage` first, then the `LocalStore` IndexedDB mirror; boot loads a
  small shell first and hydrates the full QC data in the background — login
  and Firebase sync wait for full hydration. Corrupt/invalid `localStorage`
  payloads are quarantined (`quarantineCorruptLocal()`) rather than silently
  dropped. Saves are debounced via `lsSaveDelay()` — 400ms normally, backing
  off to 700ms/1200ms as payload size or serialize time grows — flushed on
  `beforeunload`/`pagehide`/`visibilitychange`, and mirrored to `LocalStore`.
- `qc-rules.js`, `period-service.js`, `sigma-cohort-service.js`, `entry-service.js`,
  `action-workflow-service.js` — smaller service-style modules (some
  IIFE-wrapped) layered on `state`/`qc-domain`. `PeriodService` locks/unlocks
  reporting periods (`state.periodLocks`, a synced list branch); `entry-service.js`
  enforces the lock (blocks add/edit/void once a period is locked), and the
  "Khóa kỳ báo cáo" panel on the Reports page (`actions-routes.js`) is the only
  UI that actually calls `PeriodService.lock()`/`.unlock()` — until 2026-07-22
  this service had no caller at all, so locks could never actually be created.
  `EntryService` normalizes QC-point input
  (`preparePointInput`/`addPoint`/`voidPoint`/`recordPoint`) and builds the
  entry sheet/window data; called from `router-render.js`.
  (`action-workflow-service.js` actually loads a bit later, after the
  `*-ui-state.js` files.)
  `SigmaCohortService` builds period/level cohorts directly from raw QC data,
  split by lot; Sigma precision imports must not reuse `acceptedLotPoints()`
  because that display/operational helper selects one acceptable rerun per day.
- `westgard-view-model.js`, `chart-view-model.js` — pure (DOM-free)
  view-model builders: `WestgardViewModel` for the Westgard page (used by
  `router-render.js`), `ChartViewModel` for charts (used by
  `after-render.js`/`router-render.js`; loads later, after `draw.js`).
- `entry-ui-state.js`, `analysis-ui-state.js`, `sigma-ui-state.js`,
  `reagent-ui-state.js`, `manage-ui-state.js`, `auth-ui-state.js` —
  page-level UI state gathered into named objects (`EntryUIState`, …); each
  field is also exposed as a bare global via
  `Object.defineProperty(globalThis, …)` getter/setter so older code keeps
  working unchanged. Never re-declare a top-level `let`/`var` with one of
  these variable names in another module — it shadows the accessor and
  silently detaches that module from the shared state.
- `audit.js` — tamper-evident audit log: `logAct()` appends hash-chained
  entries using a synchronous pure-JS SHA-256 (`auditSha256`) over a canonical
  JSON form; `auditVerifyChain()` validates the chain. Not for passwords —
  those use PBKDF2 in `users-auth.js`.
- `modals.js` — two independent, non-nesting modal layers, each a single
  slot (opening a second modal in the same layer replaces the first, no
  stacking within a layer):
  - `openModal()`/`closeModal()` render into `#modalRoot` — page/feature forms
    (edit Panel QC, edit user, etc).
  - `confirmDialog(opts)`/`infoDialog(message,opts)` render into a *separate*
    `#dialogRoot` layer, on top of whatever's in `#modalRoot` (2026-07-18).
    These replace the browser's native `confirm()`/`alert()` — both return a
    Promise (`confirmDialog` → boolean, `infoDialog` → resolves on dismiss)
    and neither is called natively anywhere in app code anymore. They're
    deliberately kept off `#modalRoot`: alert()/confirm() guards fire
    constantly from *inside* open form modals (a validation error while
    editing), and `innerHTML` only reflects an input's original `value`
    attribute, not what the user has since typed into the `value` property —
    reusing `#modalRoot` would silently wipe whatever they'd typed. `infoDialog`
    takes an optional `{type:'success'}` (teal) vs. the default `'warn'`
    (amber) icon.
  - `requireWrite()`/`requireAdmin()` (`router-render.js`) call `infoDialog()`
    without `await`-ing it on purpose: ~68 call sites across the app do
    `if(!requireWrite())return;`, so the guard has to stay synchronous. Not
    awaiting is safe because the dialog's own DOM write happens synchronously
    before the returned Promise settles — the caller's boolean is unaffected
    either way.
- `draw.js`, `router-render.js`, `sigma.js`, `actions-routes.js`,
  `manage-routes.js`, `after-render.js`, `entry-tests-actions.js`, `modals.js`
  — UI/rendering and routing. `router-render.js` owns the page list
  (`PAGES`) and per-role page permissions (`PERM`): `rolePageIds(role)` gives
  each role's default page set, and a user's own `pagePerms` (edited in
  `users-auth.js`) can only narrow that set further, never expand past it.
  Page-level UI state lives in the `*-ui-state.js` modules above. `sigma.js`
  renders the Six Sigma page (see "Confirmed business-logic decisions" below
  for how its numbers relate to reports.js).
- `range.js`, `settings.js`, `data-io.js`, `reports.js`, `users-auth.js`,
  `reagent.js` — feature-specific logic (target-range calc, settings page,
  backup import/export + XLSX generation, printed reports, auth/user
  management, reagent lot comparison stats). `users-auth.js` hashes passwords
  with PBKDF2-SHA256 at `PASS_ITERATIONS=600000` (OWASP minimum); the stored
  `pbkdf2$<iterations>$<salt>$<hash>` string carries its own iteration count,
  so legacy 210k-iteration hashes still verify and silently re-hash at the
  current count on next successful login — don't lower `PASS_ITERATIONS` or
  drop that upgrade path. `reagent.js` implements its regression stats
  (Passing-Bablok, Deming/OLS, Bland-Altman, plus a from-scratch incomplete-beta
  t-distribution for CIs) by hand, no stats library — pure like `core.js` but
  page-scoped, covered by `tests/reagent-stats.test.js`.
- `app.js` — small async boot entry point at the bottom of `index.html`
  (`boot()` awaits `loadBootState()` before login/Firebase init).

### Button convention

Three color variants, always in this order right after `btn`: `teal`
(primary action), `ghost` (secondary/cancel), `danger` (destructive). Append
`sm` for compact/table-row buttons. `btn(label,onclick,cls='ghost sm',title='',opts={})`
in `router-render.js` is the shared builder — **always use it**, never
hand-write `<button class="btn ...">`; `opts` supports `{disabled, attrs}` for
disabled state, `style`, `data-*`, or any other extra attribute a button
needs. As of 2026-07-23 every hand-written button in `assets/modules/*.js`
(previously ~140 of them) was converted to call `btn()`, including the ones
that needed dynamic disabled state or a `style=`/`data-*` attribute — so
there's no remaining case that justifies writing one by hand.
`tests/button-conventions.test.js` enforces this as a flat ban (0 hand-written
`<button class="btn ...">` anywhere), not a ratchet, and separately rejects
any hand-written button missing a real teal/ghost/danger variant. Buttons
whose variant is chosen dynamically at runtime (e.g.
`class="btn ${danger?'danger':'teal'}"`) are unaffected — pass that
expression straight through as `btn()`'s `cls` argument.

### CSS structure

`tokens.css` also declares the app's only font (`Manrope`) via `@font-face`,
self-hosted from `assets/fonts/*.woff2` (latin + vietnamese subsets only, 5
weights each) — not loaded from Google Fonts, so text metrics don't shift in
an offline lab or the Electron shell. Regenerate those files the same way if
Manrope needs a new weight: request `fonts.googleapis.com/css2?family=...`
with an old-Chrome user agent (forces discrete static per-weight WOFF2 files
instead of one variable-font file per subset).

`tokens.css` (design tokens), `app.css` (base styles), and
`professional-base.css` (shared professional-theme layout) load first,
followed by `components.css`, then ten page-specific `professional-*.css`
files: `professional-settings.css`, `professional-dashboard.css`,
`professional-entry.css`, `professional-westgard.css`,
`professional-sigma.css`, `professional-reagent.css`,
`professional-config.css` (the "Cấu hình chung"/manage page — not the
Settings page, which is `professional-settings.css`),
`professional-reports.css`, `professional-users.css`,
`professional-audit.css`. `professional-reports.css` covers both the Báo
cáo page and the `actions` page (Khắc phục sự cố) — despite the filename,
that's where `.action-chip`/`.action-log-*`/`.issue-group`/`.issue-row`
live; the `actions` page has no separate file of its own. These files have
overlapping `@media` breakpoints and
height queries and rely on cascade/shorthand ordering between files — check
neighboring `professional-*.css` files for conflicting rules before adding
or reordering selectors, not just the one file you're editing.

`tokens.css` is organized as a small set of hex **primitives** plus semantic
aliases built on them; when a new color is needed, add a primitive and alias
it — don't scatter one-off hex values through the page stylesheets.

### Storage and sync model

Data lives in `localStorage`, mirrored on every save to the partitioned
IndexedDB store (`LocalStore` in `local-store.js`) used only as a recovery
fallback at boot, and optionally to a per-lab Firebase Realtime Database room
(`labCode`, configured in `app-meta.js`). There is no backend beyond that.
This is an **accepted tradeoff of a client-only app**, not an open bug: login
state is a JS variable, not a server-verified token/session, and Firebase
Rules by UID are the only real write boundary when sync is enabled. Don't
"fix" client-side auth without discussing the backend-authentication tradeoff
it implies.

### Confirmed business-logic decisions (don't re-litigate without new input)

- Two "Sigma" numbers are intentionally different: the printed/CSV report's
  Sigma (`reportLevelStats()` in `reports.js`/`data-io.js`) is an observed,
  period-specific value; the Six Sigma page (`sigma.js`) uses explicitly
  reviewed/sourced CV/Bias. Keep them visually disambiguated, don't unify.
- The Six Sigma page's test picker lists only tests defined in "Cấu hình
  chung" — there is deliberately no in-Sigma test creation (an attempt was
  added and reverted once already).
- The Six Sigma page uses a reviewed, single-lot IQC cohort for CV; the cohort
  may cross calendar-month boundaries but is snapshotted at the Sigma period's
  evaluation cutoff. Lots must never be pooled silently, and when more than one
  lot is active in the evaluation month the user chooses the cohort explicitly.
  Bias uses only EQA/EQC results and must not be derived from IQC. When several
  signed EQA/EQC Bias values are entered, Sigma uses their
  root mean square (RMS); the signed arithmetic mean is diagnostic only because
  opposite signs can cancel.
- A CLIA absolute acceptance limit may be converted to TEa% only when the test
  unit exactly matches the criterion unit. On a mismatch, use the percentage
  branch when available and do not persist the absolute branch as applied.
- The Sigma page's `<20`, `20–29`, and `>=30` IQC-point gates are conservative
  application rules, not a claimed CLIA/CLSI minimum: below 20 is estimate-only,
  20–29 is provisional, and only 30+ may drive the page's QC suggestion.
- Mean/SD-from-limits intentionally supports ±2SD only
  (`readTargetMatrixPicks()` in `entry-tests-actions.js` hardcodes
  `sd=(high-low)/4`) — the QC lot inserts actually used never state ±3SD.
- Parallel lot run (chạy song song 2 lô, 2026-07-21): during a lot transition
  the entry sheet renders one column per (level, lot) — a level whose
  transition record (`state.lotTransitions`, synced) is `active` AND whose new
  lot already has its own Mean/SD gets an extra "Song song" column
  (`parallelLotForLevel()` in `qc-domain.js`); it never borrows the old lot's
  Mean/SD. Safety boundary, locked by `tests/parallel-lot-run.test.js`: the
  operating lot stays the only lot deciding patient-result accept/reject —
  parallel points never enter `activeWestgard()`, each lot's chain rules
  (4-1s, 6x, 10x…) run separately via `parallelWestgard()`, and a parallel-lot
  violation never marks the day rejected.
- CUSUM (`cusum()` in `core.js`, opt-in per test via `t.cusum{on,k,h}`,
  configured in the assay modal in `entry-tests-actions.js`) is a reference
  trend chart only (`drawCUSUM()` in `draw.js`, the "Xu hướng CUSUM" tab on
  the Westgard page) — it never changes a point's accept/reject/Westgard
  status; only the Westgard rule engine does that.
- The CLIA/Ricos TEa reference table (`REFTESTS` in `state.js`, now derived
  from `TEA_ANALYTE_CATALOG` in `analyte-catalog.js`) is a built-in default;
  users override/extend it via `state.teaRefs` (synced list branch, edited in the
  "Bảng TEa tham chiếu" tab of the manage page). `sgRef` in `sigma.js`
  resolves a test against `effectiveTeaRefs()` (defaults overlaid with
  `state.teaRefs`), matching **exact name first** then longest-prefix — so
  e.g. "CK-MB" no longer inherits "CK". EFLM TEa stays a per-test manual value
  (`t.tea`), not part of this table.
