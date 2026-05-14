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

## 2026-05-14: Keep file transfer peer-to-peer only

Context:

- TURN and WebSocket relay modes consume deployment-side traffic.
- The existing `WSPeer` client path was incomplete and could imply server-side payload relay.

Decision:

- Remove the WebSocket payload fallback path.
- Allow the server to relay only WebRTC `signal` messages.
- Add optional room settings and IP visibility scopes for discovery without adding deployment-side file relay.

Consequences:

- WebRTC failure is surfaced as a connection failure rather than falling back to server relay.
- The default room remains automatic and invisible to users.
- Custom room names, password keys, and wider IP visibility scopes only affect peer discovery.

## 2026-05-14: Add a Cloudflare Worker signaling path

Context:

- Cloudflare build environments cannot run `pnpm run dev` as a deployment command because it starts a long-running Node server.
- Cloudflare static hosting alone cannot handle `/server/*` WebSocket signaling.

Decision:

- Keep the Node server for local, Docker, and VPS-style deployments.
- Add `worker/index.mjs` plus `wrangler.jsonc` for Cloudflare Workers deployments.
- Use a Durable Object for live room coordination.

Consequences:

- Cloudflare deployments use `pnpm run cloudflare:deploy`.
- The Worker serves static assets and handles signaling without relaying file payloads.
- Cloudflare deployments require Durable Object support.
