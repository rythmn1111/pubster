# Pubster — Backend Architecture

Location: `services/api`. Runtime **Node 20 LTS + TypeScript**, framework **Fastify**, ORM
**Prisma**, DB **PostgreSQL + PostGIS**. Runs as a **PM2** process. REST JSON API under `/api/v1`.

## Folder layout
```
services/api/
├── src/
│   ├── server.ts            # boot: build app, listen
│   ├── app.ts               # register plugins + module routes
│   ├── config/env.ts        # zod-validated env
│   ├── db/prisma.ts         # PrismaClient singleton
│   ├── plugins/
│   │   ├── auth.ts          # JWT verify decorator + requireRole guard
│   │   ├── errorHandler.ts  # central error -> JSON
│   │   ├── cors.ts
│   │   └── swagger.ts       # OpenAPI (@fastify/swagger)
│   ├── modules/
│   │   ├── auth/  pubs/  tables/  reservations/
│   │   ├── events/  menu/  orders/  payments/  metrics/
│   │   └── (each: schema.ts + service.ts + routes.ts)
│   └── lib/
│       ├── jwt.ts           # sign/verify access + refresh
│       ├── password.ts      # argon2 hash/verify
│       ├── geo.ts           # nearest-pubs raw query
│       └── errors.ts        # AppError types
├── prisma/{schema.prisma, seed.ts}
├── .env.example
└── package.json             # name: @pubster/api
```

## Conventions
- Each module: `schema.ts` (zod request/response), `service.ts` (business logic + Prisma),
  `routes.ts` (Fastify registration). Validation via `fastify-type-provider-zod`.
- Error shape: `{ error: { code, message, details? } }`. Central handler maps `AppError`, Zod,
  and Prisma errors.
- Response types exported to `packages/shared` for the dashboard + iOS.

## API surface (Phase 1)
**Auth**
- `POST /api/v1/auth/otp/request` `{ phone }` → `{ ok: true }` (dummy; no SMS)
- `POST /api/v1/auth/otp/verify` `{ phone, code }` → if `code === DUMMY_OTP_CODE`: upsert consumer
  User, return `{ accessToken, refreshToken, user }`
- `POST /api/v1/auth/login` `{ email, password }` → staff/manager tokens
- `POST /api/v1/auth/refresh` `{ refreshToken }` → rotated tokens
- `POST /api/v1/auth/logout` `{ refreshToken }` → revoke

**Pubs / Menu**
- `GET /api/v1/pubs/nearest?lat&lng&radius&limit` → pubs by distance
- `GET /api/v1/pubs/:id` → detail
- `GET /api/v1/pubs/:id/menu` → categories with items

**Tables** (staff/manager, `requireRole`)
- `GET /api/v1/pubs/:id/tables`
- `POST /api/v1/pubs/:id/tables` `{ seats, label?, quantity? }`
- `PATCH /api/v1/tables/:id`, `DELETE /api/v1/tables/:id`

**Reservations**
- `GET /api/v1/pubs/:id/availability?date&partyCount` → available slots (+ size class)
- `POST /api/v1/reservations` `{ pubId, startTime, partyCount, eventId? }` (consumer)
- `GET /api/v1/reservations/me`, `POST /api/v1/reservations/:id/cancel`
- Staff: `GET /api/v1/pubs/:id/reservations?date`, `POST /api/v1/reservations/:id/status`

(Phase 2 adds events CRUD/join, orders, payments; Phase 3 adds metrics.)

## Auth design
- Access JWT (~15 min): claims `{ sub, role, pubId? }`. Refresh token (~30 days): opaque random,
  stored **hashed** in `RefreshToken`, rotated on refresh.
- `requireRole(...roles)` guard; pub-scoped routes also check `pubId` matches the token.
- Dummy OTP: env `DUMMY_OTP_CODE` (default `000000`); any phone accepted; a **real** consumer User
  row is upserted → tokens issued. Only SMS is stubbed.
- Passwords: **argon2id**.

## Environment (`.env.example`)
```
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://user:pass@localhost:5432/pubster
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
DUMMY_OTP_CODE=000000
CURRENCY=USD
CORS_ORIGINS=http://localhost:3000
```
Env validated at boot with zod; process exits on invalid config. `.env` is never committed.

## Process management (PM2)
- Root `ecosystem.config.js` defines app `pubster-api`: `script: services/api/dist/server.js`,
  `instances: 1` (fork), `env_production`, autorestart, `max_memory_restart`.
- Structured logging via pino (Fastify default); logs captured by PM2.

## Deploy (see `CLAUDE.md` §2 — never edit the VPS directly)
On the server, AFTER `git pull`:
```
pnpm install --frozen-lockfile
pnpm --filter @pubster/api prisma generate
pnpm --filter @pubster/api prisma migrate deploy
pnpm --filter @pubster/api build
pm2 reload ecosystem.config.js --only pubster-api
```
Wrapped in `scripts/deploy.sh`. `.env` lives on the server (untracked).

## Testing
- vitest + supertest for auth, availability, and booking. Dedicated test DB.
- `prisma validate` + `tsc --noEmit` gate commits.

## Security (MVP → later)
- CORS locked to dashboard origins; helmet headers; input validation via zod everywhere.
- Rate limiting on auth endpoints — later.
