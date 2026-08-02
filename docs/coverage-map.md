# Bản đồ điểm mù của bộ test

Sinh bằng `npm run coverage-map` (`NODE_V8_COVERAGE` của Node, không cài thêm gì).
**Không phải cổng chặn** — không có ngưỡng nào, đây là bản đồ để quyết định viết test
hoặc tách file. Phần dựng DOM của các file render không gọi được trong sandbox `vm`,
nên độ phủ thấp ở đó là đúng thiết kế; thứ đáng nhìn là **hàm thuần chưa ai chạm tới**.

Sinh ngày 2026-08-02 · Node v26.4.0 · 47 file · 42.5% mã nguồn đã chạy.

## 8 file KHÔNG test nào nạp tới

Không phải "độ phủ thấp" mà là **không có dữ liệu độ phủ nào** — chưa test nào
nạp file này vào sandbox. Với file render thuần DOM thì đó là giới hạn của
sandbox `vm`; với file có hàm thuần thì đây là điểm mù thật.

- `modules/action-form.js` (57.7 KB)
- `modules/actions-routes.js` (39.9 KB)
- `modules/manage-routes.js` (36.9 KB)
- `modules/report-routes.js` (12.1 KB)
- `modules/modals.js` (7.9 KB)
- `modules/after-render.js` (5.0 KB)
- `modules/app-meta.js` (1.3 KB)
- `app.js` (0.3 KB)

## Toàn bộ file

| File | KB | % mã đã chạy | Ký tự chưa chạy | Hàm chưa từng chạy |
|---|---:|---:|---:|---:|
| `modules/action-form.js` | 57.7 | chưa nạp | 53.928 | — |
| `modules/sigma.js` | 75.0 | 26.9% | 53.320 | 49 |
| `modules/entry-tests-actions.js` | 67.9 | 20.5% | 51.771 | 43 |
| `modules/entry-routes.js` | 46.7 | 5.6% | 43.436 | 33 |
| `modules/actions-routes.js` | 39.9 | chưa nạp | 37.517 | — |
| `modules/manage-routes.js` | 36.9 | chưa nạp | 35.931 | — |
| `modules/reagent.js` | 35.6 | 12.1% | 30.709 | 49 |
| `modules/users-auth.js` | 37.1 | 20.5% | 27.962 | 35 |
| `modules/data-io.js` | 74.5 | 73.4% | 19.546 | 17 |
| `modules/reports.js` | 37.7 | 49.6% | 18.315 | 3 |
| `modules/westgard-routes.js` | 21.5 | 10.9% | 18.284 | 20 |
| `modules/router-render.js` | 20.9 | 19.2% | 16.834 | 50 |
| `modules/settings.js` | 19.3 | 13.3% | 16.151 | 13 |
| `modules/dashboard-routes.js` | 12.3 | 0.4% | 11.855 | 4 |
| `modules/draw.js` | 17.4 | 33.2% | 11.744 | 7 |
| `modules/report-routes.js` | 12.1 | chưa nạp | 11.607 | — |
| `modules/range.js` | 9.8 | 12.7% | 8.206 | 5 |
| `modules/modals.js` | 7.9 | chưa nạp | 7.899 | — |
| `modules/qc-domain.js` | 28.6 | 73.0% | 7.542 | 27 |
| `modules/backup-service.js` | 14.6 | 54.0% | 6.267 | 9 |
| `modules/firebase-sync.js` | 31.6 | 80.6% | 5.614 | 5 |
| `modules/lis-client-service.js` | 15.5 | 63.8% | 5.289 | 9 |
| `modules/after-render.js` | 5.0 | chưa nạp | 5.014 | — |
| `modules/state.js` | 30.9 | 83.3% | 4.997 | 12 |
| `modules/state-storage.js` | 17.5 | 80.5% | 3.288 | 0 |
| `modules/action-workflow-service.js` | 29.7 | 88.9% | 3.180 | 1 |
| `core.js` | 58.2 | 95.4% | 2.625 | 6 |
| `modules/entry-service.js` | 13.4 | 91.1% | 1.208 | 2 |
| `modules/app-meta.js` | 1.3 | chưa nạp | 1.188 | — |
| `modules/sigma-tea.js` | 12.0 | 90.4% | 1.122 | 0 |
| `modules/qc-rules.js` | 3.5 | 74.3% | 818 | 0 |
| `modules/audit.js` | 10.9 | 92.2% | 810 | 3 |
| `workers/westgard-worker.js` | 3.4 | 77.3% | 778 | 2 |
| `modules/local-store.js` | 6.0 | 91.2% | 542 | 6 |
| `modules/reagent-comparison-service.js` | 5.8 | 92.2% | 462 | 0 |
| `app.js` | 0.3 | chưa nạp | 277 | — |
| `modules/sigma-cohort-service.js` | 4.4 | 96.0% | 179 | 0 |
| `modules/period-service.js` | 2.7 | 94.0% | 160 | 0 |
| `modules/westgard-view-model.js` | 3.2 | 95.2% | 157 | 0 |
| `modules/chart-view-model.js` | 2.5 | 96.1% | 97 | 0 |
| `modules/analysis-ui-state.js` | 0.5 | 99.1% | 5 | 0 |
| `modules/auth-ui-state.js` | 0.3 | 98.5% | 5 | 0 |
| `modules/entry-ui-state.js` | 0.6 | 99.2% | 5 | 0 |
| `modules/manage-ui-state.js` | 0.5 | 99.0% | 5 | 0 |
| `modules/reagent-ui-state.js` | 0.4 | 98.6% | 5 | 0 |
| `modules/sigma-ui-state.js` | 0.4 | 98.7% | 5 | 0 |
| `modules/analyte-catalog.js` | 12.0 | 100.0% | 3 | 0 |

## Hàm chưa từng chạy (10 hàm đầu mỗi file, theo thứ tự xuất hiện)

- **modules/sigma.js** — 49 hàm: `sgFmtDPMO` (dòng 9) · `sgInputValue` (dòng 12) · `sgRows` (dòng 52) · `sgReconcileAllTeaSnapshots` (dòng 68) · `sgSetTeaSource` (dòng 74) · `sgSetTeaMeta` (dòng 75) · `sgRefreshSoon` (dòng 84) · `sgTrackedOptions` (dòng 86) · `sgPickTest` (dòng 106) · `sgStatusPeriodId` (dòng 107) …
- **modules/entry-tests-actions.js** — 43 hàm: `validIsoDate` (dòng 2) · `setManageTab` (dòng 4) · `setTargetPanel` (dòng 5) · `setTargetGroup` (dòng 6) · `setTargetLevel` (dòng 7) · `setHistoryTest` (dòng 8) · `openTargetMatrix` (dòng 9) · `targetNumberText` (dòng 10) · `targetConfigAssigned` (dòng 11) · `targetRangeDraft` (dòng 14) …
- **modules/entry-routes.js** — 33 hàm: `entryWindowFor` (dòng 2) · `entryWindow` (dòng 3) · `entryToggleRows` (dòng 7) · `pageEntry` (dòng 15) · `entryRestoreTreeNode` (dòng 171) · `treeToggle` (dòng 172) · `entryFilter` (dòng 181) · `entrySetMachine` (dòng 206) · `entryPick` (dòng 207) · `entryFocusLevel` (dòng 208) …
- **modules/reagent.js** — 49 hàm: `rcLabel` (dòng 6) · `rcAct` (dòng 7) · `rcSaveSoon` (dòng 8) · `rcPairCalc` (dòng 23) · `rcAxis` (dòng 37) · `rcPadr` (dòng 46) · `rcToolIcon` (dòng 47) · `rcMiniIcon` (dòng 56) · `rcScatterSVG` (dòng 60) · `rcBlandSVG` (dòng 66) …
- **modules/users-auth.js** — 35 hàm: `pageUsers` (dòng 2) · `auditSetQuery` (dòng 45) · `auditSetPageSize` (dòng 55) · `auditSetPage` (dòng 58) · `auditClearFilters` (dòng 61) · `activityCSVRows` (dòng 91) · `exportActivityCSV` (dòng 92) · `clearActivityLog` (dòng 97) · `archiveActivityLog` (dòng 113) · `confirmArchiveActivityLog` (dòng 126) …
- **modules/data-io.js** — 17 hàm: `csvCell` (dòng 5) · `downloadCSV` (dòng 11) · `exportMetaRows` (dòng 12) · `reportPrevLotRows` (dòng 28) · `reportRows` (dòng 89) · `exportReportCSV` (dòng 90) · `downloadBlob` (dòng 100) · `sigmaCanvas` (dòng 117) · `drawSigmaReportChart` (dòng 118) · `drawSigmaReportMDC` (dòng 163) …
- **modules/reports.js** — 3 hàm: `openPrint` (dòng 15) · `printReport` (dòng 176) · `printRangeForm` (dòng 224)
- **modules/westgard-routes.js** — 20 hàm: `wgMultiViews` (dòng 2) · `wgTogglePrevLot` (dòng 8) · `wgArchivedGroups` (dòng 13) · `wgSetViewMode` (dòng 14) · `wgSetChartMode` (dòng 15) · `wgChartModeTabs` (dòng 16) · `pageWestgardCusum` (dòng 23) · `wgSetArchivedGroup` (dòng 37) · `wgSetArchivedTest` (dòng 38) · `wgViewModeTabs` (dòng 39) …
- **modules/router-render.js** — 50 hàm: `role` (dòng 5) · `canWrite` (dòng 6) · `requireWrite` (dòng 13) · `requireAdmin` (dòng 14) · `roleLabel` (dòng 15) · `rolePageIds` (dòng 16) · `userPageIds` (dòng 17) · `setSearchCount` (dòng 22) · `showSearchEmpty` (dòng 23) · `liveRowFilter` (dòng 31) …
- **modules/settings.js** — 13 hàm: `saveLab` (dòng 5) · `saveBrand` (dòng 13) · `readBrandInputs` (dòng 21) · `pickLogo` (dòng 28) · `clearLogo` (dòng 46) · `firebaseAclHelp` (dòng 47) · `saveFb` (dòng 52) · `parseFirebaseConfig` (dòng 80) · `validateFirebaseConfig` (dòng 95) · `clearFb` (dòng 101) …
- **modules/dashboard-routes.js** — 4 hàm: `pageDash` (dòng 2) · `dashTestFilter` (dòng 85) · `dashTestSetStatus` (dòng 89) · `pageDashLoading` (dòng 93)
- **modules/draw.js** — 7 hàm: `drawRuleAcross` (dòng 3) · `qcTooltip` (dòng 4) · `hide` (dòng 7) · `ljDataURL` (dòng 123) · `drawLJMultiZ` (dòng 126) · `ljMultiDataURL` (dòng 197) · `drawCUSUM` (dòng 205)
- **modules/range.js** — 5 hàm: `openRangeWorkflow` (dòng 11) · `applyNewRange` (dòng 27) · `confirmApplyNewRange` (dòng 43) · `revertRange` (dòng 56) · `confirmRevertRange` (dòng 69)
- **modules/qc-domain.js** — 27 hàm: `reportLevelStats` (dòng 6) · `wgSet` (dòng 11) · `wgReset` (dòng 12) · `testRuleOn` (dòng 20) · `defaultRuleScope` (dòng 21) · `testRuleOnAcross` (dòng 25) · `westgard` (dòng 28) · `westgardMulti` (dòng 29) · `westgardByPoint` (dòng 30) · `westgardMultiByPoint` (dòng 31) …
- **modules/backup-service.js** — 9 hàm: `downloadBackupText` (dòng 61) · `importData` (dòng 73) · `verifyBackupFile` (dòng 93) · `markBackupDone` (dòng 97) · `lastBackupInfo` (dòng 98) · `backupStatusText` (dòng 104) · `backupCapacityText` (dòng 111) · `backupOverdue` (dòng 112) · `updateBackupBanner` (dòng 113)
- **modules/firebase-sync.js** — 5 hàm: `fbStartPull` (dòng 233) · `fbPullOnce` (dòng 246) · `initFirebase` (dòng 362) · `remoteRenderUnsafe` (dòng 395) · `syncNow` (dòng 415)
- **modules/lis-client-service.js** — 9 hàm: `lisGatewayStatusText` (dòng 19) · `lisRejectResult` (dòng 82) · `lisGatewayStart` (dòng 93) · `lisGatewaySaveSettings` (dòng 99) · `lisRenderQueueModal` (dòng 147) · `lisOpenQueueModal` (dòng 155) · `lisQueueRefresh` (dòng 161) · `lisQueueImport` (dòng 162) · `lisQueueReject` (dòng 163)
- **modules/state.js** — 12 hàm: `staffInitials` (dòng 246) · `currentStaff` (dòng 247) · `pointStaff` (dòng 248) · `dateObj` (dòng 249) · `daysToExp` (dòng 250) · `periodOfDate` (dòng 297) · `periodLock` (dòng 298) · `isPeriodLocked` (dòng 299) · `periodLockText` (dòng 300) · `requireUnlockedPeriod` (dòng 301) …
- **modules/action-workflow-service.js** — 1 hàm: `actionEventDate` (dòng 245)
- **core.js** — 6 hàm: `isOn` (dòng 170) · `isOn` (dòng 199) · `isOn` (dòng 246) · `isOn` (dòng 256) · `isOn` (dòng 282) · `isOn` (dòng 289)
- **modules/entry-service.js** — 2 hàm: `pointRunNoFor` (dòng 32) · `root.nextRunId` (dòng 251)
- **modules/audit.js** — 3 hàm: `auditChainSignature` (dòng 150) · `auditChainStatus` (dòng 154) · `auditVerifyChainNow` (dòng 163)
- **workers/westgard-worker.js** — 2 hàm: `root.onmessage` (dòng 8) · `pointRunNo` (dòng 25)
- **modules/local-store.js** — 6 hàm: `request.onerror` (dòng 14) · `request.onblocked` (dòng 15) · `request.onerror` (dòng 24) · `request.onerror` (dòng 32) · `request.onerror` (dòng 80) · `request.onerror` (dòng 88)
