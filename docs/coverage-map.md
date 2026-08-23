# Bản đồ điểm mù của bộ test

Sinh bằng `npm run coverage-map` (`NODE_V8_COVERAGE` của Node, không cài thêm gì).
**Không phải cổng chặn** — không có ngưỡng nào, đây là bản đồ để quyết định viết test
hoặc tách file, không phải một con số để đuổi.

Sinh ngày 2026-08-23 · Node v26.7.0

## A. `src/**/*.ts` — mã nghiệp vụ thật

Đo trực tiếp từ URL script thật của mỗi tiến trình test import file .ts — không qua sourcemap, không xấp xỉ.

745 file · 24.7% ký tự đã chạy.

**278 file KHÔNG test nào nạp tới** — không phải "độ phủ thấp" mà là không có dữ liệu coverage nào cho file đó:

- `compat/modular-pilot.global.ts` (504.1 KB)
- `presentation/sigma/sigma-page-controller.ts` (70.0 KB)
- `presentation/actions/action-form-controller.ts` (63.9 KB)
- `presentation/manage/manage-tests-actions-controller.ts` (57.2 KB)
- `presentation/entry/entry-page-controller.ts` (52.1 KB)
- `presentation/export/data-io-controller.ts` (43.6 KB)
- `application/manage/manage-config-service.ts` (39.2 KB)
- `presentation/report/report-print-controller.ts` (35.9 KB)
- `presentation/manage/manage-page-controller.ts` (33.8 KB)
- `presentation/actions/actions-page-controller.ts` (32.4 KB)
- `presentation/reagent/reagent-page-controller.ts` (20.1 KB)
- `presentation/westgard/westgard-page-controller.ts` (17.4 KB)
- `presentation/chart/qc-chart-renderer.ts` (15.2 KB)
- `domain/sigma/sigma-tea-resolution.ts` (15.7 KB)
- `application/entry/entry-service.ts` (14.6 KB)
- `domain/nce/action-protocol-service.ts` (14.7 KB)
- `presentation/report/report-page-controller.ts` (9.2 KB)
- `application/lis/lis-client-service.ts` (9.1 KB)
- `presentation/settings/settings-page-controller.ts` (8.6 KB)
- `application/reagent/reagent-comparison-service.ts` (8.4 KB)
- `domain/sigma/sigma-cohort-service.ts` (6.7 KB)
- `presentation/dashboard/dashboard-page-controller.ts` (6.6 KB)
- `presentation/router/vn-date-picker-controller.ts` (6.1 KB)
- `application/backup/backup-service.ts` (6.2 KB)
- `presentation/nce/action-form-steps-html.ts` (6.4 KB)
- `domain/westgard/westgard-view-model.ts` (5.3 KB)
- `application/nce/action-review-service.ts` (5.3 KB)
- `presentation/lis/lis-queue-controller.ts` (5.2 KB)
- `workers/westgard-worker.ts` (5.2 KB)
- `presentation/modal/dialog-overlay-controller.ts` (4.9 KB)
- `application/state/test-configuration-normalization.ts` (4.4 KB)
- `application/audit/audit-service.ts` (4.2 KB)
- `presentation/report/report-xlsx-builder.ts` (4.0 KB)
- `application/nce/action-rerun-service.ts` (4.0 KB)
- `presentation/sigma/sigma-chart-renderer.ts` (3.8 KB)
- `presentation/router/router-icons.ts` (3.9 KB)
- `domain/qc/qc-point-warnings.ts` (4.0 KB)
- `presentation/render/after-render-controller.ts` (3.7 KB)
- `domain/sigma/sigma-period-view-model.ts` (3.6 KB)
- `presentation/nce/action-report-model.ts` (3.6 KB)
- `domain/charts/chart-view-model.ts` (3.3 KB)
- `presentation/report/qc-report-csv-rows.ts` (3.4 KB)
- `presentation/sigma/sigma-mdc-renderer.ts` (3.2 KB)
- `application/sigma/sigma-cohort-import-service.ts` (3.0 KB)
- `application/period/period-service.ts` (3.0 KB)
- `domain/sigma/sigma-bias-service.ts` (2.9 KB)
- `application/state/configuration-relations.ts` (2.8 KB)
- `presentation/report/qc-report-rows.ts` (2.7 KB)
- `presentation/shared/ui-primitives.ts` (2.7 KB)
- `domain/sigma/sigma-presentation.ts` (2.7 KB)
- `presentation/report/report-xlsx-styles.ts` (2.5 KB)
- `application/nce/action-escalation-service.ts` (2.5 KB)
- `presentation/router/live-row-filter.ts` (2.4 KB)
- `presentation/sigma/sigma-xlsx-styles.ts` (2.4 KB)
- `domain/nce/action-workflow-status.ts` (2.5 KB)
- `presentation/modal/modal-controller.ts` (2.3 KB)
- `presentation/state/ui-state.ts` (2.3 KB)
- `presentation/router/router-dispatch-controller.ts` (2.3 KB)
- `domain/nce/action-bias-service.ts` (2.2 KB)
- `domain/auth/pbkdf2-password-service.ts` (2.2 KB)
- `domain/qc/level-reconciliation.ts` (2.2 KB)
- `domain/tea/analyte-meta.ts` (2.1 KB)
- `domain/nce/action-approval-gates.ts` (2.1 KB)
- `domain/nce/action-basics.ts` (2.1 KB)
- `presentation/sigma/sigma-print-rows.ts` (2.1 KB)
- `application/storage/partitioned-indexeddb-write-service.ts` (2.1 KB)
- `domain/nce/action-draft-status.ts` (2.1 KB)
- `domain/nce/action-rerun-evaluator.ts` (2.1 KB)
- `domain/nce/action-violation-service.ts` (2.0 KB)
- `presentation/nce/action-csv-row.ts` (1.9 KB)
- `presentation/app/app-bootstrap.ts` (2.0 KB)
- `domain/sigma/sigma-level-selection-service.ts` (1.9 KB)
- `presentation/export/xlsx-zip.ts` (1.8 KB)
- `domain/qc/range-candidate.ts` (1.8 KB)
- `domain/qc/value-format.ts` (1.8 KB)
- `presentation/sigma/sigma-mu-print-rows.ts` (1.8 KB)
- `presentation/report/report-xlsx-sheet.ts` (1.8 KB)
- `domain/qc/date-format.ts` (1.7 KB)
- `application/sigma/sigma-tea-snapshot-service.ts` (1.7 KB)
- `application/storage/indexeddb-recovery-service.ts` (1.7 KB)
- `presentation/nce/action-evidence-presentation.ts` (1.7 KB)
- `presentation/nce/action-detail-presentation.ts` (1.7 KB)
- `application/storage/storage-boot-service.ts` (1.6 KB)
- `application/storage/partitioned-snapshot-writer.ts` (1.6 KB)
- `presentation/router/router-page-policy.ts` (1.6 KB)
- `domain/qc/lot-target.ts` (1.5 KB)
- `presentation/sigma/sigma-report-rows.ts` (1.5 KB)
- `application/sigma/sigma-cohort-selection-service.ts` (1.5 KB)
- `domain/auth/login-lockout-policy.ts` (1.5 KB)
- `presentation/modal/modal-template.ts` (1.5 KB)
- `application/sigma/sigma-mu-workflow-service.ts` (1.5 KB)
- `domain/nce/action-labels.ts` (1.6 KB)
- `presentation/router/router-permission.ts` (1.4 KB)
- `presentation/manage/lot-transition-picker-service.ts` (1.4 KB)
- `presentation/nce/action-list-presentation.ts` (1.4 KB)
- `application/storage/indexeddb-open-service.ts` (1.4 KB)
- `presentation/sigma/sigma-mdc-label-placement.ts` (1.4 KB)
- `presentation/report/report-points-table.ts` (1.4 KB)
- `application/sync/firebase-merge-commit-service.ts` (1.3 KB)
- `presentation/nce/action-guide-presentation.ts` (1.6 KB)
- `application/storage/partitioned-indexeddb-read-service.ts` (1.3 KB)
- `domain/westgard/worker-hydrate.ts` (1.3 KB)
- `presentation/audit/activity-audit-filter.ts` (1.3 KB)
- `application/settings/settings-firebase-command.ts` (1.3 KB)
- `application/sigma/sigma-tea-edit-service.ts` (1.3 KB)
- `presentation/nce/action-rerun-evidence-presentation.ts` (1.3 KB)
- `application/storage/sigma-draft-service.ts` (1.3 KB)
- `application/sync/firebase-session-start-service.ts` (1.2 KB)
- `presentation/nce/action-bias-presentation.ts` (1.4 KB)
- `application/nce/action-identity-service.ts` (1.2 KB)
- `application/storage/indexeddb-record-service.ts` (1.2 KB)
- `application/storage/local-partition-transaction.ts` (1.2 KB)
- `application/sigma/sigma-level-edit-service.ts` (1.2 KB)
- `application/storage/save-command-policy.ts` (1.2 KB)
- `presentation/nce/action-status-presentation.ts` (1.2 KB)
- `presentation/export/xlsx-drawing.ts` (1.2 KB)
- `presentation/report/report-xlsx-drawing.ts` (1.1 KB)
- `domain/qc/lot-target-history.ts` (1.1 KB)
- `domain/qc/operational-access.ts` (1.1 KB)
- `application/sigma/sigma-period-record-service.ts` (1.1 KB)
- `application/sync/firebase-push-service.ts` (1.1 KB)
- `domain/nce/action-qc-link.ts` (1.1 KB)
- `presentation/report/export-helpers.ts` (1.1 KB)
- `application/manage/manage-instrument-command.ts` (1.1 KB)
- `domain/sync/array-merge.ts` (1.0 KB)
- `application/manage/manage-panel-command.ts` (1.0 KB)
- `presentation/nce/action-review-presentation.ts` (1.0 KB)
- `application/sigma/sigma-bias-workflow-service.ts` (1.0 KB)
- `presentation/audit/activity-audit-filter-state.ts` (1.0 KB)
- `presentation/nce/action-form-panel-html.ts` (1.0 KB)
- `application/state/blank-app-state.ts` (1.0 KB)
- `presentation/modal/modal-focus-trap.ts` (1.0 KB)
- `domain/auth/legacy-password-hash-service.ts` (1.0 KB)
- `application/sigma/sigma-tracked-test-service.ts` (1.0 KB)
- `domain/sync/update-payload.ts` (1.0 KB)
- `application/nce/action-point-index-service.ts` (0.9 KB)
- `domain/nce/action-rerun-policy.ts` (0.9 KB)
- `application/sync/firebase-full-sync-service.ts` (0.9 KB)
- `application/storage/partition-hydration-service.ts` (0.9 KB)
- `application/qc/point-cache-service.ts` (0.9 KB)
- `application/sync/firebase-empty-snapshot-service.ts` (0.9 KB)
- `domain/qc/run-id-normalizer.ts` (0.9 KB)
- `application/nce/point-workflow-service.ts` (0.9 KB)
- `application/storage/save-service.ts` (0.9 KB)
- `domain/qc/lot-history-view-model.ts` (0.9 KB)
- `presentation/nce/action-investigation-presentation.ts` (0.9 KB)
- `presentation/report/report-period-presentation.ts` (0.9 KB)
- `domain/qc/point-void-verdict.ts` (0.9 KB)
- `presentation/sigma/rename-xlsx-sheet.ts` (0.9 KB)
- `application/sync/firebase-app-service.ts` (0.8 KB)
- `application/sync/firebase-config-source-service.ts` (0.8 KB)
- `presentation/sigma/sigma-export-meta.ts` (0.8 KB)
- `presentation/audit/activity-audit-csv.ts` (0.8 KB)
- `application/manage/manage-lot-group-command.ts` (0.8 KB)
- `domain/westgard/worker-revision.ts` (0.8 KB)
- `presentation/sigma/sigma-period-selection-service.ts` (0.8 KB)
- `domain/sync/sync-config.ts` (0.8 KB)
- `application/sync/firebase-audit-rejection-service.ts` (0.8 KB)
- `domain/nce/action-qc-index.ts` (0.8 KB)
- `domain/sync/snapshot-compare.ts` (0.8 KB)
- `domain/westgard/rule-policy.ts` (0.8 KB)
- `application/storage/local-storage-load-service.ts` (0.8 KB)
- `domain/qc/active-westgard.ts` (0.8 KB)
- `application/sync/firebase-push-scheduler.ts` (0.7 KB)
- `domain/qc/parallel-lot-lookup.ts` (0.7 KB)
- `presentation/router/date-box-html.ts` (0.7 KB)
- `application/storage/local-storage-snapshot-writer.ts` (0.7 KB)
- `presentation/sigma/sigma-mu-trace.ts` (0.7 KB)
- `presentation/audit/activity-audit-pagination.ts` (0.7 KB)
- `application/storage/indexeddb-clear-service.ts` (0.7 KB)
- `domain/auth/new-user-validation.ts` (0.7 KB)
- `presentation/report/report-selection.ts` (0.7 KB)
- `application/lis/lis-gateway-command.ts` (0.7 KB)
- `presentation/sync/firebase-conflict-dialog-service.ts` (0.8 KB)
- `presentation/range/range-actions-html.ts` (0.7 KB)
- `presentation/shared/js-string-literal.ts` (0.7 KB)
- `application/sync/firebase-remote-render-service.ts` (0.7 KB)
- `presentation/sync/firebase-cloud-status-presentation.ts` (0.7 KB)
- `application/manage/manage-assay-command.ts` (0.7 KB)
- `presentation/sigma/sigma-report-metric.ts` (0.7 KB)
- `domain/sync/state-merge.ts` (0.6 KB)
- `application/sync/firebase-own-snapshot-service.ts` (0.6 KB)
- `domain/westgard/rule-settings.ts` (0.6 KB)
- `domain/qc/staff-identity.ts` (0.6 KB)
- `domain/westgard/worker-job.ts` (0.6 KB)
- `application/storage/indexeddb-mirror-service.ts` (0.6 KB)
- `application/sync/firebase-disconnect-service.ts` (0.6 KB)
- `application/manage/manage-assay-removal-command.ts` (0.6 KB)
- `presentation/report/report-search.ts` (0.6 KB)
- `application/storage/state-adoption-service.ts` (0.6 KB)
- `domain/qc/point-lot-normalizer.ts` (0.6 KB)
- `domain/nce/action-rerun-cache-key.ts` (0.6 KB)
- `presentation/export/csv-download.ts` (0.5 KB)
- `domain/qc/accepted-lot-points.ts` (0.5 KB)
- `application/sync/firebase-local-store-service.ts` (0.5 KB)
- `domain/auth/password-policy.ts` (0.6 KB)
- `application/storage/local-partition-recovery.ts` (0.5 KB)
- `domain/qc/report-level-stats.ts` (0.5 KB)
- `presentation/sigma/sigma-mdc-items.ts` (0.5 KB)
- `presentation/nce/action-report-html.ts` (0.5 KB)
- `presentation/audit/activity-audit-date-range.ts` (0.5 KB)
- `domain/sync/first-connect.ts` (0.5 KB)
- `domain/qc/parallel-westgard.ts` (0.5 KB)
- `domain/sync/retry-scheduler.ts` (0.5 KB)
- `presentation/nce/action-report-summary.ts` (0.5 KB)
- `presentation/sigma/sigma-canvas.ts` (0.5 KB)
- `domain/qc/entry-columns.ts` (0.5 KB)
- `presentation/auth/user-list-model.ts` (0.5 KB)
- `domain/qc/range-limit-repair.ts` (0.5 KB)
- `presentation/report/report-labels.ts` (0.5 KB)
- `presentation/report/export-meta-rows.ts` (0.5 KB)
- `presentation/sync/firebase-save-status-service.ts` (0.4 KB)
- `application/storage/local-clear-keys.ts` (0.4 KB)
- `application/sync/firebase-pull-service.ts` (0.4 KB)
- `domain/westgard/worker-prewarm.ts` (0.4 KB)
- `domain/auth/default-admin-user.ts` (0.4 KB)
- `presentation/export/xlsx-cell.ts` (0.4 KB)
- `presentation/format/basic-format.ts` (0.4 KB)
- `domain/sync/firebase-identity.ts` (0.4 KB)
- `application/sync/firebase-invalid-snapshot-service.ts` (0.4 KB)
- `presentation/audit/activity-audit-archive-window.ts` (0.4 KB)
- `presentation/report/qc-report-context.ts` (0.4 KB)
- `application/manage/target-matrix-command.ts` (0.4 KB)
- `presentation/export/blob-download.ts` (0.4 KB)
- `application/sync/firebase-polling-service.ts` (0.4 KB)
- `presentation/sync/firebase-remote-render-safety-service.ts` (0.4 KB)
- `domain/qc/error-detail.ts` (0.4 KB)
- `domain/qc/lot-lineage.ts` (0.4 KB)
- `domain/sync/value-codec.ts` (0.3 KB)
- `presentation/shared/html-escape.ts` (0.3 KB)
- `domain/auth/user-permission-selection.ts` (0.3 KB)
- `application/storage/local-snapshot-record.ts` (0.3 KB)
- `domain/qc/planned-target.ts` (0.3 KB)
- `domain/qc/accepted-memo-cache.ts` (0.3 KB)
- `domain/sync/firebase-config-selection.ts` (0.3 KB)
- `domain/qc/cusum-memo-cache.ts` (0.3 KB)
- `domain/sync/firebase-first-connect-plan.ts` (0.3 KB)
- `domain/qc/cusum-config.ts` (0.3 KB)
- `application/storage/local-partition-helpers.ts` (0.3 KB)
- `application/storage/local-partition-validation.ts` (0.3 KB)
- `domain/sync/snapshot-keys.ts` (0.3 KB)
- `application/sync/firebase-merge-application.ts` (0.3 KB)
- `application/storage/save-scheduler.ts` (0.3 KB)
- `domain/sync/snapshot-signature.ts` (0.3 KB)
- `application/storage/partition-write-policy.ts` (0.3 KB)
- `presentation/sigma/data-url-bytes.ts` (0.3 KB)
- `domain/sync/firebase-connection-gate.ts` (0.3 KB)
- `domain/export/csv-cell.ts` (0.3 KB)
- `domain/qc/cusum-series.ts` (0.3 KB)
- `domain/westgard/memo-cache.ts` (0.3 KB)
- `presentation/sigma/sigma-export-pixel-ratio.ts` (0.3 KB)
- `presentation/report/qc-export-value-format.ts` (0.3 KB)
- `application/storage/corrupt-local-quarantine.ts` (0.3 KB)
- `domain/sync/firebase-remote-snapshot.ts` (0.2 KB)
- `domain/sync/firebase-lifecycle-state.ts` (0.2 KB)
- `domain/sync/firebase-empty-snapshot.ts` (0.2 KB)
- `application/storage/derived-save-policy.ts` (0.2 KB)
- `domain/qc/level-target.ts` (0.2 KB)
- `domain/qc/lot-group-status.ts` (0.2 KB)
- `domain/qc/search-text.ts` (0.2 KB)
- `domain/sync/firebase-audit-gate.ts` (0.2 KB)
- `domain/qc/qc-point-run.ts` (0.2 KB)
- `presentation/sigma/canvas-font.ts` (0.2 KB)
- `presentation/style/css-token-pixel.ts` (0.2 KB)
- `domain/sync/firebase-snapshot-gate.ts` (0.2 KB)
- `application/storage/local-recovery-slots.ts` (0.2 KB)
- `presentation/export/xlsx-escape.ts` (0.2 KB)
- `domain/sync/firebase-own-snapshot.ts` (0.2 KB)
- `presentation/export/xlsx-period.ts` (0.2 KB)
- `presentation/export/xlsx-rounding.ts` (0.1 KB)
- `domain/qc/entry-column-points.ts` (0.1 KB)
- `presentation/report/report-xlsx-style-ids.ts` (0.1 KB)
- `application/storage/retry-delay.ts` (0.1 KB)
- `domain/sync/firebase-pull-gate.ts` (0.1 KB)
- `domain/sync/firebase-ready-state.ts` (0.1 KB)
- `presentation/export/xlsx-columns.ts` (0.1 KB)
- `presentation/export/xlsx-utf8.ts` (0.1 KB)
- `presentation/export/xlsx-emu.ts` (0.1 KB)

| File | KB | % đã chạy | Ký tự chưa chạy | Hàm chưa từng chạy |
|---|---:|---:|---:|---:|
| `compat/modular-pilot.global.ts` | 504.1 | chưa nạp | 509.631 | — |
| `presentation/sigma/sigma-page-controller.ts` | 70.0 | chưa nạp | 68.849 | — |
| `presentation/actions/action-form-controller.ts` | 63.9 | chưa nạp | 60.594 | — |
| `presentation/manage/manage-tests-actions-controller.ts` | 57.2 | chưa nạp | 55.306 | — |
| `presentation/entry/entry-page-controller.ts` | 52.1 | chưa nạp | 51.902 | — |
| `presentation/export/data-io-controller.ts` | 43.6 | chưa nạp | 43.231 | — |
| `application/manage/manage-config-service.ts` | 39.2 | chưa nạp | 39.331 | — |
| `presentation/report/report-print-controller.ts` | 35.9 | chưa nạp | 35.290 | — |
| `presentation/manage/manage-page-controller.ts` | 33.8 | chưa nạp | 33.400 | — |
| `presentation/actions/actions-page-controller.ts` | 32.4 | chưa nạp | 31.482 | — |
| `domain/core/qc-core.ts` | 63.7 | 66.7% | 20.635 | 11 |
| `presentation/reagent/reagent-page-controller.ts` | 20.1 | chưa nạp | 20.236 | — |
| `presentation/westgard/westgard-page-controller.ts` | 17.4 | chưa nạp | 17.320 | — |
| `presentation/chart/qc-chart-renderer.ts` | 15.2 | chưa nạp | 15.611 | — |
| `domain/sigma/sigma-tea-resolution.ts` | 15.7 | chưa nạp | 15.558 | — |
| `application/entry/entry-service.ts` | 14.6 | chưa nạp | 14.853 | — |
| `domain/nce/action-protocol-service.ts` | 14.7 | chưa nạp | 14.394 | — |
| `presentation/report/report-page-controller.ts` | 9.2 | chưa nạp | 9.207 | — |
| `application/lis/lis-client-service.ts` | 9.1 | chưa nạp | 9.090 | — |
| `presentation/settings/settings-page-controller.ts` | 8.6 | chưa nạp | 8.616 | — |
| `application/reagent/reagent-comparison-service.ts` | 8.4 | chưa nạp | 8.574 | — |
| `domain/sigma/sigma-cohort-service.ts` | 6.7 | chưa nạp | 6.846 | — |
| `presentation/dashboard/dashboard-page-controller.ts` | 6.6 | chưa nạp | 6.607 | — |
| `presentation/router/vn-date-picker-controller.ts` | 6.1 | chưa nạp | 6.236 | — |
| `application/backup/backup-service.ts` | 6.2 | chưa nạp | 6.171 | — |
| `presentation/nce/action-form-steps-html.ts` | 6.4 | chưa nạp | 6.135 | — |
| `domain/westgard/westgard-view-model.ts` | 5.3 | chưa nạp | 5.475 | — |
| `application/nce/action-review-service.ts` | 5.3 | chưa nạp | 5.473 | — |
| `presentation/lis/lis-queue-controller.ts` | 5.2 | chưa nạp | 5.104 | — |
| `workers/westgard-worker.ts` | 5.2 | chưa nạp | 5.072 | — |
| `presentation/modal/dialog-overlay-controller.ts` | 4.9 | chưa nạp | 4.928 | — |
| `application/state/test-configuration-normalization.ts` | 4.4 | chưa nạp | 4.436 | — |
| `application/audit/audit-service.ts` | 4.2 | chưa nạp | 4.229 | — |
| `presentation/report/report-xlsx-builder.ts` | 4.0 | chưa nạp | 4.074 | — |
| `application/nce/action-rerun-service.ts` | 4.0 | chưa nạp | 4.073 | — |
| `presentation/sigma/sigma-chart-renderer.ts` | 3.8 | chưa nạp | 3.914 | — |
| `presentation/router/router-icons.ts` | 3.9 | chưa nạp | 3.886 | — |
| `domain/qc/qc-point-warnings.ts` | 4.0 | chưa nạp | 3.860 | — |
| `presentation/render/after-render-controller.ts` | 3.7 | chưa nạp | 3.836 | — |
| `domain/sigma/sigma-period-view-model.ts` | 3.6 | chưa nạp | 3.685 | — |
| `presentation/nce/action-report-model.ts` | 3.6 | chưa nạp | 3.503 | — |
| `domain/charts/chart-view-model.ts` | 3.3 | chưa nạp | 3.343 | — |
| `presentation/report/qc-report-csv-rows.ts` | 3.4 | chưa nạp | 3.294 | — |
| `presentation/sigma/sigma-mdc-renderer.ts` | 3.2 | chưa nạp | 3.193 | — |
| `application/sigma/sigma-cohort-import-service.ts` | 3.0 | chưa nạp | 3.087 | — |
| `application/period/period-service.ts` | 3.0 | chưa nạp | 3.053 | — |
| `domain/sigma/sigma-bias-service.ts` | 2.9 | chưa nạp | 3.017 | — |
| `application/state/configuration-relations.ts` | 2.8 | chưa nạp | 2.823 | — |
| `presentation/report/qc-report-rows.ts` | 2.7 | chưa nạp | 2.771 | — |
| `presentation/shared/ui-primitives.ts` | 2.7 | chưa nạp | 2.709 | — |
| `domain/sigma/sigma-presentation.ts` | 2.7 | chưa nạp | 2.582 | — |
| `presentation/report/report-xlsx-styles.ts` | 2.5 | chưa nạp | 2.530 | — |
| `application/nce/action-escalation-service.ts` | 2.5 | chưa nạp | 2.494 | — |
| `presentation/router/live-row-filter.ts` | 2.4 | chưa nạp | 2.489 | — |
| `presentation/sigma/sigma-xlsx-styles.ts` | 2.4 | chưa nạp | 2.474 | — |
| `domain/nce/action-workflow-status.ts` | 2.5 | chưa nạp | 2.471 | — |
| `presentation/modal/modal-controller.ts` | 2.3 | chưa nạp | 2.346 | — |
| `presentation/state/ui-state.ts` | 2.3 | chưa nạp | 2.315 | — |
| `presentation/router/router-dispatch-controller.ts` | 2.3 | chưa nạp | 2.296 | — |
| `domain/nce/action-bias-service.ts` | 2.2 | chưa nạp | 2.285 | — |
| `domain/auth/pbkdf2-password-service.ts` | 2.2 | chưa nạp | 2.283 | — |
| `domain/qc/level-reconciliation.ts` | 2.2 | chưa nạp | 2.230 | — |
| `domain/tea/analyte-meta.ts` | 2.1 | chưa nạp | 2.182 | — |
| `domain/nce/action-approval-gates.ts` | 2.1 | chưa nạp | 2.167 | — |
| `domain/nce/action-basics.ts` | 2.1 | chưa nạp | 2.152 | — |
| `presentation/sigma/sigma-print-rows.ts` | 2.1 | chưa nạp | 2.128 | — |
| `application/storage/partitioned-indexeddb-write-service.ts` | 2.1 | chưa nạp | 2.122 | — |
| `domain/nce/action-draft-status.ts` | 2.1 | chưa nạp | 2.048 | — |
| `domain/nce/action-rerun-evaluator.ts` | 2.1 | chưa nạp | 2.041 | — |
| `domain/nce/action-violation-service.ts` | 2.0 | chưa nạp | 2.034 | — |
| `presentation/nce/action-csv-row.ts` | 1.9 | chưa nạp | 1.941 | — |
| `presentation/app/app-bootstrap.ts` | 2.0 | chưa nạp | 1.926 | — |
| `domain/sigma/sigma-level-selection-service.ts` | 1.9 | chưa nạp | 1.907 | — |
| `presentation/export/xlsx-zip.ts` | 1.8 | chưa nạp | 1.890 | — |
| `domain/qc/range-candidate.ts` | 1.8 | chưa nạp | 1.862 | — |
| `domain/qc/value-format.ts` | 1.8 | chưa nạp | 1.841 | — |
| `presentation/sigma/sigma-mu-print-rows.ts` | 1.8 | chưa nạp | 1.833 | — |
| `presentation/report/report-xlsx-sheet.ts` | 1.8 | chưa nạp | 1.815 | — |
| `domain/qc/date-format.ts` | 1.7 | chưa nạp | 1.761 | — |
| `application/sigma/sigma-tea-snapshot-service.ts` | 1.7 | chưa nạp | 1.759 | — |
| `application/storage/indexeddb-recovery-service.ts` | 1.7 | chưa nạp | 1.723 | — |
| `presentation/nce/action-evidence-presentation.ts` | 1.7 | chưa nạp | 1.686 | — |
| `presentation/nce/action-detail-presentation.ts` | 1.7 | chưa nạp | 1.683 | — |
| `application/storage/storage-boot-service.ts` | 1.6 | chưa nạp | 1.653 | — |
| `application/storage/partitioned-snapshot-writer.ts` | 1.6 | chưa nạp | 1.630 | — |
| `presentation/router/router-page-policy.ts` | 1.6 | chưa nạp | 1.599 | — |
| `domain/qc/lot-target.ts` | 1.5 | chưa nạp | 1.557 | — |
| `presentation/sigma/sigma-report-rows.ts` | 1.5 | chưa nạp | 1.537 | — |
| `application/sigma/sigma-cohort-selection-service.ts` | 1.5 | chưa nạp | 1.527 | — |
| `domain/auth/login-lockout-policy.ts` | 1.5 | chưa nạp | 1.513 | — |
| `presentation/modal/modal-template.ts` | 1.5 | chưa nạp | 1.498 | — |
| `application/sigma/sigma-mu-workflow-service.ts` | 1.5 | chưa nạp | 1.493 | — |
| `domain/nce/action-labels.ts` | 1.6 | chưa nạp | 1.472 | — |
| `presentation/router/router-permission.ts` | 1.4 | chưa nạp | 1.423 | — |
| `presentation/manage/lot-transition-picker-service.ts` | 1.4 | chưa nạp | 1.417 | — |
| `presentation/nce/action-list-presentation.ts` | 1.4 | chưa nạp | 1.405 | — |
| `presentation/router/router-shell-controller.ts` | 2.8 | 50.0% | 1.404 | 9 |
| `application/storage/indexeddb-open-service.ts` | 1.4 | chưa nạp | 1.398 | — |
| `presentation/sigma/sigma-mdc-label-placement.ts` | 1.4 | chưa nạp | 1.387 | — |
| `presentation/report/report-points-table.ts` | 1.4 | chưa nạp | 1.356 | — |
| `application/sync/firebase-merge-commit-service.ts` | 1.3 | chưa nạp | 1.350 | — |
| `presentation/nce/action-guide-presentation.ts` | 1.6 | chưa nạp | 1.349 | — |
| `application/storage/partitioned-indexeddb-read-service.ts` | 1.3 | chưa nạp | 1.342 | — |
| `domain/westgard/worker-hydrate.ts` | 1.3 | chưa nạp | 1.328 | — |
| `presentation/audit/activity-audit-filter.ts` | 1.3 | chưa nạp | 1.325 | — |
| `application/settings/settings-firebase-command.ts` | 1.3 | chưa nạp | 1.319 | — |
| `application/sigma/sigma-tea-edit-service.ts` | 1.3 | chưa nạp | 1.316 | — |
| `presentation/nce/action-rerun-evidence-presentation.ts` | 1.3 | chưa nạp | 1.316 | — |
| `application/storage/sigma-draft-service.ts` | 1.3 | chưa nạp | 1.310 | — |
| `application/sync/firebase-session-start-service.ts` | 1.2 | chưa nạp | 1.271 | — |
| `presentation/nce/action-bias-presentation.ts` | 1.4 | chưa nạp | 1.249 | — |
| `application/nce/action-identity-service.ts` | 1.2 | chưa nạp | 1.224 | — |
| `presentation/nce/action-review-messages.ts` | 2.9 | 52.3% | 1.220 | 0 |
| `application/storage/indexeddb-record-service.ts` | 1.2 | chưa nạp | 1.219 | — |
| `application/storage/local-partition-transaction.ts` | 1.2 | chưa nạp | 1.210 | — |
| `application/sigma/sigma-level-edit-service.ts` | 1.2 | chưa nạp | 1.201 | — |
| `domain/qc/derived-index.ts` | 2.8 | 57.8% | 1.192 | 0 |
| `application/storage/save-command-policy.ts` | 1.2 | chưa nạp | 1.190 | — |
| `presentation/nce/action-status-presentation.ts` | 1.2 | chưa nạp | 1.189 | — |
| `presentation/export/xlsx-drawing.ts` | 1.2 | chưa nạp | 1.182 | — |
| `presentation/report/report-xlsx-drawing.ts` | 1.1 | chưa nạp | 1.169 | — |
| `domain/qc/lot-target-history.ts` | 1.1 | chưa nạp | 1.160 | — |
| `domain/qc/operational-access.ts` | 1.1 | chưa nạp | 1.140 | — |
| `application/sigma/sigma-period-record-service.ts` | 1.1 | chưa nạp | 1.139 | — |
| `application/sync/firebase-push-service.ts` | 1.1 | chưa nạp | 1.099 | — |
| `domain/nce/action-qc-link.ts` | 1.1 | chưa nạp | 1.094 | — |
| `presentation/report/export-helpers.ts` | 1.1 | chưa nạp | 1.088 | — |
| `application/manage/manage-instrument-command.ts` | 1.1 | chưa nạp | 1.054 | — |
| `domain/sync/array-merge.ts` | 1.0 | chưa nạp | 1.052 | — |
| `application/manage/manage-panel-command.ts` | 1.0 | chưa nạp | 1.050 | — |
| `presentation/nce/action-review-presentation.ts` | 1.0 | chưa nạp | 1.045 | — |
| `application/sigma/sigma-bias-workflow-service.ts` | 1.0 | chưa nạp | 1.031 | — |
| `presentation/audit/activity-audit-filter-state.ts` | 1.0 | chưa nạp | 1.027 | — |
| `presentation/nce/action-form-panel-html.ts` | 1.0 | chưa nạp | 1.017 | — |
| `application/nce/nce-lifecycle-command.ts` | 3.4 | 70.6% | 1.016 | 0 |
| `application/state/blank-app-state.ts` | 1.0 | chưa nạp | 1.014 | — |
| `presentation/modal/modal-focus-trap.ts` | 1.0 | chưa nạp | 1.008 | — |
| `domain/auth/legacy-password-hash-service.ts` | 1.0 | chưa nạp | 1.000 | — |
| `application/sigma/sigma-tracked-test-service.ts` | 1.0 | chưa nạp | 999 | — |
| `application/nce/nce-form-command.ts` | 3.7 | 72.0% | 997 | 0 |
| `domain/sync/update-payload.ts` | 1.0 | chưa nạp | 975 | — |
| `application/nce/action-point-index-service.ts` | 0.9 | chưa nạp | 963 | — |
| `domain/nce/action-rerun-policy.ts` | 0.9 | chưa nạp | 939 | — |
| `application/sync/firebase-full-sync-service.ts` | 0.9 | chưa nạp | 923 | — |
| `application/storage/partition-hydration-service.ts` | 0.9 | chưa nạp | 913 | — |
| `application/qc/point-cache-service.ts` | 0.9 | chưa nạp | 911 | — |
| `application/sync/firebase-empty-snapshot-service.ts` | 0.9 | chưa nạp | 909 | — |
| `domain/qc/run-id-normalizer.ts` | 0.9 | chưa nạp | 903 | — |
| `application/nce/point-workflow-service.ts` | 0.9 | chưa nạp | 901 | — |
| `application/storage/save-service.ts` | 0.9 | chưa nạp | 901 | — |
| `domain/qc/lot-history-view-model.ts` | 0.9 | chưa nạp | 899 | — |
| `presentation/nce/action-investigation-presentation.ts` | 0.9 | chưa nạp | 898 | — |
| `presentation/report/report-period-presentation.ts` | 0.9 | chưa nạp | 893 | — |
| `domain/qc/point-void-verdict.ts` | 0.9 | chưa nạp | 891 | — |
| `presentation/sigma/rename-xlsx-sheet.ts` | 0.9 | chưa nạp | 886 | — |
| `presentation/reagent/reagent-result-html.ts` | 6.2 | 85.0% | 871 | 0 |
| `application/sync/firebase-app-service.ts` | 0.8 | chưa nạp | 857 | — |
| `application/sync/firebase-config-source-service.ts` | 0.8 | chưa nạp | 853 | — |
| `presentation/sigma/sigma-export-meta.ts` | 0.8 | chưa nạp | 846 | — |
| `presentation/audit/activity-audit-csv.ts` | 0.8 | chưa nạp | 831 | — |
| `application/manage/manage-lot-group-command.ts` | 0.8 | chưa nạp | 827 | — |
| `domain/westgard/worker-revision.ts` | 0.8 | chưa nạp | 826 | — |
| `presentation/sigma/sigma-period-selection-service.ts` | 0.8 | chưa nạp | 821 | — |
| `domain/sync/sync-config.ts` | 0.8 | chưa nạp | 809 | — |
| `application/sync/firebase-audit-rejection-service.ts` | 0.8 | chưa nạp | 799 | — |
| `domain/nce/action-qc-index.ts` | 0.8 | chưa nạp | 792 | — |
| `domain/sync/snapshot-compare.ts` | 0.8 | chưa nạp | 791 | — |
| `domain/westgard/rule-policy.ts` | 0.8 | chưa nạp | 791 | — |
| `application/storage/local-storage-load-service.ts` | 0.8 | chưa nạp | 784 | — |
| `domain/qc/active-westgard.ts` | 0.8 | chưa nạp | 777 | — |
| `application/sync/firebase-push-scheduler.ts` | 0.7 | chưa nạp | 765 | — |
| `domain/qc/parallel-lot-lookup.ts` | 0.7 | chưa nạp | 765 | — |
| `presentation/router/date-box-html.ts` | 0.7 | chưa nạp | 759 | — |
| `application/storage/local-storage-snapshot-writer.ts` | 0.7 | chưa nạp | 757 | — |
| `presentation/sigma/sigma-mu-trace.ts` | 0.7 | chưa nạp | 748 | — |
| `presentation/audit/activity-audit-pagination.ts` | 0.7 | chưa nạp | 746 | — |
| `application/storage/indexeddb-clear-service.ts` | 0.7 | chưa nạp | 740 | — |
| `domain/auth/new-user-validation.ts` | 0.7 | chưa nạp | 735 | — |
| `presentation/report/report-selection.ts` | 0.7 | chưa nạp | 732 | — |
| `application/state/derived-cache-invalidation.ts` | 2.1 | 66.9% | 728 | 2 |
| `application/lis/lis-gateway-command.ts` | 0.7 | chưa nạp | 725 | — |
| `presentation/sync/firebase-conflict-dialog-service.ts` | 0.8 | chưa nạp | 724 | — |
| `presentation/range/range-actions-html.ts` | 0.7 | chưa nạp | 722 | — |
| `presentation/shared/js-string-literal.ts` | 0.7 | chưa nạp | 709 | — |
| `application/sync/firebase-remote-render-service.ts` | 0.7 | chưa nạp | 707 | — |
| `presentation/sync/firebase-cloud-status-presentation.ts` | 0.7 | chưa nạp | 707 | — |
| `application/manage/manage-assay-command.ts` | 0.7 | chưa nạp | 703 | — |
| `presentation/sigma/sigma-report-metric.ts` | 0.7 | chưa nạp | 686 | — |
| `domain/sync/state-merge.ts` | 0.6 | chưa nạp | 664 | — |
| `presentation/lis/lis-queue-presentation.ts` | 4.0 | 83.5% | 658 | 0 |
| `application/sync/firebase-own-snapshot-service.ts` | 0.6 | chưa nạp | 620 | — |
| `domain/westgard/rule-settings.ts` | 0.6 | chưa nạp | 620 | — |
| `domain/qc/staff-identity.ts` | 0.6 | chưa nạp | 615 | — |
| `domain/westgard/worker-job.ts` | 0.6 | chưa nạp | 611 | — |
| `application/storage/indexeddb-mirror-service.ts` | 0.6 | chưa nạp | 610 | — |
| `application/sync/firebase-disconnect-service.ts` | 0.6 | chưa nạp | 601 | — |
| `application/manage/manage-assay-removal-command.ts` | 0.6 | chưa nạp | 593 | — |
| `presentation/report/report-search.ts` | 0.6 | chưa nạp | 592 | — |
| `application/storage/state-adoption-service.ts` | 0.6 | chưa nạp | 578 | — |
| `domain/qc/point-lot-normalizer.ts` | 0.6 | chưa nạp | 568 | — |
| `domain/nce/action-rerun-cache-key.ts` | 0.6 | chưa nạp | 564 | — |
| `presentation/export/csv-download.ts` | 0.5 | chưa nạp | 562 | — |
| `domain/qc/accepted-lot-points.ts` | 0.5 | chưa nạp | 559 | — |
| `application/sync/firebase-local-store-service.ts` | 0.5 | chưa nạp | 551 | — |
| `domain/auth/password-policy.ts` | 0.6 | chưa nạp | 537 | — |
| `application/storage/local-partition-recovery.ts` | 0.5 | chưa nạp | 524 | — |
| `domain/qc/report-level-stats.ts` | 0.5 | chưa nạp | 518 | — |
| `presentation/sigma/sigma-mdc-items.ts` | 0.5 | chưa nạp | 513 | — |
| `presentation/nce/action-report-html.ts` | 0.5 | chưa nạp | 498 | — |
| `presentation/audit/activity-audit-date-range.ts` | 0.5 | chưa nạp | 497 | — |
| `domain/sync/first-connect.ts` | 0.5 | chưa nạp | 495 | — |
| `domain/qc/parallel-westgard.ts` | 0.5 | chưa nạp | 489 | — |
| `domain/sync/retry-scheduler.ts` | 0.5 | chưa nạp | 483 | — |
| `presentation/nce/action-report-summary.ts` | 0.5 | chưa nạp | 477 | — |
| `presentation/sigma/sigma-canvas.ts` | 0.5 | chưa nạp | 477 | — |
| `domain/qc/entry-columns.ts` | 0.5 | chưa nạp | 474 | — |
| `presentation/auth/user-list-model.ts` | 0.5 | chưa nạp | 470 | — |
| `domain/qc/range-limit-repair.ts` | 0.5 | chưa nạp | 467 | — |
| `presentation/report/report-labels.ts` | 0.5 | chưa nạp | 454 | — |
| `presentation/report/export-meta-rows.ts` | 0.5 | chưa nạp | 444 | — |
| `presentation/sync/firebase-save-status-service.ts` | 0.4 | chưa nạp | 440 | — |
| `application/storage/local-clear-keys.ts` | 0.4 | chưa nạp | 439 | — |
| `application/sync/firebase-pull-service.ts` | 0.4 | chưa nạp | 431 | — |
| `domain/westgard/worker-prewarm.ts` | 0.4 | chưa nạp | 427 | — |
| `domain/auth/default-admin-user.ts` | 0.4 | chưa nạp | 422 | — |
| `presentation/export/xlsx-cell.ts` | 0.4 | chưa nạp | 421 | — |
| `presentation/format/basic-format.ts` | 0.4 | chưa nạp | 419 | — |
| `domain/sync/firebase-identity.ts` | 0.4 | chưa nạp | 403 | — |
| `application/sync/firebase-invalid-snapshot-service.ts` | 0.4 | chưa nạp | 402 | — |
| `presentation/audit/activity-audit-archive-window.ts` | 0.4 | chưa nạp | 399 | — |
| `presentation/report/qc-report-context.ts` | 0.4 | chưa nạp | 399 | — |
| `application/manage/target-matrix-command.ts` | 0.4 | chưa nạp | 398 | — |
| `presentation/export/blob-download.ts` | 0.4 | chưa nạp | 387 | — |
| `application/sync/firebase-polling-service.ts` | 0.4 | chưa nạp | 380 | — |
| `presentation/sync/firebase-remote-render-safety-service.ts` | 0.4 | chưa nạp | 374 | — |
| `domain/qc/error-detail.ts` | 0.4 | chưa nạp | 367 | — |
| `domain/qc/lot-lineage.ts` | 0.4 | chưa nạp | 361 | — |
| `domain/sync/value-codec.ts` | 0.3 | chưa nạp | 357 | — |
| `presentation/manage/target-matrix-row-html.ts` | 2.4 | 85.1% | 357 | 0 |
| `presentation/shared/html-escape.ts` | 0.3 | chưa nạp | 357 | — |
| `domain/auth/user-permission-selection.ts` | 0.3 | chưa nạp | 352 | — |
| `application/storage/local-snapshot-record.ts` | 0.3 | chưa nạp | 348 | — |
| `domain/qc/planned-target.ts` | 0.3 | chưa nạp | 347 | — |
| `domain/qc/accepted-memo-cache.ts` | 0.3 | chưa nạp | 344 | — |
| `domain/sync/firebase-config-selection.ts` | 0.3 | chưa nạp | 343 | — |
| `domain/qc/cusum-memo-cache.ts` | 0.3 | chưa nạp | 341 | — |
| `presentation/nce/action-review-buttons-html.ts` | 1.3 | 73.3% | 341 | 0 |
| `domain/sync/firebase-first-connect-plan.ts` | 0.3 | chưa nạp | 339 | — |
| `domain/qc/cusum-config.ts` | 0.3 | chưa nạp | 334 | — |
| `application/storage/local-partition-helpers.ts` | 0.3 | chưa nạp | 333 | — |
| `application/storage/local-partition-validation.ts` | 0.3 | chưa nạp | 328 | — |
| `domain/sync/snapshot-keys.ts` | 0.3 | chưa nạp | 323 | — |
| `application/sync/firebase-merge-application.ts` | 0.3 | chưa nạp | 316 | — |
| `application/manage/manage-lot-transition-command.ts` | 5.4 | 94.1% | 308 | 1 |
| `application/storage/save-scheduler.ts` | 0.3 | chưa nạp | 299 | — |
| `domain/sync/snapshot-signature.ts` | 0.3 | chưa nạp | 286 | — |
| `presentation/report/report-nce-detail-html.ts` | 3.9 | 92.5% | 279 | 0 |
| `application/storage/partition-write-policy.ts` | 0.3 | chưa nạp | 270 | — |
| `presentation/sigma/data-url-bytes.ts` | 0.3 | chưa nạp | 269 | — |
| `domain/sync/firebase-connection-gate.ts` | 0.3 | chưa nạp | 267 | — |
| `domain/export/csv-cell.ts` | 0.3 | chưa nạp | 264 | — |
| `domain/qc/cusum-series.ts` | 0.3 | chưa nạp | 263 | — |
| `domain/westgard/memo-cache.ts` | 0.3 | chưa nạp | 263 | — |
| `presentation/sigma/sigma-export-pixel-ratio.ts` | 0.3 | chưa nạp | 263 | — |
| `presentation/report/qc-export-value-format.ts` | 0.3 | chưa nạp | 262 | — |
| `application/storage/corrupt-local-quarantine.ts` | 0.3 | chưa nạp | 259 | — |
| `application/audit/activity-archive-command.ts` | 3.2 | 91.5% | 251 | 0 |
| `presentation/dashboard/dashboard-shift-status.ts` | 0.9 | 70.2% | 245 | 0 |
| `application/nce/action-form-ui-state.ts` | 1.2 | 79.8% | 238 | 2 |
| `domain/sync/firebase-remote-snapshot.ts` | 0.2 | chưa nạp | 236 | — |
| `presentation/reagent/reagent-report-presentation.ts` | 9.0 | 97.4% | 234 | 0 |
| `domain/sync/firebase-lifecycle-state.ts` | 0.2 | chưa nạp | 227 | — |
| `domain/sync/firebase-empty-snapshot.ts` | 0.2 | chưa nạp | 222 | — |
| `application/nce/action-record-service.ts` | 2.6 | 91.7% | 217 | 0 |
| `application/sync/firebase-config-parser.ts` | 1.5 | 85.6% | 216 | 0 |
| `application/storage/derived-save-policy.ts` | 0.2 | chưa nạp | 213 | — |
| `domain/qc/level-target.ts` | 0.2 | chưa nạp | 213 | — |
| `application/manage/tea-reference-service.ts` | 7.0 | 97.1% | 209 | 0 |
| `presentation/backup/backup-reminder.ts` | 2.2 | 90.3% | 205 | 0 |
| `domain/qc/lot-group-status.ts` | 0.2 | chưa nạp | 202 | — |
| `domain/qc/search-text.ts` | 0.2 | chưa nạp | 202 | — |
| `domain/sync/firebase-audit-gate.ts` | 0.2 | chưa nạp | 202 | — |
| `domain/qc/qc-point-run.ts` | 0.2 | chưa nạp | 197 | — |
| `presentation/sigma/canvas-font.ts` | 0.2 | chưa nạp | 195 | — |
| `presentation/style/css-token-pixel.ts` | 0.2 | chưa nạp | 194 | — |
| `presentation/nce/action-form-model.ts` | 5.0 | 96.4% | 188 | 0 |
| `domain/sync/firebase-snapshot-gate.ts` | 0.2 | chưa nạp | 181 | — |
| `application/storage/local-recovery-slots.ts` | 0.2 | chưa nạp | 169 | — |
| `presentation/sigma/sigma-governing-rule-block-html.ts` | 1.1 | 84.0% | 161 | 0 |
| `application/storage/storage-snapshot-service.ts` | 2.2 | 92.8% | 159 | 0 |
| `application/entry/entry-record-command.ts` | 2.0 | 92.4% | 156 | 0 |
| `presentation/export/xlsx-escape.ts` | 0.2 | chưa nạp | 156 | — |
| `application/range/range-target-command.ts` | 3.6 | 95.6% | 155 | 0 |
| `domain/sync/firebase-own-snapshot.ts` | 0.2 | chưa nạp | 155 | — |
| `presentation/export/xlsx-period.ts` | 0.2 | chưa nạp | 154 | — |
| `presentation/export/xlsx-rounding.ts` | 0.1 | chưa nạp | 145 | — |
| `domain/qc/entry-column-points.ts` | 0.1 | chưa nạp | 134 | — |
| `presentation/chart/levey-jennings-tooltip-controller.ts` | 1.8 | 92.6% | 133 | 0 |
| `presentation/report/report-xlsx-header.ts` | 3.1 | 95.7% | 129 | 0 |
| `presentation/report/report-xlsx-style-ids.ts` | 0.1 | chưa nạp | 129 | — |
| `application/backup/backup-restore-command.ts` | 1.1 | 88.8% | 127 | 0 |
| `application/storage/retry-delay.ts` | 0.1 | chưa nạp | 125 | — |
| `application/manage/manage-lot-command.ts` | 3.0 | 95.8% | 122 | 1 |
| `application/manage/tea-reference-workflow-command.ts` | 3.9 | 96.8% | 121 | 0 |
| `presentation/westgard/westgard-xlsx-header.ts` | 2.6 | 95.3% | 119 | 0 |
| `application/backup/backup-import-command.ts` | 1.5 | 92.3% | 118 | 0 |
| `domain/sync/firebase-pull-gate.ts` | 0.1 | chưa nạp | 116 | — |
| `presentation/entry/entry-tree-html.ts` | 3.2 | 96.4% | 115 | 1 |
| `presentation/report/report-header.ts` | 1.4 | 92.2% | 111 | 0 |
| `domain/reagent/reagent-t-distribution.ts` | 2.5 | 95.6% | 110 | 0 |
| `domain/sync/firebase-ready-state.ts` | 0.1 | chưa nạp | 110 | — |
| `presentation/settings/lis-gateway-panel-html.ts` | 2.0 | 94.2% | 110 | 0 |
| `application/storage/local-store-service.ts` | 2.2 | 95.7% | 96 | 0 |
| `application/auth/login-command.ts` | 2.2 | 95.8% | 95 | 0 |
| `application/state/foundation-normalization.ts` | 1.0 | 90.5% | 94 | 0 |
| `presentation/app/action-dispatcher.ts` | 15.7 | 99.4% | 88 | 0 |
| `presentation/manage/history-rows.ts` | 1.7 | 95.0% | 87 | 0 |
| `application/nce/action-form-render-state.ts` | 1.2 | 93.2% | 85 | 0 |
| `application/nce/action-current-issues.ts` | 1.2 | 93.2% | 83 | 0 |
| `presentation/export/xlsx-columns.ts` | 0.1 | chưa nạp | 81 | — |
| `application/auth/user-lifecycle-command.ts` | 2.2 | 96.4% | 80 | 0 |
| `presentation/export/xlsx-utf8.ts` | 0.1 | chưa nạp | 80 | — |
| `presentation/entry/entry-sheet-navigation.ts` | 1.4 | 94.5% | 79 | 0 |
| `application/entry/entry-void-command.ts` | 0.9 | 91.5% | 76 | 0 |
| `presentation/export/xlsx-emu.ts` | 0.1 | chưa nạp | 72 | — |
| `presentation/settings/storage-usage.ts` | 1.6 | 95.6% | 72 | 0 |
| `presentation/manage/lot-transition-targets-html.ts` | 2.2 | 96.7% | 70 | 0 |
| `application/backup/backup-export-command.ts` | 1.6 | 95.7% | 69 | 0 |
| `application/manage/manage-lot-group-activation-command.ts` | 2.3 | 97.0% | 67 | 0 |
| `presentation/sigma/sigma-cohort-rows-html.ts` | 1.1 | 93.9% | 66 | 0 |
| `application/manage/manage-lot-group-workflow-command.ts` | 3.0 | 97.9% | 64 | 0 |
| `domain/reagent/reagent-comparison-calculation.ts` | 2.8 | 97.8% | 64 | 0 |
| `presentation/nce/action-checklist-presentation.ts` | 2.0 | 96.9% | 64 | 0 |
| `presentation/chart/levey-jennings-multi-series.ts` | 0.8 | 92.6% | 63 | 0 |
| `presentation/chart/hi-dpi-canvas.ts` | 0.9 | 93.7% | 60 | 0 |
| `presentation/dashboard/dashboard-test-rows-html.ts` | 1.0 | 94.2% | 59 | 0 |
| `application/settings/lab-profile-service.ts` | 1.2 | 95.3% | 57 | 0 |
| `domain/reagent/reagent-statistics.ts` | 2.8 | 98.2% | 52 | 0 |
| `presentation/nce/action-cause-detail-html.ts` | 0.9 | 93.7% | 52 | 0 |
| `presentation/nce/action-effectiveness-detail-html.ts` | 1.2 | 96.0% | 49 | 0 |
| `presentation/entry/entry-chart-html.ts` | 2.9 | 98.4% | 47 | 0 |
| `presentation/entry/entry-point-table-row-html.ts` | 0.7 | 93.9% | 47 | 0 |
| `presentation/manage/qc-history-detail-modal-html.ts` | 1.5 | 97.0% | 45 | 0 |
| `presentation/manage/config-assay-rule-rows-html.ts` | 1.1 | 96.0% | 44 | 0 |
| `application/auth/login-workflow-command.ts` | 1.5 | 97.1% | 42 | 0 |
| `presentation/chart/levey-jennings-multi-dividers.ts` | 0.6 | 93.7% | 40 | 0 |
| `presentation/chart/levey-jennings-multi-hover-model.ts` | 0.8 | 95.3% | 39 | 0 |
| `presentation/manage/target-overwrite-picks.ts` | 0.7 | 94.8% | 37 | 0 |
| `presentation/manage/lot-transition-modal-html.ts` | 1.6 | 97.7% | 36 | 0 |
| `presentation/nce/action-rerun-evidence-html.ts` | 1.7 | 97.9% | 34 | 0 |
| `presentation/settings/firebase-connection-panel-html.ts` | 2.2 | 98.5% | 33 | 0 |
| `presentation/settings/firebase-acl-help.ts` | 0.4 | 91.6% | 32 | 0 |
| `domain/qc/dashboard-expiring-lots.ts` | 0.4 | 93.1% | 31 | 0 |
| `presentation/manage/target-config-state.ts` | 1.4 | 97.9% | 29 | 0 |
| `application/manage/manage-assay-workflow-command.ts` | 1.2 | 97.7% | 28 | 0 |
| `application/manage/manage-lot-transition-workflow-command.ts` | 1.7 | 98.4% | 28 | 0 |
| `presentation/backup/backup-inspection-summary.ts` | 0.6 | 95.4% | 28 | 0 |
| `presentation/nce/action-containment-detail-html.ts` | 0.5 | 94.7% | 28 | 0 |
| `presentation/sigma/sigma-opspec-cell-html.ts` | 0.7 | 95.7% | 28 | 0 |
| `presentation/westgard/westgard-xlsx-rows.ts` | 1.5 | 98.2% | 28 | 0 |
| `presentation/nce/action-cancelled-alert-html.ts` | 0.4 | 93.6% | 27 | 0 |
| `presentation/shared/parse-vn-date.ts` | 0.7 | 96.2% | 27 | 0 |
| `presentation/chart/levey-jennings-multi-point-render-model.ts` | 1.1 | 97.7% | 26 | 0 |
| `presentation/entry/entry-tree-navigation.ts` | 0.6 | 96.0% | 26 | 0 |
| `presentation/nce/action-select-html.ts` | 1.0 | 97.5% | 26 | 0 |
| `presentation/sigma/sigma-frequency-rows-html.ts` | 0.9 | 97.2% | 26 | 0 |
| `presentation/sigma/sigma-mu-preview-html.ts` | 0.6 | 96.0% | 25 | 0 |
| `presentation/chart/cusum-display-plan.ts` | 0.7 | 96.8% | 24 | 1 |
| `presentation/entry/entry-tree-state.ts` | 0.8 | 97.2% | 24 | 0 |
| `presentation/entry/entry-sheet-run-slot-html.ts` | 1.3 | 98.2% | 23 | 0 |
| `presentation/manage/config-panel-test-rows.ts` | 0.5 | 95.5% | 23 | 0 |
| `presentation/manage/target-group-lots.ts` | 0.4 | 94.4% | 23 | 0 |
| `presentation/chart/levey-jennings-legend-layout.ts` | 0.3 | 93.1% | 22 | 0 |
| `presentation/manage/target-summary-html.ts` | 0.5 | 95.7% | 22 | 0 |
| `presentation/reagent/reagent-scatter-svg.ts` | 1.6 | 98.7% | 22 | 0 |
| `presentation/manage/manage-lot-row-html.ts` | 1.1 | 98.0% | 21 | 0 |
| `presentation/manage/history-row-sort.ts` | 0.4 | 95.1% | 20 | 0 |
| `presentation/manage/tea-reference-sort.ts` | 0.3 | 94.2% | 20 | 0 |
| `presentation/settings/brand-panel-html.ts` | 1.8 | 98.9% | 20 | 0 |
| `presentation/settings/unit-profile-html.ts` | 1.0 | 98.0% | 20 | 0 |
| `presentation/sigma/sigma-add-test-modal-html.ts` | 0.8 | 97.4% | 20 | 0 |
| `presentation/westgard/westgard-archived-groups.ts` | 0.5 | 96.1% | 20 | 0 |
| `application/manage/manage-lot-workflow-command.ts` | 1.3 | 98.7% | 18 | 0 |
| `presentation/entry/entry-point-table-card-html.ts` | 0.7 | 97.5% | 18 | 0 |
| `presentation/manage/manage-lot-status.ts` | 0.6 | 97.0% | 18 | 0 |
| `presentation/render/visible-canvas-service.ts` | 1.4 | 98.8% | 18 | 0 |
| `application/backup/backup-local-marker.ts` | 0.6 | 97.0% | 17 | 0 |
| `presentation/entry/entry-column-config.ts` | 0.8 | 97.9% | 17 | 0 |
| `presentation/manage/history-search-values.ts` | 1.0 | 98.4% | 17 | 0 |
| `presentation/dashboard/dashboard-test-row-html.ts` | 0.8 | 98.0% | 16 | 0 |
| `presentation/entry/entry-sheet-month.ts` | 0.7 | 97.6% | 16 | 0 |
| `presentation/sigma/sigma-add-test-rows-html.ts` | 0.6 | 97.3% | 16 | 0 |
| `application/auth/reset-operational-data-command.ts` | 1.1 | 98.7% | 15 | 0 |
| `presentation/entry/entry-tree-visibility.ts` | 1.2 | 98.8% | 15 | 0 |
| `presentation/manage/target-matrix-items.ts` | 1.2 | 98.8% | 15 | 0 |
| `application/entry/entry-date-note-workflow-command.ts` | 0.9 | 98.5% | 14 | 0 |
| `application/manage/manage-instrument-workflow-command.ts` | 1.0 | 98.7% | 14 | 0 |
| `application/manage/manage-panel-workflow-command.ts` | 0.9 | 98.5% | 14 | 0 |
| `application/period/report-period-workflow-command.ts` | 1.1 | 98.8% | 14 | 0 |
| `application/reagent/reagent-comparison-workflow-command.ts` | 1.2 | 98.9% | 14 | 0 |
| `presentation/entry/entry-date-range-input.ts` | 0.4 | 96.4% | 14 | 0 |
| `presentation/nce/action-log-row-html.ts` | 1.1 | 98.8% | 14 | 0 |
| `presentation/sigma/sigma-mu-rows-html.ts` | 1.2 | 98.8% | 14 | 0 |
| `presentation/sigma/sigma-status-card-html.ts` | 0.6 | 97.5% | 14 | 0 |
| `presentation/westgard/westgard-archived-test-selection.ts` | 1.4 | 99.0% | 14 | 0 |
| `presentation/westgard/westgard-point-rows-html.ts` | 1.5 | 99.2% | 13 | 0 |
| `presentation/chart/levey-jennings-multi-run-ticks.ts` | 0.6 | 98.2% | 12 | 0 |
| `presentation/entry/entry-sheet-day-summary-html.ts` | 0.7 | 98.3% | 12 | 0 |
| `presentation/manage/config-assay-modal-html.ts` | 3.8 | 99.7% | 12 | 0 |
| `presentation/reagent/reagent-picker-rows-html.ts` | 0.9 | 98.7% | 12 | 0 |
| `presentation/sigma/sigma-mu-dominant-text.ts` | 0.5 | 97.8% | 12 | 0 |
| `application/storage/storage-serialize-policy.ts` | 0.4 | 97.5% | 11 | 0 |
| `presentation/auth/user-row-html.ts` | 1.4 | 99.2% | 11 | 0 |
| `presentation/nce/action-investigation-field-html.ts` | 1.7 | 99.4% | 11 | 0 |
| `presentation/sigma/sigma-period-row-html.ts` | 1.0 | 98.9% | 11 | 0 |
| `domain/reagent/reagent-pairs.ts` | 0.9 | 98.9% | 10 | 0 |
| `presentation/chart/cusum-chart-geometry.ts` | 0.7 | 98.5% | 10 | 0 |
| `presentation/dashboard/dashboard-latest-point.ts` | 0.3 | 97.2% | 10 | 0 |
| `presentation/dashboard/dashboard-loading.ts` | 1.3 | 99.2% | 10 | 0 |
| `presentation/dashboard/dashboard-overdue-action-item-html.ts` | 1.0 | 99.0% | 10 | 0 |
| `presentation/entry/entry-rows-window.ts` | 0.5 | 98.1% | 10 | 0 |
| `presentation/entry/entry-sheet-day-row-html.ts` | 0.6 | 98.4% | 10 | 0 |
| `presentation/manage/manage-lot-group-labels.ts` | 0.3 | 96.4% | 10 | 0 |
| `presentation/manage/manage-toolbar-html.ts` | 0.9 | 98.9% | 10 | 0 |
| `presentation/manage/tea-source-registry-items.ts` | 0.8 | 98.8% | 10 | 0 |
| `presentation/reagent/reagent-pair-row-html.ts` | 1.1 | 99.1% | 10 | 0 |
| `presentation/westgard/westgard-cusum-page-html.ts` | 2.3 | 99.6% | 10 | 0 |
| `presentation/manage/target-row-state.ts` | 0.4 | 97.6% | 9 | 0 |
| `application/state/state-lifecycle-normalization.ts` | 0.7 | 98.9% | 8 | 0 |
| `presentation/chart/levey-jennings-ticks.ts` | 0.5 | 98.4% | 8 | 0 |
| `presentation/nce/action-suggest-phrases.ts` | 0.3 | 97.6% | 8 | 0 |
| `presentation/report/report-page-html.ts` | 2.9 | 99.7% | 8 | 0 |
| `presentation/westgard/westgard-mode-tabs.ts` | 0.9 | 99.1% | 8 | 0 |
| `presentation/reagent/reagent-chart-range.ts` | 0.5 | 98.7% | 7 | 0 |
| `presentation/render/config-nav-scroll-service.ts` | 0.4 | 98.4% | 7 | 0 |
| `presentation/dashboard/dashboard-expiring-lots-html.ts` | 0.9 | 99.3% | 6 | 0 |
| `presentation/entry/entry-sheet-day-detail-html.ts` | 0.8 | 99.3% | 6 | 0 |
| `presentation/manage/manage-transition-row-html.ts` | 1.0 | 99.4% | 6 | 0 |
| `presentation/nce/action-bias-context.ts` | 0.5 | 98.8% | 6 | 0 |
| `presentation/nce/action-level-label.ts` | 0.6 | 99.0% | 6 | 0 |
| `presentation/reagent/reagent-comparison-label.ts` | 0.6 | 98.9% | 6 | 0 |
| `application/sync/firebase-settings-service.ts` | 0.8 | 99.4% | 5 | 0 |
| `presentation/dashboard/dashboard-qc-followup-item-html.ts` | 0.9 | 99.4% | 5 | 0 |
| `presentation/entry/entry-empty-page-html.ts` | 0.4 | 98.9% | 5 | 0 |
| `presentation/entry/entry-point-context.ts` | 0.2 | 97.9% | 5 | 0 |
| `presentation/entry/entry-save-feedback.ts` | 0.7 | 99.2% | 5 | 0 |
| `presentation/entry/entry-sheet-focus.ts` | 0.2 | 97.9% | 5 | 0 |
| `presentation/entry/entry-void-nce-choice.ts` | 1.0 | 99.4% | 5 | 0 |
| `presentation/manage/target-panel-tests.ts` | 0.3 | 98.4% | 5 | 0 |
| `presentation/nce/action-suggest-row-html.ts` | 0.7 | 99.3% | 5 | 0 |
| `presentation/report/report-lock-list-html.ts` | 1.1 | 99.5% | 5 | 0 |
| `presentation/westgard/westgard-archived-group-match.ts` | 0.6 | 99.2% | 5 | 0 |
| `presentation/westgard/westgard-test-search.ts` | 0.6 | 99.2% | 5 | 0 |
| `application/manage/manage-target-matrix-workflow-command.ts` | 0.9 | 99.6% | 4 | 0 |
| `application/nce/nce-lifecycle-workflow-command.ts` | 0.9 | 99.5% | 4 | 0 |
| `application/settings/settings-profile-command.ts` | 1.3 | 99.7% | 4 | 0 |
| `application/sigma/sigma-mu-workflow-command.ts` | 1.8 | 99.8% | 4 | 0 |
| `presentation/entry/entry-points-panel-html.ts` | 0.9 | 99.5% | 4 | 0 |
| `presentation/manage/config-instrument-modal-html.ts` | 1.2 | 99.7% | 4 | 0 |
| `presentation/manage/config-panel-modal-html.ts` | 1.2 | 99.7% | 4 | 0 |
| `presentation/manage/target-group-options-html.ts` | 0.6 | 99.3% | 4 | 0 |
| `presentation/manage/tea-source-registry-html.ts` | 0.9 | 99.5% | 4 | 0 |
| `presentation/nce/action-issue-row-html.ts` | 1.6 | 99.8% | 4 | 0 |
| `presentation/nce/action-staff-options-html.ts` | 0.3 | 98.7% | 4 | 0 |
| `presentation/reagent/reagent-select-options-html.ts` | 0.4 | 99.1% | 4 | 0 |
| `presentation/report/report-qc-format.ts` | 0.7 | 99.5% | 4 | 0 |
| `presentation/sigma/sigma-mu-state-chip-html.ts` | 0.4 | 99.0% | 4 | 0 |
| `presentation/backup/backup-import-confirmation.ts` | 0.4 | 99.2% | 3 | 0 |
| `presentation/dashboard/dashboard-progress-html.ts` | 0.4 | 99.3% | 3 | 0 |
| `presentation/nce/action-form-section-html.ts` | 0.6 | 99.5% | 3 | 0 |
| `presentation/range/range-workflow-comparison-rows-html.ts` | 0.7 | 99.6% | 3 | 0 |
| `presentation/sigma/sigma-bias-summary-html.ts` | 0.7 | 99.6% | 3 | 0 |
| `application/auth/admin-bootstrap-command.ts` | 0.6 | 100.0% | 0 | 0 |
| `application/auth/required-password-command.ts` | 1.0 | 100.0% | 0 | 0 |
| `application/auth/required-password-workflow-command.ts` | 0.9 | 100.0% | 0 | 0 |
| `application/auth/user-management-command.ts` | 1.2 | 100.0% | 0 | 0 |
| `application/backup/backup-inspection-command.ts` | 0.6 | 100.0% | 0 | 0 |
| `application/backup/backup-status-command.ts` | 1.1 | 100.0% | 0 | 0 |
| `application/entry/entry-record-workflow-command.ts` | 0.8 | 100.0% | 0 | 0 |
| `application/entry/entry-void-workflow-command.ts` | 0.8 | 100.0% | 0 | 0 |
| `application/lis/lis-settings-service.ts` | 0.8 | 100.0% | 0 | 0 |
| `application/nce/nce-form-workflow-command.ts` | 0.8 | 100.0% | 0 | 0 |
| `application/period/report-period-command.ts` | 1.4 | 100.0% | 0 | 0 |
| `application/range/range-workflow-command.ts` | 0.9 | 100.0% | 0 | 0 |
| `application/storage/storage-lifecycle-service.ts` | 1.3 | 100.0% | 0 | 0 |
| `domain/qc/dashboard-kpis.ts` | 0.8 | 100.0% | 0 | 0 |
| `domain/qc/range-safety-gate.ts` | 1.2 | 100.0% | 0 | 0 |
| `domain/qc/range-tea.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/audit/activity-audit-archive-modal-html.ts` | 1.1 | 100.0% | 0 | 0 |
| `presentation/audit/activity-audit-page-html.ts` | 1.6 | 100.0% | 0 | 0 |
| `presentation/audit/activity-audit-row-html.ts` | 0.8 | 100.0% | 0 | 0 |
| `presentation/auth/reset-password-modal-html.ts` | 0.8 | 100.0% | 0 | 0 |
| `presentation/auth/user-permission-checks-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/auth/user-permissions-modal-html.ts` | 0.9 | 100.0% | 0 | 0 |
| `presentation/auth/user-role-select-html.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/auth/users-page-html.ts` | 2.0 | 100.0% | 0 | 0 |
| `presentation/backup/backup-export-message.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/backup/backup-file-name.ts` | 0.1 | 100.0% | 0 | 0 |
| `presentation/backup/backup-import-message.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/backup/backup-inspection-message.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/backup/backup-oversize-confirmation.ts` | 0.8 | 100.0% | 0 | 0 |
| `presentation/backup/backup-size-confirmation.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/backup/backup-size-warning-confirmation.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/backup/backup-snapshot-file-name.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/chart/canvas-font.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/chart/chart-data-url.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/chart/chart-empty-labels.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/chart/chart-tooltip-service.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/chart/cusum-chart-title.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/chart/cusum-colors.ts` | 0.1 | 100.0% | 0 | 0 |
| `presentation/chart/cusum-hover-model.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/chart/cusum-line-points.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/chart/cusum-point-render-model.ts` | 0.8 | 100.0% | 0 | 0 |
| `presentation/chart/cusum-reference-lines.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/chart/levey-jennings-bands.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/chart/levey-jennings-chart-title.ts` | 0.1 | 100.0% | 0 | 0 |
| `presentation/chart/levey-jennings-colors.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/chart/levey-jennings-display-plan.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/chart/levey-jennings-geometry.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/chart/levey-jennings-grid.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/chart/levey-jennings-hover-model.ts` | 0.7 | 100.0% | 0 | 0 |
| `presentation/chart/levey-jennings-multi-colors.ts` | 0.1 | 100.0% | 0 | 0 |
| `presentation/chart/levey-jennings-multi-display-plan.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/chart/levey-jennings-multi-geometry.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/chart/levey-jennings-multi-y-axis.ts` | 0.1 | 100.0% | 0 | 0 |
| `presentation/chart/levey-jennings-point-render-model.ts` | 0.9 | 100.0% | 0 | 0 |
| `presentation/chart/levey-jennings-point-style.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/chart/levey-jennings-y-axis.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/chart/westgard-rule-scope.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-empty-tests-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-expiring-lot-items.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-followup-panel-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-head-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-kpi-items.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-kpis-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-latest-point-text.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-level-data.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-level-pill-html.ts` | 0.8 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-level-pills-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-missing-target-item-html.ts` | 0.7 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-missing-target-items.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-missing-target-list-html.ts` | 0.1 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-overdue-action-list-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-overdue-actions.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-page-html.ts` | 0.9 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-qc-followup-list-html.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-status-filter.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-status-tabs-html.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-test-action.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-test-items.ts` | 0.8 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-test-list-html.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-test-panel-html.ts` | 0.8 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-test-rank.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-test-search-text.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-test-status-tags.ts` | 0.7 | 100.0% | 0 | 0 |
| `presentation/dashboard/dashboard-westgard-alerts.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/entry/entry-cumulative-stats-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/entry/entry-date-note-feedback.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/entry/entry-expanded-tables-state.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/entry/entry-extra-run-request.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/entry/entry-levey-panel-html.ts` | 1.0 | 100.0% | 0 | 0 |
| `presentation/entry/entry-page-layout-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/entry/entry-pre-save-warning-modal-html.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/entry/entry-range-preset.ts` | 0.1 | 100.0% | 0 | 0 |
| `presentation/entry/entry-range-summary-html.ts` | 1.4 | 100.0% | 0 | 0 |
| `presentation/entry/entry-record-error-message.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/entry/entry-selection-state.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/entry/entry-sheet-cell-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/entry/entry-sheet-input-order.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/entry/entry-table-window-note-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/entry/entry-tree-collapse-preference.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/entry/entry-tree-group-state.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/entry/entry-tree-key-command.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/entry/entry-void-modal-html.ts` | 1.6 | 100.0% | 0 | 0 |
| `presentation/entry/entry-voided-point-row-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/entry/entry-voided-points-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/entry/entry-worksheet-html.ts` | 1.5 | 100.0% | 0 | 0 |
| `presentation/manage/config-assay-decimal-options-html.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/config-assay-instrument-options-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/manage/config-assay-tea-options-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/manage/config-lot-level-options-html.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/config-lot-modal-html.ts` | 1.4 | 100.0% | 0 | 0 |
| `presentation/manage/config-panel-instrument-options-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/manage/groups-of-lot.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/history-assay-options-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/manage/history-assay-selection.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/history-panel-html.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/history-period-label.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/history-selector-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/manage/history-summary.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/history-table-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/manage/history-visible-rows.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/manage/lot-group-columns-html.ts` | 0.8 | 100.0% | 0 | 0 |
| `presentation/manage/lot-group-lot-pills-html.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/lot-group-modal-html.ts` | 0.9 | 100.0% | 0 | 0 |
| `presentation/manage/lot-group-status.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/manage/lot-group-toggle-action.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/manage/lot-transition-choice-html.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/manage/lot-transition-target-number.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/manage/manage-assay-row-html.ts` | 1.2 | 100.0% | 0 | 0 |
| `presentation/manage/manage-assay-table-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/manage/manage-empty-panel-html.ts` | 0.1 | 100.0% | 0 | 0 |
| `presentation/manage/manage-history-row-html.ts` | 1.1 | 100.0% | 0 | 0 |
| `presentation/manage/manage-instrument-name.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/manage-instrument-row-html.ts` | 1.1 | 100.0% | 0 | 0 |
| `presentation/manage/manage-instrument-table-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/manage/manage-lot-config-layout-html.ts` | 1.0 | 100.0% | 0 | 0 |
| `presentation/manage/manage-lot-group-card-html.ts` | 0.8 | 100.0% | 0 | 0 |
| `presentation/manage/manage-lot-label.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/manage-page-html.ts` | 0.1 | 100.0% | 0 | 0 |
| `presentation/manage/manage-panel-name.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/manage-panel-row-html.ts` | 0.9 | 100.0% | 0 | 0 |
| `presentation/manage/manage-panel-table-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/manage/manage-search-match.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/manage-search-placeholder.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/manage/manage-shell-html.ts` | 0.7 | 100.0% | 0 | 0 |
| `presentation/manage/manage-transition-details-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/manage/manage-transition-status.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/manage/manage-transition-table-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/manage/qc-history-detail-rows-html.ts` | 1.1 | 100.0% | 0 | 0 |
| `presentation/manage/target-empty-state.ts` | 0.9 | 100.0% | 0 | 0 |
| `presentation/manage/target-group-label.ts` | 0.1 | 100.0% | 0 | 0 |
| `presentation/manage/target-group-status-suffix.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/target-level-lots.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/manage/target-level-selection.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/manage/target-level-tabs-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/manage/target-level-toolbar-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/manage/target-locked-backfill-note.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/manage/target-matrix-actions-html.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/target-matrix-panel-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/manage/target-matrix-stats.ts` | 0.9 | 100.0% | 0 | 0 |
| `presentation/manage/target-matrix-table-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/manage/target-number-text.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/manage/target-panel-label.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/target-panel-options-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/manage/target-prerequisite.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/manage/target-range-sync.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/manage/target-search-values.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/manage/target-selection.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/manage/target-selector-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/manage/target-switch-assay-names.ts` | 0.1 | 100.0% | 0 | 0 |
| `presentation/manage/target-switch-modal-html.ts` | 1.2 | 100.0% | 0 | 0 |
| `presentation/manage/tea-lab-basis-label.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/tea-reference-add-modal-html.ts` | 1.4 | 100.0% | 0 | 0 |
| `presentation/manage/tea-reference-empty-state.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/manage/tea-reference-input-value.ts` | 0.1 | 100.0% | 0 | 0 |
| `presentation/manage/tea-reference-kind.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/manage/tea-reference-lab-profile-body-html.ts` | 2.1 | 100.0% | 0 | 0 |
| `presentation/manage/tea-reference-lab-profile-modal-html.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/manage/tea-reference-lab-value-html.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/manage/tea-reference-naming-title.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/manage/tea-reference-row-actions.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/manage/tea-reference-row-html.ts` | 0.9 | 100.0% | 0 | 0 |
| `presentation/manage/tea-reference-status-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/manage/tea-reference-table-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/nce/action-approval-tag-html.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/nce/action-cancel-modal-html.ts` | 1.1 | 100.0% | 0 | 0 |
| `presentation/nce/action-detail-check-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/nce/action-detail-meta-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/nce/action-detail-modal-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/nce/action-evidence-timeline-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/nce/action-form-closed-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/nce/action-guide-content.ts` | 1.2 | 100.0% | 0 | 0 |
| `presentation/nce/action-incident-banner-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/nce/action-inspection-details-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/nce/action-issue-group-html.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/nce/action-issues-panel-html.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/nce/action-legacy-detail-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/nce/action-level-context.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/nce/action-log-panel-html.ts` | 0.8 | 100.0% | 0 | 0 |
| `presentation/nce/action-open-issue-html.ts` | 1.3 | 100.0% | 0 | 0 |
| `presentation/nce/action-page-html.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/nce/action-patient-impact-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/nce/action-reopen-modal-html.ts` | 1.0 | 100.0% | 0 | 0 |
| `presentation/nce/action-review-note-modal-html.ts` | 0.8 | 100.0% | 0 | 0 |
| `presentation/nce/action-rule-options.ts` | 0.1 | 100.0% | 0 | 0 |
| `presentation/nce/action-side-chips-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/nce/action-suggest-box-html.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/range/range-apply-confirmation-modal-html.ts` | 1.0 | 100.0% | 0 | 0 |
| `presentation/range/range-nce-notice-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/range/range-revert-confirmation-modal-html.ts` | 0.9 | 100.0% | 0 | 0 |
| `presentation/range/range-safety-gate-html.ts` | 1.4 | 100.0% | 0 | 0 |
| `presentation/range/range-workflow-checklist-rows-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/range/range-workflow-modal-html.ts` | 1.6 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-bland-svg.ts` | 2.3 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-chart-axis.ts` | 1.9 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-charts-panel-html.ts` | 0.8 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-create-modal-html.ts` | 0.9 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-create-reference-rows-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-create-typed-row-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-empty-page-html.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-info-panel-html.ts` | 3.8 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-pair-panel-html.ts` | 1.0 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-picker-modal-html.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-quick-label.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-quick-picker-modal-html.ts` | 0.7 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-quick-picker-rows-html.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-report-detail-card-html.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-report-items.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-results-panels-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-tool-icon.ts` | 1.2 | 100.0% | 0 | 0 |
| `presentation/reagent/reagent-toolbar-html.ts` | 0.7 | 100.0% | 0 | 0 |
| `presentation/render/default-date-fields-service.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/render/entry-jump-scroll-service.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/render/post-render-page-actions.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/report/report-action-icon.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/report/report-lock-panel-html.ts` | 1.8 | 100.0% | 0 | 0 |
| `presentation/report/report-lock-picker.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/report/report-nce-appendix.ts` | 0.7 | 100.0% | 0 | 0 |
| `presentation/report/report-range-picker-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/report/report-search-values.ts` | 1.0 | 100.0% | 0 | 0 |
| `presentation/report/report-sign-block.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/report/report-unlock-modal-html.ts` | 1.0 | 100.0% | 0 | 0 |
| `presentation/report/report-unlock-reason.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/settings/admin-tools-html.ts` | 1.8 | 100.0% | 0 | 0 |
| `presentation/settings/brand-preview-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/settings/brand-profile.ts` | 0.6 | 100.0% | 0 | 0 |
| `presentation/settings/firebase-guide-html.ts` | 1.5 | 100.0% | 0 | 0 |
| `presentation/settings/firebase-rules-panel-html.ts` | 0.7 | 100.0% | 0 | 0 |
| `presentation/settings/firebase-rules.ts` | 0.7 | 100.0% | 0 | 0 |
| `presentation/settings/settings-page-layout-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/sigma/sigma-analysis-setup-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/sigma/sigma-bias-modal-html.ts` | 1.2 | 100.0% | 0 | 0 |
| `presentation/sigma/sigma-bias-rows-html.ts` | 0.7 | 100.0% | 0 | 0 |
| `presentation/sigma/sigma-charts-panel-html.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/sigma/sigma-cohort-modal-html.ts` | 1.0 | 100.0% | 0 | 0 |
| `presentation/sigma/sigma-frequency-panel-html.ts` | 0.9 | 100.0% | 0 | 0 |
| `presentation/sigma/sigma-input-display-value.ts` | 0.2 | 100.0% | 0 | 0 |
| `presentation/sigma/sigma-mu-modal-html.ts` | 1.8 | 100.0% | 0 | 0 |
| `presentation/sigma/sigma-mu-summary-html.ts` | 1.1 | 100.0% | 0 | 0 |
| `presentation/sigma/sigma-no-levels-panel-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/sigma/sigma-period-table-head-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/sigma/sigma-period-table-html.ts` | 0.9 | 100.0% | 0 | 0 |
| `presentation/sigma/sigma-status-panel-html.ts` | 0.4 | 100.0% | 0 | 0 |
| `presentation/sigma/sigma-tracked-options-html.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/westgard/westgard-archived-multi-views.ts` | 0.7 | 100.0% | 0 | 0 |
| `presentation/westgard/westgard-cusum-levels.ts` | 0.3 | 100.0% | 0 | 0 |
| `presentation/westgard/westgard-export-actions-html.ts` | 0.8 | 100.0% | 0 | 0 |
| `presentation/westgard/westgard-lot-block-html.ts` | 1.7 | 100.0% | 0 | 0 |
| `presentation/westgard/westgard-multi-views.ts` | 0.8 | 100.0% | 0 | 0 |
| `presentation/westgard/westgard-row-window.ts` | 0.5 | 100.0% | 0 | 0 |
| `presentation/westgard/westgard-rows-control.ts` | 0.9 | 100.0% | 0 | 0 |
| `presentation/westgard/westgard-rule-guide-html.ts` | 1.1 | 100.0% | 0 | 0 |
| `presentation/westgard/westgard-rule-toggles-html.ts` | 0.7 | 100.0% | 0 | 0 |
| `presentation/westgard/westgard-ui-state.ts` | 0.5 | 100.0% | 0 | 0 |

### Hàm chưa từng chạy (10 hàm đầu mỗi file, theo thứ tự xuất hiện)

- **domain/core/qc-core.ts** — 11 hàm: `numericCell` (dòng 108) · `cleanPeriod` (dòng 120) · `cleanSigmaRounds` (dòng 129) · `cleanSigmaLevel` (dòng 132) · `isOn` (dòng 174) · `isOn` (dòng 202) · `add` (dòng 209) · `isOn` (dòng 247) · `isOn` (dòng 256) · `isOn` (dòng 281) …
- **presentation/router/router-shell-controller.ts** — 9 hàm: `brandTitle` (dòng 2) · `brandSub` (dòng 2) · `brandMarkText` (dòng 2) · `brandLogo` (dòng 2) · `renderBrand` (dòng 3) · `licensedLabName` (dòng 5) · `trialInfo` (dòng 5) · `sideFoot` (dòng 6) · `toggleSidebarNav` (dòng 7)
- **application/state/derived-cache-invalidation.ts** — 2 hàm: `clearPrefixed` (dòng 22) · `clearForTest` (dòng 34)
- **application/manage/manage-lot-transition-command.ts** — 1 hàm: `checkRemoval` (dòng 57)
- **application/nce/action-form-ui-state.ts** — 2 hàm: `reset` (dòng 25) · `startManual` (dòng 29)
- **application/manage/manage-lot-command.ts** — 1 hàm: `checkRemoval` (dòng 38)
- **presentation/entry/entry-tree-html.ts** — 1 hàm: `empty` (dòng 13)
- **presentation/chart/cusum-display-plan.ts** — 1 hàm: `valueAt` (dòng 1)

## B. `assets/**/*.js` — build artifact nạp qua vm sandbox

Chỉ còn 3 build artifact (`core.js`, `generated/modular-pilot.js`, `workers/westgard-worker.js`) + `nav-collapse-init.js` — KHÔNG map ngược được về dòng .ts nguồn (build không sinh sourcemap), nên số ở đây chỉ nói "phần khởi tạo/wiring của bundle có được chạy không", không phải "hàm nghiệp vụ nào thiếu test" — xem mục A cho câu đó.

4 file · 49.7% ký tự đã chạy.

**1 file KHÔNG test nào nạp tới** — không phải "độ phủ thấp" mà là không có dữ liệu coverage nào cho file đó:

- `nav-collapse-init.js` (0.1 KB)

| File | KB | % đã chạy | Ký tự chưa chạy | Hàm chưa từng chạy |
|---|---:|---:|---:|---:|
| `generated/modular-pilot.js` | 1464.6 | 47.7% | 767.465 | 2354 |
| `core.js` | 58.8 | 95.0% | 2.993 | 6 |
| `workers/westgard-worker.js` | 5.1 | 93.2% | 339 | 1 |
| `nav-collapse-init.js` | 0.1 | chưa nạp | 136 | — |

### Hàm chưa từng chạy (10 hàm đầu mỗi file, theo thứ tự xuất hiện)

- **generated/modular-pilot.js** — 2354 hàm: `pointRunNoFor` (dòng 91) · `execute` (dòng 466) · `execute` (dòng 509) · `execute` (dòng 525) · `execute` (dòng 546) · `save` (dòng 562) · `applyLab` (dòng 579) · `revertMfg` (dòng 632) · `commit` (dòng 691) · `applyLab` (dòng 698) …
- **core.js** — 6 hàm: `isOn` (dòng 384) · `isOn` (dòng 455) · `isOn` (dòng 535) · `isOn` (dòng 544) · `isOn` (dòng 577) · `isOn` (dòng 586)
- **workers/westgard-worker.js** — 1 hàm: `pointRunNo` (dòng 44)
