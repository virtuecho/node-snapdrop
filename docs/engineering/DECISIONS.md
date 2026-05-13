# Decisions

Record lightweight engineering decisions here. Keep entries short and link to pull requests or issues when available.

## 2026-05-13: Use pnpm as the package manager

Context:

- The repository previously used npm and `package-lock.json`.
- The project is a small Node.js app with no build step.

Decision:

- Use `pnpm@10.33.2`.
- Track `pnpm-lock.yaml`.
- Do not track `package-lock.json` or `yarn.lock`.

Consequences:

- Local setup uses `pnpm install`.
- CI uses `pnpm install --frozen-lockfile`.
- Docker installs dependencies with pnpm.

## 2026-05-13: Keep validation lightweight

Context:

- The project has a small plain JavaScript server and static browser assets.
- There is no TypeScript compiler or bundler.

Decision:

- Use Node syntax checks, a repository architecture check, and a smoke test as the default quality gates.
- Expose all checks through `pnpm check`.

Consequences:

- Validation is fast and reproducible.
- Future behavior changes should add focused tests rather than replacing the smoke test with broad tooling immediately.
