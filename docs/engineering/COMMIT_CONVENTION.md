# Commit Convention

Use Conventional Commits:

```text
<type>(optional-scope): <description>
```

## Allowed types

| Type | Meaning |
|---|---|
| `feat` | User-facing feature. |
| `fix` | Bug fix. |
| `refactor` | Code change that preserves behavior. |
| `perf` | Performance improvement. |
| `style` | Formatting or style-only change. |
| `test` | Test additions or updates. |
| `docs` | Documentation changes. |
| `build` | Package manager, dependency, or build workflow changes. |
| `ops` | CI, deployment, or operational workflow changes. |
| `chore` | Repository maintenance. |

## Examples

```text
build(pnpm): update lockfile
docs(runbook): document local smoke test
fix(server): handle missing peer cookie
test(smoke): verify homepage response
```

## Rules

- Keep each commit focused on one coherent change.
- Do not mix product behavior changes with formatting-only edits.
- Do not include generated files unless the repository explicitly tracks them.
- Do not claim validation in the commit message unless the command was actually run.
