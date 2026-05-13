# Runbook

## 1. Local setup

```bash
pnpm install
```

If pnpm is not available, enable it through Corepack:

```bash
corepack enable
```

## 2. Run locally

```bash
pnpm run dev
```

The server listens on `PORT` or `3000` by default.

Open:

```text
http://127.0.0.1:3000
```

## 3. Run on a public interface

```bash
pnpm run dev:public
```

Use this only when you intentionally want the app reachable beyond the local machine.

## 4. Validate a change

```bash
pnpm check
```

For a quick runtime check only:

```bash
pnpm test
```

The smoke test starts the server on a temporary local port, requests `/`, and terminates the child process.

## 5. Docker

Build:

```bash
docker build -t node-snapdrop .
```

Run:

```bash
docker run --rm -p 3000:3000 node-snapdrop
```

## 6. Troubleshooting

| Symptom | Check |
|---|---|
| Port already in use | Set `PORT` to another value. |
| Peers do not see each other | Confirm they share the expected network/IP path and proxy headers. |
| CI install fails | Confirm `pnpm-lock.yaml` matches `package.json`. |
| Smoke test fails | Run `pnpm run dev` and inspect server output. |

## 7. Rollback

No database or persistent storage is managed by this app. Roll back by reverting the code change and redeploying with the previous lockfile and Docker image.
