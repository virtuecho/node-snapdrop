# Quality Gates

This document defines the checks that must pass before a change is considered clean.

## 1. Required checks

| Gate | Purpose | Command |
|---|---|---|
| install | verify the lockfile can restore dependencies | `pnpm install --frozen-lockfile` |
| lint | JavaScript syntax validation | `pnpm run lint` |
| test | runtime smoke test | `pnpm test` |
| architecture | repository convention checks | `pnpm run arch:check` |
| build | no-build project validation | `pnpm run build` |
| all | full local validation | `pnpm check` |

## 2. Minimum clean standard

A change is not ready until:

- dependencies are installed from `pnpm-lock.yaml`
- no generated dependency folders are committed
- no secrets or local `.env` files are committed
- changed commands are documented
- changed behavior has a test or documented manual verification
- `pnpm check` passes, unless the skipped check is explicitly explained

## 3. Failure policy

Do not fix failures by:

- deleting checks
- weakening checks without explanation
- committing generated output
- hiding warnings in scripts
- changing product behavior to satisfy a test that does not match the project

Instead:

- fix the underlying issue
- keep exceptions narrow
- document intentional gaps
