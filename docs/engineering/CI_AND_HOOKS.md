# CI and Hooks

## 1. Purpose

CI exists to run the same checks that maintainers can run locally.

Current CI command:

```bash
pnpm check
```

## 2. CI workflow

The main workflow is:

```text
.github/workflows/ci.yml
```

It runs on pushes to `main` and on pull requests.

Current steps:

1. check out the repository
2. set up Node.js
3. enable pnpm through Corepack
4. install dependencies with `pnpm install --frozen-lockfile`
5. run `pnpm check`

CodeQL remains in:

```text
.github/workflows/codeql-analysis.yml
```

## 3. Local hooks

No hooks are installed by default.

Recommended future hooks:

| Hook | Purpose |
|---|---|
| `pre-commit` | Run syntax checks or `pnpm run arch:check` on changed files. |
| `commit-msg` | Validate Conventional Commit messages. |

Do not add hooks that deploy, publish, push, or perform slow production work.

## 4. Local principle

CI should not perform validation that maintainers cannot reproduce locally. If a CI check changes, update `README.md`, `AGENTS.md`, and `docs/engineering/QUALITY_GATES.md`.
