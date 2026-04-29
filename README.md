# InstaMail

Local-first temporary email web app backed by a small Express API and a Vite React frontend.

## Requirements

- Node.js 22+
- Corepack enabled
- pnpm via Corepack

## Local Setup

```powershell
corepack enable
corepack pnpm install
Copy-Item .env.api.example .env.api.local
Copy-Item .env.web.example .env.web.local
corepack pnpm run dev:api
corepack pnpm run dev:web
```

Open `http://localhost:5173`.

Default local password:

```text
dev-password
```

Change it in `.env.api.local` before sharing the app.

## Environment

API env:

```env
NODE_ENV=production
PORT=8080
APP_PASSWORD=change-this-admin-password
AUTH_SECRET=change-this-to-a-long-random-secret-at-least-32-chars
ALLOWED_ORIGINS=https://your-domain.com
RATE_LIMIT_PER_MINUTE=120
KUKU_COOKIE=
```

Web env:

```env
PORT=5173
BASE_PATH=/
```

`KUKU_COOKIE` is optional and local-only. If Kuku.lu asks for Cloudflare Turnstile on a new backend session, you can paste a verified `m.kuku.lu` Cookie header into `.env.api.local` for local testing. Never commit that value.

## Scripts

```powershell
corepack pnpm run typecheck
corepack pnpm run build
corepack pnpm run dev:api
corepack pnpm run dev:web
```

## Security Notes

- The app uses an httpOnly signed login cookie.
- Kuku session data is stored server-side in memory.
- CORS and write origins are controlled by `ALLOWED_ORIGINS`.
- Request bodies are size-limited and responses are marked `no-store`.
- For multi-instance production deployment, replace the in-memory session store with Redis, Postgres, or another shared store.
- Do not commit `.env.api.local`, `.env.web.local`, cookies, logs, or generated build output.
