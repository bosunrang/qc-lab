# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` at the repo root is a byte-identical mirror of this file except for
its first three lines (title + "guidance to Codex" sentence). Any edit here must
be copied there in the same commit, or the two agent briefs drift apart.

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
`auto-update.js` — main process, license activation with a 14-day unactivated
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

`npm test` runs `scripts/run-tests.js`, which lists `tests/*.test.js` with `fs`
and passes the files explicitly, instead of relying on a glob. The reason is not
style: **`node --test` exits 0 when its pattern matches nothing** (verified —
`node --test "tests/khong-ton-tai-*.test.js"` prints `tests 0` and returns 0). A
shell that doesn't expand the glob would therefore make the pre-commit hook and
the CI job pass while running zero tests. On Linux the shell always expanded it,
but the Windows CI job added 2026-08-01 depends entirely on Node's own glob
support. The script treats "0 test files" as a failure; the hook and all CI jobs
go through it, and `benchmarks/verify-release.js` (which already enumerated the
files itself) now refuses an empty list too. The bare glob above is still fine
for a one-off local run.

Run one file (either works):
```
node --test tests/qccore.test.js
node tests/qccore.test.js
```

`tests/helpers/sandbox.js` loads real `assets/*.js` files into a `vm` context
(in `index.html` load order) to test them without a browser. The requirement
is that the file's *top level* is side-effect-free — no DOM/`window`/
`localStorage` at load time — which nearly every module satisfies: existing
tests sandbox everything from `core.js`/`qc-rules.js`/the services,
view-models and `*-ui-state.js` files, passing stub globals for whatever the
function under test touches. What can't run in the sandbox is *calling* the
DOM-rendering functions themselves — tests against render modules exercise
only their pure helpers. `assets/modules/` is empty as of 2026-08-20 (Pha G
nhóm C done, `state.js`/`analyte-catalog.js` retired last) — any sandbox
needing state/domain logic must list `'generated/modular-pilot.js'`
explicitly; `sandbox.js` used to auto-insert `analyte-catalog.js` before
`modules/state.js` and push the bundle when that filename was present, but
that trigger can never fire again now that the file is gone, so the
auto-append branch was deleted rather than left dead.

Several tests are **source scanners, not behaviour tests** — they read the repo
as text and enforce conventions no compiler here can. Expect them to fail on a
structural change and fix the structure, not the test:

- `global-name-uniqueness.test.js` — no two files in the single shared global
  scope may declare the same top-level name (see "Architecture"). Its scanner is
  line/indent-based to match this codebase's style: top-level declarations must
  sit at column 0 and stay one logical declaration per line, or it can't see
  them. Workers are excluded (own global scope).
- `ui-route-structure.test.js` — pins the router/page split and the
  `index.html` load order of the bundle → `*-routes.js`.
- `button-conventions.test.js` — the `btn()` ban on hand-written buttons (see
  "Button convention").
- `firebase-rules.test.js` — the rules text the Settings page shows
  (`firebaseRulesText()`) must equal `firebase/database.rules.json` verbatim.
- `tea-sources.test.js` — every measurand keeps a row in `docs/tea-sources.md`.
- `westgard-rule-registry.test.js` — the Westgard rule list lives only in
  `core.js`'s `WG_RULE_REGISTRY`; no other source file may spell out three or
  more rule ids (see "Module roles" → `core.js`).

A pre-commit hook (`.githooks/pre-commit`, installed into `.git/hooks/`) runs
`node scripts/run-tests.js` and blocks the commit on failure; needs no `npm
install` since tests only use Node core modules. `.github/workflows/test.yml`
has four jobs: `test` (the same install-free command), `release-gate`
(`npm ci` → `npm run typecheck` → `npm run verify-release`),
`visual-and-a11y` (Playwright/Electron checks below), and `windows`
(`runs-on: windows-latest` — the same install-free `node scripts/run-tests.js`
plus `npm run print-check` without `xvfb-run`). The Windows job exists because
the product ships as NSIS Windows x64 only, `index.html` carries a patch for a
Windows-only Chromium dialog bug, and `print-check` otherwise exercises the
desktop print path on Linux, an OS the product never runs on.

### Coverage blind-spot map

`npm run coverage-map` (`scripts/coverage-map.js`) runs the whole suite under
Node's built-in `NODE_V8_COVERAGE` — no extra dependency — and writes
`docs/coverage-map.md`. **Rewritten 2026-08-21**: the original (2026-08-01)
version only measured `assets/**/*.js`, which made sense when most business
logic still lived there as classic JS; after nhóm D closed the migration,
`assets/**/*.js` is down to 3 build artifacts + a 1-line boot utility, so
measuring only that told you almost nothing. The tool now reports two
sections: **(A) `src/**/*.ts`** — measured directly from the real script URL
each test process reports (the ~450 test files that `spawnSync(process.execPath,
['--input-type=module', ...])` a single `.ts` file inherit `NODE_V8_COVERAGE`
from the parent and V8 reports coverage keyed by that file's own path, no
sourcemap needed); **(B) `assets/**/*.js`** — the ~61 `vm`-sandbox tests
(`tests/helpers/sandbox.js`) still only exercise the *built* bundle/`core.js`/
worker, and since none of those builds emit a sourcemap, section B cannot map
back to individual `.ts` lines — it only tells you whether the bundle's own
wiring ran at all, not which business function is untested (that question
belongs to section A). It is still deliberately **not a gate**: no thresholds,
exits non-zero only if the test suite itself fails or no coverage data was
found at all. V8's offsets are source *character* offsets (not UTF-8 bytes —
this codebase is full of Vietnamese, so the two differ a lot). The 2026-08-21
baseline after the rewrite: section A 22.5% over 750 files with 279 never
loaded by any direct-import test — expect this, not a red flag: the files at
the top of that never-loaded list are exactly the large `*-page-controller.ts`/
`modular-pilot.global.ts` factory files that are only ever exercised *indirectly*
through the wired bundle (section B), never imported standalone by a test;
section B separately shows 49.7% across the 3 real build artifacts.

### Visual/print and accessibility checks

`npm run visual-check`, `npm run a11y-audit` and `npm run print-check` are
real-browser checks (need `npm install` + `npx playwright install chromium`
first — unlike everything above, so they're deliberately **not** in `npm test`
or the pre-commit hook, and run in their own `visual-and-a11y` CI job instead
of the fast one). `scripts/lib/seed-browser-session.js` boots the static app
in headless Chromium with a minimal valid QC dataset and an
already-authenticated admin session (no login/password-change UI to fight
through), shared by visual-check/a11y-audit (print-check reuses its
`buildSeedState()` but boots the app in Electron instead — on headless Linux
it runs under `xvfb-run`, see the CI job):

- `scripts/visual-check.js` captures the actual HTML `openPrint()`
  (`report-print-controller.ts`) writes for the Westgard and Báo cáo reports, renders it
  under `@media print`, and asserts every header box with a background color
  has `print-color-adjust:exact` — this is the property that keeps a header's
  fill printing regardless of the browser's own "print backgrounds" setting;
  checking `backgroundColor` instead would not have caught the 2026-07-23 bug
  this exists for, since that computed value doesn't change based on the
  property. Screenshots go to `tests/__visual__/*.png` (gitignored) for human
  review only — not pixel-diffed, since font rendering varies across
  machines.
- `scripts/a11y-audit.js` runs axe-core against every page in `PAGES`
  (`router-page-policy.ts`, bridged as `root.PAGES`), the primary "add new X" modal on each page that has
  one (`MODALS` in the script — manage's lot/instrument/assay modals, Sigma's
  add-test/EQA-bias/MU-budget modals, reagent's create-comparison modal, users'
  edit-permissions modal), and a keyboard-Tab smoke pass on `dash`/`entry`, writing
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
- The NCE form on the "Khắc phục sự cố" page renders every field straight from state
  (`actionFormModel()`), keeps in-progress typing across `rerender()` via
  `captureActionDraft()`, and collapses sections 2–8 into `<details>` whose open/closed
  state lives in `actionOpenSections`. The narrative fields carry insert-and-edit
  suggestion chips (`ACT_SUGGEST`, `actionSuggestRow()`) rather than closed dropdowns —
  a fixed picker for "root cause" would make every NCE record read identically and
  prove nothing under an ISO 15189 review, which is the same reason the void reason
  keeps a free-text note. Chips for cause/corrective action are context-driven by
  `causeCategory` and the SE/RE split that `fixHint()` already owns. Protocol-v3
  records additionally require a traceable SOP basis for the initial risk,
  an explicit release-to-service decision after held results, and a residual-risk
  reassessment before an "effective" conclusion; these fields are retained by
  backup sanitization and the full NCE audit CSV.
- `ActionRerunService` (`src/application/nce/action-rerun-service.ts`, bridged as
  `root.actionRerunStatus`/`root.actionPoint`/… — retired from classic
  `action-workflow-service.js` on 2026-08-20, xem "Module roles") phải giữ chi phí
  `actionRerunStatus()` không tăng theo tổng số điểm QC: nó bị gọi 5 lần cho CÙNG một hồ sơ trong một lần vẽ
  (`actionWorkflowStatus()` → `actionProtocolStatus()` nhánh release →
  `actionEffectivenessStatus()`), và bản đầu mỗi lần quét lại toàn bộ
  `state.data[testId]` — đo được 5 894ms mỗi lần vẽ bảng nhật ký với 40 000 điểm × 600
  hồ sơ, còn 171ms sau khi thêm `actionLotPoints()` (index theo xét nghiệm/mức/lô, đã
  bỏ điểm hủy và sắp sẵn nên dừng ở ứng viên đầu tiên) cùng memo cho
  `actionRerunStatus()`/`actionPoint()`. KHÔNG dùng `pointsForLot()` của `qc-domain.js`
  cho việc này: cache đó chỉ được xả qua `clearDerived()`, trong khi lưu hồ sơ dùng
  `save({clearDerived:false})`. Mọi cache ở đây TỰ KIỂM CHỨNG — chữ ký gồm tham chiếu và
  độ dài mảng điểm QC, cộng các trường của hồ sơ mà phép tính đọc tới — nên thay nguyên
  `state` hay thêm/bớt điểm đều tự trượt. `clearDerived()`/`clearDerivedForTest()` gọi
  thêm `invalidateActionCaches()` cho trường hợp sửa giá trị tại chỗ. Đừng chốt phần này
  bằng mốc thời gian trong test: hai tối ưu che lẫn nhau nên phép đo không phân biệt
  được cái nào hỏng (bỏ index còn cho tỉ lệ NHỎ hơn giữ index) — hãy chốt bằng việc
  cache tự trượt, như `tests/action-workflow-service.test.js` đang làm.
- `scripts/nce-workflow-check.js` (`npm run nce-check`) drives the NCE record
  lifecycle on the "Khắc phục sự cố" page in real Chromium, because every bug it
  guards only appears once the form is rendered *and re-rendered*: the edit/new
  form must survive `rerender()` (a Firebase pull mid-typing used to blank it and
  the next save wrote empty strings over the checklist), the incident identity
  (`testId`/`level`/`lot`/`pointId`) must stay immutable once the record exists
  (changing the test dropdown made `actionPoint()` return null and silently
  dropped the QC-rerun gate), and the rerun/overdue/escalation chips must match
  between "Sự cố cần xử lý" and "Hồ sơ NCE đang mở". Each area was proven
  discriminating by reintroducing the original bug and watching the matching
  checks fail.
- `scripts/ui-workflow-check.js` (`npm run ui-check`) is the browser-level
  record-mutation smoke gate. It crosses the real DOM, route handlers, state,
  persistence scheduling and hash-chained audit for four workflows that vm
  service tests cannot prove end to end: enter then void a QC point, add/edit
  instruments and assays (including decimal/CUSUM fields), lock/unlock a report
  period through password re-authentication, and restore a checked backup after
  the automatic pre-change download. Keep it in the `visual-and-a11y` CI job;
  adding a new high-impact UI mutation path means extending this script or an
  equally real browser workflow, not merely source-scanning its button text.
- `scripts/print-check.js` covers the DESKTOP print-to-PDF pipeline that
  nothing else in the repo can see: it boots the real app in Electron, opens
  the real print window via `printWestgard()` → `openPrint()`, drives the same
  main-process path the "Lưu PDF" button uses (`printToPDF` with
  `printBackground` + `preferCSSPageSize`), then asserts on the generated
  PDF's decompressed content stream — no large rect filled with the
  screen-preview background `#EEF2F5` (the 2026-07-24 defect where the print
  window's `backgroundColor` showed through the whole PDF page, because Blink
  does not paint the body background onto the print canvas; small `#EEF2F5`
  table-border rects are legitimate and ignored), the teal header `#0E8F8F`
  still paints, and the report text is present. It also pins the desktop UX
  contract: exactly one "Lưu PDF" button wired to `opener.qcPrintPdf`. The
  review PDF lands in `tests/__print__/` (gitignored). The check was proven
  discriminating by temporarily reverting `backgroundColor` to `#eef2f5` and
  watching it fail.

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
  tests, then two dependency audits, then `performance-regression.js` against
  budgets in `performance-budget.json`. Ratio/structural checks are the real
  regression signal; absolute ms budgets are intentionally generous — don't
  tighten them from a single fast local run. The audit step is deliberately
  split (2026-07-28): `npm audit --omit=dev --audit-level=high` **blocks** the
  release, because that tree is what actually ships (`build.files` packages
  only `index.html`/`assets`/`electron`/`package.json`, so the sole runtime
  dependency is `electron-updater`); the full-tree audit only **reports**, since
  a devDependency CVE threatens the build machine, not the lab. Handle those
  with a risk row in `docs/validation/RISK-ASSESSMENT.md`, not with an
  `overrides` entry — forcing `brace-expansion@^5.0.8` to clear the current 16
  findings was tried and reverted: 5.x switched to the named export
  `{ expand }`, so `minimatch@3.1.5`/`5.1.9` inside electron-builder throw
  `expand is not a function` and packaging breaks while `npm audit` reads
  green. Neither audit may skip the performance gate — that's how a red gate
  used to hide whether performance still passed.
- `node benchmarks/performance-baseline.js [--quick]` — full/smoke benchmark.
- `startup-pipeline.js`, `partitioned-startup.js`, `render-pipeline.js` —
  focused profiles; `worker-smoke.html` (served over HTTP alongside the app)
  smoke-tests the real Web Worker.

## Architecture

**No modules, no bundler — one shared global scope.** `index.html` loads
`assets/core.js`, then the compiled TypeScript bundle
(`assets/generated/modular-pilot.js`, built by `npm run build:pilot` from
`src/compat/modular-pilot.global.ts`) — two `<script defer>` tags, in a
fixed, load-bearing order. `assets/modules/` is empty as of 2026-08-20 (Pha G
nhóm C complete): it used to hold every classic-JS page/route/service file,
each declaring top-level `function`/`const`/`let` directly into global scope
so later files could freely call functions and read state defined by earlier
ones; all of that logic has since retired into the bundle (assigned as
`root.X=` properties, see "Module roles" below for the retirement history of
each former file) or into `src/presentation`/`src/application`/`src/domain`
TypeScript modules the bundle imports. `assets/app.js` (the boot entry point)
retired the same way on 2026-08-20 (Pha H1, lát 1) — `root.boot` is now
registered via `document.addEventListener('DOMContentLoaded', ...)` at the
end of the bundle rather than a classic script that just calls `boot()` at
load time; see "Module roles" below. `assets/core.js` itself retired to
TypeScript the same day (nhóm D, closing the migration's last classic-app
file — see "Module roles" → `core.js` for the build-pipeline detail), so as
of this writing the ONLY hand-written classic JS left anywhere in the app is
`assets/nav-collapse-init.js` (1 line, a boot-order utility, not business
logic — see "CSP + SRI" below). There is still no namespacing at the
global-scope boundary — when adding a global (a bare `root.X=` in the
bundle, or an `export`ed name in `src/domain/core/qc-core.ts`, which is
`assets/core.js`'s TypeScript source) check the name isn't already taken; a
collision silently replaces the other binding and only surfaces weeks later,
so `tests/global-name-uniqueness.test.js` scans `core.js` AND the generated
bundle and fails on duplicates. If you reorder the 2 remaining `<script>`
tags in `index.html`, you can still break forward references.

`assets/core.js` is the one exception: it's wrapped in a UMD shim so it also
works via `require()` — that's what makes it usable from both the browser
(as `window.QCCore`) and Node test files (`require('../assets/core.js')`).
Since 2026-08-20 (nhóm D) this file is a Vite build artifact, not hand-written
— see "Module roles" → `core.js` for the source path and build command; the
UMD shape itself is unchanged, generated by Rollup's own UMD template instead
of a hand-written wrapper. It holds pure, side-effect-free domain math (stats,
Westgard rule evaluation, Sigma metric, measurement uncertainty, CUSUM, backup
validation/sanitization) with no DOM or state dependency — new pure
calculations belong here, not in the bundle's `state`/Westgard wiring (former
classic `state.js`/`qc-domain.js`, retired 2026-08-20 — see "Module roles").

**Code style is dense/minified-looking by convention, not generated.** Most
`assets/*.js` files are hand-written with minimal whitespace (multiple
statements per line, short names). Match the existing density when editing
these files rather than reformatting; a diff that just reflows a file makes
review harder and pollutes the `?v=` cache-busting query strings (see below).

**Cache-busting via query strings.** Every `<script>`/`<link>` tag in
`index.html` has a `?v=<tag>-<date>-<n>` suffix. Bump the version suffix on
any file you edit so browsers pick up the change (there's no build hash). The
Westgard worker URL, wired in `src/compat/modular-pilot.global.ts`
(`new Worker('assets/workers/...')`) since the classic `qc-domain.js` that
used to hold it retired into the bundle on 2026-08-20, carries its own `?v=`
— bump it there (and rebuild via `npm run build:pilot`) when editing the
worker.

**CSP + SRI (2026-07-24, `script-src` tightened further 2026-08-20).**
`index.html` sets a `<meta>` Content-Security-Policy: scripts limited to self
+ `www.gstatic.com` (no `'unsafe-inline'` since Pha H2's last lát — see
`action-dispatcher.ts` above for the event-delegation work that made this
possible), connections limited to the Firebase Auth/RTDB endpoints,
fonts/images/workers to self. `style-src` keeps `'unsafe-inline'` — a
separate directive, unrelated to the script-src change, since this codebase
still assigns `style="..."` directly from JS in hundreds of places (changing
that is a separate, much larger project). The three Firebase CDN tags carry
`integrity="sha384-..."` + `crossorigin="anonymous"` — when bumping the
Firebase version, recompute each hash
(`curl -sf <url> | openssl dgst -sha384 -binary | openssl base64 -A`) or the
browser will refuse to load the SDK. The CSP deliberately has no `unsafe-eval`;
dev scripts (a11y audit) call app functions directly via Playwright instead of
`window.eval`, and load axe-core itself via `page.evaluate(AXE_SOURCE)` (a
bare string, run through the DevTools Protocol, not a page `<script>` tag)
rather than `page.addScriptTag()`, which the tightened `script-src` now
blocks. The print window (`openPrint()` in `report-print-controller.ts`)
inherits this CSP (same-origin `document.write()`) — its former inline
`<script>` (defining `qcSavePdf`/`qcDoPrint`) is gone; the click listener and
`window.__qcPrintToken` property are now set from the OPENER side after
`document.write()`, plain property assignment being unaffected by CSP. It
loads Manrope from self-hosted `assets/tokens.css` — do not reintroduce the
Google Fonts link, offline labs must print with correct metrics.

### Module roles (load order matters — see `index.html`)

- `core.js` — pure domain math, UMD (see above). Also
  `validateStateInvariants()`, run at every load/merge/import gateway
  (`state-storage.js`, `firebase-sync.js`, `backup-service.js`), and
  `STATE_SCHEMA_VERSION` (currently 6). Version 6 introduced an `archiveRegistry`
  branch for a year-archive feature that was **removed again on 2026-08-01, before
  any release** — do not roll the number back to 5, because dev states already stamped
  6 and `validateStateInvariants()` rejects a state whose `schemaVersion` exceeds the
  app's. `sanitizeBackup()` only overwrites the fields it knows and does **not** strip
  unknown ones, so `ensureShape()` deletes the stale `archiveRegistry` explicitly;
  that is the pattern to copy whenever a state branch is retired.
  Holds the pure error-classification
  helpers too (`errorType`, `primaryErrorRule`, `fixHint`,
  `WG_RULE_DESCRIPTIONS`); the Westgard wiring (see "Module roles" below,
  retired into the TS bundle 2026-08-20) re-exports them under the same
  global names for the UI. Since 2026-08-01 it also owns the **rule-semantics tables**
  — `defaultRuleAction`/`resolveRuleAction` (which rules only warn:
  `WG_ALERT_RULES` = 1-2s/6x/7T) and `defaultRuleScope`/`resolveRuleScope`
  (within/across/both by rule and QC level count), plus `ruleEnabled`,
  `ruleOnInScope`, `ruleVerdictLevel`. These are the SINGLE SOURCE for both
  Westgard engines: the Westgard wiring feeds them state (global toggles, per-test
  `ruleActions`/`ruleScopes`, `operationalLevels().length`) and
  `workers/westgard-worker.js` feeds them the job payload. Do not re-inline
  either table into a caller — until 2026-08-01 both files carried their own
  hand-written copy, and mutating only the worker's copy passed all 58 tests
  while silently changing accept/reject verdicts for any test over
  `WG_WORKER_POINT_THRESHOLD` points. `tests/westgard-worker.test.js` now pins
  main-thread/worker parity across every rule × level count × override case.
  Also since 2026-08-01, the **rule list itself** is one registry:
  `WG_RULE_REGISTRY` — one object per rule carrying `id`, `desc`, `err` (SE/RE/''),
  `defaultOn`, `alert`, `scope`+`scopeMin`, `priority`, the `run` predicate triple
  for the "N consecutive points" family, and the `fix` hint. `WG_RULES`,
  `WG_DEFAULT_ON`, `WG_RUN_RULES`, `WG_ALERT_RULES`, `WG_SE_RULES`/`WG_RE_RULES`,
  `WG_RULE_DESCRIPTIONS`, `primaryErrorRule`'s priority order and the Westgard
  page's guide table are all **derived** from it — before this, that list was
  spelled out in 8 source files, so adding a rule meant 8 edits and one forgotten
  edit drifted silently (the guide table's descriptions and reject/warn column
  were hand-typed and nothing compared them to the engine). Adding a rule is now
  one row here, plus engine work only if it isn't a `run`-family rule.
  `tests/westgard-rule-registry.test.js` pins both halves: every derived list must
  match the registry, and **no source file outside `core.js` may spell out three or
  more rule ids** (a text scan, like `button-conventions.test.js`; 1–2 ids is
  legitimate single-rule logic — the registry-list scan itself now reads
  `src/domain/core/qc-core.ts` rather than the built `assets/core.js`, see
  below). **Retired to TypeScript 2026-08-20 (nhóm D, the last classic-app
  file — `assets/workers/westgard-worker.js` retired the same day, see its own
  bullet below).** Source is `src/domain/core/qc-core.ts` — a near-verbatim
  port (deliberately not "cleaned up" while porting, for the same reason
  `data-io.js`'s Route 15 wasn't: a misplaced line here silently changes a
  Westgard verdict app-wide with no test catching it, so minimizing the diff
  minimizes that risk) with real ES `export`s instead of the classic
  `return{...}` object, and mostly `any`-typed parameters — matching this
  repo's typecheck philosophy (catch typos/arity errors, not model every
  dynamic JSON shape precisely) rather than attempting a rigorous type system
  for `sanitizeBackup()`/`validateBackup()`/`validateStateInvariants()`'s
  deliberately-loose input shapes. Built by `npm run build:core`
  (`vite build --config vite.core.config.mjs`, folded into `build:pilot`),
  `formats:['umd']`, `name:'QCCore'` — Rollup's own UMD template reproduces
  the same `module.exports=`/`window.QCCore=` dual shape the hand-written
  wrapper used to provide, so every consumer (`index.html`'s script tag, the
  7+ `require('../assets/core.js')` test files, `modular-pilot.global.ts`'s
  `root.QCCore` guard, the `vm`-sandboxed benchmarks) needed zero changes.
  `tsconfig.json` excludes the built `assets/core.js` from `checkJs` (like
  `assets/generated/**`) — its real type-checking now happens on the `.ts`
  source under `tsconfig.modules.json`'s `strict:true`.
- `assets/workers/westgard-worker.js` — the Westgard-evaluation Web Worker
  bootstrap (see below, "Westgard rule wiring" bullet, for when it's used and
  what `computeWestgardJob`/`ruleAction`/etc. do). Retired to TypeScript
  2026-08-20 (nhóm D) as `src/workers/westgard-worker.ts` — kept as ONE file,
  bootstrap and pure logic together, deliberately NOT split the way most other
  route retirements were: `tests/westgard-worker-onmessage.test.js` reads this
  file's raw built TEXT and `vm.runInContext`s it directly in a context
  containing only `self` (no `module`, no `importScripts`) to exercise the
  real `self.onmessage` path a plain Node `require()` never reaches — splitting
  bootstrap from logic into two files would mean the built bootstrap needs a
  second `importScripts()` to reach the logic, which that minimal `vm` context
  doesn't support, breaking the test's success path. Built by
  `npm run build:worker` (`tsc -p tsconfig.worker.json`, folded into
  `build:pilot`) rather than Vite: Vite/Rollup's ES-module output wraps any
  file that references `module`/`require`/`exports`-like identifiers in a
  CommonJS-interop shim and appends a top-level `export default ...` — which
  broke both the "plain script, not a module" contract `vm.runInContext` needs
  and silently changed `require('../core.js')` into a custom `__require()`
  proxy shim. Plain `tsc` targeting `module:"commonjs"` for this one file
  (which has zero real `import`/`export` statements — `module`/`require`/
  `importScripts` are just `declare`d ambient identifiers referenced through
  `typeof` guards, exactly like the original hand-written file) emits an
  almost byte-identical file, since TypeScript only adds module-wrapper
  boilerplate when a file actually contains `import`/`export` syntax.
- `QCLAB_APP`/`QCLAB_CLOUD` — sets `window.QCLAB_APP` (name/version/releaseDate
  — bump both per `docs/validation/RELEASE-PUBLISH.md`) and `window.QCLAB_CLOUD`
  (Firebase config, `labCode`, `anonymous`/`locked` flags). Contains the live
  Firebase project keys — treat edits here as deploy/config changes, not
  routine code changes. Retired from classic `app-meta.js` on 2026-08-19 (Pha G
  hạ tầng, lát 3): pure data with zero functions, so it moved as-is into
  `src/compat/modular-pilot.global.ts` as `root.QCLAB_APP = {...}` /
  `root.QCLAB_CLOUD = root.QCLAB_CLOUD || {...}`, right after `const root =
  globalThis as QCLabGlobal`. Every consumer (`users-auth.js`'s login screen,
  the Firebase config source service, the router shell's version display, the
  Sigma/report export metadata) already read `window.QCLAB_APP`/`QCLAB_CLOUD`
  through a lazy closure, so moving the assignment later in script load order
  (the bundle now loads after `state.js`/`qc-domain.js`/`firebase-sync.js`
  instead of right after `core.js`) changed nothing observable — confirmed
  with a live browser boot showing the correct version on the login screen.
- The single in-memory `state` object (tests, instruments, QC lots/panels, QC
  data points, actions, users, etc.) plus `ensureShape()` migration/
  normalization logic run after every load/merge. `ensureShape()` stamps
  `STATE_SCHEMA_VERSION` (from `core.js`) onto `state.schemaVersion`. It also
  reconciles Sigma levels with lot-group membership: removing a live lot
  level from every group unlinks that level and deletes its stale
  `sigmaData[testId][].lv[level]`, while stopped/planned groups retain
  history. **`state` and the derived caches (`pointsCache`/`pointsIndexCache`/
  `pointsLotCache`/`wgMemo`/`acceptedMemo`/`cusumMemo`/`derivedIndex`) plus
  `mem`/`startupProblem` are `root.X` data properties, NOT `let` (Pha G hạ
  tầng, tách nền 2026-08-19, folded into the bundle at lát 6 below).** Not an
  accessor — that would add getter overhead on the app's hottest binding; the
  caches stay stable Map references (invalidation only `.clear()`/
  `.delete()`s, never reassigns). checkJs sees these via `declare var` in
  `global.d.ts` (for the 3 remaining classic files) and via a module-local
  `declare let` inside `modular-pilot.global.ts` itself. Retired from classic
  `state.js` (140 lines) TOGETHER with `analyte-catalog.js` (below) on
  2026-08-20 (Pha G nhóm C, lát 6 — the slice that closes nhóm C,
  `assets/modules/` is empty after it): every function there already only
  forwarded to an existing TypeScript service (`qcStateFoundation`/
  `qcStateLifecycle`/`qcLevelReconciliation`/`qcRangeLimitRepair`/
  `ManageConfigService`/`qcLotTargetHistory`/`derivedCacheInvalidation`/
  `qcStaffIdentity`/`qcDateFormat`/`qcBasicFormat`/`qcValueFormat`/
  `qcTestConfiguration`/`qcConfigurationRelations`/`PeriodService`/
  `ReagentComparisonService`), so it moved as-is into
  `src/compat/modular-pilot.global.ts` — but unlike every prior lát, placed at
  the very TOP of the bundle's runtime code (right after the guard that
  validates `root.QCCore`), not next to its own dependency cluster. Reason:
  `SigmaTeaResolution`'s factory reads `TEA_SOURCE_REGISTRY`/
  `TEA_ANALYTE_CATALOG`/`REFTESTS` eagerly (not through a lazy closure) much
  later in the same file, mirroring how classic `sigma-tea.js` used to; this
  port had to land before that read, matching the classic load order
  (`analyte-catalog.js` → `state.js` → every other module). Confirmed by a
  two-line `vm.runInContext` experiment: a `const` declared inside a function
  in one script execution throws `ReferenceError` when referenced bare from a
  *separate* later script execution on the same context, while a `root.X=`
  (or `globalThis.X=`) assignment from the first resolves fine in the second
  — the same "IIFE-scope trap" documented for `state-storage.js`'s lát, this
  time hitting DATA consts (`WG_RULES`/`REFTESTS`/`TEA_SOURCE_REGISTRY`/
  `QC_DECIMALS_DEFAULT`/`teaAnalyteKey`/…), not just mutable variables — these
  used to be readable bare purely because `state.js` was still a separate
  classic `<script>` loaded before the bundle (V8's shared top-level lexical
  scope across sequential script evaluations in one realm), a mechanism that
  stops working the moment they're declared inside the bundle's own IIFE.
  Fixed the same way as every mutable binding before them: `root.X=`
  assignment instead of a bundle-local `const`. No dead code to drop this
  time — every function/const in `state.js` still had a real caller. One
  test (`tests/tea-reference-service-bridge.test.js`) pins the literal
  ambient-declare text `declare const REFTESTS: readonly any[][];`, so the
  `Object.freeze(array.map(row=>Object.freeze([...])))` construction (whose
  real type is `readonly (readonly any[])[]`) got a local `as readonly
  any[][]` cast at the assignment instead of a type change.
- `TEA_ANALYTE_CATALOG`, a frozen built-in measurand registry (one
  international name + abbreviation per analyte, with CLIA/Ricos TEa values).
  Provenance lives in `docs/tea-sources.md` (CLIA 2024 final rule + EFLM BV
  database references, per-measurand trace table, review log) — treat any
  edit to a `clia`/`ricos`/`cliaAbsolute` figure as a data change needing its
  own justification recorded there, not a routine code edit.
  `tests/tea-sources.test.js` fails if any measurand loses its source row;
  since classic `analyte-catalog.js` retired together with `state.js` above
  (2026-08-20), that test now loads the catalog from the bundle
  (`loadSandbox(['core.js','generated/modular-pilot.js'])` +
  `run(ctx,'TEA_ANALYTE_CATALOG')`) instead of `vm`-evaluating the deleted
  classic file's source text directly.
- Westgard rule wiring, error-type classification (thin re-exports of the
  pure helpers in `core.js`), point derivation helpers (`pointsOf`,
  `derived()`, lot/panel lookups) built on top of `state`, and the Westgard
  background worker plumbing: at ≥3000 points the dashboard offloads Westgard
  evaluation to `assets/workers/westgard-worker.js`, hydrating results only
  when the generation/revision still matches current state, and falls back to
  the synchronous engine if Workers are unavailable or error out. Also owns
  the parallel-lot machinery for lot transitions (`parallelLotForLevel()`,
  `parallelWestgard()` — see the parallel-run decision below). Each rule's
  action (`inactive`/`alert`/`reject`) and scope (`within`/`across`/`both`
  run) can be overridden per test via `t.ruleActions`/`t.ruleScopes`
  (`testRuleAction()`/`testRuleScope()`), layered on top of the global
  defaults in `state.westgardRules`. Retired from classic `qc-domain.js` on
  2026-08-20 (Pha G nhóm C, lát 5): every function there already only
  forwarded to an existing TypeScript service (`westgardRulePolicy`/
  `westgardRuleSettings`/`westgardMemoCache`/`qcCusumMemoCache`/
  `qcAcceptedMemoCache`/`qcDerivedIndex`/`qcPointCache`/`qcOperationalAccess`/
  `qcActiveWestgard`/`qcParallelWestgard`/`qcPointVoidVerdict`/`qcLotLineage`/
  `qcLotGroupLevels`/`qcErrorDetail`/`westgardWorkerRevisionService`/
  `westgardWorkerPrewarmPlanner`/`westgardWorkerJobBuilder`/
  `westgardWorkerHydrate`/…), so it moved as-is into
  `src/compat/modular-pilot.global.ts` right after `root.westgardRuleSettings`
  is constructed (the last of its dependencies to come online). No
  eager-construction guard was hiding behind this one — every dependency
  closure was already lazy — but the classic constant
  `WG_WORKER_POINT_THRESHOLD` was confirmed dead (only a comment reference
  remained; the real value `3000` had already migrated to
  `createWestgardWorkerPrewarmPlanner(3000)`) and was dropped rather than
  moved. The 6 worker-state variables (`wgWorker`/`wgWorkerGeneration`/
  `wgWorkerRevisions`/`wgWorkerPending`/`wgWorkerFailed`/`wgWorkerRenderT`)
  became `root.X` data properties, not `let` — `tests/westgard-worker.test.js`
  reads/writes several of them bare through a separate `vm.runInContext` call,
  which a `let` trapped inside the bundle's IIFE would not see (same trap as
  `state-storage.js`'s lát). Removing the classic file exposed one test-only
  gap, not a port bug: `tests/render-downsampling.test.js` stubs
  `testRuleOn` to disable all Westgard rules for a synthetic 20,000-point
  dataset, but never stubbed `testRuleOnWithin`/`testRuleOnAcross` — those two
  used to be `undefined` (so `legacyWestgardRuleScope` always fell through to
  the `testRuleOn` stub) and are now real functions the scope-resolution
  fallback calls directly instead, re-enabling real rule evaluation and
  flooding the chart's display-sample "preserve" set with flagged points.
  Fixed by stubbing both alongside `testRuleOn`, matching the test's original
  intent. `derived()` (index cấu hình: panel/thứ tự test/lô/nhóm lô/chuyển tiếp đã duyệt)
  TỰ KIỂM CHỨNG từ 2026-08-01, cùng kỹ thuật với cache của
  `ActionRerunService`: `derivedStampWalk()` so tham chiếu + độ dài của
  đúng những lát state mà nó đọc, cộng các trường vô hướng nó lọc theo
  (`active`/`status`/`fromLotId`/`toLotId`). Trước đó nó là memo thuần nên chỉ
  đúng khi MỌI đường ghi cấu hình nhớ gọi `clearDerived()` — quên một chỗ thì màn
  hình hiện panel/nhóm lô/mức vận hành cũ mà không có gì báo. **Đọc thêm trường
  nào của cấu hình thì phải thêm trường đó vào chữ ký**, nếu không cache sẽ không
  trượt khi trường đó đổi tại chỗ. Một hàm duy nhất lo cả dựng lẫn đối chiếu
  (`prev=null` là dựng) để hai chiều không lệch thứ tự; đường warm cố ý KHÔNG cấp
  phát mảng — bản dựng mảng mỗi lần gọi làm `derived()` chậm 29 lần (2,7 µs so với
  0,095 µs, đo ở 50 xét nghiệm × 3 mức) và đẩy `warmDomainColdRatio` từ 0,0001 lên
  0,00035. `tests/derived-cache.test.js` chốt CẢ HAI nửa hợp đồng: đổi thứ
  `derived()` đọc thì phải dựng lại, đổi thứ nó không đọc (điểm QC, Mean/SD, NCE,
  khóa kỳ) thì phải giữ nguyên — thiếu nửa sau, một chữ ký hỏng kiểu "luôn khác
  nhau" vẫn qua sạch. Chốt bằng tính tự trượt, không bằng mốc thời gian.
- `LocalStore` — an IndexedDB snapshot mirror used as a recovery fallback for
  `localStorage`. Writes are partitioned (boot shell + per-test records) and
  rotate between slots A/B with a manifest — the active marker flips only
  after all records are written, so an interrupted save leaves the previous
  slot recoverable; legacy single-record snapshots migrate on the next save.
  Retired from classic `local-store.js` on 2026-08-19 (Pha G hạ tầng, lát 1):
  the classic file was already a pure bridge to `localStoreService`
  (`src/application/storage/local-store-service.ts`, the real IndexedDB
  read/write/partition logic), so this slice just folded that thin facade
  into `src/compat/modular-pilot.global.ts` as `root.LocalStore =
  Object.freeze({...})` right after `root.localStoreService` is constructed —
  no new logic. `LocalStore` stays a genuine global (assignment, not a
  classic `let`/`const` declaration) so it's still reachable as a bare
  identifier from `tests/local-store.test.js` and the storage benchmark. The
  one real fix: `modularIndexedDbOpenService`/`modularIndexedDbRecordService`
  used to be gated on `typeof LocalStore !== 'undefined'` — an eager,
  construction-time check that only worked because classic `local-store.js`
  loaded before the bundle. Folding `LocalStore` into the bundle itself would
  have made that guard permanently false (evaluated before `root.LocalStore`
  is even assigned later in the same script). Fixed by constructing both
  services unconditionally — `createIndexedDbOpenService`'s `open()` and
  `createIndexedDbRecordService`'s `get`/`put`/`delete` already resolve to a
  safe empty value when `indexedDB` itself is undefined, so the outer
  existence guard was redundant leftover, not load-bearing.
- Firebase Realtime Database sync (`fbMerge`/`fbHandleValue`/`initFirebase`/
  `syncNow`/`scheduleFbPush`/`fbFlushPush`/…) — optional, per-branch/per-element
  3-way merge (list branches merge by `id`/content key; scalar branches like
  `lab`/`westgardRules` replace wholesale). Failed pushes retry via
  `fbScheduleRetry()` with exponential backoff (1s doubling to a 30s cap), and
  `online`/`offline` listeners re-trigger push/pull. Merge semantics are covered
  by `tests/firebase-merge.test.js`/`firebase-offline.test.js` — keep them in
  step with any merge change. Retired from classic `firebase-sync.js` on
  2026-08-20 (Pha G nhóm C, lát 3): every function there already only forwarded
  to an existing TypeScript service, so it moved as-is into
  `src/compat/modular-pilot.global.ts` right before the block that constructs
  those services. That block used to guard each construction with
  `if (typeof (root as any).fbDisconnect === 'function') root.firebaseDisconnectService = ...`
  (and 16 more, on 13 different classic names) — valid only because
  `firebase-sync.js` used to load *before* the bundle in `index.html`, so the
  classic function already existed when the guard ran; every dependency closure
  inside was already a lazy arrow (calling the bare name at *call* time, not at
  service-construction time), so the guard was never behaviorally necessary —
  it just happened to hold thanks to classic load order. Moving the classic
  functions into the same script and placing them after those guards would have
  made every one of them permanently false, silently turning all of Firebase
  sync into a no-op. Fixed by deleting all 17 guards and constructing
  unconditionally (same fix as the `LocalStore` trap above). Removing the guards
  exposed two latent environment-safety gaps rather than causing them — both
  found by running the *full* `npm test`, not just this file's own tests:
  `root.fb`'s initial `clientId: 'c_'+uid()` ran at bundle-load time (not
  inside a closure) and broke ~28 sandbox tests that load the bundle without
  `state.js` (where `uid()` lives), since `fb` used to be inert classic-only
  data those tests never touched; and
  `firebaseConfigSourceService`'s `cloud`/`readStored` closures assumed
  `window`/`localStorage` always exist, which used to be masked because their
  caller (`fbDataPath()` in `state-storage.js`'s `persistSigmaDraft()`) guarded
  itself with `typeof fbDataPath==='function'` and `fbDataPath` was always
  `undefined` in sandboxes that didn't load `firebase-sync.js` — now that it
  always exists, that guard stopped skipping the real call. Both fixed with
  defensive `typeof`-checks, the same idiom already used elsewhere in this file
  for optional `window` access.
- `localStorage`/IndexedDB persistence pipeline (`loadBootState`/`save`/
  `persistLocalSnapshot`/`lsFlush`/…) — retired from classic `state-storage.js`
  on 2026-08-20 (Pha G nhóm C, lát 4): every function there already only
  forwarded to an existing TypeScript service (`storageLifecycleService`,
  `indexedDbMirrorService`, `storageSerializePolicy`, `localSaveScheduler`,
  `storageSnapshotService`, `saveService`, `sigmaDraftService`,
  `corruptLocalQuarantine`), so it moved as-is into
  `src/compat/modular-pilot.global.ts` right before
  `root.storageSerializePolicy` is constructed. Unlike the `firebase-sync.js`
  retirement, no eager-construction guard was hiding behind this one — every
  dependency closure in those services was already lazy — but this file had a
  much larger set of mutable module-level variables (14 of them: `lsDirty`,
  `lsRevision`, `partitionSlot`, `LS_FULL_ROTATE_MAX_INCREMENTALS`, etc.) that
  the *existing* bundle code and several tests already read/wrote as bare
  globals. Since Vite wraps the whole compat bundle in one IIFE
  (`(function(){...})();`), any of those declared as a plain `let` inside it
  would be invisible both to a test's separate `vm.runInContext` call and to
  any classic script — so all of them became `root.X` data properties instead
  (same fix as `state`/`mem`/`fb` before them), verified by grepping bare
  references to each name across both `modular-pilot.global.ts` and `tests/*.js`
  before deciding. `loadBootState()` tries `localStorage` first, then the
  `LocalStore` IndexedDB mirror; boot loads a small shell first and hydrates
  the full QC data in the background — login and Firebase sync wait for full
  hydration. Corrupt/invalid `localStorage` payloads are quarantined
  (`quarantineCorruptLocal()`) rather than silently dropped. Saves are
  debounced via `lsSaveDelay()` — 400ms normally, backing off to 700ms/1200ms
  as payload size or serialize time grows — flushed on
  `beforeunload`/`pagehide`/`visibilitychange`, and mirrored to `LocalStore`.
  It also owns `save(opts)`, the app's single write gateway, whose `opts` do
  three separate jobs at once — pass them deliberately
  (`tests/cache-invalidation.test.js` locks the semantics):
  `{}` (default) is the fail-safe: drops every derived cache
  (`pointsCache`/`wgMemo`/`acceptedMemo`/`cusumMemo`/`derivedIndex`) and marks
  the whole snapshot dirty. `{testId}`/`{testIds}` narrows both the cache drop
  and the partitioned localStorage write to those tests — use it whenever a QC
  point changed, it's what keeps large datasets fast. `{clearDerived:false}` is
  for saves that touch no QC math at all (actions, period locks, settings,
  backup bookkeeping); using it after a data change leaves stale Westgard
  results on screen. `{cloud:false}` skips the Firebase push and the `_ts` bump.
- `qc-rules.js`, `period-service.js`, `sigma-cohort-service.js`, `entry-service.js`,
  `reagent-comparison-service.js`, `manage-config-service.js` — smaller service-style modules (some
  IIFE-wrapped) layered on `state`/`qc-domain`. `PeriodService` locks/unlocks
  reporting periods (`state.periodLocks`, a synced list branch); `entry-service.js`
  enforces the lock (blocks add/edit/void once a period is locked), and the
  "Khóa kỳ báo cáo" panel on the Reports page
  (`src/presentation/report/report-page-controller.ts`) is the only
  UI that actually calls `PeriodService.lock()`/`.unlock()` — until 2026-07-22
  this service had no caller at all, so locks could never actually be created.
  The lock panel promises users it blocks editing/voiding QC points of that
  period **across every test**, so any BULK destroy-or-rewrite path must ask
  `PeriodService.lockedPoints(state, points)` (pure; counts per period,
  voided points included — they are still that period's records) before
  touching state. Two paths went straight through the lock until 2026-08-01:
  `delTest()`'s `delete state.data[id]` and `renameLotAcrossPoints()`. `delTest()`
  now **refuses** — the correct route is to unlock the period first, which
  demands a reason and logs itself, exactly the ISO 15189 trail. The lot rename
  is still allowed (a lot number is an identity label, and not rewriting old
  points makes them vanish from every lot filter) but now **asks first**, with
  the affected count and which locked periods it touches, before any mutation —
  cancelling must leave no trace. `tests/locked-period-guards.test.js` pins both,
  and was verified to fail when either guard is removed. Adding another bulk
  path over `state.data` means adding the same question.
  `ManageConfigService` owns the DOM-free validation and state mutation for
  instruments and assays. Keep confirmation, re-authentication, audit logging,
  persistence and rendering in `manage-tests-actions-controller.ts`; do not
  move those UI side effects into the service.
  `EntryService` normalizes QC-point input
  (`preparePointInput`/`addPoint`/`voidPoint`/`recordPoint`) and builds the
  entry sheet/window data; called from `entry-page-controller.ts`.
  `SigmaCohortService` builds period/level cohorts directly from raw QC data,
  split by lot; Sigma precision imports must not reuse `acceptedLotPoints()`
  because that display/operational helper selects one acceptable rerun per day.
- `westgard-view-model.js`, `chart-view-model.js` — pure (DOM-free)
  view-model builders: `WestgardViewModel` for the Westgard page (used by
  `westgard-page-controller.ts`), `ChartViewModel` for charts (used by
  `after-render-controller.ts` and by `qc-chart-renderer.ts`'s downsampling).
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
  those use PBKDF2 in `users-auth.js`. `core.js` also exposes the pure
  `verifyAuditChain()` ingress gate: backup import and both directions of
  Firebase sync MUST validate each source chain before merge/relink, otherwise
  re-hashing the merged array can hide a broken source payload. A failed cloud
  check disconnects sync and preserves local state; a failed backup check
  rejects the import. The app deliberately has no "delete all audit" action;
  admins may only use the verified archive flow below. Retention: cutting old rows (the admin
  "Lưu trữ nhật ký cũ" flow, `archiveActivityLog`/`ActivityArchiveCommand` — see
  "Module roles" for where users-auth.js's Users/Audit/Auth retired to, or
  `auditRotateOverflow()` past
  `ACTIVITY_HARD_CAP`) removes a **prefix** and records the removed segment's
  tip hash in `state.activityAnchor`; `auditVerifyChain()`/`auditRelinkChain()`
  seed from that anchor instead of `''`. Do not go back to re-hashing the
  retained rows: that cost 2 235ms per 20 000 rows (~11s at the old 120 000
  cap) *inside* `logAct()`, i.e. a silent freeze in the middle of an unrelated
  save, and it rewrote historical hashes so an archived CSV no longer matched
  the live chain. The anchor keeps the cut O(1) and keeps the archive CSV
  cryptographically continuous with what remains. The anchor is only meaningful
  while the log is non-empty — `auditPushRaw()` clears it when appending to an
  empty list, so every path that rebuilds the log (backup import, reset)
  is covered without remembering to. `activityAnchor` is in `FB_TOP` because a
  machine that pulls a cut log without the anchor would report a false "audit
  bị sửa". `pageAudit()` no longer verifies on every render (paging/filtering
  rerenders): `auditChainStatus()` caches by (row count, last hash, anchor) and
  skips auto-verification above `AUDIT_AUTO_VERIFY_MAX`, offering a button
  instead.
- `src/presentation/modal/` (`modal-focus-trap.ts`, `modal-template.ts`,
  `modal-controller.ts`, `dialog-overlay-controller.ts`) — retired the classic
  `modals.js` on 2026-08-18 (Pha G slice 1); wired into the global scope via
  `src/compat/modular-pilot.global.ts` (`root.openModal`/`closeModal`/
  `modalTemplate`/`modalCloseButton`/`confirmDialog`/`infoDialog`/
  `openDialogOverlay`/`closeDialogOverlay`) so the ~20 classic route files
  still calling these as bare globals keep working unchanged. Two
  independent, non-nesting modal layers, each a single slot (opening a second
  modal in the same layer replaces the first, no stacking within a layer):
  - `openModal()`/`closeModal()` (`modal-controller.ts`) render into
    `#modalRoot` — page/feature forms (edit Panel QC, edit user, etc).
  - `confirmDialog(opts)`/`infoDialog(message,opts)` (`dialog-overlay-
    controller.ts`) render into a *separate* `#dialogRoot` layer, on top of
    whatever's in `#modalRoot` (2026-07-18). These replace the browser's
    native `confirm()`/`alert()` — both return a Promise (`confirmDialog` →
    boolean, `infoDialog` → resolves on dismiss) and neither is called
    natively anywhere in app code anymore. They're deliberately kept off
    `#modalRoot`: alert()/confirm() guards fire constantly from *inside* open
    form modals (a validation error while editing), and `innerHTML` only
    reflects an input's original `value` attribute, not what the user has
    since typed into the `value` property — reusing `#modalRoot` would
    silently wipe whatever they'd typed. `infoDialog` takes an optional
    `{type:'success'}` (teal) vs. the default `'warn'` (amber) icon.
  - The two layers' focus-trap keydown handling (Escape closes, Tab wraps) is
    shared via `modal-focus-trap.ts`'s `createFocusTrapKeydown()` — the only
    consolidation done during the TS port; each layer still keeps its own
    return-focus state and resolver, per the reasoning above.
  - `requireWrite()`/`requireAdmin()` (`src/presentation/router/router-permission.ts`) call `infoDialog()`
    without `await`-ing it on purpose: ~68 call sites across the app do
    `if(!requireWrite())return;`, so the guard has to stay synchronous. Not
    awaiting is safe because the dialog's own DOM write happens synchronously
    before the returned Promise settles — the caller's boolean is unaffected
    either way.
- `src/presentation/router/` (`router-dispatch-controller.ts`,
  `router-permission.ts`, `router-icons.ts`, `live-row-filter.ts`,
  `date-box-html.ts`) plus `src/presentation/shared/ui-primitives.ts`
  (`btn`/`emptyState`/`headOnly`/`topUserBox`) and
  `src/presentation/range/range-actions-html.ts` — retired the classic
  `router-render.js` on 2026-08-18 (Pha G slice 3, ~50 bridged globals; see
  `docs/TYPESCRIPT-MIGRATION-PLAN.md`). `router-dispatch-controller.ts` owns
  `go()`/`resetMainScroll()`/`render()`/`restoreRouteFilters()`/`rerender()`
  and the current-page dispatch table; the current page id itself moved into
  `RouterUIState` (`src/presentation/state/ui-state.ts`'s `createRouterUiState()`,
  the `page` field) so `page` stays a bare classic-compatible global the same
  way `dashTestQ`/`currentUser`/etc. already do. `router-permission.ts` owns
  `role()`/`canWrite()`/`requireWrite()`/`requireAdmin()`/`roleLabel()`/
  `roleSelectOptions()`. All of this is wired in
  `src/compat/modular-pilot.global.ts`, which every classic route file still
  calls as bare globals unchanged (`btn`, `emptyState`, `headOnly`, `dateBox`,
  `liveRowFilter`, `icon`, `go`, `rerender`, `page`, …). A `PERM` const existed
  in the classic file but had zero callers anywhere in the app — confirmed
  dead and dropped rather than carried forward as a bridge global.
  Since 2026-07-24 the three biggest pages live in their own files:
  `pageEntry()` retired to `src/presentation/entry/entry-page-controller.ts`
  (`createEntryPageController(deps)`) on 2026-08-19 (Pha G route slice 10) —
  a faithful port of the sheet/tree/Levey-Jennings page including the parallel-
  lot columns; its UI state (`entrySel`/`entryDays`/`entryPrevOpen`/…) stays in
  the `EntryUIState` bag (written directly from onclick handlers, so it must
  remain accessor globals). `document`/`window`/`localStorage` are lazy
  getters in its deps since tests reassign the bare `document` global between
  keyboard-navigation cases. `pageWestgard()` retired to
  `src/presentation/westgard/westgard-page-controller.ts`
  (`createWestgardPageController(deps)`) on 2026-08-18 (Pha G route slice 3) —
  a faithful port of the whole page including the archived-lot-group and CUSUM
  branches; its UI state (`selTest`/`wgViewMode`/`wgChartMode`/`wgPrevOpen`/…)
  stays in the `AnalysisUIState` bag (written directly from onclick handlers
  like `selTest=this.value`, so it must remain accessor globals, unlike the
  Report page's closure state). `pageDash()` retired to
  `src/presentation/dashboard/dashboard-page-controller.ts` on 2026-08-18
  (Pha G slice 2) and `router-dispatch-controller.ts`'s dispatch table calls
  it as `root.pageDash` through the compat bridge like any other bundle-owned
  global, same as `pageEntry`/`pageWestgard`/etc.
  On 2026-07-30 the same treatment
  reached `actions-routes.js`, which had been holding **two** whole pages and
  had grown to 105 KB, in two steps:
  - `pageReportV2()` and every `report*` helper (period lock/unlock, test
    search, date range, print icons) moved to `report-routes.js` — and then on
    2026-08-18 (Pha G route slice 2) the whole page moved again to
    `src/presentation/report/report-page-controller.ts`
    (`createReportPageController(deps)`), retiring the classic file. Its page
    state (`reportQ`/`reportTest`/`reportRangeStart`/`reportRangeEnd`/
    `reportLockYm`) now lives as **controller closure `let`** (persists across
    `rerender()` because the factory runs once) — it is set only through
    `reportSetLockPart()`/`reportSearchSet()` handlers, never by direct global
    assignment, so nothing outside may write it. Those two pages share no
    function — only `professional-reports.css`, see "CSS structure".
  - The NCE form then moved to classic `action-form.js`: the `ACT_*` option/
    suggestion constants, `actSel()`, the `<details>` section machinery, the
    investigation checklist, the draft that survives `rerender()`,
    `actionFormModel()`, `addAction()`, and `actionFormHtml()` — extracted out
    of `pageActionsV4()`, a single 17 KB function that had been rendering the
    8-section form, the issue list and the log table together. `pageActionsV4()`
    became ~20 lines and passed the already-computed issue count into
    `actionFormHtml(issues.length)` rather than calling `currentIssues()` a
    second time (two calls could disagree). Classic `actions-routes.js` kept
    the issue list, the record lifecycle (approve/return/cancel/escalate/reopen
    + version tokens) and the detail sheet.

  Both retired to TypeScript on 2026-08-19 (Pha G route slice 11 — the
  **largest single slice**, 226 + 464 dense lines): `actions-routes.js` →
  `src/presentation/actions/actions-page-controller.ts`
  (`createActionsPageController(deps)`), `action-form.js` →
  `src/presentation/actions/action-form-controller.ts`
  (`createActionFormController(deps)`). Unlike the report cut, **this one is
  deliberately not one-directional**: the form calls back into the page's
  evidence builders (`actionEvidenceTimelineHtml`, `actionRerunEvidenceHtml`,
  `actionLevelShort`) because the detail sheet renders the very same blocks,
  and the page calls into the form to open/save a record.
  `tests/ui-route-structure.test.js` still asserts the **split of
  responsibility** (which function lives in which file — the Report page in
  `report-page-controller.ts`, the Actions page split across
  `actions-page-controller.ts`/`action-form-controller.ts`), not an acyclic
  dependency graph. `modular-pilot.global.ts` resolves the two-way reference
  with a two-phase build: `action-form-controller.ts` is constructed first,
  its 3 dependencies into the page controller call through a `let
  actionsPageControllerRef` set only after the page controller is built;
  the page controller's `formHtml`/`captureFormDraft` deps then point
  straight at the already-built form controller. No cyclic import between the
  two TypeScript modules — the forward reference lives in the bridge, which is
  exactly its job as a transitional mechanism.
  `router-page-policy.ts` owns the page list
  (`PAGES`, bridged as `root.PAGES`) and per-role page permissions:
  `rolePageIds(role)` gives each role's default page set, and a user's own
  `pagePerms` (edited in `users-auth.js`) can only narrow that set further,
  never expand past it. Page-level UI state lives in the `*-ui-state.js`
  modules above.
- `src/presentation/export/data-io-controller.ts`
  (`createDataIoController(deps)`) — every CSV/XLSX export: the printable
  report's Excel twin (`reportXlsxDoc`/`exportReportXLSX`), the Westgard
  Excel export (`westgardXlsxDoc`/`exportWestgardXLSX`), the Six Sigma
  exports (`buildSigmaXlsx`/`exportSigmaPeriodXLSX`/`exportSigmaPeriodsXLSX`),
  the CSV exports (`exportReportCSV`/`exportActionsCSV`), and the hand-rolled
  byte-precise ZIP/OOXML engines (`XlsxCore` — the shared ZIP-write/CRC32/
  cell-building core; `SigmaXlsx` and `ReportXlsx`, the two worksheet
  builders on top of it). Retired from classic `data-io.js` on
  2026-08-19 (Pha G route 15, closing nhóm B). Nearly every function in the
  classic file was a thin wrapper reading `globalThis.X` *inside its own
  body* (re-read on every call, not once at module load) — six of those
  wrappers forward to object-shaped services
  (`reportExportHelpers`/`qcReportContext`/`qcReportRowsService`/
  `sigmaExportMetaService`/`westgardXlsxRows`/`qcExportValueFormat`); wiring
  them as a single `root.X` value captured once at construction time (the
  same eager-construction trap as Route 12/14) broke every test that
  overrides one of these services with `globalThis.X={...}` *after* the
  bundle already loaded — fixed by wrapping each method in a closure that
  re-reads `root.X` per call, matching what the classic per-call reads
  actually did. `exportActionsCSV` hit the same self-reference trap as
  `openPrint` in Route 14: it called `exportMetaRows` as a local closure
  rather than a dependency, so a test's bare `exportMetaRows=()=>[]` override
  had no effect — fixed by adding `exportMetaRows` as a self-referencing
  dependency (`(globalThis as any).exportMetaRows(kind)`, wired back to
  itself) and calling it via `deps.exportMetaRows(...)`. `WG_RULES` repeated
  the exact const-vs-`globalThis` scoping bug from Route 14 (referencing the
  bare ambient-declared identifier instead of a `globalThis` property read),
  and `errorType` needed the same bare treatment — the classic file mixed
  both styles (`WG_RULES`/`errorType` bare, `QCCore.westgardByPoint`
  prefixed), and copying the wrong one for either would have silently
  regressed the export in production without any Node test catching it (only
  `visual-check`/`print-check` render real print/PDF output). One confirmed
  dead-code drop: the classic `ReportXlsx` IIFE read
  `globalThis.reportXlsxStyles`/`reportXlsxSheet`/`reportXlsxDrawing` into
  local consts it never used again (only `build`, already fully self-
  contained via its own closure over `root.X`, was ever called) — dropped the
  three unused local reads; the three `root.X` bridge assignments themselves
  stay required since `root.reportXlsxBuild` still calls them internally.
- `src/presentation/report/report-print-controller.ts`
  (`createReportPrintController(deps)`) — every printable report:
  `openPrint()` (the shared print-window bootstrap), `printReport`/
  `printWestgard`/`printSigmaPeriod`/`printSigmaPeriods`/`printRangeForm`,
  plus the small `reportQcValue`/`reportQcStat`/`reportQcPoint`/
  `reportHeader`/`signBlock`/`sigmaMuPrintCard`/`reportNceSummaryHtml`/
  `reportNceDetailHtml`/`reportNceAppendixHtml` wrappers that used to forward
  to other `globalThis.X` presentation services. Retired from classic
  `reports.js` on 2026-08-19 (Pha G route 14). `esc()`/`escAttr()` — called
  via `(root as any).esc(...)` by dozens of already-ported TypeScript files —
  turned out to be defined *only* in classic `reports.js`, which loaded
  *after* the bundle in `index.html`; safe only because every call site was a
  lazy closure. Split out to `src/presentation/shared/html-escape.ts`
  (`escapeHtml`/`escapeHtmlAttr`, same pattern as `jsq()` in Route 10) so
  they're real TypeScript globals now, assigned earlier in the bundle than
  before. This route's real find came from `visual-check`/`print-check`, not
  from the 613 Node tests: a `WG_RULES` dependency wired as
  `(globalThis as any).WG_RULES` read `undefined` in a real browser, because
  `WG_RULES` in `state.js` is a top-level `const` — and per the ECMAScript
  spec, top-level `const`/`let` in a classic script do **not** become
  properties of the global object (`window`/`globalThis`), only `var` and
  `function` declarations (or an explicit `root.X = value` assignment) do.
  `printWestgard()` threw in real Chromium/Electron; the Node vm sandbox
  tests missed it because their stubs used bare assignment (`WG_RULES=[...]`,
  which *does* create an implicit global property in sloppy mode). Fixed by
  referencing the bare identifier `WG_RULES` (already ambient-declared in
  `modular-pilot.global.ts`, next to `QC_DECIMALS_DEFAULT` for the same
  reason) instead of a `globalThis` property read — this is the first time in
  Pha G a browser-level gate caught something all the Node tests missed,
  confirming why nhóm B needs those two extra gates. Also hit the
  eager-construction trap twice more: four object-shaped dependencies
  (`reportQcFormat`/`sigmaPrintRowsService`/`sigmaMuPrintRowsService`/
  `actionReportHtml`) were first wired by reading `root.X` once at
  construction time, which broke `tests/sigma-print.test.js`'s strategy of
  overriding those services *after* the bundle loads — fixed by wrapping each
  method in a closure that re-reads `root.X` per call; and the five top-level
  `print*` functions called the module's own `openPrint` as a local closure
  reference, which made `tests/westgard-print.test.js`/`sigma-print.test.js`'s
  `openPrint = async (...) => {...}` override (needed to intercept output
  without touching a real DOM `window.open`) silently do nothing — fixed by
  routing that one call through a self-referencing `deps.openPrint` (wired to
  `root.openPrint`) instead of the local function.
- `src/presentation/chart/qc-chart-renderer.ts`
  (`createQcChartRenderer(deps)`) — canvas renderer for the Levey-Jennings
  (single/multi-level) and CUSUM trend charts, retired from classic `draw.js`
  on 2026-08-19 (Pha G route 13, mở đầu nhóm B). Every dependency (geometry,
  colors, point-render models, tooltip controller) was already a TypeScript
  factory from an earlier pilot phase — this route only stopped reading them
  off `globalThis` and started taking them as injected `deps`. Along the way
  it fixed a real production bug that predates this route: `cusum-display-
  plan.ts`/`cusum-hover-model.ts` existed and were unit-tested but were never
  wired to `root.X` anywhere, so `drawCUSUM()` (the "Xu hướng CUSUM" tab on
  the Westgard page) threw `TypeError` for any test with CUSUM enabled — no
  gate caught it because no browser-level check opens that tab. Fixed by
  wiring `root.cusumDisplayPlan`/`root.cusumHoverModel` for the first time.
- `src/presentation/sigma/sigma-page-controller.ts`
  (`createSigmaPageController(deps)`) — renders the Six Sigma page (see
  "Confirmed business-logic decisions" below for how its numbers relate to
  the printed report), retired from classic `sigma.js` on 2026-08-19 (Pha G route
  slice 12, the last file in the "Route/presentation" group). Large dependency
  surface (~35 classic/bridged functions, 14 Sigma services, the 11-function
  TEa layer, 26 presentation builders) but no new patterns — one dead wrapper
  confirmed and dropped (`sgRun()`, zero callers anywhere, unlike its sibling
  `sgZone()` which the canvas export renderers still call), and one guard in
  `data-io-controller.ts`'s `sigmaReportRowsService` (written for the transitional period
  when `sgVisibleLevels` might not exist) that a test alone relied on — fixed
  by stubbing `sgVisibleLevels` in that test, not by changing the guard.
  `sgCohortCtx` (the cohort-picker modal's transient context, read/written as
  a bare global by a regression test) joined `sgBiasCtx`/`sgMuCtx` in
  `SigmaUIState`.
- `src/domain/sigma/sigma-tea-resolution.ts` (`createSigmaTeaResolution(deps)`) —
  the Six Sigma page's **TEa resolution layer**, split out of `sigma.js` on
  2026-08-01 as classic `sigma-tea.js` and retired to TypeScript on 2026-08-19
  (Pha G route slice 7); wired via `src/compat/modular-pilot.global.ts` (`root.sgRef`,
  `root.sgTea`, etc.) guarded behind `typeof TEA_SOURCE_REGISTRY!=='undefined'` — a
  guard that predates classic `state.js`'s retirement (Pha G nhóm C lát 6,
  2026-08-20) and is now always true since the bundle constructs
  `TEA_SOURCE_REGISTRY` itself at load time, kept as a cheap safety net rather
  than removed. It answers "what is this
  assay's TEa, from which source, with what traceability": the effective TEa table
  (`REFTESTS` defaults overlaid with `state.teaRefs`), assay↔reference-row matching
  (`sgRef`, exact-then-longest-prefix), the CLIA percent/absolute/greater-of
  criterion, and the per-period TEa snapshot. It knows nothing about Sigma, MU,
  charts or modals — that boundary is one-directional and pinned by
  `tests/ui-route-structure.test.js`, and it is what makes the layer testable in
  Node (`tests/sigma-tea.test.js` loads the bundle with only `core.js`).
- `src/presentation/dashboard/dashboard-page-controller.ts` —
  `createDashboardPageController(deps)` owns `pageDash()`/`pageDashLoading()`/
  `dashTestFilter()`/`dashTestSetStatus()`, retired from classic
  `dashboard-routes.js` on 2026-08-18 (Pha G slice 2). It is pure orchestration
  — every actual computation (KPIs, Westgard alerts, expiring-lot grouping,
  status filter, row/panel HTML) is one of the `dashboardXxx` builders under
  `src/presentation/dashboard/`/`src/domain/qc/` that this controller was
  already calling through the bridge before the route itself moved; this slice
  only moved the calling code, not the math. Wired via
  `src/compat/modular-pilot.global.ts` (`root.pageDash`, etc.) so
  `router-dispatch-controller.ts`'s page dispatch table keeps working
  unchanged. A
  dashboard KPI/CAPA panel (`dashboardKpiSnapshot()`) existed briefly
  (`5673eb49`) and was removed again before release (`890604eb`, "tinh gon
  dashboard") — the dashboard page has no such panel today.
- `src/presentation/settings/settings-page-controller.ts` —
  `createSettingsPageController(deps)` owns `pageSettings()` plus the Settings
  page's form handlers (`saveLab`/`saveBrand`/`pickLogo`/`clearLogo`/`saveFb`/
  `clearFb`/`copyFirebaseRules`/`readBrandInputs`/`checkStorageUsage`) and the
  `ensureLabBrandShape()` state-normalization callback `state.js`'s
  `ensureShape()` invokes. Retired classic `settings.js` on 2026-08-18 (Pha G
  route slice 1). It is a DOM/browser adapter — every computation is already a
  TypeScript command/service (`SettingsProfileCommand`, `SettingsFirebaseCommand`,
  `firebaseSettingsService`) or HTML builder (`settingsXxxHtml`); the controller
  reads the form, drives FileReader/canvas for the logo, opens dialogs, and
  delegates. Browser APIs (`FileReader`/`Image`/canvas/clipboard/`navigator`)
  are injected as deps so it stays testable. Wired via
  `src/compat/modular-pilot.global.ts` (`root.pageSettings`, `root.saveLab`,
  `root.ensureLabBrandShape`, …) so the onclick handlers in the TS HTML builders
  and `ensureShape()`'s bare `ensureLabBrandShape` call keep working unchanged.
- `src/presentation/reagent/reagent-page-controller.ts` —
  `createReagentPageController(deps)` owns the reagent lot-comparison page
  (`pageReagent`/`rcCompute`/`rcMeta`/`rcCell`/row+quick-list+picker+create
  modals/`rcPrint`/`rcPrintSummary`/…), retired classic `reagent.js` on
  2026-08-18 (Pha G route slice 4). Page state (`rcId`/`rcModalQ`/`rcQuickType`/…)
  is written directly from handlers into the `ReagentUIState` bag (accessor
  globals), like the Westgard page. Every stat/render is a TS domain/service/
  presentation reached through `deps` (`ReagentComparisonService`,
  `ReagentComparisonWorkflowCommand`, `reagentComparisonCalculator`, the
  `reagentXxx` HTML builders); the palette consts `RCC`/`RCPAD`/`RC_MIN_PAIRS`
  live in the controller. `tests/reagent-stats.test.js` drives `rcCalc`/
  `rcReportSummaryTable` (bridged as globals) directly.
- QC target-range workflow (`rangeCandidate`/`openRangeWorkflow`/`applyNewRange`/
  `confirmApplyNewRange`/`revertRange`/`confirmRevertRange`/`rangeGateHtml`/
  `rangeGatePasses`/`rangeUpdateBiasHint`/`rangeTeaPercent`/`rangeSystematicNce`)
  — the "Áp dụng dải PXN"/"Hoàn về dải NSX" modals on the Entry page. Retired
  from classic `range.js` on 2026-08-19 (Pha G hạ tầng, lát 4): thin glue
  around `qcRangeCandidateService`/`qcRangeTea`/`qcRangeSafetyGate`/
  `qcRangeBiasEvaluation`/`RangeWorkflowCommand`, all already TypeScript, so
  it moved as-is into `src/compat/modular-pilot.global.ts` right after
  `root.RangeWorkflowCommand` is constructed. `rangeCandidate()` is the one
  function with a dedicated behavior test (`tests/range-candidate.test.js`) —
  it's the clinical gate behind "Áp dụng dải PXN" (≥20 results, ≥20
  independent days, 0 rejected/warning points, SD>0), computed from the
  *entire* operating lot including Westgard-violating points (excluding them
  would shrink SD artificially and falsely narrow the new range).
- Corrective-action (NCE) workflow (`actionApprovalStatus`/`actionRecordStatus`/
  `actionCancelled`/`actionWorkflowStatus`/`actionRerunStatus`/`actionCanApprove`/
  `nextNceId`/`pointWorkflowSummary`/…) — retired from classic
  `action-workflow-service.js` on 2026-08-20 (Pha G nhóm C, lát 1): every
  function there already only forwarded to an existing TypeScript service
  (`NceActionIdentityService`, `NceActionBasics`, `ActionProtocolService`,
  `ActionApprovalGates`, `ActionRerunService`, `ActionPointIndexService`,
  `ActionQcLink`, `NceActionRerunPolicy`, `PointWorkflowService`), so it moved
  as-is into `src/compat/modular-pilot.global.ts` right after
  `root.ActionPointIndexService` is constructed. Two classic-only workarounds
  were dropped, not carried over: `actionWorkflowStatus()`'s JS fallback branch
  (dead — `root.ActionWorkflowStatusService` always exists in this bundle,
  confirmed identical logic to `src/domain/nce/action-workflow-status.ts`), and
  the `root.NceActionLabels&&...||ACTION_LABELS` load-order guard on
  `ACTION_LABELS`/`RISK_SCALE` (moot once the assignment lives in the same
  script as `root.NceActionLabels`, after it). Three classic functions
  (`actionLotPoints(testId,level,lot)`, `actionPointIndex(testId)`,
  `actionOpenedFromVoid(a,p)`) were confirmed dead — never exported, never
  called — and dropped rather than moved; do not confuse them with the
  differently-shaped, still-live `NceActionQcIndex.actionLotPoints(points,…)`/
  `.actionPointIndex(points)`. This module owns the corrective-action
  lifecycle: `approvalStatus` is `pending`/`approved`/`returned`; physical
  deletion has been replaced by `recordStatus='cancelled'` plus a
  reason/actor/timestamp. It ignores cancelled records when deciding whether a
  QC point has a real NCE, and `actionWorkflowStatus()` only reports an action
  complete when its rerun requirement, release-to-service gate,
  effectiveness/residual-risk review and independent approval are all met.
  Approval is deliberately independent — `actionCanApprove()` refuses the
  action's own author, matching both the creator and later content editors by
  stable user ID/username, with the free-text `by` field as the legacy
  fallback — and approved actions cannot be cancelled or edited.
- `backup-service.js` —
  feature-specific logic (backup/restore service). Users/Audit/Auth
  (Người dùng, Nhật ký hoạt động, đăng nhập/đổi mật khẩu/khóa đăng nhập) —
  retired from classic `users-auth.js` on 2026-08-20 (Pha G nhóm C, lát 2):
  every DOM-adapter function there already only forwarded to an existing
  TypeScript command/service (`pbkdf2PasswordService`/`legacyPasswordHashService`/
  `isPbkdf2PasswordHash`, `LoginWorkflowCommand`/`RequiredPasswordWorkflowCommand`/
  `AdminBootstrapCommand`/`UserLifecycleCommand`/`ResetOperationalDataCommand`/
  `ActivityArchiveCommand`, `activityAuditFilter`/`activityAuditPagination`/
  `activityAuditCsv`, `userListModel`/`userRowHtml`/`usersPageHtml`/
  `userPermissionsModalHtml`/`resetPasswordModalHtml`), so it moved as-is into
  `src/compat/modular-pilot.global.ts` right after `root.UserLifecycleCommand`
  is constructed. `auditQ`/`auditFrom`/`auditTo`/`auditPage`/`auditPageSize`
  joined `currentUser`/`loginFails`/`loginLockUntil` in `AuthUIState`
  (`src/presentation/state/ui-state.ts`) rather than staying classic `let`s,
  for the same reason those three already were — a vm-sandbox test assigning
  bare `auditQ='...'` must hit the real accessor property on `globalThis`, not
  a `let` trapped inside the bundle's IIFE. Hashes passwords with PBKDF2-SHA256
  via the TypeScript `pbkdf2PasswordService` bridge, whose
  `PASSWORD_HASH_ITERATIONS=600000` (OWASP minimum) lives in
  `src/domain/auth/pbkdf2-password-service.ts` — the single source now, not a
  classic-JS constant. The stored `pbkdf2$<iterations>$<salt>$<hash>` string
  carries its own iteration count, so legacy 210k-iteration hashes still
  verify (via `legacyPasswordHashService`) and silently re-hash at the current
  count on next successful login — don't lower `PASSWORD_HASH_ITERATIONS` or
  drop that upgrade path. Also exports `reauthenticateCurrentUser({title,
  message})` — a password re-prompt gating the app's *critical* operations
  (approving/returning a corrective action, locking/unlocking a reporting
  period, writing or reverting a lot's Mean/SD, concluding a lot transition,
  replacing data from backup, resetting all data, deleting a test with QC data);
  wire any new operation of that weight the same way, `await`-ing it before
  mutating state. `backup-service.js` (split out of `data-io.js` on
  2026-07-24) rejects imports over `BACKUP_IMPORT_MAX_BYTES` (128 MB) before
  parsing. The reagent regression stats
  (Passing-Bablok, Deming/OLS, Bland-Altman, plus a from-scratch incomplete-beta
  t-distribution for CIs) are pure TypeScript in `src/domain/reagent/`
  (`reagentComparisonCalculator` etc.), no stats library, covered by
  `tests/reagent-stats.test.js`.
- `lis-client-service.js` — browser-side client for the LIS Gateway prototype;
  see "LIS Gateway" below.
- Boot entry point (`boot()` awaits `loadBootState()` before login/Firebase
  init). Retired from classic `app.js` (9 lines) on 2026-08-20 (Pha H1, lát
  1): `root.boot = async () => {...}` moved as-is to the very end of
  `src/compat/modular-pilot.global.ts`, but unlike its classic form — which
  called `boot()` immediately, safe only because `app.js` was its own
  `<script defer>` loaded dead last — the port does **not** self-invoke.
  Doing so would run before `#main`/the rest of the DOM exists (still true
  even though this bundle is itself a deferred script) and would crash every
  sandbox test that loads this bundle without a `document`/`window` (most
  don't, since `app.js` was never part of any test's `loadSandbox([...])`
  list before). Fixed by registering
  `document.addEventListener('DOMContentLoaded', () => { root.boot(); })` at
  the bottom of the file instead — per the HTML spec, `DOMContentLoaded`
  always fires after every `<script defer>` has finished running, so
  `root.boot()` still fires at the same real-world moment as before, with no
  race. `index.html` dropped from 3 app `<script>` tags to 2
  (`core.js` + the bundle). A second, unrelated bug surfaced by this port:
  the classic-era `boot()` did `await ensureAdmin().then(...)`, but this
  file's own internal ambient declare said `declare function ensureAdmin():
  void;` (wrong since its creation in the `users-auth.js` retirement,
  Pha G nhóm C lát 2 — nothing had chained off its result until now) —
  fixed to `Promise<void>`.
  `src/presentation/app/app-bootstrap.ts` (`createAppBootstrap(deps)`) is a
  sibling lát-2 change: the 6 top-level `window`/`document.addEventListener`
  registrations that used to sit inline at two unrelated spots in the bundle
  (local-save flush on `beforeunload`/`pagehide`/hidden-tab
  `visibilitychange`; Firebase pull/push on `focus`/`online`/`offline`/
  visible-tab `visibilitychange`) are now one named, dependency-injected
  factory called once. `window`/`document` are passed in only after the
  adapter checks `typeof window.addEventListener === 'function'` itself (not
  `!== 'undefined'` truthiness — TypeScript's `strict` mode flags a plain
  truthy check on a DOM method as "always true" since `Window`/`Document`
  declare it as a required, non-optional member; a `typeof ... ===
  'function'` comparison sidesteps that diagnostic while still being the
  right runtime check for a duck-typed test stub that has `window` but not a
  working `addEventListener`). That distinction is exactly the regression
  this lát hit first: an initial version wrote `typeof window !== 'undefined'
  ? window : undefined` (dropping the second half of the classic double
  guard, `&& window.addEventListener`), which crashed 7 tests whose `window`
  stub exists but has no `addEventListener` method (e.g.
  `westgard-xlsx.test.js`'s `window:{QCLAB_APP:{...}}`) — caught by running
  the full `npm test`, not typecheck.
- `src/presentation/app/action-dispatcher.ts` (`createActionDispatcher(deps)`)
  — Pha H2 (2026-08-20, DONE): the event-delegation replacement for
  hand-written `onclick="fn(...)"`/`oninput=`/`onchange=`/`onkeydown=`/
  `onmousemove=`/`onfocus=`/`onmouseleave=`/`ontoggle=` strings, which is
  what let the CSP's `script-src` drop `'unsafe-inline'` (see "CSP + SRI"
  below). A single `click` listener bound once to `document` (idempotent
  `bind()`, same pattern as `vn-date-picker-controller.ts`/
  `modal-focus-trap.ts`) matches `event.target.closest('[data-action]')`,
  decodes `dataset.args` as JSON, and calls the named global with `this`
  bound to the clicked element — preserving classic `onclick` semantics for
  free. `router-dispatch-controller.ts`'s `render()` only ever replaces
  `#main`'s `innerHTML`, never the node itself, so this one listener
  survives every `rerender()` permanently. `btn()` (`ui-primitives.ts`)
  accepts `{action, args?}` — every real call site across the app now uses
  this object form (confirmed by an exhaustive scan of every `btn(`/
  `button(` call in `src/`, not just a text grep for `onclick=`, since a
  caller building the onclick STRING dynamically at runtime — e.g.
  `` `confirmReturnAction('${jsq(id)}')` `` — leaves no literal `onclick=`
  text in the TypeScript source for a grep to find); the raw-string branch
  in `btn()`/`modalCloseButton()` is dead code at this point but kept rather
  than removed, since deleting it would mean re-touching every caller's
  `action: string | {...} | null` type signature for a purely cosmetic win.
  Also binds `input`/`change`/`focusin` listeners: `data-action-on="input"|
  "change"` auto-appends the element's live value (`.checked` for
  checkbox/radio, else `.value` — or the real `event` for
  `<input type="file">`, whose `.value` is just a filename) as the final
  arg, matching every classic `this.value`/`this.checked` handler's calling
  convention without touching the target function's signature;
  `data-action-on="focus"` listens via `focusin` (bare `focus` doesn't
  bubble) with no value appended, and `data-action-on="mouseout"`
  substitutes for `onmouseleave=` (also non-bubbling) via its bubbling
  equivalent, safe only for a leaf element (SVG point tooltip). `data-action-
  self-only` (present/absent, no value) fires only when the event target IS
  the data-action element itself, not a descendant — replaces the modal
  backdrop's `onclick="if(event.target===this)closeModal()"`.
  `data-keydown-action`+`data-keydown-args`+`data-keydown-keys` (JSON — Space
  is the literal `" "` character) filters by key, always `preventDefault()`s,
  and appends the live value like input/change ("Enter creates"/"Enter
  selects the row"); the same attributes WITHOUT `data-keydown-keys` fire on
  every keydown unfiltered with the real event prepended
  (`fn.apply(el,[event,...args])`) for real keyboard navigation (arrow keys
  in the entry tree/sheet) — those target functions read `this` instead of
  `event.currentTarget`, since a delegated listener's `currentTarget` is
  always `document`. `data-keydown-self-only` is a SEPARATE flag from
  `data-action-self-only` — one row can need `closest()` dedup (no
  self-only) for its click action and self-only for its Enter/Space action
  at the same time. `data-mousemove-action`+`data-mousemove-args` prepends
  the real event the same way, for a point tooltip that follows the cursor.
  `data-notify-changed="tenHam"` is a SEPARATE mechanism from `data-action`:
  it fires a zero-arg function on every bubbled 'input'/'change', even when
  a nested descendant already has its own `data-action` for that same event
  — the one case where a single event legitimately needs to invoke two
  handlers (the NCE form's "any field changed → save draft, refresh section
  chips" catch-all, layered on top of each field's own specific action).
  Three more mechanisms closed the last real gap — one element needing
  MULTIPLE INDEPENDENT events with different target functions/args, which
  `data-action-on` (one event per element) can't express: `data-input-
  action`+`data-input-args` (bound to `input`), `data-focus-action`+
  `data-focus-args` (bound to `focusin`), `data-change-action`+
  `data-change-args` (bound to `change`) — all three call `fn.apply(el,args)`
  with NO live-value append (unlike `data-action-on`), so an element can
  carry `data-action` for one event (needs the live value) and
  `data-focus-action`/`data-change-action` for others (don't) at the same
  time — used by the reagent info panel's lô cũ/mới/Bias/alpha fields
  (`data-action` on input for `rcMeta`, `data-focus-action` for
  `rcMetaFocus`, `data-change-action` for `rcMetaLog`) and the lot-transition
  combobox (`data-input-action`+`data-change-action`, both calling
  `lotTransitionChoiceInput`, `commit` argument differing by event — the
  function itself now reads `this` instead of an explicit `el` param,
  matching every other function converted this way). Finally,
  `data-toggle-action`+`data-toggle-args` covers `<details>`'s `ontoggle=`
  (3 sites: the NCE form's collapsible sections, the entry page's two
  secondary panels) — `toggle` does NOT bubble, so unlike every mechanism
  above it's bound via the CAPTURE phase
  (`addEventListener('toggle',fn,true)`, which reaches every element
  regardless of bubbling) and reads `event.target` directly rather than
  `closest()`; appends `el.open` after the static args, matching the old
  `this.open` argument. Missing this one specific attribute name in the
  original grep sweep (which only checked 5 common event names) is exactly
  why the browser-level gates (`nce-check` here) matter: a `<details>` whose
  open/closed state silently stopped surviving `rerender()` produced no
  TypeScript or Node-test failure at all, only a real-Chromium one.
  `report-print-controller.ts`'s print popup (a genuinely separate
  `document`, built via `w.document.write(...)`) is now driven from the
  OPENER side instead of via its own inline `<script>` — the popup inherits
  the main app's CSP (same-origin `document.write()`), so it would have been
  blocked too; `openPrintImpl()` now attaches the click listener directly
  from the main bundle after `w.document.close()`, using
  `(window as any).qcPrintPdf` (the Electron preload bridge, no longer
  reached via `opener.qcPrintPdf` since this code already runs in the
  opener) instead of a `qcSavePdf`/`qcDoPrint` pair defined inline. Plain
  property assignment (`w.__qcPrintToken = printToken`) is unaffected by CSP
  (only inline SCRIPT EXECUTION is restricted, not property writes), so
  `electron/main.js`/`scripts/print-check.js`'s
  `executeJavaScript('window.__qcPrintToken')` lookup keeps working
  unchanged. `index.html`'s last 2 inline `<script>` blocks moved out the
  same lát: the nav-collapsed pre-render check became
  `assets/nav-collapse-init.js` (loaded via a plain non-deferred
  `<script src=...>` at the exact same DOM position, so it still runs
  synchronously before `<aside>` paints — no flash of an uncollapsed
  sidebar); the Electron-only `window.qcDialog` → `window.alert` override
  moved into the bundle itself (`modular-pilot.global.ts`, right after
  `appBootstrap.run()`), guarded by `(window as any).qcDialog` since
  `global.d.ts`'s `Window.qcDialog` ambient type isn't visible under
  `tsconfig.modules.json` (which only includes `src/**/*.ts`, not the
  repo-root `.d.ts` files). Finding every real site took more than a text
  grep for `onclick=`/etc.: a `btn()`/`button()` call whose action argument
  is built as a runtime template-literal string (` `fn('${id}')` `) leaves
  no literal `onXXX=` text in the source, so it silently survived every
  earlier grep-based sweep and only showed up as an actual CSP violation in
  a real browser (`ui-check`'s void-point/period-lock flows, both of which
  go through a confirm button built this way in
  `entry-page-controller.ts`/`report-page-controller.ts`) — the fix was a
  small Node script that parses every `btn(`/`button(` call's real argument
  list (balanced parens/quotes, not a single regex) and flags any whose
  second argument doesn't start with `{`. Two dev scripts needed their own
  fix once real inline execution was gone: `a11y-audit.js` loaded axe-core
  via `page.addScriptTag({content: AXE_SOURCE})`, which inserts a real
  `<script>` into the page (blocked); switched to
  `page.evaluate(AXE_SOURCE)` (a bare string, not a function) instead, which
  Playwright sends through the browser's DevTools Protocol
  (`Runtime.evaluate`) rather than a page-owned `<script>` element, so it
  runs regardless of the page's own CSP — confirmed with a two-line
  before/after test against a real minimal-CSP page.
  `visual-check.js`'s `window.open` stub (used to capture the print window's
  HTML without actually opening one) only ever implemented
  `document.write`/`close`/`focus`, since the old inline-script version
  never touched the opener-side `document`/`window` after writing it; the
  refactored `openPrintImpl()` now calls `getElementById`/reads
  `document.body`/sets `onbeforeprint`/`onafterprint` from the opener side,
  so the stub needed those added (as harmless no-ops — this script only
  checks the CSS of the captured HTML, not click behavior).

### Button convention

Three color variants, always in this order right after `btn`: `teal`
(primary action), `ghost` (secondary/cancel), `danger` (destructive). Append
`sm` for compact/table-row buttons. `btn(label,onclick,cls='ghost sm',title='',opts={})`
in `src/presentation/shared/ui-primitives.ts` (bridged as `root.btn`) is the shared builder — **always use it**, never
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
live; the `actions` page has no separate file of its own — so the two pages
stay coupled in CSS even though their logic was split apart (Actions in
`src/presentation/actions/actions-page-controller.ts`/`action-form-controller.ts`
/ Report in `src/presentation/report/report-page-controller.ts`).
These files have
overlapping `@media` breakpoints and
height queries and rely on cascade/shorthand ordering between files — check
neighboring `professional-*.css` files for conflicting rules before adding
or reordering selectors, not just the one file you're editing.

`tokens.css` is organized as a small set of hex **primitives** plus semantic
aliases built on them; when a new color is needed, add a primitive and alias
it — don't scatter one-off hex values through the page stylesheets.

Khoảng cách giao diện cũng dùng một thang duy nhất trong `tokens.css`
(`--space-2xs` đến `--space-2xl`) cùng các alias theo component:
`--panel-inline-padding`, `--modal-inline-padding`,
`--table-cell-*-padding`. HTML dựng từ JavaScript dùng các class `flow-*`,
`space-after-*`, `.field-error` và `.sr-only`; không thêm lại
`style="margin-top:...px"`/`style="margin-bottom:...px"` cho bố cục tĩnh.
`tests/spacing-tokens.test.js` khóa quy tắc này; chỉ HTML in độc lập trong
`report-print-controller.ts` được loại trừ (kiểm riêng bằng `doesNotMatch`) vì
cửa sổ in không tải stylesheet của ứng dụng.

`--panel-content-gap` (`14px`) là nguồn duy nhất cho khoảng cách dọc từ
viền dưới header đến nội dung đầu tiên của mọi panel/card/bảng và modal. Không
hard-code `padding-top`/`margin-top` riêng cho quan hệ này trong stylesheet theo
trang; label của hàng form đầu tiên cũng không được cộng thêm margin trên. Nếu
một popup đặc biệt buộc `.modal-b` có `padding-top:0` (như hướng dẫn NCE), phần
tử nội dung đầu tiên phải tự dùng đúng `var(--panel-content-gap)`. Quy tắc này
chỉ áp dụng cho khoảng cách **header → nội dung đầu tiên**; khoảng cách nội bộ
giữa các trường/nhóm vẫn dùng token phù hợp với ngữ nghĩa riêng.
`tests/ui-accessibility.test.js` và `tests/spacing-tokens.test.js` khóa cả
token, modal mặc định và ngoại lệ này.

### Storage and sync model

Data lives in `localStorage`, mirrored on every save to the partitioned
IndexedDB store (`LocalStore`, see "Module roles") used only as a recovery
fallback at boot, and optionally to a per-lab Firebase Realtime Database room
(`labCode`, configured via `QCLAB_CLOUD`, see "Module roles"). There is no backend beyond that.
This is an **accepted tradeoff of a client-only app**, not an open bug: login
state is a JS variable, not a server-verified token/session, and Firebase
Rules by UID are the only real write boundary when sync is enabled. Don't
"fix" client-side auth without discussing the backend-authentication tradeoff
it implies.

Those Rules are a versioned artifact, not something to hand-edit in the
Firebase console: `firebase/database.rules.json` is the single source of truth
(deployment steps and the five post-deploy checks are in
`firebase/HUONG-DAN-FIREBASE-RULES.md`), and the Settings page renders the same
text via `firebaseRulesText()` (`src/presentation/settings/firebase-rules.ts`,
bridged as `settingsFirebaseRulesText`) — `tests/firebase-rules.test.js`
fails if the two diverge, so change both together. The model: a room is
readable/writable only by UIDs listed under `qclab-acl/{labCode}/{uid}`, which
clients can read for themselves but never write; every snapshot must carry a
numeric `_ts`. QC Lab's own admin/technician/viewer roles are client-side UI
permissions layered on top, not a server write boundary.

### LIS Gateway (prototype, out of validation scope)

`lis-gateway/` is a standalone Node HTTP/JSON server (plain `node:http`, zero
dependencies, no HL7/ASTM) that lets an analyzer's existing middleware push QC
results into QC Lab — it is **not** part of the Electron app (`package.json`
`build.files` excludes `lis-gateway/` and `scripts/`) and only runs from the
source tree via `npm run lis:gateway`. It is explicitly out-of-scope in
`docs/validation/URS.md` (prototype/research, not in `TRACEABILITY.md`); see
`docs/lis-bridge-prototype.md` for the full write-up. Direction was reversed
once (`5d1a061`, "đảo chiều"): the original design had the gateway push QC
accept/review/held gatekeeping status out toward the LIS so it could hold
patient results — that required the LIS vendor to change their release
workflow, which was infeasible, so the gateway now only **receives** QC
results from middleware and makes no decision about patient-result release.
Received results never auto-become QC points; they sit `pending` in an
append-only NDJSON journal (`store.js`'s `JournalStore`, self-heals a
truncated last line after a crash, entries are never deleted) until a tech
reviews the queue in QC Lab and clicks Nhận, at which point they go through
the same `EntryService` path as manual entry — period locks, audit log,
partitioned storage all apply. PHI is hard-rejected (`PHI_NOT_ALLOWED`),
including `specimenRef`, since this is deliberately not a clinical LIS
integration.

`server.js` refuses to start without a `QCLAB_LIS_TOKEN` — an earlier version
fail-opened (`if(!token) return true`) and since `npm run lis:gateway` doesn't
set that env var by default, every endpoint was unauthenticated on a port
gatekeeping patient-adjacent data; the process now auto-generates and persists
a token to `.data/token.txt` (mode 0600) if none is set. `/health` is the only
unauthenticated endpoint and deliberately excludes `bridge.status()`
(pending/mapping counts) — operational numbers require the token via
`/api/v1/status`. All bodied requests must carry `Content-Type: application/json`;
a `text/plain` POST is a CORS "simple request" with no preflight, so before
this check any web page could POST straight into `/api/v1/qc-results`.

Mapping config (`config.example.json`, shape:
`{allowedOrigins, mappings:[{analyzerId, testCode, qclabTestId, displayName,
expectedUnit, levels:[...], lots:[...]}]}`) keys results on `qclabTestId` —
QC Lab's internal generated id (`uid()`, e.g. `a3f9k2p`), not shown in any
screen. A typo doesn't fail to start; that test's results silently sit at
`held/UNMAPPED_TEST` forever. Since app state lives in browser
localStorage/IndexedDB, Node can't read it directly, so
`node scripts/lis-config.js <backup.json> [-o <config.json> | --check <config.json>]`
generates/validates the mapping skeleton from a Settings-page backup export;
`--check` reuses the gateway's own `buildMappingIndex()` (`core.js`) rather
than reimplementing validation, so the two can't drift.

The browser-side LIS client (`src/application/lis/lis-client-service.ts`,
bridged as `LISClientService`) polls the gateway over HTTP (`LIS_POLL_MS`, 5 min), not
a websocket. The gateway origin (`http://127.0.0.1:8787` by default) is
hard-pinned in three places that must stay in sync: `index.html`'s CSP
`connect-src`, `lisNormalizeGatewayUrl()`, and the gateway's own default
`QCLAB_LIS_PORT` — changing the port in only one place fails silently as "Lỗi
kết nối." The queue row's `onclick` wraps the *entire* attribute string in
`escAttr()`, not just the id, because `messageId` is middleware-controlled
(not an internal `uid()`) and so is an XSS-relevant input.
`tests/lis-client-service.test.js` pins that a QC point's date uses local
time (a 06:05 VN result has a UTC `measuredAt` of the previous day), and that
the gateway is only told `imported` *after* the local point write succeeds, so
a crash between the two can't silently drop a result from the queue with
nothing to show for it.

### Validation dossier (ISO 15189 / IVDR-style)

`docs/validation/` holds the controlled protocol set — `URS.md`,
`RISK-ASSESSMENT.md`, `TRACEABILITY.md`, `IQ-OQ-PQ-UAT.md`,
`BACKUP-RESTORE-DRILL.md` — applying to 2.5.0 onward. `TRACEABILITY.md` maps
each URS requirement to the code and the *named automated tests* that evidence
it; if you rename, delete or add a test that is someone's evidence row, update
that table in the same commit. Release evidence is the stdout of `npm ci`,
`npm test`, `npm run typecheck`, `npm run verify-release`, `npm run
visual-check`, `npm run a11y-audit`, `npm run nce-check`, `npm run
print-check` — the same set CI runs, so every check that gates a merge also
leaves a dossier record.

### Confirmed business-logic decisions (don't re-litigate without new input)

- **The app does not delete QC data to save space, and has no year-archive feature.**
  Both were built and then removed on 2026-08-01, before any release (`3e90819`,
  `408170a` hold the full code if it is ever needed again). The measurements that
  settled it: 10 years × 50 tests × 3 levels = 547,500 points = 78 MB and a 14,008 ms
  one-off cold domain (warm stays 0.77 ms); a mid-size lab at 20 tests × 2 levels ×
  2 years is 29,200 points / 4.2 MB. QC points do not live in `localStorage` at all
  (partitioned save writes a shell and `removeItem('qclab')`, data goes to IndexedDB),
  so the 5–10 MB cap is not the constraint. Deleting regulated QC records permanently,
  from a client-only app with no server, no transaction and no undo beyond a file the
  user may have cancelled, is not worth ~13 s of boot time at a scale almost no lab
  reaches. If a real lab ever hits a wall, reopen this with **their** numbers — and
  note the two blockers recorded in `408170a`'s message (Firebase resurrects
  per-point deletions; the NCE guard misses records whose rerun evidence is in the
  deleted year). Backup keeps its SHA-256 package format and the read-only
  "Kiểm tra backup" verifier — those earned their place independently.
- Two "Sigma" numbers are intentionally different: the printed/CSV report's
  Sigma (`reportLevelStats()` in `report-print-controller.ts`/`data-io-controller.ts`) is an observed,
  period-specific value; the Six Sigma page (`sigma-page-controller.ts`) uses
  explicitly reviewed/sourced CV/Bias. Keep them visually disambiguated, don't unify.
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
  (`readTargetMatrixPicks()` in `manage-tests-actions.js` hardcodes
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
  configured in the assay modal in `manage-tests-actions-controller.ts`) is a
  reference trend chart only (`drawCUSUM()` in `qc-chart-renderer.ts`, the
  "Xu hướng CUSUM" tab on the Westgard page) — it never changes a point's
  accept/reject/Westgard
  status; only the Westgard rule engine does that.
- The CLIA/Ricos TEa reference table (`REFTESTS`, derived from
  `TEA_ANALYTE_CATALOG` — both `root.X` properties in the bundle since the
  classic files that defined them retired on 2026-08-20, see "Module roles")
  is a built-in default;
  users override/extend it via `state.teaRefs` (synced list branch, edited in the
  "Bảng TEa tham chiếu" tab of the manage page). `sgRef` in
  `sigma-tea-resolution.ts` resolves a test against `effectiveTeaRefs()` (defaults overlaid with
  `state.teaRefs`), matching **exact name first** then longest-prefix — so
  e.g. "CK-MB" no longer inherits "CK". EFLM TEa stays a per-test manual value
  (`t.tea`), not part of this table.
- Measurement uncertainty (MU, ISO 15189:2022 §7.3.4) is a **top-down** budget
  (ISO/TS 20914 + Nordtest TR 537): `uncertaintyBudget()` in `core.js` does the
  math, `sgMU()`/`sgMuHTML()` + the MU modal (`sgOpenMU()`) surface it on the
  Sigma page, and `sigmaMuPrintCard()`/`sigmaMuPeriodsPrintRows()` in
  `report-print-controller.ts` put it on both Sigma print reports. Inputs are the ones the page
  already holds — u(Rw) is the *same* long-term IQC CV% the Sigma cohort uses,
  u(bias) = √(bias² + u(Cref)²) over the stored EQA rounds (u(Cref) = SD between
  rounds / √n, null with a single round), u(cal) is typed from the calibrator
  CoA; u_c = √(Σu²), U = 2·u_c. Four rules are locked by
  `tests/uncertainty.test.js` and must not be "simplified":
  (1) a component that was never assessed stays `null` and lands in `missing[]`
  — it is **never** silently read as 0, because that prints a smaller U than the
  truth with nothing on the report saying so; (2) `uCal: 0` is a *valid
  conclusion* ("CoA says negligible") and must stay distinguishable from "not
  entered", which is why `cleanSigmaLevel()` filters only negatives;
  (3) dropping the bias term is a per-level human decision (`muBiasMode`), never
  automatic, since ISO/TS 20914 only allows it once the bias has been
  investigated and corrected; (4) screen, print and the modal preview all call
  the same `uncertaintyBudget()` — `sgComp()` hangs the result on `r.mu` and
  everything else reads that back, so a level can never show one U on screen and
  another on paper. The app does **not** judge MU pass/fail: the allowable limit
  (MAU) comes from the lab's SOP; it only puts U next to TEa and flags U > TEa.
