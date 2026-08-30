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
- `css-hex-ratchet.test.js` (added 2026-08-23, same pattern as
  `tests/a11y-ratchet.json`) — a per-file cap on raw `#rrggbb` hex literals in
  `assets/*.css` outside `tokens.css`, checked against
  `tests/css-hex-ratchet-baseline.json`. A rà soát that day counted 242 such
  literals; most are one-off gradient/shading shades a mechanical
  find-replace can't safely collapse into existing tokens without a design
  call, so this isn't a flat ban like `button-conventions.test.js` — it only
  blocks the count from **growing**. Update the baseline with
  `node tests/css-hex-ratchet.test.js --update-baseline` after an intentional
  cleanup, never to allow a new one-off color.

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
  tests, then `check-build-freshness.js` (below), then two dependency audits,
  then `performance-regression.js` against budgets in `performance-budget.json`.
  Ratio/structural checks are the real
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
- `node benchmarks/check-build-freshness.js` (`npm run check-build-freshness`,
  added 2026-08-23) — rebuilds `assets/generated/modular-pilot.js`,
  `assets/core.js` and `assets/workers/westgard-worker.js` into a temp
  directory and diffs them byte-for-byte against the committed files.
  `npm test`/the pre-commit hook are deliberately install-free (see "Tests"
  above) and never rebuild, so they only ever exercise whatever is already
  committed in `assets/` — editing a `src/**/*.ts` file and forgetting
  `npm run build:pilot` before committing passes the hook and the fast CI
  `test` job silently, exactly the class of bug `qc-core.ts`'s own
  `WG_RULE_REGISTRY` warning worries about, but for the whole bundle instead
  of one file. This gate is the only place that catches it, which is why it
  only runs after `npm ci` in `verify-release.js`/the `release-gate` CI job,
  never in the fast suite.
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

**React island (2026-08-29, `docs/REACT-ADOPTION-PLAN.md`).** A third
`<script defer>`, `assets/generated/react-pilot.js` (built by
`npm run build:react` from `src/react/react-pilot.entry.tsx` via
`vite.react.config.mjs`, loaded in `index.html` *before* `core.js`/
`modular-pilot.js` so `window.QCLabReact` exists first), lets individual pages
be migrated to React one at a time while the rest keep running on the classic
bundle — a new, separate initiative from the TypeScript migration above (see
`docs/TYPESCRIPT-MIGRATION-PLAN.md` §2 item 5, updated to record this).
`router-dispatch-controller.ts`'s `render()` checks `isReactPage(id)` and
mounts/unmounts a React root into `#main` for migrated pages instead of the
classic `innerHTML` swap; `rerender()` additionally calls `notifyReactStore()`
so migrated pages re-render through the same `useSyncExternalStore`-based
bridge (`src/react/state/renderBus.ts`) whenever anything elsewhere triggers a
redraw. Migrated components keep using `data-action`/`data-args` markup (not
`onClick=`) so `action-dispatcher.ts` and the existing Playwright checks need
no changes. `react-pilot.js` is built with `minify:true` (unlike
`modular-pilot.js`/`core.js`, which use `minify:false` to keep hand-written
code diffable) — both to cut bundle size and because unminified React
internals produce false positives in `tests/global-name-uniqueness.test.js`'s
line/column-based scanner. `tsconfig.react.json` (separate from
`tsconfig.modules.json`, includes only `src/react/**`) adds `jsx:"react-jsx"`
without touching the existing strict TS config. Dashboard/"Tổng quan"
(`src/react/pages/DashboardPage.tsx`) and Activity log/"Nhật ký hoạt động"
(`src/react/pages/AuditPage.tsx`), Users/"Người dùng"
(`src/react/pages/UsersPage.tsx`), Settings/"Cài đặt"
(`src/react/pages/SettingsPage.tsx`), Manage/"Cấu hình chung"
(`src/react/pages/ManagePage.tsx`), Reagent/"So sánh hóa chất"
(`src/react/pages/ReagentPage.tsx`), Report/"Báo cáo"
(`src/react/pages/ReportPage.tsx`), Six Sigma/"Six Sigma & Sai số"
(`src/react/pages/SigmaPage.tsx`), Westgard analysis/"Phân tích Westgard"
(`src/react/pages/WestgardPage.tsx`), Corrective action/"Khắc phục sự cố"
(`src/react/pages/ActionsPage.tsx`) and Entry/"Nhập QC & Biểu đồ"
(`src/react/pages/EntryPage.tsx`) are all ten pages — the entire app — with
their classic HTML-builder code already deleted post-parity-check; the
React migration is complete, see `docs/REACT-ADOPTION-PLAN.md` for the
page-by-page history.

**Kernel / gỡ global bridge (2026-08-30–, in progress, see plan file
"gỡ bỏ global bridge, đưa QC Lab sang kiến trúc React chuẩn").** A second,
new-and-separate initiative from the React-island work above: even though
every page renders via React now, the underlying architecture is unchanged —
`src/compat/modular-pilot.global.ts` still imports ~600 modules and assigns
~1,305 individual names to `root.X=` (root = globalThis) so they're reachable
as bare identifiers, `src/react/bridge/*.ts` still read everything via
`(window as any).x`, events still go through `data-action="fnName"` +
`action-dispatcher.ts`'s global-name lookup, modals still build raw HTML
strings and `innerHTML`-inject them, and state-change notification is the
fully manual `save()`→`rerender()`→`notifyReactStore()`→hand-rolled
`renderBus.ts` chain. Merging the two separate Vite bundles
(`modular-pilot.js`/`react-pilot.js`) into one was considered and rejected:
`react-pilot.js` is deliberately minified to dodge
`tests/global-name-uniqueness.test.js`'s false-positive behavior on
unminified React internals, the 61 `tests/helpers/sandbox.js`-based tests
`vm`-sandbox only `modular-pilot.js` with no `document`/`window` (React's
own module-top-level code touches `document` and would throw immediately in
that bare sandbox), and Rollup's import-graph-determined evaluation order
inside one shared IIFE risks reintroducing the exact "eager-construction
trap"/"IIFE-scope trap" bug class documented throughout this file. Instead:
the two bundles stay separate (no build/Electron/CSP/
`check-build-freshness.js` changes), and the ~1,305 scattered globals
collapse into **one** typed object, `window.__QC_KERNEL__` — constructed
once in `modular-pilot.global.ts`, right before `root.boot=`, from the
SAME already-constructed page controllers (`entryPageController`,
`actionsPageController`, `sigmaPageController`, etc. — each already returns
exactly the right group of functions via `createXPageController()`, so no
new taxonomy was invented) plus a `store` field. **Giai đoạn 0 (done)**:
added `zustand` (devDependency) and `src/application/state/app-store.ts`
(`createAppStore()`, a `zustand/vanilla` store holding only `{revision,
touch()}` — a deliberate, documented **notify-bus wrapper**, not a real
immutable-state migration, since 16 files across `src/application`/
`src/presentation` mutate `state.x=` directly outside any DI-injected
setter; converting all of them to immutable updates is a separate, much
larger project not attempted here). `createAppStore()` is constructed once
in `modular-pilot.global.ts` (module-scope `const appStore`, right after
`root.state=`/the derived-cache `root.mem=...` line) since the store must be
a SINGLE shared instance — the two bundles have no shared module registry,
so constructing it in each bundle separately would give React and classic
code two different store instances that never see each other's `touch()`
calls. The existing `notifyReactStore` dependency (passed into
`createRouterDispatchController`, called at the end of every `rerender()`)
now also calls `appStore.getState().touch()` alongside the pre-existing
`window.QCLabReact?.notify()` call — the only behavior change in this phase,
and inert until something actually subscribes to the store. `kernel`'s
`window.__QC_KERNEL__` assignment was originally guarded by
`typeof window!=='undefined'` (caught immediately by the sandbox tests
otherwise — `vm.createContext` has no `window`) — **since Giai đoạn 4 Bước 1
(2026-08-30) this guard is gone**: the assignment goes through `root`
(`=globalThis`, already used everywhere else in this file) instead of
`window` directly, since `globalThis` always exists (that's exactly what
`vm.createContext(sandbox)` turns `sandbox` into) while `window` doesn't in a
bare vm context — `root===window` in a real browser, so this changed nothing
observable there, but it makes `__QC_KERNEL__` reachable from
`tests/helpers/sandbox.js`'s sandboxed tests for the first time, which is the
foundation the sandbox-test-rewrite portion of Giai đoạn 4 depends on.
`kernel`'s namespaces mirror each page's OWN controller return
object 1:1 (`kernel.entry = entryPageController`, `kernel.sigma =
sigmaPageController`, etc. — no new taxonomy invented) plus a `kernel.pres`
grab-bag for the cross-page shared helpers that aren't owned by any single
page controller (formatting: `esc`/`escAttr`/`fmt`/`vnDate`/`fmtPointValue`/
`formatDateTimeVN`/`testDisplayName`; permissions: `role`/`canWrite`/
`requireWrite`/`requireAdmin`/`roleLabel`/`roleSelectOptions`/`rolePageIds`
from `routerPermission`; icons: `icon`/`icoCal`/`icoDownload`/`icoPrint`;
render-cycle: `afterRender`; misc: `normalizeSearchText`/`levelTargetOk`/
`QCCore`/`AnalysisUIState`). `kernel.manage` merges TWO controllers
(`managePageController` plus `manageTestsActionsController`'s
`setTargetPanel`/`setTargetGroup`/`setHistoryTest`, which the Manage page's
Mean/SD tab needs but which live in a sibling controller, not
`managePageController` itself) — this was the one page where "just alias the
page's own controller" wasn't enough, found by tracing every bridge file's
actual dependencies rather than assuming the taxonomy.

**Giai đoạn 1 (done, 2026-08-30).** All 11 `src/react/bridge/*.ts` files
(actions, audit, dashboard, entry, manage, reagent, report, settings, sigma,
users, westgard) converted from `const w = () => window as any; ... w().x()`
to `import { getKernel } from '../state/kernel'; ... getKernel().page.x()` —
a purely mechanical swap (same call shape, different lookup path), verified
by TypeScript catching every wrong/missing kernel field name at compile time
(a few were: `kernel.manage` needed the `manageTestsActionsController` merge
above; everything else matched the page's own controller on the first try).
`src/react/state/kernel.ts` (new) exports `getKernel()` (throws a clear error
if called before `modular-pilot.js` has run boot() — should never happen in
practice, since actual page rendering only starts after `DOMContentLoaded`)
and `useAppStore(selector)` (wraps Zustand's `useStore` React binding over
`kernel.store`, default selector returns `revision` — an exact drop-in
replacement for the old `useRenderVersion()`, confirmed by the 2 pages
(Sigma, Westgard) that capture the return value as `key={version}` for their
documented stale-`defaultValue` remount fix still working unchanged). The 9
pages that called `useRenderVersion()` now call `useAppStore()` instead;
`src/react/state/renderBus.ts`/`useRenderVersion.ts` and the
`window.QCLabReact.notify`/`notifyReactStore`'s `QCLabReact?.notify()` call
were deleted outright (zero remaining consumers once every page switched to
the Zustand-backed hook) — `notifyReactStore` is now just
`appStore.getState().touch()`. Verified: `npm test` 467/467, `typecheck`
clean, `check-build-freshness` matches all 4 bundles, `a11y-audit` 0
violations (18/18 modals — every kernel-routed function across every page
exercised via real browser clicks), `ui-check` 29/29, `nce-check` 91/91,
`visual-check`/`print-check` pass.

**Giai đoạn 2 (in progress) — `data-action` → real `onClick`/`onChange`/
`onKeyDown`, one page at a time, full e2e suite after every single page (not
batched — this is the highest-behavior-risk phase).** Dashboard (done): all
7 `data-action` buttons converted (`dashboardGoEntryFollowup`,
`dashboardContinueAction`, `goManageTargets`, `dashViewTestInEntry`,
`dashTestSetStatus` — the last already had a real bridge export, just wasn't
wired to `onClick` yet). `goManageTargets`/`dashboardGoEntryFollowup`/
`dashboardContinueAction`/`dashViewTestInEntry` are page-agnostic navigation
helpers (confirmed used across 6 pages via grep) added to `kernel.pres`, not
`kernel.dash` — they don't belong to Dashboard's own controller. Running
`scripts/nce-workflow-check.js` surfaced one test that had drifted into
checking an implementation detail rather than behavior: `checkOverdue-
ReachesDashboard()`'s "Nút mở thẳng đúng hồ sơ" asserted
`/data-action="dashboardContinueAction" data-args="\[0\]"/.test(main.innerHTML)`
— true by construction before this conversion, meaningless after (the
button still opens the right record, it just does so via a real `onClick`
closure now, with no `data-action` attribute left to match). Fixed by
clicking the actual button and asserting the real outcome (navigates to
`'actions'`, form shows the right `nceId`) instead of scanning for the
attribute string — this is a strict improvement, not a workaround, and is
the same class of fix anticipated for the ~88 bridge-wiring text-scanner
tests in the final cleanup phase, just found early because pages are being
converted before that phase runs. `goManageTargets`/`dashViewTestInEntry`
etc. embedded as raw text inside strings returned by shared classic
HTML-builders (`emptyStateHtml`, used via `dangerouslySetInnerHTML` on
Westgard/Sigma/Entry/Report) are NOT yet convertible — that requires those
shared builders to become real components first (a separate sub-task, not
yet started); Dashboard's own usages were all plain JSX buttons, so this
page needed no such dependency.

Users (done): all 7 `data-action` buttons/select (`addUser`,
`syncUserPermChecks` on the role `<select>`'s `onChange`, `resetPass`,
`openUserPerms`, `toggleUser`, `delUser`) converted — these 6 functions are
genuinely Users-page-specific (confirmed via grep, unlike Dashboard's shared
nav helpers) so they went into `kernel.users`, not `kernel.pres`. No test
fallout this time (nothing scanned for `data-action="addUser"` etc. as
literal text). Verified with an ad-hoc Playwright script (not committed) that
exercised every converted handler end-to-end under a real seeded admin
session: create user (count 2→3, confirmed reliable across 4 runs), toggle
active state, open the edit-permissions modal, and the role `<select>`'s
`onChange` correctly recomputing which permission checkboxes are
enabled/checked for the newly chosen role — this last one is the same
"append the live value" semantic `data-action-on="change"` used to provide
automatically; converting it to a plain `onChange={e => fn(id, e.target.value)}`
preserves that without the dispatcher.

Audit (done): 6 of 8 `data-action` usages converted
(`exportActivityCSV`/`archiveActivityLog`/`auditVerifyChainNow`/
`auditSetPageSize`/`auditClearFilters`/`auditSetPage`×2, all Audit-only →
`kernel.audit`) — the remaining one (`auditSetDate`, on the two date-range
inputs) is embedded as raw `data-action=` text inside `dateBoxHtml()`'s
returned string, injected via `dangerouslySetInnerHTML`; left as-is
(coexists fine with the converted handlers on the same page) until
`dateBoxHtml` itself becomes a real component — a cross-cutting change
shared by ~6 pages, deliberately deferred rather than done ad hoc per page.
Verified with an ad-hoc Playwright script: page-size `<select>` (using a
VALID option value — `AUDIT_PAGE_SIZES = [25, 50, 100]`, no `20` — a mistake
in the first draft of the check itself, not a product bug, caught by the
row count not changing and fixed by using a real option), pagination "Sau"
button, CSV export (stubbed `csvDownload` and confirmed it's called), and
`auditVerifyChainNow()` invoked directly (its button only renders when the
chain hasn't been auto-verified yet, unrelated to this conversion) — all
correct.

Report (done): 8 of 10 `data-action` usages converted
(`goManageTargets`/`reportUnlockPeriod`/`reportSetLockPart`×2/
`reportLockPeriod`/`printReport`/`exportReportXLSX`/`exportReportCSV`) —
remaining 2 (`reportRangeChanged`, on the two date-range inputs) deferred
like Audit's `auditSetDate`, same reason (`dateBoxHtml` string). This page
needed TWO new kernel namespaces beyond its own `kernel.report`:
`kernel.reportPrint` (= `reportPrintController`, also used by Westgard/Sigma
print) and `kernel.dataIo` (= `dataIoController`, also used by Westgard/Sigma
Excel export) — `printReport`/`exportReportXLSX`/`exportReportCSV` live on
those sibling controllers, not on `reportPageController` itself, found the
same way as Manage's `manageTestsActionsController` merge in Giai đoạn 1
(tracing each bridge call to its actual source rather than assuming
"one page, one controller"). Verified with an ad-hoc Playwright script:
clicking "Khóa kỳ này" correctly opens the real confirm dialog ("Khóa kỳ báo
cáo"); month/year `<select>`'s `onChange` fires `reportSetLockPart` with the
right part+value; clicking the Excel/CSV export buttons ran the real export
functions with zero console errors (a first attempt tried to stub
`window.exportReportXLSX`/`exportReportCSV` to detect the call — this no
longer works after the conversion, since the button now reads
`kernel.dataIo.exportReportXLSX` directly and never touches the bare global
at all; that's the intended outcome of this whole rewrite, not a test bug to
route around — switched to confirming zero errors on the real call instead).
`ui-workflow-check`/`visual-check`/`print-check` also re-run since this page
owns the print/export pipeline other pages share.

Settings (done): all 17 `data-action` usages converted — the first page
needing ZERO deferrals, since none of its buttons/inputs live inside a
`dangerouslySetInnerHTML`-injected string. `kernel.settings` merged in 6
standalone backup/reset functions (`exportData`/`importData`/
`verifyBackupFile`/`resetAllData`) plus `lisQueueController`'s
`lisGatewaySaveSettings`/`lisOpenQueueModal` (a LIS-Gateway-specific
sibling controller, same merge pattern as Manage/Report). The generic
`data-action="clickElementById" data-args='["imp"]'` pattern (used to click
a hidden `<input type="file">` from a visible button) and the one-line
`brandPickLogo` helper (itself just `document.getElementById('logoFile')
?.click()`) were both replaced with a plain inline
`onClick={() => document.getElementById('imp')?.click()}` instead of being
routed through the kernel at all — pure DOM operations with zero state
dependency don't need kernel indirection, matching the "pure functions get
direct treatment" principle from Giai đoạn 1. `pickLogo`/`importData`/
`verifyBackupFile` (wired to file `<input>`'s `onChange`) all take the raw
event object as their only parameter — confirmed by reading their
signatures before converting, so `onChange={pickLogo}` works as a direct
pass-through, same as the classic `data-action-on="change"` dispatch for
file inputs (which forwards the real event, not `.value`, since a file
input's `.value` is just the filename). Verified with an ad-hoc Playwright
script: `saveLab()` persisted a typed name into `state.lab.name`, the
backup file-picker button correctly triggers the hidden input's `.click()`,
`checkStorageUsage()` opens a real info dialog, `copyFirebaseRules()` wrote
649 characters to a stubbed `navigator.clipboard`. `ui-workflow-check`'s own
"Chọn file backup chưa tự thay state"/"Restore UI thay dữ liệu sau xác nhận
+ re-auth" checks independently cover the real import/restore flow through
the converted picker button.

Westgard (done): 15 of 16 `data-action` usages converted
(`wgSetViewMode`×2/`wgSetChartMode`×2/`exportWestgardXLSX`/`printWestgard`/
`wgSet`(checkbox)/`wgReset`/`goManageTargets`(one of its two usages — the
other stays embedded in an `emptyStateHtml()` string)/`wgLoadMoreRows`/
`wgTogglePrevLot`/`dashboardGoEntryFollowup`/`wgSelectTest`/
`openConfigAssay`/`wgSetArchivedTest`/`wgSetArchivedGroup`) — most were
ALREADY on `westgardPageController` (just needed wiring into JSX);
`wgSet`/`wgReset`/`wgSelectTest` were standalone globals, merged into
`kernel.westgard`; `openConfigAssay` came from `manageTestsActionsController`
(a cross-page helper — Westgard's CUSUM empty-state opens the SAME assay
config modal Manage uses — added to `kernel.pres`, not `kernel.manage`, since
reading `kernel.manage.X` from the Westgard page would misleadingly imply a
Manage-page dependency); `exportWestgardXLSX`/`printWestgard` came from the
`kernel.dataIo`/`kernel.reportPrint` namespaces added during the Report
page's conversion. Two source-text scanner tests broke exactly as
anticipated — `tests/westgard-print.test.js` and `tests/westgard-xlsx.test.js`
each asserted `/data-action="(printWestgard|exportWestgardXLSX)"/` against
`WestgardPage.tsx`'s raw source; fixed by asserting
`/onClick=\{(printWestgard|exportWestgardXLSX)\}/` instead — confirms the
button is still wired to the right function, just via the new mechanism.
Verified with an ad-hoc Playwright script: chart-mode tab switch (LJ↔CUSUM)
updates the active tab class; a rule checkbox's `onChange` correctly flips
`state.westgardRules['1-2s']`; "Khôi phục mặc định" click succeeds with no
errors. `visual-check`/`print-check` re-run since this page shares the
print/export pipeline.

Six Sigma (done): 19 of 21 `data-action` usages converted
(`sgOpenAddTest`/`sgRemoveTracked`/`sgSetTea`/`sgSetTeaMeta`×3/
`sgSetTeaSource`/`sgSelectPeriod`/`sgCell`×2/`sgPullCV`/
`exportSigmaPeriodXLSX`/`printSigmaPeriod`/`sgDelPeriod`/`sgOpenBias`/
`sgAddPeriod`/`exportSigmaPeriodsXLSX`/`printSigmaPeriods`/
`goManageTargets`) — everything was already reachable via `kernel.sigma`
(`sigmaPageController`), `kernel.dataIo`, `kernel.reportPrint`, or
`kernel.pres`, so this page needed zero NEW kernel wiring, only bridge
exports. Remaining 2 (`sgOpenAddTest` in `EmptyPanel`, `sgSetTeaMeta` for
the EFLM lookup date) stay deferred inside `emptyStateHtml()`/`dateBoxHtml()`
strings. The period `<tr>` combining `data-action="sgSelectPeriod"` (click)
+ `data-keydown-action` (Enter/Space, self-only) surfaced a **real semantic
gap** converting to React: the classic dispatcher resolves via
`event.target.closest('[data-action]')`, which returns the NEAREST matching
element only — a click on a nested button (`data-action="sgPullCV"` etc.)
never reaches the row's own handler, because `closest()` stops at the first
match. React's `onClick` has no such short-circuit — both the button's and
the row's handlers fire via normal bubbling. Fixed by checking
`(e.target as HTMLElement).closest('button, input, select')` inside the
row's `onClick` and bailing out if the click originated on/inside any
interactive descendant — every other multi-level `data-action` nesting in
this app was audited and confirmed to not hit this (buttons/inputs
elsewhere are not nested inside another `data-action` element), but this is
the pattern to check for whenever a `data-action` container HOLDS other
`data-action` descendants. Verified with an ad-hoc Playwright script:
clicking a `<td>` background selects the row; clicking a nested button/input
does not also select it. Hit a **test-harness pitfall, not a product bug**
while verifying `sgCell`: setting `input.value` directly and dispatching a
plain `input` event does NOT reliably trigger a React `onChange` (React's
internal value-tracking misses changes made through the raw DOM setter) —
confirmed by comparing against the pre-conversion code (via a throwaway
`git stash`/`pop` round-trip) which worked with the naive dispatch, then
finding the fix: set the value through
`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set`
before dispatching, which both correctly triggered `onChange` and confirmed
`sgCell` behaves identically to before. `ui-workflow-check`'s own "Xuất
Sigma XLSX từ browser tải workbook" independently re-confirms the export
button through a real click on the fully-converted page.

Reagent (done): 22 of 23 `data-action` usages converted
(`rcSwitch`/`openRcCreateModal`/`rcDeleteCurrent`/`openRcModal`/`rcPrint`/
`rcPrintSummary`/`rcMeta`(9 fields)/`rcMetaFocus`+`rcMetaLog`(4 fields)/
`rcOpenQuick`×2/`rcCell`×2/`rcRmRow`/`rcAddRow`/`rcClearRows`) — all already
on `reagentPageController` (`kernel.reagent`), zero new kernel wiring.
Remaining 1 (`rcMeta` for the date field) deferred, embedded in
`dateBoxHtml()`. The `data-focus-action="rcMetaFocus"` +
`data-change-action="rcMetaLog"` pair (used on lô cũ/lô mới/Bias/alpha —
the 4 fields worth an audit trail) needed a real mapping decision: classic
`data-change-action` binds the native `change` event, which for a text/
number input fires on commit (blur after an edit) — React exposes no direct
`onChange`-for-native-`change` equivalent (`onChange` is really `input`), so
`onFocus`/`onBlur` is the correct React counterpart; `rcMetaLog` itself
already no-ops when the before/after values are equal, so firing it on
every blur (not just "value actually changed since focus") is harmless.
Verified with an ad-hoc Playwright script (fixing the same native-value-
setter technique learned on the Sigma page): typing into "Tên hóa chất"
persists to `rcAct().test.reagent`; focusing then editing then blurring
"Số lô cũ" adds exactly one audit-log entry (confirming the onFocus/onBlur
split fires correctly and only once); "+ Thêm mẫu" grows the pair-row count
5→6; the row's own "✕" button shrinks it back 5→4. `a11y-audit` independently
confirms both `reagent:create-comparison`/`reagent:find-existing` modals
still open via the converted `openRcCreateModal`/`openRcModal` handlers.

Entry (done): all real-JSX `data-action` usages converted (tree nodes'
`treeToggle`/`entryPick` + `entryTreeKey` keydown, `toggleEntryTree`,
`entryFilter`, `entrySheetRunChanged`, `entryUnlockExtraRun`,
`entryDateNoteSave`, `entrySetSheetPart`×2, `entrySetSheetMonth`,
`entryGoToday`, `entryShowPrevLot`/`entryShowCurrentLot`, `entryFocusLevel` +
its click/keydown combo, `entrySetDays`, `voidQcPoint`, `entryToggleRows`,
`entryDetailToggled`×2 (via `<details onToggle>`), `openRangeWorkflow`,
`revertRange`) — everything already on `kernel.entry`
(`entryPageController`) except `openRangeWorkflow`/`revertRange`
(standalone globals, merged in) and `go` (added to `kernel.pres`, the
generic page-navigation primitive every page could plausibly need).
Remaining `entrySetStart`/`entrySetEnd` stay deferred inside `dateBoxHtml()`
strings. Found and fixed a **genuine pre-existing bug** while auditing every
`data-action` on this page: `entrySetMachine` (the "Lọc theo máy xét
nghiệm" `<select>`) had NEVER had a matching function anywhere in the
codebase since Entry's original React migration — `action-dispatcher.ts`'s
`resolve()` silently returned `undefined` for it, so the filter select had
done nothing since it was written. Added a real `entrySetMachine(value)` to
`entry-page-controller.ts` (same shape as the neighboring `entrySetDays`)
rather than leaving the select non-functional. The keydown-bound tree/sheet
navigation (`entryTreeKey`/`entrySheetKey`) uses the SAME `this`-bound
classic function signature as before — bridged as
`(el, event) => kernel.entry.entryTreeKey.call(el, event)`, called from JSX
as `onKeyDown={e => entryTreeKey(e.currentTarget, e)}`, preserving the
exact `this`-reads-the-DOM-node contract the navigation logic depends on.
`LjMini` (Levey-Jennings mini-panel) hit the same nested-data-action
bubbling gap as Sigma's period row (it wraps a real `<button>` from
`LjAction`) — fixed with the same `closest('button, input, select')` guard
in both its `onClick` and `onKeyDown`. **Also fixed 3 real bugs introduced
in the PREVIOUS (Sigma) commit**, found while auditing this page's
`data-action-on="change"` fields against React's actual event mapping:
`data-action-on="change"` on a plain text/number input means "fire on
commit/blur" (native `change`), but React's `onChange` for text-like inputs
fires on native `input` (every keystroke) — only for `<select>` and
checkbox/radio does React's `onChange` correspond to native `change`. Sigma's
`sgSetTea` and two `sgSetTeaMeta` fields (`eflmAnalyte`/`eflmRef`) are number/
text inputs that had been wired to `onChange` (saving on every keystroke,
including a real `deps.save()` persistence call) instead of `onBlur` —
fixed by switching those 3 to `onBlur`. Confirmed (by grepping every prior
commit's diff for `data-action-on="change"` paired with `<input>`/`<textarea>`)
that no other already-converted page has this mistake — the remaining
`change`-on-text-like cases in this Entry commit
(`entrySheetRunChanged`/`entryDateNoteSave`) were done correctly as `onBlur`
from the start. Verified extensively: a11y-audit's dedicated Entry keyboard-
Tab smoke pass (25 real Tab presses) still reports every focus stop clearly;
`ui-workflow-check`'s full Entry-heavy suite (create/void a QC point, date
picker sync, lot search/combobox, period lock/unlock) all pass unchanged;
an ad-hoc Playwright script additionally confirmed the newly-fixed
`entrySetMachine` actually filters the tree now, `ArrowDown` moves tree
focus between nodes, and a `<details>` toggle's open state survives a
`rerender()`.

Corrective action/"Khắc phục sự cố" (done): 21 of 21 `data-action`/
`data-notify-changed` usages converted — every function needed was ALREADY
on `kernel.actions`/`kernel.actionForm`/`kernel.dataIo` (no new kernel wiring
at all, unlike every other page so far). The generic `<Select>` component
was simplified to a single `onChange?: (v: string) => void` prop (dropped
the old `dataAction`/`dataActionOn`/extra-attrs plumbing it briefly carried
mid-conversion). `IssueRow` hit the same TS discriminated-union narrowing gap
as Westgard's `block.prevToggle!` fix: `item.action!.index` doesn't narrow
`item.action`'s `kind`, so `continueIndex`/`createArgs` are extracted as
plain `const`s via a ternary BEFORE the JSX, not inline. `<details
data-action-section={sectionKey} onToggle={...}>` and
`data-notify-changed="actionFormChanged"` (the form-wide "any field changed
→ save draft + refresh section chips" catch-all) became a container-level
`<div className="action-form-body" onChange={actionFormChanged}
key={model.formKey}>` — this covers every plain-JSX field correctly (a
select/textarea/input rendered directly by React bubbles its native
'input'/'change' up to a real ancestor fiber, so the ancestor's `onChange`
fires), but **not** the 5 `DateField`-rendered fields (`aDate`, `aDueDate`,
`aActionCompletedDate`, `aReleaseDate`, `aEffectivenessDate`), which render
via `dangerouslySetInnerHTML` and so create DOM nodes outside React's fiber
tree entirely — confirmed live (a raw native capture listener on
`.action-form-body` sees the bubbled 'input' event from inside a
`dangerouslySetInnerHTML` span just fine, but React's synthetic `onChange`
on that same ancestor never fires, because React resolves an event's
dispatch path by walking up looking for a stashed fiber reference starting
at `event.target`, and a `dangerouslySetInnerHTML`-injected node never gets
one). This is exactly the `nce-workflow-check.js` failure that had this
page at 90/91 mid-conversion ("Sau ngày hoàn thành, cổng cho phép trở lại
vẫn còn thiếu" — filling `#aActionCompletedDate` never recomputed the
"nguyên nhân" chip). Fixed by giving `DateField` its own `useRef`+`useEffect`
that binds native `input`+`change` listeners directly on its wrapper span,
calling `actionFormChanged()` — deliberately listening to **both** events,
matching `action-dispatcher.ts`'s own `data-notify-changed` implementation
(bound to both `document`-level `input` and `change` for the exact same
reason: `vn-date-picker-controller.ts`'s `pick()` dispatches both events
synchronously on a single calendar-day click, and a value typed then blurred
also fires a native `change` after the `input`). This means `actionFormChanged`
sometimes runs twice for one edit (once per event) — confirmed intentional
and harmless (verified live with call-count instrumentation): it's a pure
recompute-from-DOM function with no side effect beyond overwriting the same
chip text/title twice, and the classic implementation had identical
double-firing for the same reason. `nce-workflow-check.js` back to 91/91
after the fix. Verified: `npm test` 467/467 (1 `ui-route-structure.test.js`
assertion updated — it scanned for the old conditional `data-action` spread
and the literal `data-action="openActionGuide"` string, both replaced with
the real `onChange`/`onClick` patterns), `typecheck` clean,
`check-build-freshness` matches, `a11y-audit` 0 violations (18/18 modals),
`ui-workflow-check` 29/29, `nce-workflow-check` 91/91.

Manage/"Cấu hình chung" (done, the last page — **Giai đoạn 2 is now 11/11
complete**): 34 of 34 `data-action` usages across all 8 tabs converted.
`kernel.manage` needed 22 new entries beyond the 3 (`setTargetPanel`/
`setTargetGroup`/`setHistoryTest`) added in Giai đoạn 1 — every one of them
was already a plain export on `manageTestsActionsController` (the
`teaRefEdit`/`teaRefRemove`/`teaLabProfileOpen`/`teaRefOpenAdd` quartet
needed nothing extra, since `kernel.manage`'s `...managePageController`
spread already carried them). Two functions are **`this`-bound**
(`syncTargetRange`, `toggleTargetRow` — same calling convention as Entry's
`entryTreeKey`/`entrySheetKey`: they read `this.closest('.target-row')`
internally), so their bridge wrappers take the DOM element as an explicit
first parameter and `.call(el, ...)` the kernel method
(`syncTargetRange(el, 'target')` → `getKernel().manage.syncTargetRange.call(el,
'target')`), called from JSX as `onChange={e =>
syncTargetRange(e.currentTarget, 'target')}` — the Mean/SD matrix stays
exactly as uncontrolled (`defaultValue`/`defaultChecked`, no `rerender()` on
change) as documented under "Module roles" → Manage, only the event wiring
changed. The toolbar's "+ Thêm..." button and the Mean/SD matrix's row
checkbox both needed the SAME dynamic-name-to-function resolution the
Actions page's `IssueRow` needed for its discriminated union, but at the
page level instead of per-row: `toolbar.action.action` is a runtime string
from `manage-page-controller.ts` (one of 6 values —
`openConfigInstrument`/`openConfigAssay`/`openConfigPanel`/
`openLotTransitionV2`/`teaRefOpenAdd`/`setManageTab`), so a small closed
`TOOLBAR_ACTIONS` lookup object (module-scope, listing exactly those 6) maps
the string to the real imported function — a deliberately narrow, closed
dispatch table, not a re-implementation of `action-dispatcher.ts`'s general
name-to-global lookup. `LotGroupCard`'s activate/toggle button picked its
function the same way but inline (`group.toggle.command === 'activate' ?
activateLotGroup : toggleLotGroupStatus`), since it's only ever those two.
This page surfaced the SAME `dangerouslySetInnerHTML`-vs-fiber-tree gap
Actions found — but did **not** need the same fix: none of Manage's own
fields render through that mechanism (its `EmptyState`/table rows are all
real JSX), so the container-catch-all issue documented under Actions simply
didn't arise here. Verified: `npm test` 467/467 (no scanner test needed
updating — nothing scanned Manage's `data-action` strings literally),
`typecheck` clean, `check-build-freshness` matches all 4 bundles, `a11y-audit`
0 violations (18/18 modals, including the 6 Manage ones), `ui-workflow-check`
29/29 (covers add/edit instrument, add test, apply Mean/SD range, lot
transition combobox — all Manage-page workflows), `nce-workflow-check` 91/91,
plus an ad-hoc Playwright script confirming tab switching, the TEa reference
onBlur commit, the toolbar's dynamic "+ Thêm..." dispatch, and the lot
group's "Sửa nhóm" button all still work correctly.

**Giai đoạn 2 (data-action → React events) is now fully done, 11/11 pages.**

**Giai đoạn 3 (modal → `createPortal`, one modal at a time) — started.**
`confirmDialog`/`infoDialog`/`reauthenticateCurrentUser` (the 3 shared,
cross-page dialogs — `#dialogRoot`, used from dozens of call sites app-wide,
not page-specific forms) are the first piece done, since they're the
simplest and most foundational of the ~18 modals. `src/react/dialogs/
dialog-store.ts` (a plain `zustand/vanilla` store — no need to route through
`window.__QC_KERNEL__`, since both producer and consumer of this state live
in the SAME bundle, react-pilot.js) replaces classic `dialog-overlay-
controller.ts` (deleted outright — confirmed zero remaining consumers of
`openDialogOverlay`/`dialogKeydown`/`confirmDialogAnswer`/`infoDialogAnswer`
once `confirmDialog`/`infoDialog` themselves were replaced).
`src/react/dialogs/DialogOverlay.tsx` is mounted ONCE, permanently, into
`#dialogRoot` from `react-pilot.entry.tsx` (a `createRoot().render()` call
at module top level, not per-page-switch like `#main` — `#dialogRoot` is a
static element in `index.html`, already parsed by the time this `<script
defer>` runs) — it renders `null` when no dialog is open, exactly matching
the a11y-audit/ui-check test convention of checking
`#dialogRoot.innerHTML.trim()` to detect "is a dialog open". The component
replicates the classic HTML structure/CSS classes byte-for-semantic
(`.modal-bg`/`.confirm-modal`/`.confirm-modal-h`/`.confirm-modal-body`/
`.confirm-modal-actions`, the `dialog-enter` CSS animation, `role="dialog"`/
`aria-modal`/`aria-labelledby`) so no CSS changes were needed and the a11y
ratchet's `shared:confirm-dialog`/`shared:reauth-dialog` entries keep passing
unmodified. The focus-trap contract (Escape closes, Tab/Shift+Tab wraps,
focus returns to the pre-open element) is ported from `modal-focus-trap.ts`
into a `useDialogFocusTrap` hook — `modal-focus-trap.ts` stays a pure,
DOM-free-at-module-scope helper, so importing it directly into `react-pilot.js`
is safe and duplicates zero risk (same "pure functions get direct import"
rule from Giai đoạn 1), rather than reimplementing the same logic twice.
`reauthenticateCurrentUser` (the password re-auth gate in front of ~9
critical operations — approve/return NCE, lock/unlock report periods,
Mean/SD range changes, lot transitions, reset-all-data, restore-from-backup)
turned out to depend on the SAME `openDialogOverlay` primitive with its own
custom HTML (a password field, not just message+buttons) — discovered while
tracing consumers before assuming `dialog-overlay-controller.ts` was safe to
delete outright. Converted in the same unit of work rather than left on the
classic HTML-string path (which would have meant TWO different code paths
writing to the same `#dialogRoot` DOM node — the classic one competing with
React's now-permanent ownership of that container, guaranteed to corrupt
React's reconciliation the moment both write to it). The actual PBKDF2
password check stays entirely in `modular-pilot.js`
(`root.reauthVerify`/`root.reauthAccountLabel`, exposed to React via
`kernel.pres`) — the React `ReauthForm` component only ever sees a
true/false verification result, never `currentUser.passHash`, preserving the
same security boundary as before. Verified: `npm test` 467/467 (2 source-scanner
tests — `ui-route-structure.test.js`/`ui-accessibility.test.js` — updated to
drop the deleted `dialog-overlay-controller.ts` from their `read()`
concatenation; their assertions all target patterns that also exist in the
still-live `modal-controller.ts`/`modal-focus-trap.ts`, so nothing else
needed to change), `typecheck` clean, `check-build-freshness` matches all 4
bundles, `a11y-audit` 0 violations (18/18 modals, `shared:confirm-dialog`/
`shared:reauth-dialog` included), `ui-workflow-check` 29/29 (3 of its checks
exercise the real reauth flow end to end: period lock/unlock, backup
restore), `nce-workflow-check` 91/91, `visual-check` passes, plus an ad-hoc
script confirming `confirmDialog` resolves `true`/`false` correctly on
confirm/Escape/backdrop-click, `infoDialog` resolves on "Đã hiểu", and
`reauthenticateCurrentUser` shows the inline error and stays open on a wrong
password.

`#modalRoot` infrastructure (done): the ~16 remaining page-specific form
modals (Manage's instrument/lot/assay/tea-lab-profile, Sigma's
add-test/bias/MU-budget, Reagent's create-comparison/find-existing, Actions'
NCE guide, Users' edit-permissions, Settings' LIS-queue, Audit's archive-log)
all still render as classic HTML strings via `openModal(html)` — but
`#modalRoot` itself is now permanently React-owned, the same strangler-fig
shape already proven across the whole page migration: `src/react/dialogs/
modal-store.ts`'s `ModalState` has an `'html'` variant (a raw string, shown
via `dangerouslySetInnerHTML` — what every unconverted modal still produces)
and a `'react'` variant (`render: () => ReactNode`, for a modal once it's
actually ported to JSX) side by side, so modals can be converted **one at a
time** without two writers ever fighting over the same DOM node — the exact
trap `reauthenticateCurrentUser` hit and had to be fixed alongside
confirmDialog/infoDialog. `openModal(html)` keeps its original signature
(now `(window as any).QCLabReact.openModal(html)` under the hood), so **none
of the ~17 existing call sites needed to change** — only the container
itself moved to React. `src/react/dialogs/ModalOverlay.tsx` mirrors
`DialogOverlay.tsx`'s pattern but can't hold a stable `ref` to the modal
element the way `DialogOverlay` does (an `'html'`-kind child isn't a React
tree, so there's nothing to attach a ref to) — it re-queries `#modalRoot
.modal` on demand instead, exactly like classic `modal-controller.ts`'s own
`activeModal()` used to. For the `'html'` kind only, a `useHtmlModalA11y`
effect reproduces the same post-render DOM annotation classic code did
(`role="dialog"`, `aria-modal`, `aria-labelledby` wired to the first `<h3>`,
a default `aria-label` on any `.modal-close` button missing one) — a
future `'react'`-kind modal sets all of this directly in its own JSX instead,
same division of labor as `DialogOverlay.tsx`'s `confirm`/`info`/`reauth`
kinds. Classic `modal-controller.ts` was deleted outright (confirmed zero
consumers left after `root.openModal`/`root.closeModal` were repointed) —
`tests/ui-accessibility.test.js`/`ui-route-structure.test.js`'s `modals`
text-scanner concatenation now reads `ModalOverlay.tsx` in its place (one
literal string tweak: `setAttribute('role','dialog')` needed the same
no-space style as the deleted classic file, since the scanner regex is an
exact string match, not whitespace-tolerant). Verified: `npm test` 467/467,
`typecheck` clean, `check-build-freshness` matches all 4 bundles,
`a11y-audit` 0 violations across **all 18** modals (proving the `'html'`
compatibility path is pixel-for-pixel behaviorally identical to the classic
container for every still-unconverted modal), `ui-workflow-check` 29/29,
`nce-workflow-check` 91/91.

Actions' NCE guide (done, first modal actually converted to `'react'`):
`openActionGuide()` — a purely informational popup (the 8-step NCE process,
no form state, no re-authentication) — was picked first for exactly that
reason, same "simplest first" logic as picking confirmDialog/infoDialog
before reauthenticateCurrentUser. `src/react/modals/ActionGuideModal.tsx`
reads the SAME step data as before (`root.ActionGuidePresentation.steps`,
exposed via `kernel.actions.actionGuideSteps` — a plain data array, no
duplication risk) and declares its own `role="dialog"`/`aria-modal`/
`aria-labelledby`/`tabIndex` directly in JSX, same division of labor as
`DialogOverlay.tsx`'s `'confirm'`/`'info'`/`'reauth'` kinds vs.
`ModalOverlay.tsx`'s `useHtmlModalA11y` (which only runs for the `'html'`
kind). The bridge function `openActionGuide` (`src/react/bridge/
actionsBridge.ts`) keeps its exact name and call signature — `ActionsPage.tsx`
needed ZERO changes, still `onClick={openActionGuide}` — but its
implementation switched from `getKernel().actions.openActionGuide()` to
`openReactModal(() => createElement(ActionGuideModal, {steps:
getKernel().actions.actionGuideSteps}))`; `createElement` (not JSX) because
`actionsBridge.ts` is a plain `.ts` file, and — the one build-config fix this
conversion needed — `tsconfig.modules.json` (the non-JSX classic/bridge
config, `include: ["src/**/*.ts"]`) was unintentionally also type-checking
every `src/react/**/*.ts` bridge file redundantly alongside
`tsconfig.react.json` (which already covers `src/react/**/*.ts` *and*
`*.tsx` with `jsx:"react-jsx"`); that redundancy was harmless until a bridge
file needed to import a `.tsx` component, at which point the non-JSX config
failed to resolve it. Fixed by adding `"exclude": ["src/react/**"]` to
`tsconfig.modules.json` — `src/react/**` was always meant to be
`tsconfig.react.json`'s domain alone. The classic implementation
(`openActionGuide()` in `actions-page-controller.ts`, `createActionGuideContent`/
`action-guide-content.ts`, and their `root.X=` wiring) was deleted outright
once confirmed to have zero remaining callers — `root.ActionGuidePresentation`
itself (the pure step *data*, from `action-guide-presentation.ts`) stays,
since the React side still reads it. Two now-obsolete test files were
deleted (`action-guide-content.test.js` — exercised the deleted HTML
builder directly; `admin-render-bridge.test.js` — its one-entry table
existed solely to pin `actionGuideContent`'s classic bridge-contract shape),
and two scanner assertions in `tests/ui-route-structure.test.js` were
repointed at the new source of truth (the `const openActionGuide = ` check
dropped from the classic-file list since the function no longer lives
there; the `cls: 'action-guide-modal'` check now reads
`ActionGuideModal.tsx`'s `className` instead, preserving the original
intent — a dedicated CSS class, not a generic modal — against wherever the
modal now actually lives). `scripts/a11y-audit.js`'s `actions:nce-guide`
entry called `openActionGuide()` as a bare global — no longer possible since
it's now React-only, not a `root.X=` global — fixed by clicking the real
"Quy trình 8 bước" button instead (arguably more faithful to the file's own
stated goal of exercising "the real trigger function, not a synthetic
click", since a button click *is* the real trigger now). Verified: `npm
test` 465/465 (467 minus the 2 deleted files), `typecheck` clean,
`check-build-freshness` matches, `a11y-audit` 0 violations across all 18
modals, `ui-workflow-check` 29/29, `nce-workflow-check` 91/91, plus an
ad-hoc script confirming all 8 steps render with correct text, and the
modal closes via Escape and via its "Đóng" button.

Audit's "Lưu trữ nhật ký cũ" (done, second real modal converted): picked
next for being the next-simplest — one `<select>` (12/24/36 months, no
validation) plus a submit button, with **zero local error/loading state
needed in the component itself**, since `ActivityArchiveCommand.execute()`
(unchanged, already using React confirmDialog/infoDialog from the very first
Giai đoạn 3 commit) owns the entire confirm → reauthenticate → download →
confirm-again → close flow internally — `ArchiveLogModal.tsx` only renders
the initial form and calls `confirmArchiveActivityLog()` on submit, letting
that command decide whether/when to call `closeModal()`. This is a
meaningfully different (simpler) shape than a modal that manages its own
draft/validation state, worth remembering as a category: **modals whose
"confirm" button hands off to an existing command that already owns the
close/cancel decision need no local React state at all** — only modals that
validate/collect input themselves (the next tier up in complexity) will.
`root.archiveActivityLog`/`activityAuditArchiveModalHtml` (the classic
opener + HTML builder) were deleted outright, confirmed dead — the gate
logic they held (`requireAdmin()` + "is there anything to archive at all"
via `state.activity.length`) moved into the bridge function
(`src/react/bridge/auditBridge.ts`), reading the count via a new
`kernel.audit.activityTotal()` (`root.confirmArchiveActivityLog` itself
stays classic-side, exposed the same way). Two now-dead files removed
(`activity-audit-archive-modal-html.ts` + its test). This conversion also
exposed a real gap in `scripts/a11y-audit.js`'s own seeding for this modal:
its `open()` used to call `logAct(...)` then the (now-retired) global
`archiveActivityLog()` directly, bypassing the Audit page's own render
entirely — `logAct()` alone does **not** call `rerender()`/`touch()` (most
callers trigger their own re-render right after logging), so nothing had
ever required the just-logged row to actually reach the screen before. Once
the trigger became "click the real button" (same fix pattern as the NCE
guide's `actions:nce-guide` entry), the button's own visibility gate
(`model.total > 0`) meant the test had to force a `rerender()` after
`logAct()` and poll for the button (mirroring the "React commit is
asynchronous relative to a synchronous `page.evaluate` body" lesson from
`nce-workflow-check.js`) — and doing so surfaced a **real, pre-existing**
accessibility bug the old test had never actually exercised: `.audit-seq`'s
`#7c8e9a` on white was only 3.39:1 contrast (needs 4.5:1, since 10.5px bold
doesn't qualify as WCAG "large text"). Fixed by switching to the existing
`--muted` token (`--gray-600`, `#506674`, ~6:1 contrast) instead of a new
one-off hex — a genuine accessibility fix that happened to fall out of
fixing the test's own fidelity, not a change requested by this modal
conversion itself. Verified: `npm test` 464/464, `typecheck` clean,
`check-build-freshness` matches, `a11y-audit` 0 violations across all 18
modals, `ui-workflow-check` 29/29, `nce-workflow-check` 91/91, plus an
ad-hoc script confirming the form renders with the right default
(24 months), and that submitting with only a same-day seeded row correctly
takes the "nothing old enough to archive" path (closes the form, shows the
matching info message) — proving the hand-off to the unchanged
`ActivityArchiveCommand` still works end to end through the new UI.

Reagent's "Chọn phép so sánh" (done, third real modal converted): the first
one with **live search filtering**. Classic `renderRcModal()` had to
debounce the search box (`scheduleSearchRender`) because every keystroke
rebuilt the whole modal's HTML string and re-opened it via `openModal()`;
the React version doesn't need that — `ReagentPickerModal.tsx` holds `query`
in local `useState` and re-filters a plain array on every keystroke, which
is cheap enough to skip debouncing entirely (worth remembering as a general
pattern: a debounce that existed to amortize *string-rebuild-and-reopen*
cost usually isn't needed once the same list becomes a React re-render).
`rcPickerItems(query)` is a new pure-data twin of the deleted
`renderRcModal()`'s filter logic, added to `reagent-page-controller.ts` (mirrors
Actions' `actionGuideSteps` and Audit's `activityTotal()` — expose a plain
data reader on the existing controller rather than inventing new
architecture). This conversion surfaced a **real latent bug in the classic
code**, not just a test-fidelity gap: `rcDelete(id, keepModal)` special-cased
`keepModal=true` (only ever passed by the picker's own delete button) to
call `renderRcModal()` again afterward, refreshing the list to remove the
deleted row — a manual "re-render this one modal" step that has no React
equivalent and would have thrown `ReferenceError` the moment
`renderRcModal` was deleted. Fixed by dropping the `keepModal` parameter
entirely and having `ReagentPickerModal` call `useAppStore()` — the same
`deps.rerender()` that already ran unconditionally at the end of
`rcDelete()` now reaches the picker automatically through the shared store,
same as any other page. This is the general fix for the whole "modal needs
to manually re-open itself after a mutation" class: once a modal subscribes
to the store, that class of special-casing becomes unnecessary and should
be deleted, not ported. Classic `reagent-picker-modal-html.ts`/
`reagent-picker-rows-html.ts` (plus their 2 dedicated tests) were deleted
outright; `tests/reagent-label-bridge.test.js` had its 2 now-retired
contract checks removed (`deps.pres.pickerModal`/`pickerRows`, and the
matching bridge-type-declaration checks) while its ~20 *other* contract
checks (for the parts of this page NOT yet converted) were left untouched;
`tests/reagent-comparison-service.test.js` had one assertion's pinned
`rcDelete` signature text updated to drop `keepModal` while preserving its
actual intent (rcDelete must require admin, not just write — unchanged).
`scripts/a11y-audit.js`'s `reagent:find-existing` entry switched from
calling the now-retired `openRcModal()` global to clicking the real
`.rc-find-btn` (a class selector, since the button's actual text is mixed
with an SVG icon via `dangerouslySetInnerHTML` — matching-by-class is more
robust here than matching visible text). Verified: `npm test` 462/462,
`typecheck` clean, `check-build-freshness` matches, `a11y-audit` 0
violations across all 18 modals, `ui-workflow-check` 29/29,
`nce-workflow-check` 91/91, plus an ad-hoc script confirming live search
narrows/restores the row list without any debounce delay, and picking a row
closes the modal.

Settings' "Xem hàng chờ QC" (done, fourth real modal converted, LIS Gateway
queue): the most involved conversion so far, because unlike the prior
three, **the trigger itself does real async work before deciding whether to
open anything** (`lisOpenQueueModal()` checks `gatewayConfig().enabled` and
does a network `gatewayPull()` before showing data) — a classic `.ts` file
can run that logic, but can't construct the JSX to show afterward. Split
cleanly: `lis-queue-controller.ts`'s `lisOpenQueueModal()` now does only the
check-and-pull and returns a `Promise<boolean>` (open or don't); the bridge
(`settingsBridge.ts`) awaits it and calls `openReactModal(...)` only on
`true` — the same "classic owns verification, React owns presentation"
split used for `reauthenticateCurrentUser`'s PBKDF2 check vs. its form.
`lisQueueModel()` (new, mirrors `rowHtml`/`sectionHtml`/`modalHtml`'s branch
logic but returns `{pending, unresolved}` data) reuses the SAME `rowModel()`
addition to `lis-queue-presentation.ts`, added alongside — not replacing —
`rowHtml`, since `rowHtml`/`sectionHtml`/`modalHtml` still exist and pass
their own dedicated tests unchanged; only the *controller's* call sites
moved off them. `lisQueueRefresh`/`lisQueueImport`/`lisQueueReject` — which
used to call the classic `lisRenderQueueModal()` to redraw the list after
every action — were simplified to call the already-existing `deps.rerender()`
instead (a new `rerender` dependency added to the controller's `deps`), and
`LisQueueModal.tsx` subscribes via `useAppStore()`; this is now the **third**
instance of the exact fix pattern first found in Reagent's picker
(`keepModal`/manual re-open → store subscription), confirming it as the
general rule for any modal that must reflect a mutation it just caused.
`scripts/a11y-audit.js`'s `settings:lis-queue` entry could no longer bypass
the network check by calling `lisRenderQueueModal()` directly (that
function still exists but nothing in the live UI calls it anymore) — fixed
by stubbing the two classic globals its real check reads
(`lisGatewayConfig`/`lisGatewayPull`, both bare, reassignable `root.X`
functions) and clicking the real "Xem hàng chờ QC" button, matching the
"click the real trigger" convention from the two prior a11y-script fixes.
Verified: `npm test` 462/462, `typecheck` clean, `check-build-freshness`
matches, `a11y-audit` 0 violations across all 18 modals, `ui-workflow-check`
29/29, `nce-workflow-check` 91/91, plus an ad-hoc script confirming both
queue sections render with correct counts, and that rejecting an
unresolved row removes it from the list — and the section disappears
entirely — without the modal ever closing or being reopened.

Users' "Sửa quyền" (done, fifth real modal converted): the first modal
where **the checkbox grid stays `dangerouslySetInnerHTML` on purpose** —
`syncUserPermChecks(groupId, roleValue)` (unchanged) directly toggles
`disabled`/`checked` on the raw DOM checkboxes when the role `<select>`
changes, exactly the same pattern the "Thêm người dùng" form already used
since Giai đoạn 2 (a classic function mutating inside a React-opaque
`dangerouslySetInnerHTML` block is safe, since React never diffs inside
it) — so this modal needed NO new interaction logic, just wiring the
existing pieces (`roleSelectOptionsHtml`, `userPermChecksHtml`,
`syncUserPermChecks`, all already bridged from Giai đoạn 2's Users page)
into a real `.modal`/`.modal-h`/`.modal-b`/`.modal-f` JSX shell. `openUserPerms(id)`
followed the same split as `lisOpenQueueModal()`: the classic function now
returns `Promise<Model | null>` (permission gate + "not editing yourself"
check, `null` on any failure) instead of opening anything; the bridge awaits
it and calls `openReactModal(...)` only on a non-null result.
`applyUserPerms(id)` needed **zero changes** — it already read
`#editUserRole`/`#editUserPerms` straight from the DOM at submit time,
oblivious to whether React or a template string produced those elements
(same reason Manage/Settings' uncontrolled-form fields never needed
conversion work either). Classic `user-permissions-modal-html.ts`/
`user-role-select-html.ts` deleted outright (2 dedicated tests removed);
`tests/users-page-bridge.test.js` had its now-retired
`userPermissionsModalHtml` contract check removed while its `resetPasswordModalHtml`
check (a different, still-unconverted modal) stayed untouched.
`scripts/a11y-audit.js`'s `users:edit-permissions` switched from calling
the retired `openUserPerms()` global to clicking the real "Sửa quyền"
button. Verified: `npm test` 460/460, `typecheck` clean,
`check-build-freshness` matches, `a11y-audit` 0 violations across all 18
modals, `ui-workflow-check` 29/29, `nce-workflow-check` 91/91, plus an
ad-hoc script confirming the modal opens with the right role/permission
state (4 disabled checkboxes under "technician"), and that switching the
role to "admin" correctly re-enables every checkbox live, matching the
exact classic behavior.

Manage's máy xét nghiệm (done, sixth real modal converted): the first
**pure CRUD form** in Giai đoạn 3 — no async gate on open, no live search, no
role-driven checkbox logic, just 4 text inputs + a checkbox, entirely
uncontrolled (`defaultValue`/`defaultChecked`), submit hands off to the
unchanged `saveConfigInstrument(id)`. `openConfigInstrumentModel(id)` (new,
replaces `openConfigInstrument`) is a plain synchronous data reader — no
`Promise`/gate split needed this time, unlike `lisOpenQueueModal`/
`openUserPerms`, since the classic function never checked permissions on
*open*, only on *save*. This conversion surfaced a **real, pre-existing
wiring gap** that had nothing to do with the HTML-vs-React question: `kernel.manage`
was missing `saveConfigInstrument` entirely — it was never needed before,
because the classic modal's save button was plain `data-action="saveConfigInstrument"`
HTML, dispatched by `action-dispatcher.ts`'s direct `root.X` lookup, which
never went through the kernel at all. The moment the button became a real
`onClick={() => getKernel().manage.saveConfigInstrument(id)}`, the missing
kernel entry surfaced immediately as `getKernel(...).manage.saveConfigInstrument
is not a function` — caught by an ad-hoc debug script before it could reach
committed code. General lesson for the remaining Manage/Sigma modals: **check
that every action a converted modal's buttons call is actually present on
`kernel.X`, not just assume it's not there because it "was working before"** —
a modal only reaching the kernel for its OPEN path (already routed through
`kernel.manage.openConfigInstrument` since Giai đoạn 2) says nothing about
whether its SAVE path was ever exercised through the kernel too. `openConfigAssay()`
(still classic, unconverted) has its own internal redirect — if no
instruments exist yet, it force-opens the instrument modal first, to guide
the user — which used to call the local `openConfigInstrument()` directly;
now it calls a new `deps.openReactInstrumentModal()` dependency, wired to
`window.QCLabReact.openConfigInstrument()` (the same bridge function real
buttons call), the same "classic caller reaching into the React modal
system" pattern already used for `reauthenticateCurrentUser`. Classic
`config-instrument-modal-html.ts` deleted outright (1 dedicated test
removed); `tests/manage-core-bridge.test.js` had its 2 now-retired contract
checks removed; `tests/manage-crud-labels.test.js` (a title-convention
check running across every Manage CRUD modal) had its instrument branch
repointed from the deleted classic file to `InstrumentModal.tsx`'s JSX text.
`scripts/a11y-audit.js`'s `manage:add-instrument`/`manage:edit-instrument`
and `scripts/ui-workflow-check.js`'s instrument add/edit checks all switched
from calling the retired `openConfigInstrument()` global to clicking the
real toolbar/row buttons. Verified: `npm test` 459/459, `typecheck` clean,
`check-build-freshness` matches, `a11y-audit` 0 violations across all 18
modals, `ui-workflow-check` 29/29 (including the real add/edit-instrument
flows that caught the `saveConfigInstrument` gap), `nce-workflow-check`
91/91.

Manage's lô QC (done, seventh real modal converted): same CRUD-form shape as
the instrument modal, plus **2 date fields** (Ngày mở/Hạn sử dụng) — kept as
`dateBoxHtml()` + `dangerouslySetInnerHTML`, the established "deferred
field" treatment, since nothing else in this modal needs to react to the
date value while typing (only read at submit via `saveConfigLot`, unchanged).
The level `<select>` also stays `dangerouslySetInnerHTML` for its `<option>`s
(`configLotLevelOptionsHtml(level)`, newly exposed on `kernel.manage`) since
it needs no live interaction either — matching Users' role-select precedent
of keeping simple, read-at-submit pickers as raw HTML rather than converting
them to controlled `<option>` JSX for no behavioral benefit. Caught the
**exact same missing-kernel-wiring bug class** as the instrument modal,
twice in a row now: `kernel.manage` was missing `saveConfigLot` too (same
root cause — its save button used to be classic `data-action`, dispatched
straight off `root.X`, never through the kernel) — found immediately via
typecheck-clean-but-runtime-broken behavior, fixed the same way. This
confirms the lesson from the instrument modal as a **standing checklist
item** for every remaining Manage/Sigma conversion: before wiring a modal's
save button to `getKernel().manage.X(...)`, grep `kernel.manage`'s
construction block for `X:` — don't assume presence from the open-path
already working. Classic `config-lot-modal-html.ts` deleted outright (1
dedicated test removed); `tests/manage-core-bridge.test.js` had 2 more
now-retired contract checks removed, one of which needed repointing rather
than deleting outright (`configLotLevelOptionsHtml`'s *consumption* check
moved to `LotModal.tsx`, since the function itself is still a valid bridge
contract — only *where* it's called from changed). `tests/manage-crud-labels.test.js`'s
lot branch repointed to `LotModal.tsx`'s JSX, mirroring the instrument
branch. `scripts/a11y-audit.js`'s `manage:add-lot`/`manage:edit-lot`
entries needed to switch to the "lots" tab first (`Manage` defaults to
"instruments") — and since that tab switch shares the exact "React commit
is async relative to a synchronous script body" race documented for
`audit:archive-log`, this surfaced a **latent ordering bug in the audit
script itself**: `manage:add-lot`/`manage:edit-lot` leaving the tab
switched to "lots" made the *already-passing* `manage:edit-instrument`
entry (which runs later in the same array and assumed the default
"instruments" tab was still active) start failing — fixed by having every
Manage tab-dependent entry explicitly call `setManageTab(...)` itself
(with the same async retry-poll for the resulting button) rather than
relying on residual state from whichever entry happened to run before it.
Verified: `npm test` 458/458, `typecheck` clean, `check-build-freshness`
matches, `a11y-audit` 0 violations across all 18 modals, `ui-workflow-check`
29/29, `nce-workflow-check` 91/91, plus an ad-hoc script confirming the
level options render correctly (1–6), the date field widgets are present,
and saving persists all fields (including a blank date correctly staying
blank) and closes the modal.

Manage's Panel QC (done, eighth real modal converted): the first modal with
a **dependent, live-filtered list** — which tests show as checkboxes
depends on the currently-selected instrument. Classic `renderConfigPanelTests()`
rebuilt the whole checkbox-list HTML string on every instrument change (a
`data-action-on="change"` handler); the React version needs no such
rebuild-and-inject step — `PanelModal.tsx` keeps `instrumentId` in real
`useState` (the ONE genuinely-controlled field in this modal) and derives
`visibleTests = allTests.filter(t => t.instrumentId === instrumentId)`
inline, letting React's own reconciliation mount/unmount the right
`<input>` checkboxes. The subtlety: classic behavior always resets to an
all-unchecked list on instrument change (never remembers a previous
selection for a re-selected instrument) — reproduced with
`defaultChecked={instrumentId === initialInstrumentId && testIds.includes(t.id)}`,
which is `true` only for the ORIGINALLY-loaded instrument's originally-saved
test IDs; switching to any other instrument (including switching back)
naturally unmounts/remounts those checkbox nodes with a fresh (unchecked)
`defaultChecked`, matching classic behavior with zero manual reset code.
`openConfigPanelModel(id)` also has **two sequential preconditions** (no
tests yet / no instruments yet), each showing an `infoDialog` and switching
the Manage tab before returning `null` — same `Promise<Model | null>` shape
as `lisOpenQueueModal`/`openUserPerms`. Hit the **exact missing-kernel-wiring
bug a third time**: `kernel.manage` was missing `saveConfigPanel` too — by
now a fully expected, quickly-caught category rather than a surprise.
`renderConfigPanelTests()` itself, and the 3 classic HTML builders it and
`openConfigPanel()` used (`config-panel-modal-html.ts`, `config-panel-test-rows.ts`,
`config-panel-instrument-options-html.ts`), were deleted outright once
confirmed to have zero remaining callers (6 dedicated tests removed across
the 3 files); `tests/manage-core-bridge.test.js` had 4 more now-retired
contract checks removed, `tests/manage-crud-labels.test.js`'s Panel QC
branch repointed to `PanelModal.tsx`'s JSX. No a11y-audit.js/ui-workflow-check.js
changes needed — Panel QC was never in either script's tracked list.
Verified: `npm test` 455/455, `typecheck` clean, `check-build-freshness`
matches, `a11y-audit` 0 violations across all 18 modals, `ui-workflow-check`
29/29, `nce-workflow-check` 91/91, plus an ad-hoc script confirming the
test list correctly filters per instrument, shows the empty state for an
instrument with none, and resets to unchecked when switching instruments
and back.

Manage's nhóm lô (done, ninth real modal converted): lots grouped into
columns by level, each a real checkbox — simpler than Panel QC since
nothing here needs to be re-filtered when a checkbox changes (unlike
Panel's instrument-dependent test list), so the whole column structure is
plain JSX with uncontrolled (`defaultChecked`) checkboxes, no local
`useState` at all. `suggestConfigGroupName()` (unchanged, still reads
`.cfg-group-lot:checked` and writes `#cfgGroupName` directly) is wired via
one `onChange` on the `.lot-level-picker` container — the same
"container-level catch-all instead of per-checkbox handlers" pattern
`FormOpenBody`'s `actionFormChanged` established back in the Actions page.
`openConfigGroupModel(id)` has one precondition (no lots yet exist at all)
returning `Promise<Model | null>`, same shape as the last several
conversions. Classic `lot-group-modal-html.ts`/`lot-group-columns-html.ts`
deleted outright (2 dedicated tests removed — NOT
`lot-group-status.test.js`/`lot-group-toggle-action.test.js`, which test
unrelated status/toggle logic and were left untouched);
`tests/manage-core-bridge.test.js` had its 4 now-retired contract checks
removed, `tests/manage-crud-labels.test.js`'s "nhóm lô" branch repointed to
`LotGroupModal.tsx`. Neither `a11y-audit.js` nor `ui-workflow-check.js`
tracks this modal, so no script changes needed. An ad-hoc verification
script's first attempt looked like a save failure (`groupCount` unchanged,
modal stayed open) — turned out to be the test picking lots already
belonging to the existing seeded group, then (after fixing that) picking
only one fresh lot, both correctly rejected by the **pre-existing** "a lot
group needs at least 2 lots" validation with an `infoDialog` message; not a
regression, a reminder to check for a blocking `infoDialog` before assuming
a save silently failed. Verified: `npm test` 453/453, `typecheck` clean,
`check-build-freshness` matches, `a11y-audit` 0 violations across all 18
modals, `ui-workflow-check` 29/29, `nce-workflow-check` 91/91, plus the
corrected ad-hoc script confirming the auto-name suggestion updates live as
lots are checked and the group saves/closes correctly with 2+ lots.

Six Sigma's "Chọn hoặc thêm xét nghiệm" (done, tenth real modal converted,
first Sigma modal): the first modal after the Manage series, and the first
case where `kernel.sigma` needed **zero new wiring** at all —
`kernel.sigma = sigmaPageController` is a direct spread of the whole
controller (unlike `kernel.manage`'s hand-curated object), so every new
function (`sgOpenAddTestModel`, `sgAddTestPickerItems`) was automatically
reachable the moment it existed on the controller — confirming Manage's
repeated "missing kernel wiring" bug class was specific to `kernel.manage`'s
itemized shape, not a general risk for every page. Otherwise the same
picker shape as Reagent's modal: `useState` query, no debounce, `sgTrackTest`/
`sgViewTrackedTest` per row depending on whether that test is already
tracked. Found a **real trigger-duplication trap** distinct from anything
seen so far: the "+ Thêm xét nghiệm" button appears in TWO places — a real
JSX button on the tracked-tests toolbar, AND a second copy embedded as raw
`data-action="sgOpenAddTest"` HTML inside `emptyStateHtml()`'s
`dangerouslySetInnerHTML` output (shown only when Sigma has zero tracked
tests). `action-dispatcher.ts` resolves that second button by looking up
the bare global `window.sgOpenAddTest` — so simply repointing the *bridge*
export (as done for every other modal) would leave this one embedded button
silently broken, since it never goes through the bridge at all. Fixed by
also repointing the classic `root.sgOpenAddTest` global itself to call
`window.QCLabReact.sgOpenAddTest()` (the same React-opening bridge
function) — the third instance of the "classic caller reaching into the
React modal system via `window.QCLabReact`" pattern (after
`openReactInstrumentModal`/`reauthenticateCurrentUser`), but the first time
it was needed to keep a *dead-simple* global name working rather than a
deliberate cross-controller redirect. The gate-check function itself was
renamed `sgOpenAddTest` → `sgOpenAddTestModel` to free up the bare name for
this redirect, matching Manage's `openConfigXModel` convention retroactively.
`scripts/a11y-audit.js`'s `sigma:add-test` entry needed **no change** —
unlike every other converted modal, calling `sgOpenAddTest()` as a bare
global still correctly opens the React modal now, precisely because of the
redirect above. Classic `sigma-add-test-modal-html.ts`/`sigma-add-test-rows-html.ts`
deleted outright (2 dedicated tests removed); `tests/sigma-comp.test.js`/
`tests/sigma-tracked-test-bridge.test.js` had their now-retired
classic-file/contract checks repointed or removed. Verified: `npm test`
451/451, `typecheck` clean, `check-build-freshness` matches, `a11y-audit` 0
violations across all 18 modals, `ui-workflow-check` 29/29,
`nce-workflow-check` 91/91, plus an ad-hoc script confirming BOTH trigger
paths (the real toolbar button and the embedded empty-state button) open
the identical modal correctly.

Six Sigma's "Tính Bias% từ EQA/EQC" (done, 11th real modal converted):
the first modal with a **dynamic list edited live per keystroke** —
add/remove EQA/EQC rounds, with per-round Bias% and a rolling summary
(valid-round count, signed mean, RMS, mixed-signs warning) all recomputed on
every edit. Classic `sgRenderBiasModal()`/`sgBiasUpdateSummary()` did this by
re-reading the whole `<table>` via `sgBiasRowsFromDom()` and patching
`innerHTML`/`textContent` by hand on every keystroke and every add/delete.
The conversion did **not** port that DOM-patching machinery at all: `rounds`/
`periodIds` became real `useState`, and the summary math — `sgBiasStats()`,
already a pure TypeScript service call (`deps.SigmaBiasService.stats(rounds)`,
no DOM involved) — is called directly inside the component's render
(`getKernel().sigma.sgBiasStats(rounds)`), so React just re-renders whenever
`rounds` changes; no "update the summary" function of any kind survives.
This is the first Giai đoạn 3 modal where an entire cluster of DOM-reader/
DOM-writer functions (`sgRenderBiasModal`, `sgBiasUpdateSummary`,
`sgBiasSelectPeriods`, `sgBiasAdd`, `sgBiasDel`, `sgBiasRowsFromDom`,
`sgBiasPeriodsFromDom`) was deleted with **no replacement function at all** —
every bit of that state now just lives in the component. `sgOpenBias()` split
into `sgOpenBiasModel(eid, level)` (synchronous, returns `Model | null` — no
permission gate on open, matching prior behavior exactly, since the triggering
button itself is already hidden unless `canWrite`). `sgBiasApply()` changed
signature from reading `ui().sgBiasCtx` (a DOM-fed side-channel) to taking
`(level, periodIds, rounds)` directly as parameters — with no more side-channel
needed, `sgBiasCtx` itself was deleted from `SigmaUIState`/`global.d.ts`
outright (confirmed zero remaining readers). `sgBiasStats`/`sgBiasRoundsKey`/
`sgBiasLinkedPeriodIds`/`sgApplyBiasToPeriods` (pure functions with their own
public contract via `tests/sigma-comp.test.js`) were left untouched. Classic
`sigma-bias-modal-html.ts`/`sigma-bias-rows-html.ts`/`sigma-bias-summary-html.ts`
deleted outright (3 dedicated tests removed). `scripts/a11y-audit.js`'s
`sigma:add-bias` switched from calling the retired `sgOpenBias()` global to
clicking the real "Bias EQA% Mức 1" button. This modal's first a11y run
surfaced a real, expected gap: the new component was missing
`role="dialog"`/`aria-modal`/`aria-labelledby`/`tabIndex` (present in every
prior real-JSX modal since `ActionGuideModal.tsx`, simply forgotten here) —
axe-core caught it as a genuine "region" (moderate) violation; adding the same
attributes brought it back to 0 violations across all 18 modals. Verified:
`npm test` 448/448, `typecheck` clean, `check-build-freshness` matches,
`a11y-audit` 0 violations (18/18 modals), `ui-workflow-check` 29/29,
`nce-workflow-check` 91/91, plus an ad-hoc script confirming two rounds with
opposite-sign bias produce the correct per-row values, RMS, and mixed-signs
warning live as they're typed; add/delete correctly changes the row count
(never below 1, even deleting every round); the period checkbox and Apply
button correctly persist `biasEqa`/`eqaRounds` onto the record and close the
modal.

Six Sigma's "Ngân sách độ không đảm bảo đo (MU)" (done, 12th real modal
converted): same family as Bias (multiple rows edited live, values
recomputed on every keystroke) but with **no dynamic add/remove** — the row
count is fixed to the test's operational level count
(`sgVisibleLevels(t)`), so `rows` is just a fixed-size `useState` array, no
add/delete logic needed. Same cluster-deletion pattern as Bias: classic
`sgMuRowsFromDom`/`sgMuPeriodsFromDom`/`sgMuCaptureDom`/`sgRenderMuModal`/
`sgMuUpdatePreview`/`sgMuSelectPeriods` deleted with **no replacement** —
`sgMuPreview(level)` became `sgMuPreview(eid, level, rows)`, a pure function
(no more `ui().sgMuCtx` side-channel) called directly during render for each
row, so the live u_c/U preview and the "Thiếu ..."/"Đủ thành phần" state
update automatically on every uCal/uCalBasis/muBiasMode change with no
"update the preview" function surviving at all. `sgOpenMU(eid)` split into
`sgOpenMUModel(eid)` — **keeping** the `requireWrite()` gate on open (unlike
Bias, which has none — matching each one's original classic behavior
exactly, not a new convention). `sgMuApply()` changed from reading
`ui().sgMuCtx` to taking `(eid, periodIds, rows, reviewedBy, reviewedDate)`
directly; the audit-log/save/close/rerender sequencing stays entirely inside
`SigmaMuWorkflowCommand` (unchanged) — the first Sigma modal in this
sub-group where the apply hand-off already owned the close decision, same
shape as Audit's archive-log modal. `sgMuCtx` deleted from `SigmaUIState`/
`global.d.ts` (zero remaining readers); `tests/lab-ui-state.test.js`'s
generic accessor-round-trip example switched to `sgCohortCtx` (the one
remaining ctx-shaped field, for the still-unconverted cohort-picker modal).
Hit the **dual-trigger-path bug a second time** (after `sgOpenAddTest`): the
"Nhập u(Cal)" trigger is not JSX at all — it lives in `#sgMUAction`, an
empty `<div>` in `SigmaPage.tsx` that `sgRefresh()` patches via `innerHTML`
after every render, embedding classic `data-action="sgOpenMU"` —
`action-dispatcher.ts` resolves it via the bare global `window.sgOpenMU`.
Fixed the same way: `root.sgOpenMU` stays a bare global but now redirects to
`window.QCLabReact.sgOpenMU(eid)` instead of
`sigmaPageController.sgOpenMUModel` (gate-check only, opens nothing) —
`scripts/a11y-audit.js`'s `sigma:mu-budget` entry needed **no change**
(calling the bare global still correctly opens the React modal). The
review-date field (`sgMuDate`) stays `dangerouslySetInnerHTML` via
`dateBoxHtml()` like every other deferred date field — its value is read
directly off the DOM at Apply time (the calendar widget writes to that
input outside React's knowledge), not tracked in React state. Classic
`sigma-mu-modal-html.ts`/`sigma-mu-rows-html.ts`/`sigma-mu-preview-html.ts`
deleted outright (3 dedicated tests removed); two scanner assertions
(`tests/uncertainty.test.js`, `tests/sigma-mu-workflow-bridge.test.js`)
updated to match the new function signatures, same intent preserved (MU
apply always gates on write permission, always goes through the TypeScript
workflow command, a missing u(cal) is never silently treated as 0).
Verified: `npm test` 445/445, `typecheck` clean, `check-build-freshness`
matches, `a11y-audit` 0 violations across all 18 modals (this component had
`role="dialog"`/`aria-modal`/`aria-labelledby`/`tabIndex` from the start,
learned from Bias's initial miss), `ui-workflow-check` 29/29,
`nce-workflow-check` 91/91, plus an ad-hoc script confirming: clicking the
real embedded `#sgMUAction` button opens the modal with the correct row
count; typing u(cal) live-recomputes u_c/U; switching the bias-handling
select from "include" to "exclude" correctly flips the state from "Thiếu
u(bias)" to "Đủ thành phần"; Apply persists `uCal`/`muBiasMode`/
`muReviewedBy` and closes the modal.

Manage's "Hồ sơ TEa chuẩn hóa" (done, 13th real modal converted, tab
"tearefs"): the most validation-heavy CRUD modal so far —
`teaLabProfileSave()` runs 6 sequential `infoDialog` checks (value > 0, a
source chosen, reference text ≥3 chars, reason ≥10 chars, valid
effective+approved dates, approved date not after effective date, next-review
date not before effective date, both preparer and approver filled) — but
needed **zero changes** to `teaLabProfileSave()`/`teaLabProfileRemove()`
themselves, since both already read the DOM directly by element id (same
uncontrolled-form pattern as Instrument/Lot). `teaLabProfileOpen()` split into
`teaLabProfileOpenModel()` — a plain synchronous data reader, no async gate.
`kernel.manage` needed **no new wiring** this time: `teaRefEdit`/
`teaRefRemove`/`teaLabProfileOpenModel`/`teaLabProfileSave`/
`teaLabProfileRemove` all belong to `managePageController` (not
`manageTestsActionsController`), and `kernel.manage`'s `...managePageController`
spread already carried all of them — reconfirming the standing rule that the
missing-wiring bug class is specific to functions owned by
`manageTestsActionsController`, not a blanket risk for every Manage modal.
The 6-option "primary source" select renders real JSX `<option>`s instead of
`dangerouslySetInnerHTML` — a small, static list with no reason to keep as a
string. Classic `tea-reference-lab-profile-body-html.ts`/
`tea-reference-lab-profile-modal-html.ts` deleted outright (2 dedicated
tests removed); 4 other scanner tests (`ui-accessibility.test.js`,
`manage-crud-labels.test.js`, `manage-core-bridge.test.js`,
`tea-reference-bridges.test.js`) updated to match the new function/file
locations. `scripts/a11y-audit.js`'s `manage:tea-lab-profile` switched from
calling the retired bare global to switching to the "tearefs" tab and
clicking the real row button for "Sodium". This is the first time switching
to a real-button trigger surfaced a **genuine pre-existing accessibility
bug unrelated to the modal itself**: since the test had never before made a
real browser actually render the "tearefs" tab, axe-core had never scanned
the underlying TEa reference table — its two per-row CLIA%/Ricos% inputs
(`.tea-ref-value`) had no accessible label at all, a real "critical"
violation dating back to Manage's 2026-08-29 React migration. Fixed by
adding a descriptive `aria-label` (naming the column and the test) to both
inputs in `ManagePage.tsx`'s `TeaRefRow`. Verified: `npm test` 443/443,
`typecheck` clean, `check-build-freshness` matches, `a11y-audit` 0
violations across all 18 modals (including the newly-fixed table gap),
`ui-workflow-check` 29/29, `nce-workflow-check` 91/91, plus an ad-hoc script
confirming: clicking "Thêm hồ sơ" opens the modal in create mode (no remove
button); saving with required fields empty shows the correct validation
message and keeps the modal open; filling all 6 required fields saves the
complete profile (source, reference, reason, dates, preparer/approver) into
`state.teaRefs` and closes the modal; reopening correctly shows edit mode
("Xem hồ sơ" button, a remove button present, the saved value pre-filled).

Manage's "Hồ sơ chuyển tiếp lô" (done, 14th real modal converted, tab
"transitions"): the most complex modal so far — a hand-written fuzzy-match
combobox (free typing, not a `<select>`) for Lô cũ/Lô mới, plus an embedded
Mean/SD table that recomputes dynamically from whichever Panel/Lô cũ/Lô mới
are currently selected. Key design decision: the combobox stays
**uncontrolled** — `LotComboInput` reads/writes `dataset.lotId` directly on
the input via a ref, matching the exact `this`-bound classic contract, so
`lotTransitionSelectedId()` (unchanged) still reads it correctly by DOM id —
meaning `saveLotTransitionV2()` needed **zero changes**. Only a resolved lot
ID is reported up to parent state (`fromLotId`/`toLotId`) to trigger
recomputing the Mean/SD table — the component never controls what the user
is mid-typing. The suggestion `<datalist>` is computed **once** at open time
(matching classic behavior — it was never live-refreshed per keystroke
either). The Mean/SD table itself moved to pure data:
`lotTransitionTargetsModel(panelId, fromLotId, toLotId)` is a 1:1 port of
classic `lotTransitionTargetsHtml()` (same calls to
`inspectAcceptedLotTransition`/`targetRangeDraft`/`targetNumberText`) but
returns an object instead of an HTML string, called directly during render —
eliminating `refreshLotTransitionTargets()`/`filterLotTransitionTargets()`
entirely (the search filter becomes a plain `useState` + `normalizeSearchText`
filter over the rows). The 4 mean/low/high/sd inputs per row stay
uncontrolled (`defaultValue`), wired to `syncTargetRange(el, kind)` via
`onChange` — the exact same pattern as Manage's own Mean/SD matrix tab.
`openLotTransitionV2()` split into `openLotTransitionModel()`
(`Promise<Model | null>`, with its two existing preconditions — no Panel QC
yet / fewer than 2 lots — unchanged). Hit the **missing-kernel-wiring bug a
fourth time**: `kernel.manage` was also missing `saveLotTransitionV2` (same
root cause as every prior instance — its save button was classic
`data-action`, never routed through the kernel). Classic
`lot-transition-choice-html.ts`/`lot-transition-modal-html.ts`/
`lot-transition-targets-html.ts` deleted outright (3 dedicated tests
removed); 2 other tests updated (`manage-crud-labels.test.js`;
`lot-transition-picker.test.js` — its pure `lotTransitionChoiceMatch` half
stays unchanged, only the HTML-shape half now scans the new `.tsx`'s JSX).
**`scripts/ui-workflow-check.js` needed a real fix, not just a test tweak**:
its `checkLotTransitionPicker()` called the now-gone bare global
`openLotTransitionV2()` directly — switched to clicking the real toolbar
button (`.rcfg-tools .btn.teal`) with the same async retry-poll used
elsewhere after `setManageTab()`. This modal was never in
`scripts/a11y-audit.js`'s 18-modal list, so that script needed no change.
Verified: `npm test` 440/440, `typecheck` clean, `check-build-freshness`
matches, `a11y-audit` still 0 violations across the existing 18 modals (no
regression), `ui-workflow-check` 29/29 (including its 3 real
lot-transition-combobox checks, now exercising the converted modal end to
end), `nce-workflow-check` 91/91, plus two ad-hoc scripts confirming:
create → reopen correctly shows "Sửa hồ sơ chuyển lô"/"Lưu thay đổi" with
the combobox showing the full saved label; and, once the test's `levels[]`/
`meanSdHistory` were seeded correctly, the Mean/SD table renders one "Đã
nhập" row, the live search box correctly hides/restores it, and editing the
mean field keeps the newly typed value.

Manage's xét nghiệm (done, 15th real modal converted — the largest form in
the whole migration): a 13-row Westgard rule action/scope table, CUSUM
settings, a TEa autocomplete matched against the analyte catalog, and an
instrument-driven Khoa/Khu vực auto-fill. `saveConfigAssay()` needed **zero
changes** (still reads every field via `document.getElementById(...)`, same
as every prior CRUD modal), and neither did the two auto-fill side effects —
`configAssaySuggestionInput(value)` (looks up a TEa ref for the typed name,
overwrites `#cfgAssayTeaRefKey`/`#cfgAssayTeaSource`/`#cfgAssayUnit`/
`#cfgAssayTea` directly, deliberately **not** `#cfgAssaySection`) is wired via
`onChange` on `#cfgAssayName`; `configAssayInstrumentChanged` (`this`-bound,
auto-fills `#cfgAssaySection` from the selected option's `data-section`) is
wired via `onChange` on `#cfgAssayInstrument` — the same `this`-bound
convention as `syncTargetRange`/`toggleTargetRow`. `openConfigAssay()` split
into `openConfigAssayModel(id)` (synchronous, `Model | null` — keeping the
existing "no instruments yet" gate that redirects to the instrument modal).
Hit the **missing-kernel-wiring bug a fifth time**: `saveConfigAssay`,
`configAssaySuggestionInput`, and `configAssayInstrumentChanged` were *all
three* missing from `kernel.manage` (only `openConfigAssay` itself was
present, needing renaming). This modal's own unique wrinkle: `openConfigAssay`
is also called from a **different page** — Westgard's CUSUM empty state
("Mở cấu hình xét nghiệm") — through a **separate** bridge
(`westgardBridge.ts`, routed via `kernel.pres.openConfigAssay`, not
`kernel.manage`) — so both bridge files needed updating together to open the
same `AssayModal.tsx`, and the rename had to be applied consistently on
**both** `kernel.manage` and `kernel.pres` (the latter reads `root.openConfigAssay`,
also renamed). Classic `config-assay-modal-html.ts`/
`config-assay-instrument-options-html.ts`/`config-assay-rule-rows-html.ts`/
`config-assay-tea-options-html.ts`/`config-assay-decimal-options-html.ts`
deleted outright (5 dedicated tests removed); 3 other tests updated
(`manage-crud-labels.test.js`, `manage-core-bridge.test.js`,
`entry-service.test.js` — two assertions needed their old template-literal
interpolation syntax `${value}` updated to JSX's `{v}`). Both
`scripts/a11y-audit.js`'s `manage:add-assay`/`manage:edit-assay` entries and
**`scripts/ui-workflow-check.js`'s `checkManageForms()`** (a real
verification script, not just a test — it called the bare global
`openConfigAssay()` directly) needed switching to select the "assays" tab
and click the real button. Verified: `npm test` 435/435 (typecheck clean on
the **first** attempt — despite being the largest, most complex form,
keeping every save/auto-fill function completely unchanged kept the actual
risk lower than expected), `check-build-freshness` matches, `a11y-audit` 0
violations across all 18 modals, `ui-workflow-check` 29/29 (including "Form
thêm xét nghiệm tạo data branch...", "Số thập phân và CUSUM được lưu từ
DOM", "Thêm xét nghiệm ghi audit" — all now exercised through the converted
modal), `nce-workflow-check` 91/91, plus two ad-hoc scripts confirming:
typing a known analyte name correctly auto-fills TEa ref/unit/value without
touching section; changing to an instrument that actually has a section
correctly auto-fills Khoa/Khu vực; opening an existing test correctly shows
"Sửa xét nghiệm"/"Lưu thay đổi" with all 13 Westgard rule rows present; and
the Westgard page's CUSUM "Mở cấu hình xét nghiệm" button correctly opens
the exact same assay modal through the `kernel.pres` path.

Actions' "Chi tiết phiếu xử lý sự cố" (done, 18th and **final** real modal
converted, `viewActionDetail` — not part of `scripts/a11y-audit.js`'s
tracked 18-modal list): a purely **read-only** display modal (no input
fields, just a "Đóng" button) — the exact opposite of every CRUD modal
before it. Design decision: kept the entire >10-function HTML-composition
logic (`actionDetailMetaHtml`, `actionEvidenceTimelineHtml`,
`actionContainmentDetailHtml`, `actionCauseDetailHtml`, …, branching on
legacy/modern/cancelled record shape) completely unchanged —
`viewActionDetail()` split into `viewActionDetailModel(i)`, changing only
"return `{bodyHtml}`" instead of "open the modal directly", **not** a
rewrite into 10+ JSX components. `ActionDetailModal.tsx` renders the outer
shell (role/title/close button) as real JSX, but the **entire body** goes
through **one** `dangerouslySetInnerHTML` — the first time a converted
modal used it for the whole body rather than a single isolated field
(date picker, option list) — justified because every field in this content
is display-only, with nothing needing `onChange`. The "Xem điểm QC" button
embedded in the rerun-evidence block keeps its classic
`data-action="openActionQcEvidence"` — it keeps working unmodified because
`action-dispatcher.ts` listens at the `document` level (not React-specific)
and `root.openActionQcEvidence` is untouched — confirming a `'react'`-kind
modal can still safely embed classic `data-action` content, not just
isolated fields. `scripts/nce-workflow-check.js`'s
`checkEvidenceTimelineAndLink()` (another real verification script, not
just a test — it called the bare global `viewActionDetail(0)` directly)
switched to clicking the real "Chi tiết" button; safe because the
immediately-preceding check in the same session already narrows
`state.actions` to exactly one record, so the click is unambiguous. Classic
`action-detail-modal-html.ts` deleted outright (1 dedicated test removed);
1 other test updated (`ui-route-structure.test.js`, two structural
assertions renamed). Verified: `npm test` 434/434 (typecheck clean on the
first attempt), `check-build-freshness` matches, `a11y-audit` still 0
violations across the existing 18 modals (no regression — this modal isn't
in that tracked list), `ui-workflow-check` 29/29, `nce-workflow-check` 91/91
(including 4 checks now exercised through the converted modal: "Chi tiết
NCE tách đủ bốn mốc thời gian", "Khung bằng chứng nêu đúng giá trị, ngày và
lần chạy", "Khung bằng chứng có nút mở điểm QC", "Nút bằng chứng mở đúng
trang và đúng ngày QC"), plus an ad-hoc script confirming two branches
`nce-workflow-check.js` never happens to exercise: a **legacy** record
(predating `protocolVersion`) correctly shows the "Bản ghi được tạo trước
khi có phiếu điều tra 8 bước..." warning plus the old-style "Hành động đã
ghi" block; a **cancelled** record correctly shows "Hồ sơ đã hủy — dữ liệu
được giữ để truy xuất" with its reason/actor/timestamp.

**Giai đoạn 3 (modal → `createPortal`) is now fully done — all 18 modals
tracked by `scripts/a11y-audit.js` plus the Actions NCE detail modal (19
total) render through real React components under `#modalRoot`/
`#dialogRoot`. No modal anywhere in the app still uses the `'html'` string
path in `modal-store.ts`.**

**Cross-cutting findings worth carrying into Giai đoạn 4** (see the plan
file's "Tổng kết phát hiện xuyên suốt Giai đoạn 3" section for the full
write-up): the missing-kernel-wiring bug hit **exactly 5 times**, always in
`kernel.manage` (`saveConfigInstrument`, `saveConfigLot`, `saveConfigPanel`,
`saveLotTransitionV2`, and the `saveConfigAssay`/`configAssaySuggestionInput`/
`configAssayInstrumentChanged` trio) — never in `kernel.sigma`/
`kernel.actions`/`kernel.reagent` (all direct `...xPageController` spreads,
confirmed immune every time this was checked); the dual-trigger-path bug
(a classic bare global still needed by embedded `data-action` content
elsewhere) hit twice (`sgOpenAddTest`, `sgOpenMU`) plus a cross-page variant
(`openConfigAssay`, called from Westgard via a *separate* `kernel.pres`
bridge, needing both namespaces renamed together); every real verification
script (not just tests) that called a converted modal's old bare global
needed the same fix — switch to tab-select-then-click-the-real-button, with
an async retry-poll after any `setManageTab()` call.

**Mục tiêu mở rộng (2026-08-30) — "chuẩn tuyệt đối".** Sau khi Giai đoạn 3
xong, người dùng quyết định nâng mục tiêu từ "gỡ global bridge, thực dụng"
lên "kiến trúc React/Vite/TS chuẩn hoàn toàn" — chấp nhận làm hết, kể cả 2
việc đã bị bác bỏ có chủ đích ở phiên trước (gộp 2 bundle Vite; state
immutable thật). Đã khảo sát kỹ bằng 3 agent trước khi lên kế hoạch chi
tiết (xem file kế hoạch kiến trúc, mục "MỞ RỘNG MỤC TIÊU") — 2 phát hiện
quan trọng nhất: (1) state immutable thật là rủi ro CAO NHẤT toàn kế hoạch,
vì middleware `immer` của Zustand không giảm rủi ro thật (rủi ro cốt lõi là
hàng trăm hàm đóng trực tiếp lên biến `state` toàn cục, đọc lại field ngay
sau mutate — chuyển sang `set()` chuẩn sẽ làm mọi biến trung gian giữ tham
chiếu tới field con của state CŨ stale ngay lập tức, bug âm thầm khó bắt
bằng test); (2) gộp bundle đã kiểm chứng THỰC NGHIỆM sẽ vỡ ngay 61 sandbox
test (`ReferenceError: window is not defined`, vì bootstrap của
`react-pilot.entry.tsx` gọi `document.getElementById(...)` không có guard ở
top-level module) — quyết định giữ 2 bundle tách biệt là có chủ đích, có lý
do kỹ thuật thật, không phải nợ kỹ thuật bị bỏ quên. Thứ tự ưu tiên: Giai
đoạn 5 (bỏ `dangerouslySetInnerHTML`, rủi ro thấp→trung bình) → Giai đoạn 6
(Router chuẩn, rủi ro thấp) → Giai đoạn 4 tiếp tục (dọn alias) → Giai đoạn 7
(state immutable, RỦI RO CAO NHẤT, làm theo từng nhóm dữ liệu nhỏ→lớn,
KHÔNG dùng middleware `immer`) → Giai đoạn 8 (gộp bundle, RỦI RO CAO, cần
thêm `jsdom` vào sandbox test TRƯỚC KHI thử gộp).

Giai đoạn 5, Bước 1 (done): Header dùng chung 10/11 trang (trừ Dashboard,
có `dashboardHeadHtml()` riêng, cấu trúc khác biệt nhỏ — chưa đụng).
`headOnlyHtml()`+`topUserBox()` cũ (dangerouslySetInnerHTML, giống hệt nhau
ở cả 10 trang) thay bằng `src/react/components/PageHeader.tsx` — component
JSX thật đầu tiên trong thư mục `src/react/components/` (mới tạo, chưa từng
có nơi chứa component dùng chung trước Giai đoạn 5). Avatar (click hoặc
phím Enter/Space → mở modal đổi ảnh đại diện) và nút Đăng xuất giờ là
`onClick`/`onKeyDown` React thật, không còn `data-action="openAvatarModal"`/
`"logout"`. Thêm `currentUser`/`openAvatarModal`/`logout` vào `kernel.pres`
(chưa từng cần lộ ra ngoài trước đây). **Phát hiện phụ quan trọng**:
`openAvatarModal()` mở một modal **'html' cổ điển** (`avatar-modal-controller.ts`)
— đây là **modal thứ 20, chưa từng được tính vào danh sách 18+1 modal của
Giai đoạn 3** (bị bỏ sót hoàn toàn, không nằm trong `scripts/a11y-audit.js`'s
MODALS list). Vẫn hoạt động đúng qua `ModalOverlay.tsx`'s nhánh 'html'
(không cần đổi gì để giữ app chạy đúng), nhưng để đạt "chuẩn tuyệt đối"
thật sự thì modal này cũng cần chuyển sang 'react' — chưa làm, ghi nhận lại
để không bỏ sót lần nữa. Cũng xóa hẳn `headOnlyHtml` khỏi cả 10 file bridge
và `headOnly` khỏi `kernel.pres` (không còn ai gọi từ React); phát hiện
`root.headOnly` còn 3 chỗ được truyền vào deps object
(`managePageController`/`entryPageController`/`reagentPageController`) mà
KHÔNG BAO GIỜ được gọi (`deps.headOnly(` không khớp ở đâu trong 3 file đó)
— xác nhận đây là dead code có TỪ TRƯỚC, không phải do đổi lần này, để
nguyên (dọn dead params ngoài phạm vi bước này). Verified: `npm test`
434/434, `typecheck` clean, `check-build-freshness` matches, `a11y-audit` 0
violations across all 18 tracked modals and all 11 pages, `ui-workflow-check`
29/29, `nce-workflow-check` 91/91, plus two ad-hoc scripts confirming: all
11 pages render the correct title + `.top-user` (name, role); clicking the
avatar (both mouse and keyboard Enter) opens the "Ảnh đại diện" modal
correctly; zero console errors.

Giai đoạn 5, Bước 2 (done): Dashboard's own `dashboardHeadHtml()` — the one
page held back from Bước 1 — now reuses the SAME `<PageHeader title="Tổng
quan" subtitle={...}/>` (verified safe first: `.head-actions`'s flex wrapper
is harmless even with Dashboard's single child, unlike the other 10 pages
which render both a subtitle AND `.top-user`). This closed the last gap in
Bước 1's "10/11 trang" header conversion (now 11/11) and triggered a
dead-code cascade: `dashboardHeadHtml` itself (bridge export, `kernel.dash`
wiring, `src/presentation/dashboard/dashboard-head-html.ts` source file, its
dedicated test) is deleted outright; since `headOnlyHtml`/`dashboardHeadHtml`
were the ONLY two callers of `topUserBox()`/`headOnly()` in
`src/presentation/shared/ui-primitives.ts`, both functions are deleted too
(`createUiPrimitives`'s `deps` type shrunk to just `{escapeAttr}`, return
shape now `{btn, emptyState}`). Deleting those two functions exposed 3
dead-code references that PREDATE Giai đoạn 5 (not introduced by this step):
`managePageController`/`entryPageController`/`reagentPageController`'s deps
objects each carried a `headOnly: (title, subtitle, actions) =>
(root as any).headOnly(...)` line that no function in any of those 3
controller source files ever calls (confirmed via grep for `deps.headOnly(`
before touching anything) — cleaned up properly rather than left as noted-
but-untouched dead code (per this session's "chuẩn tuyệt đối" thoroughness
standard): removed the wiring line from `modular-pilot.global.ts`, removed
the matching `headOnly: (...) => string;` type declaration from all 3
controller source files, and removed `declare function headOnly(...)` from
`global.d.ts` (nothing assigns or reads that bare global any more). Verified:
`npm test` 433/433, `typecheck` clean, `build:pilot` succeeds (all 4
artifacts), `check-build-freshness` matches, `a11y-audit` 0 violations
(18/18 modals, 11/11 pages), `ui-workflow-check` 29/29, `nce-workflow-check`
91/91, plus an ad-hoc Playwright script confirming: Dashboard renders "Tổng
quan" + the hospital/department subtitle, `.top-user` shows the correct
name/role, the avatar (`role="button" tabindex="0"`) opens the avatar modal
via both a mouse click and the Enter key, and 3 other pages (entry/users/
settings) still render their titles correctly through the shared
`PageHeader` — zero console errors.

Giai đoạn 5, Bước 3 (done) — nhóm "dễ": icon-button + option list nhỏ.
Reagent's 6 icon buttons (trash/search/print/report/user/sample, formerly
`rcToolIcon()`/`reagentToolIconPresentation`) became a real JSX component
`src/react/components/ReagentToolIcon.tsx` (same SVG path data, just a
different construction mechanism); Report's "Tạo báo cáo & In" button
(`reportActionIcon('print')`) became `src/react/components/PrintIcon.tsx` —
but `reportActionIconPresentation`/`report-action-icon.ts` itself stays
UNCHANGED, since the classic print-HTML path in `report-page-controller.ts`
still needs it; only the React-side read was removed. Because
`reagentToolIconPresentation` had zero consumers left outside React
(confirmed via grep), it was deleted end-to-end: source file, its
`root.reagentToolIconPresentation=`/type-declaration wiring in
`modular-pilot.global.ts`, the `rcToolIcon`/`reportActionIcon`(kernel.pres
field) bridge exports, its dedicated test, and 2 assertions in
`typescript-module-pilot.test.js` — the same "delete the now-superseded
builder outright" discipline used throughout Giai đoạn 3.
`tests/ui-accessibility.test.js`'s old assertion scanning for the literal
`reportActionIcon('print')` string in `ReportPage.tsx` was updated to scan
for `<PrintIcon` JSX instead, plus a new assertion confirming `PrintIcon.tsx`
itself carries `aria-hidden="true"`. Option list: Manage's Lot QC modal
(`LotModal.tsx`) — the `#cfgLotLevel` `<select>`'s 6 options (levels 1-6),
formerly built via `configLotLevelOptionsHtml()` + `dangerouslySetInnerHTML`,
are now plain static JSX `<option>`s (`LOT_LEVELS.map(...)`) —
`saveConfigLot()` needed no change (still reads `#cfgLotLevel`'s value via
DOM at submit time, same as every other CRUD modal). `configLotLevelOptionsHtml`/
`config-lot-level-options-html.ts` deleted outright (zero other consumers),
along with its dedicated test and 2 assertions in `manage-core-bridge.test.js`
(updated to scan for the JSX `[1, 2, 3, 4, 5, 6]` literal instead of the old
bridge contract). Westgard's `ArchivedView` empty-state (the variant with NO
embedded `data-action` button — unlike the sibling one in the same file
that still embeds `goManageTargets`, deferred to the "hard" 5b group)
converted straight to static JSX (title+message only, same `.empty`/
`.empty-title` classes). Verified: `npm test` 431/431, `typecheck` clean,
`build:pilot` succeeds (4/4 artifacts), `check-build-freshness` matches,
`a11y-audit` 0 violations (18/18 modals, 11/11 pages), `ui-workflow-check`
29/29, `nce-workflow-check` 91/91, `visual-check` passes, plus an ad-hoc
Playwright script confirming: the Reagent/Report buttons render real
`<svg>` elements (no HTML string) with correct text; the Lot QC level
`<select>` shows all 6 options with the right selected value; zero console
errors.

Giai đoạn 5, Bước 4 (done) — easier half of the "hard" 5b group: the 2
`emptyStateHtml` calls with an embedded `data-action` button (Westgard's
"Cấu hình Mean/SD" → `goManageTargets`; Sigma's "+ Thêm xét nghiệm" →
`sgOpenAddTest`) converted straight to static JSX (same `.empty`/
`.empty-title`/`.empty-actions` classes), with the button calling
`onClick={goManageTargets}`/`onClick={sgOpenAddTest}` directly — both
functions were already real imports in these two pages (used elsewhere), so
no new kernel wiring was needed. The `emptyStateHtml` import was removed
from both `WestgardPage.tsx`/`SigmaPage.tsx` (no longer used); since those
were the ONLY two call sites of `westgardBridge.ts`'s/`sigmaBridge.ts`'s own
`emptyStateHtml` bridge export (EntryPage.tsx has its own separate bridge
copy, untouched), those two dead export lines were deleted too — the
underlying `emptyState()`/`kernel.pres.emptyState` itself stays UNCHANGED
(still used by plenty of classic call sites). Side finding: once the only
embedded `data-action="sgOpenAddTest"` string anywhere in the repo was
removed, the `root.sgOpenAddTest = () => window.QCLabReact.sgOpenAddTest()`
redirect (built in Giai đoạn 3 for the dual-trigger-path bug) **still had to
stay** — for a different reason now: `scripts/a11y-audit.js`'s
`sigma:add-test` entry calls `sgOpenAddTest()` directly as a bare global
(not a real button click), so the redirect remains load-bearing, just
serving a verification script instead of embedded HTML. Verified: `npm test`
431/431, `typecheck` clean, `build:pilot` succeeds (4/4 artifacts),
`check-build-freshness` matches, `a11y-audit` 0 violations (18/18 modals,
11/11 pages — `sigma:add-test` still opens correctly through the redirect),
`ui-workflow-check` 29/29, `nce-workflow-check` 91/91, plus an ad-hoc
Playwright script that forced Sigma into its empty state (untracking every
test) and confirmed the correct title/message/button render, clicking the
button opens the real add-test modal, and zero console errors.

Giai đoạn 5, Bước 5 (done) — 5c begins, infrastructure + the FIRST date
field fully converted: built `<DateField>`/`<DatePickerPopup>` as real JSX
(`src/react/components/DateField.tsx`/`DatePickerPopup.tsx`) plus a plain
Zustand store `src/react/state/date-picker-store.ts` (holds DOM refs of the
currently-open field — box/input/native — NOT the date "value" in React
state, since every date field across the app deliberately stays
uncontrolled). Mounted once, permanently, via `#datePickerRoot` (new,
added to `index.html`, same pattern as `#dialogRoot`/`#modalRoot`).
Converted the FIRST field: Entry page's Từ ngày/Đến ngày
(`entryStartDate`/`entryEndDate`) — chosen first because
`ui-workflow-check.js` already has a dedicated check ("Date picker
TypeScript đồng bộ ngày text và native") targeting exactly this field,
giving fast feedback on the new component's design. `entrySetStart`/
`entrySetEnd` (existing, calls `rerender()`) wired through an `onChange`
prop (fires on blur after typing OR on calendar pick) — applied the
`key={lj.startDate}` remount pattern immediately (same "stale defaultValue"
bug class hit repeatedly before: Reagent's picker, Report's lock panel,
Sigma's period selects, Westgard's rule toggles).

**3 real bugs found AND fixed during this step** (not assumed in advance —
caught through actual browser verification):
1. **Two date-picker systems colliding**: classic `vn-date-picker-
   controller.ts` (still serving ~15 not-yet-converted date fields) binds
   ONE `document`-level click listener keyed on `.datepick`/`#vnDatePicker`
   — it doesn't distinguish a React trigger from a classic one. If the new
   React component shared the SAME id, the classic code would directly
   `remove()`/overwrite the innerHTML of a node React owns (classic
   `close()` in particular runs UNCONDITIONALLY on any outside click,
   without checking whether the classic module actually has anything open)
   — React would then try to detach a node something else already removed,
   throwing a real `removeChild: The node to be removed is not a child of
   this node` error. Fixed by using a DIFFERENT id for the React popup
   (`#reactDatePicker`, not `#vnDatePicker`) — not a stopgap patch, but a
   real boundary that holds until every date field is converted (at which
   point `vn-date-picker-controller.ts` is deleted outright and the
   collision risk disappears entirely). `ui-workflow-check.js`'s
   `checkVnDatePicker()` updated to the new id.
2. **`stopPropagation()` on `DateField.tsx`'s `.datepick`**: even with
   separate ids, the classic document-level listener still reacts to EVERY
   `.datepick` click (React's included) before the id split — kept
   `stopPropagation()` as an INDEPENDENT second layer of defense (stops the
   event at the source instead of relying only on the id boundary), in case
   one protection layer develops a gap later.
3. **`target.closest()` racing a mid-event DOM change**: `DatePickerPopup.tsx`'s
   "click outside closes" listener originally used
   `event.target.closest('#reactDatePicker')` to decide "was this click
   inside the popup" — but some clicks INSIDE the popup (e.g. picking a
   month in month/year mode) trigger a `mode` change that makes React
   re-render and REMOVE the just-clicked button from the DOM WHILE the
   original event was STILL BUBBLING to `document`. By the time the
   listener ran, `target` had already left the DOM tree, so `.closest()`
   always returned `null` — misread as "clicked outside", closing the
   popup mid-interaction (caught via real Playwright verification: picking
   a month made the popup vanish entirely, with no console error at all).
   Fixed with `event.composedPath()` instead of `.closest()` — the path is
   FROZEN at the moment the event is dispatched, unaffected by DOM changes
   later in the same dispatch.

Removed the now-unused `dateBoxHtml`/`icoCal` import from `EntryPage.tsx`
and the `dateBoxHtml` export from `entryBridge.ts` (its only 2 call sites in
that file are converted). Verified: `npm test` 431/431, `typecheck` clean,
`build:pilot` succeeds (4/4 artifacts), `check-build-freshness` matches,
`a11y-audit` 0 violations (18/18 modals, 11/11 pages), `ui-workflow-check`
29/29 (including "Date picker TypeScript đồng bộ ngày text và native"
itself), `nce-workflow-check` 91/91, plus SEVERAL ad-hoc Playwright scripts
confirming each of the 3 bugs above stays fixed: switching to month/year
mode then picking a month correctly returns to day view (no accidental
popup close); picking a date via the calendar updates the REAL underlying
state (not just DOM — `.lj-range`'s text changes accordingly, confirming
`entrySetStart` actually ran); manual typing + blur also commits correctly;
clicking outside closes correctly; AND a still-classic date field elsewhere
(Manage's Lot QC modal, `#vnDatePicker`) still opens/works normally
alongside the new system, with zero console errors on either side.

Giai đoạn 5, Bước 6 (done) — 5c COMPLETE: converted the remaining 15 date
fields and deleted the now-fully-dead classic date-box infrastructure.
LotModal (2) → TeaLabProfileModal (3) → LotTransitionModal (1) → SigmaMuModal
(1) — all four are pure uncontrolled fields (no `onChange` needed, read via
DOM at submit time, same as every other CRUD modal). AuditPage (2, from/to
filter) — the FIRST time `auditSetDate` (previously "deferred", embedded as
raw `data-action` text inside the classic HTML string, per this file's own
earlier note "until dateBoxHtml itself becomes a real component") got a
real `onChange` — added `auditSetDate` to `kernel.audit` + a bridge export,
verified with a REAL Playwright check (not just reading DOM values): seeded
fake activity rows, set a future filter date, confirmed the row count
actually dropped from 2/2 to 0/2 — proving the underlying STATE changed, not
just the DOM. ReagentPage (1, `rcMeta('date', v)`) → SigmaPage (1,
`sgSetTeaMeta('eflmLookupDate', v)`, using `onChange` per the established
"text field → onBlur" rule from Giai đoạn 2) → ReportPage (2,
`reportRangeChanged()` with no params — re-reads `#rStartDate`/`#rEndDate`
directly from the DOM, matching classic behavior exactly). ActionsPage (5
fields: aDate/aDueDate/aActionCompletedDate/aReleaseDate/aEffectivenessDate)
— **deleted the manual addEventListener workaround entirely** (the
`useRef`+`useEffect` binding native 'input'/'change' to call
`actionFormChanged()`, built in Giai đoạn 2 because the field used to be
`dangerouslySetInnerHTML`, outside React's fiber tree) — now that the field
is real JSX, the event naturally bubbles to the existing
`<div className="action-form-body" onChange={actionFormChanged}>`
container, no workaround needed. Also fixed a REAL PRE-EXISTING CSS BUG
found along the way: `attrs="action-date"` (the 4th, raw-attrs parameter)
should have been the 3rd (`cls`) parameter — the `action-date` class (which
has real CSS: `.datebox.action-date{height:38px}`) had never actually been
applied to `.datebox` since this page went React; fixed with
`className="action-date"` in the correct slot.

Once all 16 fields were converted, deleted the entire now-dead classic
system (confirmed zero consumers via grep at each step, never assumed):
`date-box-html.ts`/`createDateBoxHtml` deleted outright (`dateBoxHtml`/
`root.dateBox` was never actually CALLED anywhere — only ever assigned);
`icoCal()` deleted from `router-icons.ts` (its only caller was
`date-box-html.ts`); cleaned up 5 dead `deps.dateBox=(root as
any).dateBox(...)` wirings in `kernel.pres`/the deps objects of
`managePageController`/`manageTestsActionsController`/`entryPageController`/
`reagentPageController`/`sigmaPageController` — confirmed all 5 were never
actually called (`deps.dateBox(` matched nowhere in any of those controller
source files) before removing, along with the matching type declaration in
each source file. `vn-date-picker-controller.ts` (the DOM/popup half)
DELIBERATELY STAYS — its pure `parse()`/`valid()`/`text()` half is STILL
called by classic `auditSetDate()` via `root.vnPickerParse` (used to
normalize the input value before updating the filter range); deleting the
whole file would remove that still-needed pure half too. The DOM/popup half
(`open`/`render`/`bind`...) is now inert dead weight (no classic `.datepick`
is left anywhere for its listener to find) — left for a future dedicated
refactor to split the pure half out, not urgent since there's no functional
benefit to doing it right now. `tests/ui-route-structure.test.js`'s `router`
string concatenation dropped `date-box-html.ts` (deleted, would otherwise
throw a file-read error).

Verified: `npm test` 431/431, `typecheck` clean, `build:pilot` succeeds
(4/4 artifacts), `check-build-freshness` matches, `a11y-audit` 0 violations
(18/18 modals, 11/11 pages — including `manage:add-lot`/`edit-lot`/
`tea-lab-profile`, which carry the just-converted date fields),
`ui-workflow-check` 29/29, `nce-workflow-check` 91/91 (including the EXACT
check "Sau ngày hoàn thành, cổng cho phép trở lại vẫn còn thiếu" —
`page.fill('#aActionCompletedDate', ...)` confirms the real container
onChange correctly replaced the old workaround), plus an ad-hoc Playwright
script confirming: Audit filters correctly by date (seeded 2 fake rows, set
a future date, confirmed filtering down to 0/2 — proving real STATE
changed, not just DOM); Reagent's rcDate commits correctly to `model.date`
on blur; Report's rStartDate retains the correct value after blur; zero
console errors on any page.

**Giai đoạn 5 (removing `dangerouslySetInnerHTML`) is essentially complete
for its core scope — both 5a (easy group) and 5c (date-picker, the hardest
part) are done.** What remains of Giai đoạn 5 is a narrower slice of 5b than
originally scoped: `icoDownloadHtml`'s 2 spots in SigmaPage (shares
`icoDownload()` with the nav icon — low risk/benefit either way to split
out); `ActionDetailModal`/`UserPermissionsModal`'s checkbox grid/
`ActionsPage.tsx`'s dynamic HTML blocks (evidenceTimelineHtml,
thresholdHtml, rerunEvidenceHtml, referenceHtml, incidentBanner) — these
were ALREADY evaluated and deliberately kept as-is back in Giai đoạn 3 for
substantive reasons (100%-read-only content, or genuinely complex content
where a JSX rewrite has no functional benefit), not neglected debt; the
Avatar modal (the side-finding from Bước 1 — the 20th modal, never counted
before — still 'html'-kind, convertible to 'react' for absolute
completeness if wanted).

**Giai đoạn 6 — Router chuẩn (done, 2026-08-30).** Key design decision
(different from the original idea of "React Router or a Zustand-backed
page state"): after surveying the options, chose **hash-based navigation
via the plain History API** (`location.hash`/`history.pushState`/
`popstate`), NOT adding `react-router-dom` as a dependency. Reasoning: (1)
the app has 11 FLAT pages, no nested routes or dynamic params — a real
router would be disproportionate machinery for this; (2) the sidebar nav
(`<nav id="nav">`) is STILL classic HTML (`router-shell-controller.ts`'s
`nav()`, building `data-action="go" data-args='["id"]'` buttons), not
React — a real router would first need that sidebar converted to React
too, a separate, larger undertaking outside Giai đoạn 6's actual scope;
(3) it matches the codebase's existing minimal-dependency philosophy
(CLAUDE.md: zero runtime npm dependencies except electron-updater; zustand
is the ONE deliberate exception, with a clear reason). A hash (`#/entry`)
is the technically correct choice for a static-file app (runs via `file://`
in Electron, or any static HTTP server — there's no server-side route to
serve `index.html` for an arbitrary path-based URL).

Implementation: 2 new pure functions in `src/presentation/router/
router-hash.ts` (`pageIdFromHash(hash)`/`hashForPage(id)`, no DOM touch).
`router-dispatch-controller.ts`'s `go(p)` split its shared "activate this
page" logic into an internal `activate()`, reused by TWO paths: `go(p)`
(in-app navigation — button/nav-sidebar clicks, also calls `pushUrl` to
push a new history entry) and `goFromHistory(p)` (browser-driven navigation
— Back/Forward, does NOT call `pushUrl` since the browser already changed
its own history; calling it again would create a redundant entry, making
Back require two clicks to go back one page). `app-bootstrap.ts` (which
already centralizes the app's top-level `window`/`document` listener
registrations from Pha H) gained an `onPopState` dep → binds
`window.addEventListener('popstate', ...)` calling
`goFromHistory(pageFromUrlHash())`. `modular-pilot.global.ts` wiring:
`pushUrl` uses `history.pushState(null,'',hashForPage(id))` (guarded by
`typeof history!=='undefined'` for DOM-less sandbox tests); `root.
pageFromUrlHash` reads `location.hash` via `pageIdFromHash` (same guard).
`showApp()` (runs after login/session restore) now prefers opening the
page named in the URL hash if the user can ACTUALLY access it (bookmark/
page reload/shared link) — falling back to the existing `firstAccessPage()`
logic only if not; both that fallback branch and the analogous one in
`applyUserPerms()` (when the current page's access is revoked) call
`history.replaceState` (not `pushState`) to resync the URL without adding a
spurious history entry for an "invalid, correcting" hash. `logout()` resets
the hash to `#/dash`, matching the existing `page='dash'` reset.

Verified: `npm test` 431/431 (no sandbox test needed updating — `go()` kept
its exact signature; `pushUrl`/`pageFromUrlHash` safely no-op when
`history`/`location` don't exist), `typecheck` clean, `build:pilot`
succeeds (4/4 artifacts), `check-build-freshness` matches, `a11y-audit` 0
violations (18/18 modals, 11/11 pages — the script navigates constantly via
`go()`), `ui-workflow-check` 29/29, `nce-workflow-check` 91/91,
`visual-check` passes, plus an ad-hoc Playwright script confirming the full
lifecycle: `go('manage')`/`go('sigma')` correctly update the hash
(`#/manage`, `#/sigma`) and page title; clicking the browser Back button
correctly returns to `#/manage`; Forward correctly returns to `#/sigma`;
clicking the classic sidebar nav button ("Nhập QC") still works via
`data-action="go"`, correctly updating to `#/entry`; reloading with
`#/report` in the URL opens the Report page DIRECTLY (the bookmark/shared-
link scenario); logging out correctly resets to `#/dash`; zero console
errors at any step.

**Giai đoạn 7 — state genuinely immutable, group 1 of 6 (users/settings/lab
profile, done, 2026-08-30).** Key design decision, different from the
original "write a clear Zustand action" wording: after investigation
(surveyed via a background agent before writing any code), confirmed
`users`/`lab`/etc. CANNOT be moved out of the single `state` object into a
"real" separate Zustand store — the entire persistence stack (localStorage/
IndexedDB), Firebase merge-by-branch sync, backup import/export, and
`validateStateInvariants()`/`ensureShape()` all operate on `state` as ONE
object; splitting fields out would require rewriting all of that for
unclear benefit. "Immutable" for Giai đoạn 7 therefore does NOT mean
"move state out of the classic object into Zustand" — it means: **`state`
STAYS a single object (so the existing persistence/sync/validation
machinery keeps working unchanged), but how each of its fields gets
UPDATED changes from "mutate the nested object/array in place"
(`Object.assign`, `.push()`, `.splice()`, `delete`) to "replace the field
with a newly-computed value"** (`state.users = newArray`, `state.lab =
newObject`). This is the actual "immutable update" the original 3-agent
survey's finding was about (the risk being an intermediate variable holding
a STALE reference) — no storage-architecture change needed to fix it.

**Group 1: users/settings/lab profile (done, 2026-08-30).** A dedicated
background-agent survey (before writing any code) confirmed: mutation call
sites are HIGHLY concentrated (mostly one large file,
`modular-pilot.global.ts`, plus 2 small controllers,
`settings-page-controller.ts`/`avatar-modal-controller.ts` — not scattered);
every READ site is a lazy closure (`() => state.lab`), so it's safe against
reference replacement; and the group's SINGLE HIGHEST RISK: `currentUser`
is a SEPARATE variable (`AuthUIState.currentUser`, not inside `state`)
holding a reference into one element of `state.users` — without actively
re-syncing it after `state.users` is replaced with a new array,
`currentUser` would point at the OLD object the very first time a user
edits their own profile/avatar/password (a silent bug, no visible error).

The `lab` half turned out to be ALREADY mostly correct
(`lab-profile-service.ts`/`settings-profile-command.ts` already return new
objects via spread every time, and `set: lab => { state.lab = lab; }` was
already a replace, not a mutation) — only 2 spots needed fixing:
`foundation-normalization.ts`'s `delete state.lab.kpiTargets` (mutated an
object that could be a SHARED reference from the original `input`, since
the surrounding spread is only SHALLOW — fixed by copying `state.lab =
{...state.lab}` before deleting the field) and
`settings-page-controller.ts`'s `ensureLabBrandShape()` (`Object.assign` →
replace with `state.lab = {...old, ...newProfile}`).

The `users` half needed deeper changes: rewrote ALL 6 functions in
`user-management-command.ts` (`add`/`updatePermissions`/`resetPassword`/
`toggle`/`setAvatar`/`clearAvatar`) from mutate-and-return-the-same-
reference to PURE — each returns a NEW object, touching nothing passed in;
dropped `remove` from this file entirely (filtering out one id needs no
dedicated logic). Added a new module `user-store-update.ts`
(`createUserStoreUpdate`) — the SINGLE place that finds-and-replaces one
element of `state.users` by id, then calls `syncCurrentUser(updated)` after
every successful replacement — shared by both `user-lifecycle-command.ts`
(permissions/password/lock changes) and `user-avatar-command.ts` (avatar
changes), avoiding writing the "resync currentUser" logic twice.
`user-lifecycle-command.ts`'s API changed from accepting a `user` reference
(already `find()`'d by the caller) to accepting `id` directly (matching
what `remove(id)` already did) — the caller
(`modular-pilot.global.ts`'s `applyUserPerms`/`applyResetPass`/`toggleUser`)
got simpler too (no longer needs to `find()` just to pass a reference
through). `user-avatar-command.ts` DELIBERATELY KEPT its old public
signature (still takes the whole `user` object, not just an id) —
`avatar-modal-controller.ts` (its only caller) already has the full user
via `deps.currentUser()`, so nothing there needed to change; internally,
the new `user-avatar-command.ts` uses `user.id` to call
`userStore.replaceById()`. The `syncCurrentUser` wiring
(`modular-pilot.global.ts`): `user => { if (currentUser && currentUser.id
=== user.id) currentUser = user; }` — reassigns `currentUser` DIRECTLY,
matching the exact `page = ...` convention already used throughout this
file (a bare-global accessor via `AuthUIState`/`installUiState`).

Rewrote all 3 affected tests (`user-management-command.test.js`/
`user-lifecycle-command.test.js`/`user-avatar-command.test.js`) to match
the new pure contract — `user-avatar-command.test.js` specifically proves
the exact bug the survey flagged: captures a reference to the OLD user
before calling `setAvatar()`, confirms that OLD reference stays UNCHANGED
(proof it's no longer mutated in place) while `currentUser`/`state.users`
DID update correctly (proof the `userStore`-based sync works). Verified:
`npm test` 431/431, `typecheck` clean, `build:pilot` succeeds (4/4
artifacts), `check-build-freshness` matches, `a11y-audit` 0 violations
(18/18 modals — including `users:edit-permissions`), `ui-workflow-check`
29/29, `nce-workflow-check` 91/91, `benchmarks/verify-release.js` PASSES IN
FULL (the ISO 15189 dossier gate: 431/431 tests, build freshness matches,
clean dependency audit, performance regression within budget — confirming
no performance regression), plus an ad-hoc Playwright script confirming the
EXACT highest-risk scenario in a REAL BROWSER (not just a unit test):
self-service password change through the real `resetPass`/`applyResetPass`
flow (filling the form, clicking Save) — `passHash` genuinely changes AND
`currentUser` is ALWAYS the same object reference as the matching element
in `state.users` afterward (no "two copies diverging" bug); the avatar
modal still opens correctly; zero console errors.

Remaining for Giai đoạn 7 (not yet done): activity/audit log →
instruments/qcLots/qcPanels → tests/teaRefs/lotTransitions → actions (NCE)
→ `state.data` (QC points, the largest, highest-risk, done LAST) — each
group repeats the same discipline: survey before coding, convert
mutate-in-place to replace-the-reference, check for any intermediate
variable holding a long-lived reference outside a single function call's
lifetime (the `currentUser` lesson from this group), full verification +
`benchmarks/verify-release.js` after EACH group.

Then shrink/delete the now-dead
`root.X=` aliases, `global.d.ts`'s
ambient bare-global declarations, and rewrite the 61 sandbox tests + ~88
bridge-wiring text-scanner tests. See the plan file for the full phase
breakdown and the risks already identified (LIS Gateway's
`lis-client-service.ts` shares the same `getState`/`rerender` deps shape and
gets swept into this even though it's unrelated to the UI rewrite; several
`data-*` conventions in `action-dispatcher.ts` encode real event-timing
semantics that a naive `onClick`-only conversion would silently drop; a
`dangerouslySetInnerHTML`-rendered field needs its own native
`addEventListener` if it must notify an ancestor's `onChange`, since it sits
outside React's fiber tree — see the Actions page bullet above; a modal that
shares its DOM container with a still-classic caller must convert BOTH sides
together, not just the one being planned — see the `reauthenticateCurrentUser`
finding above).

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
  bị sửa". `root.auditModel()` (the pure-data function behind
  `src/react/pages/AuditPage.tsx` — see "Module roles" below; formerly
  `pageAudit()`, retired 2026-08-29) no longer verifies on every render
  (paging/filtering rerenders): `auditChainStatus()` caches by (row count,
  last hash, anchor) and skips auto-verification above
  `AUDIT_AUTO_VERIFY_MAX`, offering a button instead.
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
  keyboard-navigation cases. **`pageEntry()` no longer exists**: the page
  retired again on 2026-08-30 to `src/react/pages/EntryPage.tsx` — the
  **last** page in the React migration (see `docs/REACT-ADOPTION-PLAN.md`).
  Entry needed one architectural fix none of the other 9 pages did: classic
  `entryRenderKeepScroll()` never called standard `rerender()` (which
  replaces all of `#main.innerHTML`, resetting `.qc-sheet-wrap`'s own scroll
  position and dropping keyboard focus) — instead it hand-patched
  `.entry-main` via `element.innerHTML=...`, and nearly every interaction
  handler (`entryPick`, `entryFocusLevel`, `entryShowPrevLot`/
  `entryShowCurrentLot`, `entryUnlockExtraRun`, `entryInlineSaveCommit`,
  `confirmVoidQcPoint`, `entryToggleRows`) called it as its last step. Live
  verification (scroll `.qc-sheet-wrap` to 300px, save a new QC point,
  confirm `scrollTop` unchanged and the DOM node reused) confirmed React's
  own reconciliation (`mountReactPage()` → real `root.render()`, never
  `innerHTML=`) already preserves scroll/focus for free — no manual
  snapshot/restore needed. `entryModel()` (the pure-data twin) was added
  alongside the still-live classic branch first, and only once React owned
  the page for real did `entryRenderKeepScroll()` collapse to a bare
  `deps.rerender()` call (name kept unchanged — `tests/entry-service.test.js`
  pins the literal call site inside `entryPick()`). Deleting the classic
  branch cascaded: `entryLatestTreeState`/`entrySyncTreeState` (only caller
  of both) became dead, which made `entry-tree-state.ts`/
  `entry-tree-group-state.ts` dead too — all four removed together with the
  19 classic HTML-builder files `pageEntry()` used to call
  (`entry-tree-html.ts`, `entry-page-layout-html.ts`, `entry-worksheet-html.ts`,
  `entry-levey-panel-html.ts`, `entry-points-panel-html.ts`,
  `entry-point-table-card-html.ts`, `entry-point-table-row-html.ts`,
  `entry-range-summary-html.ts`, `entry-voided-points-html.ts`,
  `entry-voided-point-row-html.ts`, `entry-cumulative-stats-html.ts`,
  `entry-table-window-note-html.ts`, `entry-sheet-day-row-html.ts`,
  `entry-sheet-cell-html.ts`, `entry-sheet-day-summary-html.ts`,
  `entry-sheet-day-detail-html.ts`, `entry-sheet-run-slot-html.ts`,
  `entry-chart-html.ts`, `entry-empty-page-html.ts`) and their 21 test files.
  `entry-void-modal-html.ts`/`entry-pre-save-warning-modal-html.ts` stay —
  both render into `#modalRoot`, outside React. The parity check
  (`scripts/react-migration-parity-check.js`) caught one real bug this way:
  `TableCardView` only rendered the cumulative-stats block when
  `card.rows.length>0`, but classic code always renders it (cumulative stats
  come from `cumulativePts`, a separate point set independent of the
  windowed `rows`) — fixed by moving that block outside the conditional.
  Because Entry was the last page, removing `pageEntry()` also retired the
  router-level strangler-fig scaffolding itself:
  `router-dispatch-controller.ts`'s `pageMap()`/classic `innerHTML` branch
  and `unmountReactPageIfMounted()` had no remaining consumer (every id in
  `ROUTER_PAGE_DEFS` is now in the React registry), so `render()` collapsed
  to `deps.mountReactPage(deps.isReactPage(id) ? id : 'dash', m)` — the
  `'dash'` fallback exists only for a corrupt/unknown page id, not normal
  flow. `pageWestgard()` retired to
  `src/presentation/westgard/westgard-page-controller.ts`
  (`createWestgardPageController(deps)`) on 2026-08-18 (Pha G route slice 3) —
  a faithful port of the whole page including the archived-lot-group and CUSUM
  branches; its UI state (`selTest`/`wgViewMode`/`wgChartMode`/`wgPrevOpen`/…)
  stays in the `AnalysisUIState` bag (written directly from onclick handlers
  like `selTest=this.value`, so it must remain accessor globals, unlike the
  Report page's closure state). **`pageWestgard()`/`pageWestgardArchived()`
  no longer exist**: the page retired again on 2026-08-30 to
  `src/react/pages/WestgardPage.tsx` (see the `westgard-page-controller.ts`
  bullet further below and `docs/REACT-ADOPTION-PLAN.md`), and `pageMap()` in
  `modular-pilot.global.ts` no longer carries a `westgard` entry at all —
  `isReactPage('westgard')` intercepts it first. `pageDash()` retired to
  `src/presentation/dashboard/dashboard-page-controller.ts` on 2026-08-18
  (Pha G slice 2) and `router-dispatch-controller.ts`'s dispatch table called
  it as `root.pageDash` through the compat bridge like any other bundle-owned
  global, same as `pageEntry`/`pageWestgard`/etc. — **`pageDash`/`root.pageDash`
  no longer exist**: the page retired again on 2026-08-29 to
  `src/react/pages/DashboardPage.tsx` (see "Module roles" below and
  `docs/REACT-ADOPTION-PLAN.md`), and `router-dispatch-controller.ts`'s
  dispatch table no longer carries a `dash` entry at all — `isReactPage('dash')`
  intercepts it before the dispatch table is ever consulted.
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
    **`pageReportV2()`/`reportLockPanelHtml()`/`reportRangePicker()`/
    `reportApplySearch()` no longer exist**: the page retired again on
    2026-08-30 to `src/react/pages/ReportPage.tsx` (see the
    `report-page-controller.ts` bullet further below and
    `docs/REACT-ADOPTION-PLAN.md`), and `pageMap()` in
    `modular-pilot.global.ts` no longer carries a `report` entry at all —
    `isReactPage('report')` intercepts it first.
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

  Corrective action/"Khắc phục sự cố" retired to React 2026-08-30:
  `src/react/pages/ActionsPage.tsx` now owns the whole page, and `pageMap()`
  in `modular-pilot.global.ts` no longer carries an `actions` entry at all —
  `isReactPage('actions')` intercepts it first. `pageActionsV4()`
  (issue list + log table) and `actionFormHtml()` (the 8-section form) are
  deleted outright, along with the 19 classic HTML-builder files whose only
  caller was one of those two functions (`action-issue-row-html.ts`,
  `action-open-issue-html.ts`, `action-issue-group-html.ts`,
  `action-log-row-html.ts`, `action-review-buttons-html.ts`,
  `action-side-chips-html.ts`, `action-approval-tag-html.ts`,
  `action-issues-panel-html.ts`, `action-log-panel-html.ts`,
  `action-page-html.ts`, `action-select-html.ts`, `action-suggest-box-html.ts`,
  `action-suggest-row-html.ts`, `action-form-closed-html.ts`,
  `action-form-section-html.ts`, `action-investigation-field-html.ts`,
  `action-staff-options-html.ts`, `action-form-panel-html.ts`,
  `action-form-steps-html.ts`) and their 19 dedicated test files. Only
  `actionsModel()` (issue list + log table, pure data, in
  `actions-page-controller.ts`) and `actionFormViewModel()` (the 8-section
  form, pure data, in `action-form-controller.ts`) remain. The two-way bridge
  above is now one-way in practice: the page no longer calls into the form
  (`deps.formHtml` is gone from `actions-page-controller.ts`'s deps — React
  calls `actionFormViewModel(model.issueCount)` directly from
  `ActionsPage.tsx`), but the form still calls back into the page's evidence
  builders (`actionEvidenceTimelineHtml`, `actionRerunEvidenceHtml`,
  `actionLevelShort`), since the classic detail modal (`viewActionDetail()`,
  unchanged — renders into `#modalRoot` like every other page's modals) still
  reuses those same blocks. Much of the issue-list/log-table "presentation
  builder" tier turned out to be unnecessary for React: `ActionReviewPresentation.buttons()`/
  `.approvalTag()` and `ActionStatusPresentation.sideChips()` already return
  plain data (button-visibility flags, `{cls,label}` chip arrays), not HTML —
  `actionsModel()` calls them directly and `ActionsPage.tsx` renders buttons/
  chips as real JSX, skipping the `deps.pres.actionReviewButtonsHtml`/
  `actionSideChipsHtml` wrapper tier `pageActionsV4()` used to go through.
  This page hit a **new variant** of the stale-`defaultValue` bug class:
  classic `syncActionSuggestions()` refreshed the cause/action suggestion-chip
  rows via `node.outerHTML = ...` — replacing the DOM node outright, unlike
  every prior direct-DOM-patch precedent (bias hint, section chips, risk
  score), which only ever mutate a stable node's `textContent`/`className`.
  Reusing that function for the React page would let an unrelated `rerender()`
  arrive after the outerHTML swap and hand React a now-detached node to
  reconcile (a real `NotFoundError` risk on `removeChild`). Fixed by NOT
  reusing it: the cause-category (`aCauseCategory`) and error-type (`aErr`)
  fields recompute their sibling suggestion boxes via local `useState` in two
  small components (`CauseSection`'s `causeCategory` state,
  `ErrTypeSelect`/`ActSuggestBox`'s `errType` state), calling the already-pure
  `actionCausePhrases()`/`actionActionPhrases()` directly — no DOM mutation at
  all. Also hit a real remount bug independent of that fix:
  `beginActionManual()` always seeds the identical shape `{manual:true}`, so
  opening the manual form, typing, closing, then opening it manually AGAIN
  produced the same `formKey` both times — React reused the old DOM node and
  the previously-typed (already `clearDraft()`-cleared in the model) text
  stayed visible in the uncontrolled fields despite the fresh model saying
  empty. Fixed with a monotonic `openSeq` counter on `ActionFormUiState`
  (incremented in `startManual()`/`startIssue()`/`edit()`), folded into
  `actionFormViewModel()`'s `formKey` — every *open* action now gets a distinct
  key regardless of seed shape, confirmed live in the browser (typed a marker,
  closed, reopened, confirmed the field came back empty). Running
  `scripts/nce-workflow-check.js` for real surfaced a further, more general
  finding that applies to every React page, not just this one: a script that
  calls a `rerender()`-triggering function and reads the DOM back in the
  *same* `page.evaluate()` call races React's asynchronous `createRoot().render()`
  commit — 10 of 91 checks failed this way at first, including one in the
  Dashboard block (a latent bug dating back to Dashboard's own 2026-08-29
  React migration that nothing had exercised via this script until now).
  Fixed by splitting each offending trigger+read pair into two separate
  `page.evaluate()` calls, matching the pattern already used successfully
  elsewhere in the same script — not a real user-facing regression (a genuine
  browser click is itself an async DOM event, always leaving React time to
  flush before the next script step), just a gap in how directly the test
  script was calling internal functions.

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
  `SigmaUIState`. Six Sigma/"Six Sigma & Sai số" (`pageSigma()`,
  `sgTrackedOptions()`, `sigma-analysis-setup-html.ts`,
  `sigma-no-levels-panel-html.ts`, `sigma-period-table-html.ts`,
  `sigma-period-table-head-html.ts`, `sigma-period-row-html.ts`,
  `sigma-charts-panel-html.ts`, `sigma-tracked-options-html.ts`) retired to
  React 2026-08-30: `src/react/pages/SigmaPage.tsx` now owns the page's body,
  reading data from `sigmaModel()` (a new pure-data function added right
  where `pageSigma()` used to sit — the biggest dependency surface migrated
  so far). `pageSigma()`, `sgTrackedOptions()` and all 7 HTML builders are
  deleted outright, along with their 7 dedicated test files. The panels that
  compute AFTER the initial render (`#sgStatus`/`#sgTrend`/`#sgMDC`/`#sgFreq`/
  `#sgMUAction`/`#sgMU`, filled by `sgRefresh()`) needed no change at all —
  they were already just empty containers in the classic HTML too, and
  `sgRefresh()` keeps patching them via `innerHTML` from a `useEffect` with no
  dependency array, the same trigger point as Reagent's `rcCompute()`. Every
  modal (`sgOpenBias`, `sgOpenMU`, `sgRenderAddTestModal`,
  `sgRenderCohortModal`) is unchanged since they render into `#modalRoot`.
  This page surfaced a **new variant** of the stale-`defaultValue` bug class
  already seen on Reagent/Report: each period row's month/year `<select>`
  (`sgPart()`) does NOT call `rerender()` on a successful change (only
  `sgRefreshSoon()`), but DOES call `rerender()` when the change is REJECTED
  (duplicate period) — and at that point the select must revert to the OLD
  value even though that value is unchanged between the two render passes.
  A fully controlled `value=` select (no local state) was tried first and
  **failed** — confirmed live in the browser: `notify()` ran, the model was
  correct, but the select kept showing the just-rejected value, because React
  compares the new `value` prop against what it last set itself, not against
  the DOM's actual live value after an out-of-band native mutation. Fixed by
  keying just those two `<select>` elements with `renderVersion` (a counter
  from `useRenderVersion()` that increments on every `rerender()`), forcing a
  fresh remount with a fresh `defaultValue` on every render pass — matching
  the classic page's own cost profile (it rebuilt the whole table on every
  rerender too), scoped down to only these two small elements instead of the
  whole row. The outer `<div key={model.testId}>` wrapping the rest of the
  page reuses the same Reagent-class fix to avoid stale CV/Bias data when
  switching tracked tests.
- `src/presentation/westgard/westgard-page-controller.ts` — Westgard
  analysis/"Phân tích Westgard" retired to React 2026-08-30:
  `src/react/pages/WestgardPage.tsx` now owns both view modes (operational
  tests and archived/stopped lot groups), reading data from `westgardModel()`
  (a new pure-data function added right where `pageWestgard()`/
  `pageWestgardArchived()` used to sit). Those two functions,
  `wgChartModeTabs()`, `wgViewModeTabs()`, `wgRowsControl()`, `wgLotBlock()`,
  `pageWestgardCusum()`, and their 8 classic HTML-builder files
  (`westgard-mode-tabs.ts`, `westgard-point-rows-html.ts`,
  `westgard-rows-control.ts`, `westgard-cusum-page-html.ts`,
  `westgard-lot-block-html.ts`, `westgard-rule-guide-html.ts`,
  `westgard-rule-toggles-html.ts`, `westgard-export-actions-html.ts`) are
  deleted outright, along with their 8 dedicated test files; the pure
  `icoRefArrow()` helper in `router-icons.ts` lost its only remaining caller
  in the same cleanup and was dropped too. The three near-identical classic
  row-table builders (current-lot level, previous-lot-after-transition,
  archived-lot-group) collapsed into one `<LevelBlock>` component reading a
  single `WestgardBlock` shape from the model, keyed off whether `badgeText`
  is present (lot-block contexts) vs absent (the live current level). Canvas
  drawing (`wgLJMulti`/`wgLJMultiArchived` Levey-Jennings, `cusumChart`) needed
  no new logic — those stay empty `<canvas>` elements exactly like the classic
  HTML, and the existing `afterRender()` sweep (an `IntersectionObserver`+rAF
  service already keyed by CSS class/`dataset`, see
  `src/presentation/render/after-render-controller.ts` and
  `visible-canvas-service.ts`) keeps painting them — the only change is
  calling `afterRender('westgard')` from a dependency-free `useEffect` in
  `WestgardPage.tsx` instead of relying on the classic `rerender()` → `render()`
  → `afterRender()` call chain, because that chain calls `afterRender()`
  synchronously right after `render()` while `createRoot().render()` commits
  asynchronously, so the `<canvas>` might not exist in the DOM yet at that
  point (found by code inspection, not a live failure). Applied the Sigma-page
  `key={renderVersion}` remount fix to the Westgard rule-toggle checkboxes:
  `wgSet()`/`wgReset()` both call `rerender()` unconditionally, and
  `wgReset()` in particular can change many checkboxes' `on` state at once
  without any of them being individually clicked — confirmed live in the
  browser that a plain `defaultChecked` row left every checkbox showing its
  pre-reset state, fixed by keying the whole toggle row with `renderVersion`
  so it remounts fresh on every `rerender()`, matching the classic page's own
  full-HTML-rebuild cost profile for just that one row. Testing also
  reconfirmed (as first found on the Report page) that the canvases' lazy
  `IntersectionObserver`-gated draw does not fire automatically in this
  session's headless browser regardless of React or classic rendering —
  calling `canvas._ljDraw()` directly confirmed the paint function and
  underlying chart data are both correct on both versions, so this is an
  environment limitation, not a regression.
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
- `src/presentation/dashboard/dashboard-page-controller.ts` — originally
  `createDashboardPageController(deps)` owned `pageDash()`/`pageDashLoading()`/
  `dashTestFilter()`/`dashTestSetStatus()`, retired from classic
  `dashboard-routes.js` on 2026-08-18 (Pha G slice 2) as pure orchestration
  over `dashboardXxx` builders under `src/presentation/dashboard/`/
  `src/domain/qc/`. **Retired again on 2026-08-29** (React island, see below):
  `pageDash`/`pageDashLoading` and every `*Html`-only builder they called
  (25 files — `dashboard-page-html.ts`, `dashboard-loading.ts`,
  `dashboard-*-list-html.ts`/`dashboard-*-item-html.ts`,
  `dashboard-kpi-items.ts`, `dashboard-test-rank.ts`,
  `dashboard-test-action.ts`, `dashboard-test-status-tags.ts`,
  `dashboard-level-pill(s)-html.ts`, `dashboard-latest-point-text.ts`, plus
  their ~27 dedicated test files) are deleted outright, not just superseded —
  `src/react/pages/DashboardPage.tsx` now owns the "Tổng quan" page, styled
  with real JSX instead of template strings. The controller's only remaining
  export is `dashboardModel()` (a pure-data twin of the old `pageDash()`
  pipeline — same domain calls in the same order, stopping before any HTML
  composition) plus `dashTestSetStatus()`, which is still `data-action`-driven
  from React markup per the React-island convention below. The still-pure
  data-shaping files that pipeline depends on (`dashboard-status-filter.ts`,
  `dashboard-shift-status.ts`, `dashboard-test-search-text.ts`,
  `dashboard-latest-point.ts`, `dashboard-expiring-lot-items.ts`,
  `dashboard-level-data.ts`, `dashboard-missing-target-items.ts`,
  `dashboard-overdue-actions.ts`, `dashboard-test-items.ts`,
  `dashboard-westgard-alerts.ts`, plus `dashboard-head-html.ts` — the one HTML
  builder React still calls, via `dangerouslySetInnerHTML` for the shared
  top-user/avatar header) are untouched and still bridged the same way. A
  dashboard KPI/CAPA panel (`dashboardKpiSnapshot()`) existed briefly
  (`5673eb49`) and was removed again before release (`890604eb`, "tinh gon
  dashboard") — the dashboard page has no such panel today.
- Activity log/"Nhật ký hoạt động" (`pageAudit()`, defined inline in
  `src/compat/modular-pilot.global.ts` rather than its own controller file)
  retired to React the same way as Dashboard, same day (2026-08-29):
  `src/react/pages/AuditPage.tsx` now owns the page, reading data from
  `root.auditModel()` (a new pure-data function added right next to where
  `pageAudit()` used to sit, running the identical filter → chain-status →
  paginate pipeline but returning plain data instead of composing HTML).
  `pageAudit()` itself and its two now-unused HTML builders
  (`activity-audit-page-html.ts`, `activity-audit-row-html.ts`) are deleted
  outright, along with their 2 dedicated test files; `tests/audit-filter.test.js`
  (the real behavioral coverage — search/date-range/pagination correctness)
  was repointed at `auditModel()` instead of scanning `pageAudit()`'s HTML
  output. The search box is the one control that doesn't use `data-action`
  (see "React island" above) — it calls the still-existing `auditSetQuery()`
  directly from a real `onChange`, so the existing debounce
  (`scheduleSearchRender`) keeps working unchanged. The date-range boxes
  (`dateBox()`) and page header (`headOnly()`) are still classic HTML-string
  builders, reused as-is via `dangerouslySetInnerHTML` — same pattern as
  Dashboard's `topUserBox()`/`dashboardHeadHtml()`, not worth porting to JSX
  for a shared, page-agnostic widget.
- Users/"Người dùng" (`pageUsers()`, `user-row-html.ts`, `users-page-html.ts`)
  retired to React the same day (2026-08-29): `src/react/pages/UsersPage.tsx`
  now owns the page, reading data from `root.usersModel()` (a new one-line
  pure-data function, `() => root.userListModel(state.users, currentUser &&
  currentUser.id)`, added right where `pageUsers()` used to sit).
  `pageUsers()` and both HTML builders are deleted outright, along with their
  2 dedicated test files. This page needed the narrowest migration surface of
  the three so far: every modal/action handler (`addUser`, `openUserPerms`,
  `applyUserPerms`, `resetPass`, `applyResetPass`, `toggleUser`, `delUser`)
  needed zero changes, since they either render into `#modalRoot` (a separate
  DOM root outside React's control) or read `document.getElementById(...)
  .value` directly at submit time — an uncontrolled form React never
  intercepts. `userPermissionsModalHtml()`/`resetPasswordModalHtml()`/
  `roleSelectOptions()`/`userPermChecks()`/`headOnly()` are all still classic
  HTML-string builders, reused as-is via `dangerouslySetInnerHTML` for the
  role `<select>` options and the permissions checkbox grid. The "Thêm người
  dùng" form's inputs and role select are plain uncontrolled JSX
  (`defaultValue`, no `onChange`) — safe because nothing reads or resets
  their value except the submit-time handler, unlike Dashboard/Audit's search
  boxes which need live external resets and so keep the local-state+
  `onChange` pattern documented above.
- `src/presentation/settings/settings-page-controller.ts` —
  `createSettingsPageController(deps)` owns the Settings page's form handlers
  (`saveLab`/`saveBrand`/`pickLogo`/`clearLogo`/`saveFb`/`clearFb`/
  `copyFirebaseRules`/`readBrandInputs`/`checkStorageUsage`) and the
  `ensureLabBrandShape()` state-normalization callback `state.js`'s
  `ensureShape()` invokes. Retired classic `settings.js` on 2026-08-18 (Pha G
  route slice 1). It is a DOM/browser adapter — every computation is already a
  TypeScript command/service (`SettingsProfileCommand`, `SettingsFirebaseCommand`,
  `firebaseSettingsService`); the controller reads the form, drives
  FileReader/canvas for the logo, opens dialogs, and delegates. Browser APIs
  (`FileReader`/`Image`/canvas/clipboard/`navigator`) are injected as deps so
  it stays testable. Wired via `src/compat/modular-pilot.global.ts`
  (`root.saveLab`, `root.ensureLabBrandShape`, …) so `ensureShape()`'s bare
  `ensureLabBrandShape` call keeps working unchanged. Settings/"Cài đặt"
  (`pageSettings()`, `admin-tools-html.ts`, `brand-panel-html.ts`,
  `brand-preview-html.ts`, `firebase-connection-panel-html.ts`,
  `firebase-rules-panel-html.ts`, `lis-gateway-panel-html.ts`,
  `settings-page-layout-html.ts`, `unit-profile-html.ts`) retired to React the
  same day as Users, 2026-08-29: `src/react/pages/SettingsPage.tsx` now owns
  the page, reading data from `root.settingsModel()` (a new pure-data function
  added right where `pageSettings()` used to sit, gathering the same lab/
  brand/backup/firebase/LIS fields the old function composed into HTML).
  `pageSettings()` and all 8 now-unused HTML builders are deleted outright,
  along with their 8 dedicated test files — every field the page renders
  (unit profile, brand/logo, admin tools, Firebase connection, LIS Gateway)
  is read only at submit time via `document.getElementById(...).value`, so
  every input/textarea/select in `SettingsPage.tsx` is plain uncontrolled JSX
  (`defaultValue`/`defaultChecked`), matching Users' add-user form rather than
  Dashboard/Audit's live-reset search boxes. `firebaseGuideHtml()` (a static
  `<details>` block) and `headOnly()` are still classic HTML-string builders,
  reused as-is via `dangerouslySetInnerHTML`. None of the controller's form
  handlers needed any change — they already read the DOM by id at call time,
  oblivious to whether React or a template string produced those elements.
- Manage/"Cấu hình chung" (`src/presentation/manage/manage-page-controller.ts`)
  retired to React 2026-08-29: `src/react/pages/ManagePage.tsx` now owns the
  page's 8 tabs (máy xét nghiệm, danh mục xét nghiệm, Panel QC, lô & nhóm lô,
  Mean/SD, chuyển tiếp lô, lịch sử dữ liệu, bảng TEa tham chiếu), the largest
  single page migrated so far. `manageShell`/`manageToolbar`/`manageLots`/
  `manageInstruments`/`managePanels`/`manageTransitionsV2`/`manageTargets`/
  `manageAssays`/`manageHistory`/`manageTeaRefs`/`manageView`/
  `renderManageBody`/`pageManage` and their 37 backing `*-html.ts` files
  (one table/row builder per tab, plus the whole `target-*-html.ts` cluster
  for the Mean/SD matrix) are deleted outright, along with 37 dedicated test
  files. `root.manageModel()` — a new pure-data function reading the same
  filtered/sorted state each classic `manageXxx()` used to, one branch per
  active tab — is the only page-body export left; every modal-opening
  function (`teaRefOpenAdd`, `teaLabProfileOpen`, `teaRefEdit`, …) stays
  unchanged since modals render into `#modalRoot`, outside React. The Mean/SD
  matrix (tab `targets`) is the highest-risk part of this page — dozens of
  per-row checkboxes and 4 number inputs (mean/low/high/sd) with live
  cross-field sync — and is deliberately left fully uncontrolled
  (`defaultChecked`/`defaultValue`, keyed by `${testId}:${lotId}`):
  `syncTargetRange()`/`toggleTargetRow()`/`targetCheckAll()`
  (`manage-tests-actions-controller.ts`) read/write only the DOM of the row
  being edited via `querySelector`/`closest`, and never call `rerender()`, so
  React never re-renders these inputs mid-keystroke and there is no reset-on-
  type risk — confirmed live (typed into `.tm-mean`, cross-synced `.tm-low`/
  `.tm-high` from `.tm-sd`, toggled the row checkbox, saved through the
  re-authentication modal, and the saved Mean/SD showed up correctly on both
  the matrix and the History tab afterward). Three `<select>`s — Panel QC/
  Nhóm lô QC (tab `targets`) and Xét nghiệm (tab `history`) — DO need live
  external resets (`ensureTargetSelection()` can silently correct an invalid
  panel/group, and search can auto-switch the selected assay), so those use
  real `value=`/`onChange` calling `setTargetPanel`/`setTargetGroup`/
  `setHistoryTest` directly, same exception class as the search boxes below.
  The page's own search box (`manageSearchSet`) used to debounce into a
  narrow `renderManageBody()` that replaced only `.config-shell-main`'s
  `innerHTML` — unsafe once React owns that DOM node — so it now debounces
  into `deps.rerender()` directly (matching every other migrated page's
  search box), a strict simplification since `renderManageBody()` already
  fell back to full `rerender()` whenever `.config-shell-main` was missing.
- `src/presentation/reagent/reagent-page-controller.ts` —
  `createReagentPageController(deps)` owns the reagent lot-comparison page
  (`rcCompute`/`rcMeta`/`rcCell`/row+quick-list+picker+create modals/`rcPrint`/
  `rcPrintSummary`/…), retired classic `reagent.js` on 2026-08-18 (Pha G route
  slice 4). Page state (`rcId`/`rcModalQ`/`rcQuickType`/…) is written directly
  from handlers into the `ReagentUIState` bag (accessor globals), like the
  Westgard page. Every stat/render is a TS domain/service/presentation reached
  through `deps` (`ReagentComparisonService`, `ReagentComparisonWorkflowCommand`,
  `reagentComparisonCalculator`, the modal/print HTML builders); the palette
  consts `RCC`/`RCPAD`/`RC_MIN_PAIRS` live in the controller.
  `tests/reagent-stats.test.js` drives `rcCalc`/`rcReportSummaryTable` (bridged
  as globals) directly. Reagent/"So sánh hóa chất" (`pageReagent()`,
  `reagent-toolbar-html.ts`, `reagent-info-panel-html.ts`,
  `reagent-pair-panel-html.ts`, `reagent-pair-row-html.ts`,
  `reagent-results-panels-html.ts`, `reagent-charts-panel-html.ts`,
  `reagent-select-options-html.ts`, `reagent-empty-page-html.ts`) retired to
  React 2026-08-29: `src/react/pages/ReagentPage.tsx` now owns the page,
  reading data from `root.reagentModel()` (a new pure-data function added
  right where `pageReagent()` used to sit). `pageReagent()` and all 8 HTML
  builders are deleted outright, along with their 8 dedicated test files.
  `rcCompute()` — which patches `#rcStats`/`#rcCrit`/`#rcVerdict`/`#rcScatter`/
  `#rcBland` directly via `innerHTML`, entirely outside React — is unchanged;
  `ReagentPage.tsx` calls it once via `useEffect` after every mount/re-render,
  the same trigger point classic code reached through
  `postRenderPageActions.run('reagent', {reagent: rcCompute, …})` on an
  animation frame after `afterRender()`. This page surfaced a real bug in the
  "uncontrolled input" pattern already used for Users/Settings/Manage: typing
  is safe with `defaultValue` (`rcMeta`/`rcCell` never call `rerender()`), but
  *switching to a different comparison* (`rcSwitch`/`rcCreateFrom`/`rcPick`/
  `rcDelete`, all of which DO call `rerender()`) left every field showing the
  **previous** comparison's data — confirmed live in the browser — because
  React reuses the same DOM node at the same tree position across renders and
  never re-applies `defaultValue` after first mount. Fixed by wrapping the
  toolbar + info/pair panels in `<div key={model.currentId}
  style={{display:'contents'}}>` so switching comparisons forces a full
  remount, and keying each pair-row by `` `${rows.length}-${row.index}` ``
  (not `row.index` alone) so deleting a middle row — which renumbers every
  row after it — also forces a remount instead of leaving stale values in
  shifted positions. `scripts/react-migration-parity-check.js` needed a
  matching fix: it forces the legacy fallback via `render()` alone, which
  never re-triggers `rcCompute()`, so the parity snapshot compared a
  "computed" React version against an "uncomputed" classic one until a
  `POST_RENDER` hook was added to call `rcCompute()` for both sides before
  diffing.
- `src/presentation/report/report-page-controller.ts` — Report/"Báo cáo"
  retired to React 2026-08-30: `src/react/pages/ReportPage.tsx` now owns the
  page, reading data from `reportModel()`/`reportLockPanelModel()` (new
  pure-data functions added right where `pageReportV2()`/`reportLockPanelHtml()`
  used to sit). `pageReportV2()`, `reportLockPanelHtml()`, `reportRangePicker()`,
  `reportApplySearch()` and their 4 classic HTML-builder files
  (`report-page-html.ts`, `report-range-picker-html.ts`,
  `report-lock-panel-html.ts`, `report-lock-list-html.ts`) are deleted
  outright, along with their 5 dedicated test files (the 4 builder tests plus
  `report-page-bridge.test.js`, which pinned only the now-gone `pageHtml`
  bridge contract). `reportApplySearch()` was the sole caller of
  `report-search.ts`'s `createReportSearch()` — confirmed via a repo-wide
  grep before deleting that file too, plus its bridge wiring
  (`root.reportSearch`) and the assertions referencing it in
  `tests/typescript-module-pilot.test.js`/`tests/report-render-bridge.test.js`.
  Every other Report function (`reportLockPeriod`, `reportUnlockPeriod`,
  `reportConfirmUnlockPeriod`, `reportExportSelection`, `reportRangeChanged`,
  `printReport`/`exportReportXLSX`/`exportReportCSV` in
  `report-print-controller.ts`/`data-io-controller.ts`) needed no change —
  they read the DOM directly at call time or render into `#modalRoot`,
  outside React. The Lock Panel's month/year `<select>`s applied the
  Reagent-class `key={ym}` remount fix **proactively, before hitting the bug
  live** (`reportSetLockPart()` changes which value should show via
  `rerender()` without changing the tree's structure — exactly the pattern
  that bit Reagent's `rcSel`); confirmed correct by calling
  `reportSetLockPart('month','3')` directly and checking the rendered
  `<select>` value. Testing this page surfaced one **pre-existing bug
  unrelated to the React migration**: `exportReportCSV()` always threw
  `TypeError: Cannot read properties of undefined (reading 'currentLot')` —
  `root.qcReportCsvRows`'s `rows:` dependency read `root.qcReportRowsService`
  eagerly at construction time (line ordering placed it before
  `root.qcReportRowsService` itself was assigned), the same
  eager-construction trap documented throughout this file for other routes.
  Confirmed the bug predates this migration by reproducing it with
  `isReactPage('report')` forced `false` (the classic path) before fixing;
  fixed by wrapping the dependency in a closure that re-reads `root.X` per
  call, matching the pattern `data-io-controller.ts`'s own
  `qcReportRowsService` dependency already used correctly.
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
`docs/validation/URS.md` (prototype/research, not in `TRACEABILITY.md`).
Direction was reversed once (`5d1a061`, "đảo chiều"): the original design had the gateway push QC
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
