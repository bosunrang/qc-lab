# Bản đồ điểm mù của bộ test

Sinh bằng `npm run coverage-map` (`NODE_V8_COVERAGE` của Node, không cài thêm gì).
**Không phải cổng chặn** — không có ngưỡng nào, đây là bản đồ để quyết định viết test
hoặc tách file. Phần dựng DOM của các file render không gọi được trong sandbox `vm`,
nên độ phủ thấp ở đó là đúng thiết kế; thứ đáng nhìn là **hàm thuần chưa ai chạm tới**.

Sinh ngày 2026-08-08 · Node v26.4.0 · 47 file · 43.9% mã nguồn đã chạy.

## 7 file KHÔNG test nào nạp tới

Không phải "độ phủ thấp" mà là **không có dữ liệu độ phủ nào** — chưa test nào
nạp file này vào sandbox. Với file render thuần DOM thì đó là giới hạn của
sandbox `vm`; với file có hàm thuần thì đây là điểm mù thật.

- `modules/manage-routes.js` (44.5 KB)
- `modules/actions-routes.js` (39.6 KB)
- `modules/report-routes.js` (12.2 KB)
- `modules/modals.js` (7.9 KB)
- `modules/after-render.js` (5.0 KB)
- `modules/app-meta.js` (1.3 KB)
- `app.js` (0.3 KB)

## Toàn bộ file

| File | KB | % mã đã chạy | Ký tự chưa chạy | Hàm chưa từng chạy |
|---|---:|---:|---:|---:|
| `modules/sigma.js` | 76.0 | 26.5% | 54.323 | 49 |
| `modules/manage-tests-actions.js` | 68.6 | 20.8% | 52.193 | 43 |
| `modules/entry-routes.js` | 48.9 | 5.7% | 45.470 | 35 |
| `modules/manage-routes.js` | 44.5 | chưa nạp | 43.316 | — |
| `modules/action-form.js` | 64.3 | 28.5% | 43.018 | 52 |
| `modules/actions-routes.js` | 39.6 | chưa nạp | 37.250 | — |
| `modules/reagent.js` | 37.7 | 16.2% | 30.892 | 47 |
| `modules/users-auth.js` | 38.0 | 20.5% | 28.557 | 37 |
| `modules/data-io.js` | 74.9 | 72.6% | 20.249 | 19 |
| `modules/reports.js` | 37.9 | 49.3% | 18.526 | 3 |
| `modules/westgard-routes.js` | 21.5 | 10.9% | 18.319 | 20 |
| `modules/router-render.js` | 21.7 | 21.1% | 17.077 | 51 |
| `modules/settings.js` | 18.6 | 13.6% | 15.617 | 13 |
| `modules/draw.js` | 20.0 | 33.2% | 13.392 | 7 |
| `modules/dashboard-routes.js` | 12.5 | 0.4% | 12.054 | 4 |
| `modules/range.js` | 15.4 | 19.4% | 11.742 | 9 |
| `modules/report-routes.js` | 12.2 | chưa nạp | 11.700 | — |
| `modules/modals.js` | 7.9 | chưa nạp | 7.899 | — |
| `modules/qc-domain.js` | 29.5 | 73.5% | 7.599 | 27 |
| `modules/backup-service.js` | 14.5 | 54.2% | 6.219 | 9 |
| `modules/firebase-sync.js` | 32.4 | 81.1% | 5.621 | 5 |
| `modules/lis-client-service.js` | 15.5 | 63.9% | 5.289 | 9 |
| `modules/state.js` | 32.5 | 84.0% | 5.017 | 12 |
| `modules/after-render.js` | 5.0 | chưa nạp | 5.014 | — |
| `modules/state-storage.js` | 17.5 | 80.5% | 3.288 | 0 |
| `modules/action-workflow-service.js` | 30.0 | 89.0% | 3.180 | 1 |
| `core.js` | 59.3 | 95.4% | 2.625 | 6 |
| `modules/app-meta.js` | 1.3 | chưa nạp | 1.188 | — |
| `modules/entry-service.js` | 13.3 | 91.5% | 1.146 | 1 |
| `modules/sigma-tea.js` | 12.8 | 91.9% | 1.014 | 0 |
| `modules/qc-rules.js` | 3.5 | 74.3% | 818 | 0 |
| `modules/audit.js` | 10.9 | 92.2% | 810 | 3 |
| `modules/local-store.js` | 6.0 | 91.2% | 542 | 6 |
| `modules/reagent-comparison-service.js` | 6.3 | 92.8% | 462 | 0 |
| `workers/westgard-worker.js` | 3.4 | 90.8% | 316 | 1 |
| `app.js` | 0.3 | chưa nạp | 277 | — |
| `modules/sigma-cohort-service.js` | 4.4 | 96.0% | 179 | 0 |
| `modules/period-service.js` | 2.7 | 94.0% | 160 | 0 |
| `modules/westgard-view-model.js` | 3.2 | 95.2% | 157 | 0 |
| `modules/chart-view-model.js` | 2.5 | 96.1% | 97 | 0 |
| `modules/auth-ui-state.js` | 0.8 | 92.3% | 59 | 0 |
| `modules/analysis-ui-state.js` | 0.5 | 99.1% | 5 | 0 |
| `modules/entry-ui-state.js` | 0.7 | 99.3% | 5 | 0 |
| `modules/manage-ui-state.js` | 0.5 | 99.0% | 5 | 0 |
| `modules/reagent-ui-state.js` | 0.4 | 98.7% | 5 | 0 |
| `modules/sigma-ui-state.js` | 0.4 | 98.7% | 5 | 0 |
| `modules/analyte-catalog.js` | 12.0 | 100.0% | 3 | 0 |

## Hàm chưa từng chạy (10 hàm đầu mỗi file, theo thứ tự xuất hiện)

- **modules/sigma.js** — 49 hàm: `sgFmtDPMO` (dòng 9) · `sgInputValue` (dòng 12) · `sgRows` (dòng 52) · `sgReconcileAllTeaSnapshots` (dòng 68) · `sgSetTeaSource` (dòng 74) · `sgSetTeaMeta` (dòng 75) · `sgRefreshSoon` (dòng 84) · `sgTrackedOptions` (dòng 86) · `sgPickTest` (dòng 106) · `sgStatusPeriodId` (dòng 107) …
- **modules/manage-tests-actions.js** — 43 hàm: `validIsoDate` (dòng 6) · `setManageTab` (dòng 8) · `setTargetPanel` (dòng 9) · `setTargetGroup` (dòng 10) · `setTargetLevel` (dòng 11) · `setHistoryTest` (dòng 12) · `openTargetMatrix` (dòng 13) · `targetNumberText` (dòng 14) · `targetConfigAssigned` (dòng 15) · `targetRangeDraft` (dòng 18) …
- **modules/entry-routes.js** — 35 hàm: `entryWindowFor` (dòng 2) · `entryWindow` (dòng 3) · `entryToggleRows` (dòng 7) · `entryDetailToggled` (dòng 15) · `entryTreeIsCollapsed` (dòng 16) · `pageEntry` (dòng 17) · `treeToggle` (dòng 176) · `toggleEntryTree` (dòng 177) · `entryFilter` (dòng 186) · `entrySetMachine` (dòng 211) …
- **modules/action-form.js** — 52 hàm: `actionSectionToggled` (dòng 28) · `actionDefaultOpenSections` (dòng 32) · `actionRuleOptions` (dòng 44) · `actionStaffOptions` (dòng 49) · `captureActionDraft` (dòng 85) · `actionFormChanged` (dòng 90) · `actionDraftValues` (dòng 93) · `clearActionDraft` (dòng 94) · `actionSourceOptions` (dòng 99) · `actionCausePhrases` (dòng 152) …
- **modules/reagent.js** — 47 hàm: `rcLabel` (dòng 6) · `rcAct` (dòng 7) · `rcSaveSoon` (dòng 8) · `rcPairCalc` (dòng 29) · `rcAxis` (dòng 43) · `rcPadr` (dòng 52) · `rcToolIcon` (dòng 53) · `rcMiniIcon` (dòng 62) · `rcScatterSVG` (dòng 66) · `rcBlandSVG` (dòng 72) …
- **modules/users-auth.js** — 37 hàm: `pageUsers` (dòng 2) · `auditSetQuery` (dòng 44) · `auditSetPageSize` (dòng 54) · `auditSetPage` (dòng 57) · `auditClearFilters` (dòng 60) · `activityCSVRows` (dòng 90) · `exportActivityCSV` (dòng 91) · `clearActivityLog` (dòng 96) · `archiveActivityLog` (dòng 112) · `confirmArchiveActivityLog` (dòng 125) …
- **modules/data-io.js** — 19 hàm: `dataIoTypePx` (dòng 5) · `dataIoCanvasFont` (dòng 6) · `csvCell` (dòng 7) · `downloadCSV` (dòng 13) · `exportMetaRows` (dòng 14) · `reportPrevLotRows` (dòng 30) · `reportRows` (dòng 91) · `exportReportCSV` (dòng 92) · `downloadBlob` (dòng 102) · `sigmaCanvas` (dòng 119) …
- **modules/reports.js** — 3 hàm: `openPrint` (dòng 15) · `printReport` (dòng 176) · `printRangeForm` (dòng 224)
- **modules/westgard-routes.js** — 20 hàm: `wgMultiViews` (dòng 2) · `wgTogglePrevLot` (dòng 8) · `wgArchivedGroups` (dòng 13) · `wgSetViewMode` (dòng 14) · `wgSetChartMode` (dòng 15) · `wgChartModeTabs` (dòng 16) · `pageWestgardCusum` (dòng 23) · `wgSetArchivedGroup` (dòng 37) · `wgSetArchivedTest` (dòng 38) · `wgViewModeTabs` (dòng 39) …
- **modules/router-render.js** — 51 hàm: `role` (dòng 12) · `canWrite` (dòng 13) · `requireWrite` (dòng 20) · `requireAdmin` (dòng 21) · `roleLabel` (dòng 23) · `roleSelectOptions` (dòng 24) · `rolePageIds` (dòng 25) · `userPageIds` (dòng 26) · `setSearchCount` (dòng 31) · `showSearchEmpty` (dòng 32) …
- **modules/settings.js** — 13 hàm: `saveLab` (dòng 5) · `saveBrand` (dòng 13) · `readBrandInputs` (dòng 21) · `pickLogo` (dòng 28) · `clearLogo` (dòng 46) · `firebaseAclHelp` (dòng 47) · `saveFb` (dòng 52) · `parseFirebaseConfig` (dòng 80) · `validateFirebaseConfig` (dòng 95) · `clearFb` (dòng 101) …
- **modules/draw.js** — 7 hàm: `drawRuleAcross` (dòng 3) · `qcTooltip` (dòng 6) · `hide` (dòng 9) · `ljDataURL` (dòng 128) · `drawLJMultiZ` (dòng 131) · `ljMultiDataURL` (dòng 231) · `drawCUSUM` (dòng 239)
- **modules/dashboard-routes.js** — 4 hàm: `pageDash` (dòng 2) · `dashTestFilter` (dòng 85) · `dashTestSetStatus` (dòng 89) · `pageDashLoading` (dòng 93)
- **modules/range.js** — 9 hàm: `openRangeWorkflow` (dòng 23) · `rangeTeaPercent` (dòng 43) · `rangeGateHtml` (dòng 47) · `rangeUpdateBiasHint` (dòng 59) · `rangeGatePasses` (dòng 68) · `applyNewRange` (dòng 73) · `confirmApplyNewRange` (dòng 90) · `revertRange` (dòng 105) · `confirmRevertRange` (dòng 118)
- **modules/qc-domain.js** — 27 hàm: `reportLevelStats` (dòng 6) · `wgSet` (dòng 11) · `wgReset` (dòng 12) · `testRuleOn` (dòng 20) · `defaultRuleScope` (dòng 21) · `testRuleOnAcross` (dòng 25) · `westgard` (dòng 28) · `westgardMulti` (dòng 29) · `westgardByPoint` (dòng 30) · `westgardMultiByPoint` (dòng 31) …
- **modules/backup-service.js** — 9 hàm: `downloadBackupText` (dòng 61) · `importData` (dòng 73) · `verifyBackupFile` (dòng 93) · `markBackupDone` (dòng 97) · `lastBackupInfo` (dòng 98) · `backupStatusText` (dòng 104) · `backupCapacityText` (dòng 111) · `backupOverdue` (dòng 112) · `updateBackupBanner` (dòng 113)
- **modules/firebase-sync.js** — 5 hàm: `fbStartPull` (dòng 239) · `fbPullOnce` (dòng 252) · `initFirebase` (dòng 368) · `remoteRenderUnsafe` (dòng 401) · `syncNow` (dòng 421)
- **modules/lis-client-service.js** — 9 hàm: `lisGatewayStatusText` (dòng 19) · `lisRejectResult` (dòng 82) · `lisGatewayStart` (dòng 93) · `lisGatewaySaveSettings` (dòng 99) · `lisRenderQueueModal` (dòng 147) · `lisOpenQueueModal` (dòng 155) · `lisQueueRefresh` (dòng 161) · `lisQueueImport` (dòng 162) · `lisQueueReject` (dòng 163)
- **modules/state.js** — 12 hàm: `staffInitials` (dòng 259) · `currentStaff` (dòng 260) · `pointStaff` (dòng 261) · `dateObj` (dòng 262) · `daysToExp` (dòng 263) · `periodOfDate` (dòng 310) · `periodLock` (dòng 311) · `isPeriodLocked` (dòng 312) · `periodLockText` (dòng 313) · `requireUnlockedPeriod` (dòng 314) …
- **modules/action-workflow-service.js** — 1 hàm: `actionEventDate` (dòng 249)
- **core.js** — 6 hàm: `isOn` (dòng 170) · `isOn` (dòng 199) · `isOn` (dòng 246) · `isOn` (dòng 256) · `isOn` (dòng 282) · `isOn` (dòng 289)
- **modules/entry-service.js** — 1 hàm: `pointRunNoFor` (dòng 32)
- **modules/audit.js** — 3 hàm: `auditChainSignature` (dòng 150) · `auditChainStatus` (dòng 154) · `auditVerifyChainNow` (dòng 163)
- **modules/local-store.js** — 6 hàm: `request.onerror` (dòng 14) · `request.onblocked` (dòng 15) · `request.onerror` (dòng 24) · `request.onerror` (dòng 32) · `request.onerror` (dòng 80) · `request.onerror` (dòng 88)
- **workers/westgard-worker.js** — 1 hàm: `pointRunNo` (dòng 25)
