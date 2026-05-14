# Security

## 1. Sensitive data

Do not commit:

- `.env` files
- API keys
- private keys
- OAuth secrets
- cookies
- production logs with private data
- production traffic captures

Use `.env.example` for documented configuration.

## 2. Network exposure

The app is meant for local or intentionally shared network use.

Before exposing it publicly, review:

- reverse proxy headers
- HTTPS termination
- rate limiting
- WebSocket upgrade handling
- trusted proxy settings in `index.js`
- room visibility scope, especially on shared public deployments

## 3. Relay policy

The deployment server must not relay file or text payloads.

Allowed WebSocket traffic:

- peer discovery messages
- keepalive messages
- WebRTC `signal` messages

Disallowed fallback behavior:

- TURN relay
- WebSocket file relay
- server-side file buffering
- server-side text payload forwarding

Room passwords are discovery keys only. They separate room membership but do not encrypt files and should not be treated as strong authentication.

## 4. Dependency policy

- Use `pnpm-lock.yaml` for reproducible installs.
- Keep dependencies minimal.
- Let Dependabot propose package updates.
- Run `pnpm check` after dependency changes.

## 5. Current controls

| Control | Location |
|---|---|
| HTTP rate limit | `index.js` |
| Secure peer cookie flag | `index.js` |
| Signal-only WebSocket relay | `index.js`, `worker/index.mjs` |
| Cloudflare room coordination | `worker/index.mjs`, `wrangler.jsonc` |
| Client-side room settings | `public/scripts/network.js`, `public/scripts/ui.js` |
| Secret file ignore rules | `.gitignore` |
| Lockfile policy check | `scripts/check-architecture.js` |
| CodeQL scanning | `.github/workflows/codeql-analysis.yml` |

## 6. Reporting

For public repository use, report security issues through the repository owner's preferred GitHub security channel or a private maintainer contact if one is provided.
