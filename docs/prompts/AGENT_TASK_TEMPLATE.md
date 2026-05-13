# Agent Task Template

Use this prompt when asking an AI coding agent to work in this repository.

```md
# Task

Describe the requested change.

## Constraints

- Preserve existing Snapdrop behavior unless explicitly changing it.
- Use pnpm.
- Do not push, deploy, or publish.
- Do not commit secrets or generated dependency folders.
- Keep the change small and reviewable.

## Expected workflow

1. Check `git status --short --branch`.
2. Read `README.md`, `AGENTS.md`, and relevant docs in `docs/engineering/`.
3. Inspect the relevant source files.
4. Make the smallest coherent change.
5. Run `pnpm check` or explain why a narrower check is enough.
6. Summarize changed files and validation.
```
