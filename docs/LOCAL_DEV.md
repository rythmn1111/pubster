# Pubster — Local Development (Database + PostGIS)

How to run the stack locally, focused on the database + PostGIS so migrations,
the seed, and the "nearest pubs" geo query work. Production deploy is different —
see `CLAUDE.md` §2: never edit the VPS directly, never commit `.env`.

This documents the **exact path used** on the reference machine.

## Reference versions used

| Component  | Version / value |
|---|---|
| PostgreSQL | **17.9** (Homebrew `postgresql@17`), running on `localhost:5432`, socket in `/tmp` |
| PostGIS    | **3.6.4** (Homebrew `postgis`; its bottle builds against `postgresql@17`) |
| Prisma     | **6.19.3** |
| DB role    | `dixitsolanki` — the macOS user, a Postgres **superuser**; local + TCP auth is `trust`, so **no password** for dev |
| Database   | `pubster` (created fresh; the pre-existing `cheese_pos` DB was left untouched) |

## Prerequisites
- **Node 20+**, **pnpm** via corepack: `corepack enable && corepack prepare pnpm@latest --activate`.
- **PostgreSQL 16/17** running. To use Homebrew's:
  ```bash
  brew install postgresql@17
  brew services start postgresql@17     # server on localhost:5432
  pg_isready                            # -> "/tmp:5432 - accepting connections"
  ```
- Find your superuser role (usually your macOS user):
  ```bash
  psql -l                    # databases + owners
  psql postgres -c "\du"     # roles; look for "Superuser"
  ```

## 1. Install PostGIS (once)
Stock Homebrew PostgreSQL has no PostGIS. Adding it is **additive** — it does not
touch existing databases:
```bash
brew install postgis        # pulled 3.6.4 + deps (gdal, geos, proj, ...)
```
The `postgis` formula builds extension files for both `postgresql@17` and
`postgresql@18`, so it works for the running `@17` server with no restart. Confirm:
```bash
psql postgres -tc \
  "SELECT name, default_version FROM pg_available_extensions WHERE name='postgis';"
# -> postgis | 3.6.4
```
> Gotcha: PostGIS must be built for the **same major version** as the running
> server, or `CREATE EXTENSION postgis` fails with "could not open extension
> control file". Check `postgres --version` first.

## 2. Create the `pubster` database
```bash
psql "postgresql://dixitsolanki@localhost:5432/postgres" \
  -c "CREATE DATABASE pubster OWNER dixitsolanki;"
```
Replace `dixitsolanki` with your own superuser role. We use the dev superuser
directly for simplicity; a dedicated least-privilege role also works but isn't
required locally. You do **not** run `CREATE EXTENSION` by hand — the Prisma
migration does it (also inside Prisma's shadow DB).

## 3. Configure the API `.env` (git-ignored — never commit)
```bash
cp services/api/.env.example services/api/.env
```
Set at minimum:
```
DATABASE_URL=postgresql://dixitsolanki@localhost:5432/pubster?schema=public
```

## 4. Migrate
```bash
pnpm install
pnpm --filter @pubster/api exec prisma migrate dev     # applies migrations/20260702143336_init
pnpm --filter @pubster/api exec prisma migrate status  # -> "Database schema is up to date!"
```
Migration highlights (`services/api/prisma/migrations/20260702143336_init/migration.sql`):
- `CREATE EXTENSION IF NOT EXISTS "postgis";` — emitted automatically by the
  `postgresqlExtensions` preview feature (`extensions = [postgis]` on the datasource).
- All tables + enums from `docs/DATABASE.md`.
- A **hand-added GiST index** on the PostGIS column (Prisma writes no index DDL
  for `Unsupported` columns during migrate):
  ```sql
  CREATE INDEX "Pub_location_idx" ON "Pub" USING GIST ("location");
  ```
  The schema also declares `@@index([location], type: Gist)` on `Pub` so drift
  detection stays clean — without it, `migrate dev` would try to drop the index.

Fresh-DB apply (what deploy does) is verified via `prisma migrate deploy` against
a throwaway DB; the `CREATE EXTENSION` succeeds there and on Prisma's shadow DB.

## 5. Seed (idempotent)
Seed config is wired in `services/api/package.json` (`prisma.seed = tsx prisma/seed.ts`):
```bash
pnpm --filter @pubster/api exec prisma db seed
```
Seeds 4 Boston-area pubs (Bell in Hand, Cheers Beacon Hill, Black Rose, Lansdowne),
each with a mixed table inventory (2×2-seat, 3×4-seat, 2×6-seat), a menu, and one
upcoming event; plus a manager + staff user on the first pub. `Pub.location` is set
from lat/lng via raw SQL after each insert. Clean-then-insert → safe to re-run.

Seeded dashboard accounts (email + password, argon2id):
- **Manager:** `manager@bellinhand.test` / `ManagerPass123!`
- **Staff:** `staff@bellinhand.test` / `StaffPass123!`

Consumer login uses phone + dummy OTP **`000000`** (any phone; a real DB user is
created).

## 6. Verify the geo path
```bash
psql pubster -c \
  "SELECT name, round(ST_Distance(location, ST_MakePoint(-71.0589,42.3601)::geography)) AS meters
   FROM \"Pub\" ORDER BY meters ASC;"
# Bell in Hand ~157 m first, Lansdowne ~3489 m last
```

## Run the API
```bash
pnpm --filter @pubster/api dev        # dev server (tsx watch)
curl localhost:4000/api/v1/health     # -> {"status":"ok"}
```

## Notes / gotchas
- Prisma warns that `package.json#prisma` (seed config) moves to `prisma.config.ts`
  in Prisma 7. Harmless on 6.19.3; migrate later.
- `tsc` for `@pubster/api` only compiles `src/**`; `prisma/seed.ts` runs via `tsx`
  and is outside the typecheck.
- After `pnpm install` / deploy, run `prisma generate` so the client matches the schema.
- A Docker/`docker-compose` path (`postgis/postgis:16-3.4`) is a valid alternative
  but was **not** used here (Docker isn't installed on the reference machine).
