# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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

Several tests are **source scanners, not behaviour tests** — they read the repo
as text and enforce conventions no compiler here can. Expect them to fail on a
structural change and fix the structure, not the test:

- `global-name-uniqueness.test.js` — no two files in the single shared global
  scope may declare the same top-level name (see "Architecture"). Its scanner is
  line/indent-based to match this codebase's style: top-level declarations must
  sit at column 0 and stay one logical declaration per line, or it can't see
  them. Workers are excluded (own global scope).
- `ui-route-structure.test.js` — pins the router/page split and the
  `index.html` load order of `router-render.js` → `*-routes.js`.
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
`docs/coverage-map.md`: percent of each `assets/**/*.js` executed, which files no
test loads at all, and the names+lines of functions never executed. It is
deliberately **not a gate**: no thresholds, and it only exits non-zero if the test
suite itself fails or no coverage data was found. Two things to know when reading
it: V8's offsets are source *character* offsets (not UTF-8 bytes — this codebase is
full of Vietnamese, so the two differ a lot), and render modules can only run their
pure halves inside the `vm` sandbox, so a low number there is the sandbox boundary,
not test debt. The 2026-08-01 baseline: 40.5% overall, 9 files never loaded by any
test, `sigma.js` at 26.9% (all UI) with 49 never-executed functions, and the TEa
layer it was split into (`sigma-tea.js`) at 90.4% with none. That contrast is the
map's whole point: before the split those two numbers were averaged into one
uninformative 34.4%.

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
- `action-workflow-service.js` phải giữ chi phí `actionRerunStatus()` không tăng theo
  tổng số điểm QC: nó bị gọi 5 lần cho CÙNG một hồ sơ trong một lần vẽ
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
`assets/core.js` then every file in `assets/modules/` via plain
`<script defer>` tags, in a fixed, load-bearing order. Every file (except
`core.js`) declares top-level `function`/`const`/`let` directly into global
scope; later files freely call functions and read state defined by earlier
ones. There is no namespacing — when adding a function, check the existing
global name isn't already taken by another module; a collision silently
replaces the other module's binding and only surfaces weeks later, so
`tests/global-name-uniqueness.test.js` scans every file and fails on
duplicates. If you reorder or split `<script>` tags in `index.html`, you can
break forward references.

`assets/core.js` is the one exception: it's wrapped in a UMD shim
(`(function(root, factory){...})`) so it also works via `require()` — that's
what makes it usable from both the browser (as `window.QCCore`) and Node test
files (`require('../assets/core.js')`). It holds pure, side-effect-free domain
math (stats, Westgard rule evaluation, Sigma metric, measurement uncertainty,
CUSUM, backup validation/sanitization) with no DOM or state dependency — new pure
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
  (`state-storage.js`, `firebase-sync.js`, `backup-service.js`), and
  `STATE_SCHEMA_VERSION` (currently 5). Holds the pure error-classification
  helpers too (`errorType`, `primaryErrorRule`, `fixHint`,
  `WG_RULE_DESCRIPTIONS`); `qc-domain.js` re-exports them under the same global
  names for the UI. Since 2026-08-01 it also owns the **rule-semantics tables**
  — `defaultRuleAction`/`resolveRuleAction` (which rules only warn:
  `WG_ALERT_RULES` = 1-2s/6x/7T) and `defaultRuleScope`/`resolveRuleScope`
  (within/across/both by rule and QC level count), plus `ruleEnabled`,
  `ruleOnInScope`, `ruleVerdictLevel`. These are the SINGLE SOURCE for both
  Westgard engines: `qc-domain.js` feeds them state (global toggles, per-test
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
  legitimate single-rule logic).
- `app-meta.js` — loads right after `core.js`, before `state.js`. Sets
  `window.QCLAB_APP` (name/version/releaseDate — bump both per
  `docs/validation/RELEASE-PUBLISH.md`) and `window.QCLAB_CLOUD` (Firebase
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
  `derived()` (index cấu hình: panel/thứ tự test/lô/nhóm lô/chuyển tiếp đã duyệt)
  TỰ KIỂM CHỨNG từ 2026-08-01, cùng kỹ thuật với cache của
  `action-workflow-service.js`: `derivedStampWalk()` so tham chiếu + độ dài của
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
  `action-workflow-service.js` — smaller service-style modules (some
  IIFE-wrapped) layered on `state`/`qc-domain`. `PeriodService` locks/unlocks
  reporting periods (`state.periodLocks`, a synced list branch); `entry-service.js`
  enforces the lock (blocks add/edit/void once a period is locked), and the
  "Khóa kỳ báo cáo" panel on the Reports page (`report-routes.js`) is the only
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
  `EntryService` normalizes QC-point input
  (`preparePointInput`/`addPoint`/`voidPoint`/`recordPoint`) and builds the
  entry sheet/window data; called from `router-render.js`.
  (`action-workflow-service.js` actually loads a bit later, after the
  `*-ui-state.js` files.)
  `action-workflow-service.js` owns the corrective-action lifecycle:
  `approvalStatus` is `pending`/`approved`/`returned`; physical deletion has been
  replaced by `recordStatus='cancelled'` plus a reason/actor/timestamp. The service
  ignores cancelled records when deciding whether a QC point has a real NCE, and
  `actionWorkflowStatus()` only reports an action complete when its rerun
  requirement, release-to-service gate, effectiveness/residual-risk review and
  independent approval are all met. Approval is deliberately
  independent — `actionCanApprove()` refuses the action's own author, matching
  both the creator and later content editors by stable user ID/username, with the
  free-text `by` field as the legacy fallback — and approved actions cannot be
  cancelled or edited.
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
  those use PBKDF2 in `users-auth.js`. Retention: cutting old rows (the admin
  "Lưu trữ nhật ký cũ" flow in `users-auth.js`, or `auditRotateOverflow()` past
  `ACTIVITY_HARD_CAP`) removes a **prefix** and records the removed segment's
  tip hash in `state.activityAnchor`; `auditVerifyChain()`/`auditRelinkChain()`
  seed from that anchor instead of `''`. Do not go back to re-hashing the
  retained rows: that cost 2 235ms per 20 000 rows (~11s at the old 120 000
  cap) *inside* `logAct()`, i.e. a silent freeze in the middle of an unrelated
  save, and it rewrote historical hashes so an archived CSV no longer matched
  the live chain. The anchor keeps the cut O(1) and keeps the archive CSV
  cryptographically continuous with what remains. The anchor is only meaningful
  while the log is non-empty — `auditPushRaw()` clears it when appending to an
  empty list, so every path that rebuilds the log (clear, backup import, reset)
  is covered without remembering to. `activityAnchor` is in `FB_TOP` because a
  machine that pulls a cut log without the anchor would report a false "audit
  bị sửa". `pageAudit()` no longer verifies on every render (paging/filtering
  rerenders): `auditChainStatus()` caches by (row count, last hash, anchor) and
  skips auto-verification above `AUDIT_AUTO_VERIFY_MAX`, offering a button
  instead.
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
- `draw.js`, `router-render.js`, `dashboard-routes.js`, `entry-routes.js`,
  `westgard-routes.js`, `sigma.js`, `actions-routes.js`, `action-form.js`,
  `report-routes.js`, `manage-routes.js`, `after-render.js`,
  `entry-tests-actions.js`, `modals.js` —
  UI/rendering and routing. Since 2026-07-24 the three biggest pages live in
  their own files:
  `router-render.js` keeps only dispatch plus cross-page UI primitives (the
  `btn()` builder, the `requireWrite()`/`requireAdmin()` guards, search/filter
  helpers, the VN date picker, icon SVGs), while `pageDash()` lives in
  `dashboard-routes.js`, `pageEntry()` in `entry-routes.js` and
  `pageWestgard()` in `westgard-routes.js` — `router-render.js` must never
  redefine those three, and the files must load right after it in that order;
  `modals.js` likewise keeps only the modal machinery (`modalTemplate()`,
  `modalCloseButton()`), not page logic. On 2026-07-30 the same treatment
  reached `actions-routes.js`, which had been holding **two** whole pages and
  had grown to 105 KB, in two steps:
  - `pageReportV2()` and every `report*` helper (period lock/unlock, test
    search, date range, print icons) moved to `report-routes.js`. Those two
    pages share no function — only `professional-reports.css`, see "CSS
    structure" — so that cut left **no** cross-reference in either direction.
  - The NCE form then moved to `action-form.js`: the `ACT_*` option/suggestion
    constants, `actSel()`, the `<details>` section machinery, the investigation
    checklist, the draft that survives `rerender()`, `actionFormModel()`,
    `addAction()`, and `actionFormHtml()` — which was extracted out of
    `pageActionsV4()`, a single 17 KB function that had been rendering the
    8-section form, the issue list and the log table together. `pageActionsV4()`
    is now ~20 lines and passes the already-computed issue count into
    `actionFormHtml(issues.length)` rather than calling `currentIssues()` a
    second time (two calls could disagree). `actions-routes.js` keeps the issue
    list, the record lifecycle (approve/return/cancel/escalate/reopen + version
    tokens) and the detail sheet.

  Unlike the report cut, **this one is deliberately not one-directional**: the
  form calls back into the page's evidence builders (`actionEvidenceTimelineHtml`,
  `actionRerunEvidenceHtml`, `actionLevelShort`) because the detail sheet renders
  the very same blocks, and the page calls into the form to open/save a record.
  In one shared global scope that is harmless — what is being pinned is the
  **split of responsibility**, not an acyclic dependency graph, and
  `tests/ui-route-structure.test.js` asserts it that way (which function lives in
  which file, plus load order). Both files must load right after
  `router-render.js`'s page trio, in the order `actions-routes.js` →
  `action-form.js` → `report-routes.js`. That test also fails if a `page*()`
  function or an Actions-page helper migrates back.
  `router-render.js` owns the page list
  (`PAGES`) and per-role page permissions (`PERM`): `rolePageIds(role)` gives
  each role's default page set, and a user's own `pagePerms` (edited in
  `users-auth.js`) can only narrow that set further, never expand past it.
  Page-level UI state lives in the `*-ui-state.js` modules above. `sigma.js`
  renders the Six Sigma page (see "Confirmed business-logic decisions" below
  for how its numbers relate to reports.js).
- `sigma-tea.js` — the Six Sigma page's **TEa resolution layer**, split out of
  `sigma.js` on 2026-08-01 (loads immediately before it; `SG_TEA_DEFAULT_REF` and
  `SG_CLIA_FIXED` read `TEA_SOURCE_REGISTRY`/`TEA_ANALYTE_CATALOG` at load time).
  It answers "what is this assay's TEa, from which source, with what traceability":
  the effective TEa table (`REFTESTS` defaults overlaid with `state.teaRefs`),
  assay↔reference-row matching (`sgRef`, exact-then-longest-prefix), the CLIA
  percent/absolute/greater-of criterion, and the per-period TEa snapshot. It knows
  nothing about Sigma, MU, charts or modals — that boundary is one-directional and
  pinned by `tests/ui-route-structure.test.js`, and it is what makes the layer
  testable in Node (`tests/sigma-tea.test.js` loads it with only `core.js` +
  `state.js`). `tests/helpers/sandbox.js` auto-inserts it before `modules/sigma.js`,
  like it does `analyte-catalog.js` before `state.js`.
- `dashboard-routes.js` còn dựng bảng KPI chất lượng & CAPA (`dashboardKpiSnapshot()`):
  tỷ lệ QC được chấp nhận/bị loại, số NCE đang mở, tỷ lệ CAPA có hiệu lực, xu hướng 6
  tháng, luồng giai đoạn CAPA và nhóm nguyên nhân. Kỳ và phạm vi (thiết bị/xét nghiệm)
  nằm ở `dashKpi*` trong `analysis-ui-state.js`; ngưỡng đạt/không đạt lấy từ
  `state.lab.kpiTargets`, sửa ở panel `#kpiTargets` trang Cài đặt và được
  `sanitizeBackup()` kẹp lại theo min/max nên bản backup hỏng không đặt được ngưỡng vô
  lý. Bốn ô KPI là nút bấm mở modal liệt kê đúng tập dữ liệu đã tính (`dashKpiLast`),
  nên KHÔNG được tính lại tập đó trong modal — chỉ số hiện trên ô và danh sách người
  dùng bấm vào xem phải là cùng một phép tính. Thống kê điểm QC chỉ gồm xét nghiệm đang
  vận hành, còn thống kê CAPA lấy mọi hồ sơ khi không lọc phạm vi — hồ sơ nguồn ngoài
  IQC không có `testId` nên sẽ biến mất nếu lọc theo thiết bị/xét nghiệm.
- `range.js`, `settings.js`, `backup-service.js`, `data-io.js`, `reports.js`, `users-auth.js`,
  `reagent.js` — feature-specific logic (target-range calc, settings page,
  backup/restore service + XLSX generation, printed reports, auth/user
  management, reagent lot comparison stats). `users-auth.js` hashes passwords
  with PBKDF2-SHA256 at `PASS_ITERATIONS=600000` (OWASP minimum); the stored
  `pbkdf2$<iterations>$<salt>$<hash>` string carries its own iteration count,
  so legacy 210k-iteration hashes still verify and silently re-hash at the
  current count on next successful login — don't lower `PASS_ITERATIONS` or
  drop that upgrade path. It also exports `reauthenticateCurrentUser({title,
  message})` — a password re-prompt gating the app's *critical* operations
  (approving/returning a corrective action, locking/unlocking a reporting
  period, writing or reverting a lot's Mean/SD, concluding a lot transition);
  wire any new operation of that weight the same way, `await`-ing it before
  mutating state. `backup-service.js` (split out of `data-io.js` on
  2026-07-24) rejects imports over `BACKUP_IMPORT_MAX_BYTES` (64 MB) before
  parsing. `reagent.js` implements its regression stats
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
live; the `actions` page has no separate file of its own — so the two pages
stay coupled in CSS even though their JS was split apart on 2026-07-30
(`actions-routes.js` / `report-routes.js`). These files have
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

Those Rules are a versioned artifact, not something to hand-edit in the
Firebase console: `firebase/database.rules.json` is the single source of truth
(deployment steps and the five post-deploy checks are in
`firebase/HUONG-DAN-FIREBASE-RULES.md`), and the Settings page renders the same
text via `firebaseRulesText()` in `settings.js` — `tests/firebase-rules.test.js`
fails if the two diverge, so change both together. The model: a room is
readable/writable only by UIDs listed under `qclab-acl/{labCode}/{uid}`, which
clients can read for themselves but never write; every snapshot must carry a
numeric `_ts`. QC Lab's own admin/technician/viewer roles are client-side UI
permissions layered on top, not a server write boundary.

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
- Measurement uncertainty (MU, ISO 15189:2022 §7.3.4) is a **top-down** budget
  (ISO/TS 20914 + Nordtest TR 537): `uncertaintyBudget()` in `core.js` does the
  math, `sgMU()`/`sgMuHTML()` + the MU modal (`sgOpenMU()`) surface it on the
  Sigma page, and `sigmaMuPrintCard()`/`sigmaMuPeriodsPrintRows()` in
  `reports.js` put it on both Sigma print reports. Inputs are the ones the page
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
