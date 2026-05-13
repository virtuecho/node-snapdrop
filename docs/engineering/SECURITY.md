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

## 3. Dependency policy

- Use `pnpm-lock.yaml` for reproducible installs.
- Keep dependencies minimal.
- Let Dependabot propose package updates.
- Run `pnpm check` after dependency changes.

## 4. Current controls

| Control | Location |
|---|---|
| HTTP rate limit | `index.js` |
| Secure peer cookie flag | `index.js` |
| Secret file ignore rules | `.gitignore` |
| Lockfile policy check | `scripts/check-architecture.js` |
| CodeQL scanning | `.github/workflows/codeql-analysis.yml` |

## 5. Reporting

For public repository use, report security issues through the repository owner's preferred GitHub security channel or a private maintainer contact if one is provided.
