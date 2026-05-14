# node-snapdrop [![CI](https://github.com/Bellisario/node-snapdrop/actions/workflows/ci.yml/badge.svg)](https://github.com/Bellisario/node-snapdrop/actions/workflows/ci.yml) [![CodeQL](https://github.com/Bellisario/node-snapdrop/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/Bellisario/node-snapdrop/actions/workflows/codeql-analysis.yml)

Just the original Snapdrop, with a complete Node.js server.

> [!NOTE]
> We do not endorse any recent changes made to the original Snapdrop, sold to LimeWire and [considered badware](https://github.com/uBlockOrigin/uAssets/issues/27172) by uBlock Origin, so we removed all links referring to it.
>
> This repository acts as a pre-LimeWire and Node.js version of the good old Snapdrop.

## Requirements

- Node.js `>= 18`
- pnpm `10.33.2`

If pnpm is not available, enable it through Corepack:

```bash
corepack enable
```

## Getting started

Clone and enter the repository:

```bash
git clone https://github.com/Bellisario/node-snapdrop.git
cd node-snapdrop
```

Install dependencies:

```bash
pnpm install
```

Start the local server:

```bash
pnpm run dev
```

Open:

```text
http://127.0.0.1:3000
```

## Public run

If you want to run on a public or shared interface, use:

```bash
pnpm run dev:public
```

> [!TIP]
> Check your machine's IP address before sharing the URL.

## Commands

| Command | Purpose |
|---|---|
| `pnpm install` | Install dependencies from `pnpm-lock.yaml`. |
| `pnpm run dev` | Run the app locally. |
| `pnpm run dev:public` | Run with the public listen mode. |
| `pnpm run lint` | Check JavaScript syntax. |
| `pnpm test` | Start the app and smoke test `GET /`. |
| `pnpm run arch:check` | Verify repository hygiene conventions. |
| `pnpm run build` | Run no-build project validation. |
| `pnpm check` | Run all local quality gates. |

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP and WebSocket port. |
| `NODE_ENV` | `development` in `.env.example` | Conventional Node runtime environment value. |

Copy `.env.example` for local notes if needed, but do not commit `.env`.

## Rooms and visibility

Every visitor joins the default room automatically, so the default experience remains the same as classic Snapdrop.

Use the room settings button only when you want to override discovery:

| Setting | Effect |
|---|---|
| Room | Separates discovery by a user-chosen room name. |
| Password | Adds a local discovery key to the room. It does not encrypt files. |
| Visible range | Changes the server-side IP grouping from exact IP to `/24` or `/16` for IPv4, and `/64` or `/48` for IPv6. |

The deployment server only relays WebRTC signaling. File and text payloads must travel peer-to-peer through WebRTC; there is no TURN or WebSocket file relay fallback.

## Project structure

```text
index.js                  Node.js HTTP and WebSocket server
public/                   Static Snapdrop client assets
scripts/                  Local validation scripts
docs/engineering/         Architecture, quality, CI, security, and runbook docs
docs/prompts/             Reusable AI collaboration prompts
.github/workflows/        CI and CodeQL workflows
```

## Validation

Run the full local check before handing off a non-trivial change:

```bash
pnpm check
```

The current check suite verifies JavaScript syntax, repository conventions, and a runtime smoke test.

## Docker

Build:

```bash
docker build -t node-snapdrop .
```

Run:

```bash
docker run --rm -p 3000:3000 node-snapdrop
```

## Cloudflare Workers

This repository also includes a Cloudflare Workers deployment path:

```bash
pnpm run cloudflare:deploy
```

Cloudflare should not run `pnpm run dev` during deployment. `pnpm run dev` starts a long-running Node.js server and will time out in Cloudflare's build environment.

Recommended Cloudflare build settings:

| Setting | Value |
|---|---|
| Build command | `pnpm install --frozen-lockfile` or empty if Cloudflare already installs dependencies |
| Deploy command | `pnpm run cloudflare:deploy` |
| Config file | `wrangler.jsonc` |

The Worker serves `public/` as static assets and handles `/server/*` WebSocket signaling through a Durable Object. It does not relay files or text payloads.

## Contributing

We love contributions. Feel free to open an [issue](https://github.com/Bellisario/node-snapdrop/issues) or a [pull request](https://github.com/Bellisario/node-snapdrop/pulls), and follow the [Contributing Guidelines](https://github.com/Bellisario/node-snapdrop/blob/main/CONTRIBUTING.md).

For AI-assisted work, read [AGENTS.md](AGENTS.md) first.

## License

GPL-3.0 License [here](https://github.com/Bellisario/node-snapdrop/blob/main/LICENSE).
