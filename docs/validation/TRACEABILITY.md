# Traceability matrix

| URS | Thành phần chính | Bằng chứng tự động |
|---|---|---|
| 01–02 | state, entry service, target matrix | entry-service, target-matrix, lot-rename tests |
| 03 | core, qc-domain, worker | qccore, qc-rules, westgard-worker/action tests |
| 04 | parallel lot/transition | parallel-lot-run, lot-transition tests |
| 05 | draw, chart view-model, core CUSUM | cusum, chart-view-model, render-downsampling |
| 06–07 | entry/action workflow | entry-service, action-workflow-service tests |
| 08 | action workflow, users auth | action-workflow-service, auth-security tests |
| 09 | period service/entry service | period-service, entry-service tests |
| 10 | Sigma services/UI/export | sigma cohort/comp/xlsx/print/export tests |
| 11 | reagent statistics | reagent-stats test |
| 12 | data-io/reports/Electron print | report/westgard/sigma xlsx+print, print-check |
| 13 | audit | audit-hash, firebase-merge tests |
| 14 | router/auth | UI route/accessibility, auth-security tests |
| 15 | local/state storage | local-store, storage-pipeline/safety tests |
| 16 | data-io/core | backup-roundtrip, qccore tests |
| 17 | firebase sync/rules | firebase merge/offline/config/rules tests |
| 18 | benchmark gate | `npm run verify-release` |
| 19 | CSS/modal/router | `npm run a11y-audit` |
| 20 | electron main/preload/license | license, electron-preload, print-check |

Mỗi lần release, lưu stdout của:

```powershell
npm ci
npm test
npm run typecheck
npm run verify-release
npm run visual-check
npm run a11y-audit
npm run print-check
```
