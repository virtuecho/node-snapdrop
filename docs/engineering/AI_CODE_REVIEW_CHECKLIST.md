# AI Code Review Checklist

Use this checklist when reviewing AI-generated or human-written changes.

## 1. Product boundary

- [ ] Does the change match the requested task?
- [ ] Does it preserve Snapdrop behavior unless a behavior change was requested?
- [ ] Does it avoid unnecessary frontend or server rewrites?
- [ ] Does it avoid unnecessary dependencies?

## 2. Server behavior

- [ ] Are WebSocket message types preserved?
- [ ] Are peer IDs and peer rooms handled safely?
- [ ] Are disconnect and keepalive paths still correct?
- [ ] Are rate limit and proxy assumptions documented when changed?
- [ ] Are errors handled without leaking sensitive data?

## 3. Client behavior

- [ ] Does the browser UI still load from `public/`?
- [ ] Are service worker changes intentional?
- [ ] Are static assets referenced by existing paths?
- [ ] Is browser compatibility considered for plain JavaScript changes?

## 4. Repository hygiene

- [ ] `pnpm-lock.yaml` is the only Node lockfile.
- [ ] `node_modules/`, `dist/`, `build/`, and `coverage/` are not committed.
- [ ] `.env` and secret files are not committed.
- [ ] New commands are documented.

## 5. Validation

- [ ] `pnpm install --frozen-lockfile` run when dependencies changed.
- [ ] `pnpm run lint` run.
- [ ] `pnpm test` run.
- [ ] `pnpm run arch:check` run.
- [ ] `pnpm check` run for non-trivial changes.
- [ ] Any skipped checks are explained.
