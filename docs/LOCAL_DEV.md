# Pubster — Local Development

How to run the stack locally. (Production deploy is different — see `CLAUDE.md` §2: never edit the
VPS directly.)

## Prerequisites
- **Node 20+** (developed on Node 25).
- **pnpm** via corepack: `corepack enable && corepack prepare pnpm@latest --activate`.
- **PostgreSQL 17** (Homebrew) with **PostGIS 3.6**:
  ```
  brew install postgresql@17 postgis
  brew services start postgresql@17     # server on localhost:5432
  ```

## Database
```
createdb pubster
psql pubster -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```
Set the connection in `services/api/.env` (git-ignored — never commit it):
```
DATABASE_URL=postgresql://<user>@localhost:5432/pubster
```
(On a local Homebrew install the `<user>` is usually your macOS username, no password.)

## Install, migrate, seed
```
pnpm install
pnpm --filter @pubster/api exec prisma migrate deploy   # apply migrations
pnpm --filter @pubster/api exec prisma generate          # generate client
pnpm --filter @pubster/api exec prisma db seed           # seed test data (idempotent)
```

## Seeded test data
- 4 Boston-area pubs (Bell in Hand, Black Rose, Cheers Beacon Hill, Lansdowne) with table
  inventories, menus, and upcoming events.
- Dashboard accounts:
  - **Manager:** `manager@bellinhand.test` / `ManagerPass123!`
  - **Staff:** `staff@bellinhand.test` / `StaffPass123!`
- Consumer login uses phone + dummy OTP **`000000`** (any phone; a real DB user is created).

## Run the API
```
pnpm --filter @pubster/api dev        # dev server (tsx watch)
# health check:
curl localhost:4000/api/v1/health     # -> {"status":"ok"}
```

## Verify the geo path
```
psql pubster -c "SELECT name, round(ST_Distance(location, ST_MakePoint(-71.0589,42.3601)::geography)) AS meters FROM \"Pub\" ORDER BY meters ASC;"
```
