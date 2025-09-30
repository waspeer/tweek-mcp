# Tweek MCP

Minimal scaffold to start development.

## Prerequisites

- Node 20+
- PNPM 10+

## Setup

```bash
pnpm i
pnpm build
pnpm dev
```

You should see a startup message.

## Linting

Configured with [`@antfu/eslint-config`](https://github.com/antfu/eslint-config).

```bash
pnpm lint
```

## Env Config

Set at runtime (examples):

- `TWEEK_API_KEY` (required)
- `TWEEK_API_BASE` (default: `https://tweek.so/api`)
- `TWEEK_TOKENS_PATH` (default: `~/.config/tweek/tokens.json`)
- `TWEEK_REQUEST_TIMEOUT_MS` (default: `10000`)
- `TWEEK_TOKEN_REFRESH_BUFFER_SEC` (default: `120`)
- `TWEEK_ENCRYPTION_KEY` (optional)
