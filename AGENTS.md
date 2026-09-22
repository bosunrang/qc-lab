# AGENTS.md

This file provides guidance to Codex when working in this repository.

# QC Lab app

Only `app/` is product source. It is an Electron desktop app with a React
renderer and SQLite in the main process. The renderer uses `HashRouter`; IPC
types live exclusively in `app/shared/qc-api.d.ts`.

## Commands

```powershell
npm run dev
npm start
npm test
npm run typecheck
npm run build
npm run dist
```

`npm run dev` serves the browser preview on port 5174. `npm start` builds and
opens Electron. The preview uses sql.js/WASM only in the browser; packaged
Electron uses `node:sqlite` and excludes the WASM asset.

## Development rules

- Read the relevant section of `docs/APP-PLAN.md` before changing app.
- Keep read IPC rows in SQLite `snake_case`; form drafts use `camelCase`.
- Every write handler performs authorization first, then pure validation,
  transaction, `writeAudit()`, and `notifyChanged()`.
- Do not hard-delete QC points; use the existing void workflow.
- Run `npm test`, `npm run typecheck`, and `npm run build` for code changes.
- `docs/WESTGARD-REVIEW-*.md` and `docs/SIGMA-REVIEW-*.md` record the business
  reviews and the decisions taken; read the matching one before touching the
  Westgard or Six Sigma logic. The `*-probes-*.cjs` beside them capture the
  PRE-FIX state on purpose and are expected to fail — the live regressions are
  in `app/tests/`, run by `npm test`.
