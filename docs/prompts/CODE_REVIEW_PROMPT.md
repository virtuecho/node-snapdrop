# Code Review Prompt

Use this prompt for AI-assisted reviews.

```md
# Review this change

Review the current diff for bugs, regressions, missing tests, security risks, and repository hygiene issues.

Prioritize findings over summary. Include file and line references where possible.

Project context:

- Node.js Snapdrop server and static browser client.
- Package manager: pnpm.
- Main validation command: `pnpm check`.
- Server entry: `index.js`.
- Static client: `public/`.

Review checklist:

- Does the change preserve peer discovery and WebSocket signaling behavior?
- Are static asset paths still valid?
- Are generated files and secrets excluded?
- Are dependency changes justified and reflected in `pnpm-lock.yaml`?
- Were relevant checks run?
```
