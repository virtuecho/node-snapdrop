# AGENTS.md

This file gives AI coding agents, Codex, and future maintainers the rules for working in this repository.

## 1. Project identity

This repository is a small full-stack Node.js web app:

- `index.js` starts an Express HTTP server and a WebSocket signaling server.
- `public/` contains the static Snapdrop client.
- Peers are grouped by detected client IP so devices on the same network can discover one another.
- Users can optionally choose a room, room password key, and wider IP visibility scope.
- The server does not store files, user accounts, or persistent peer state.
- The server must not relay file or text payloads; it only relays WebRTC signaling.

## 2. Non-negotiable rules

- Do not push to remote unless explicitly asked.
- Do not deploy unless explicitly asked.
- Do not publish packages unless explicitly asked.
- Do not commit secrets, private keys, cookies, production data, or local `.env` files.
- Do not commit generated dependency folders such as `node_modules/`.
- Preserve existing Snapdrop behavior unless the task explicitly asks to change it.
- Do not add TURN, WebSocket relay, or any fallback that moves file payloads through the deployment server unless explicitly requested.
- Keep changes small, reviewable, and reversible.
- Prefer commands in `package.json` over one-off manual steps.

## 3. Source of truth

Read these files before making broad changes:

```text
README.md
AGENTS.md
docs/engineering/ARCHITECTURE.md
docs/engineering/QUALITY_GATES.md
docs/engineering/CI_AND_HOOKS.md
docs/engineering/RUNBOOK.md
docs/engineering/SECURITY.md
.env.example
package.json
```

If documentation conflicts with code, inspect the code and update the docs in the same change when practical.

## 4. Runtime and package manager

- Runtime: Node.js `>= 18`
- Package manager: `pnpm@10.33.2`
- Lockfile: `pnpm-lock.yaml`

Do not reintroduce `package-lock.json` or `yarn.lock`.

## 5. Common commands

```bash
pnpm install
pnpm run dev
pnpm run dev:public
pnpm run lint
pnpm test
pnpm run arch:check
pnpm check
```

`pnpm check` is the strongest local validation command currently available.

## 6. Environment policy

Configuration is intentionally minimal:

- `PORT` controls the HTTP/WebSocket port.
- `NODE_ENV` may be used by tooling, but the app does not currently branch on it.

Use `.env.example` to document environment variables. Do not commit `.env`.

## 7. Quality gates

Before finishing a change, run:

```bash
pnpm check
```

If the change only updates documentation and cannot affect runtime behavior, at least run:

```bash
pnpm run arch:check
```

Do not claim a command passed unless it was actually run.

## 8. Agent workflow

1. Check `git status --short --branch`.
2. Read the relevant docs and source files.
3. Make the smallest coherent change.
4. Update docs when commands, boundaries, or behavior change.
5. Run the strongest relevant validation command.
6. Commit only when the user asks for commits.
7. Report changed files, commands run, and any skipped checks.

## 9. Commit policy

Use Conventional Commits:

```text
<type>(optional-scope): <description>
```

Examples:

```text
docs(agents): clarify validation workflow
build(pnpm): update lockfile
fix(server): guard missing peer cookie
test(smoke): cover static homepage response
```
