# AGENTS.md — Pubster: Status, Progress & Handoff

**Last updated:** 2026-07-15
**Companion docs:** `CLAUDE.md` (source-of-truth spec + golden rules), `docs/ROADMAP.md` (checklist),
`docs/DATABASE.md`, `docs/BACKEND.md`, `docs/LOCAL_DEV.md`.

This file is a plain-language, detailed snapshot of *what we're building, what is finished, what we're
doing right now, and what comes next* — so anyone (human or agent) can pick up with full context.

---

## 0. ⭐ LATEST STATE (read this first — resume here)

**Backend is DEPLOYED and LIVE on the VPS.** Phase-1 API runs under PM2 as `pubster-api` on
`http://147.93.169.15:4000` (PostgreSQL + PostGIS, seeded: 4 Boston pubs, events, staff accounts).
Reachable from the public internet; verified end-to-end. The whole Phase-1 backend + web dashboard +
original iOS app are merged into `phase-1-foundation` and pushed to GitHub (`main` also updated).

**iOS app now WORKS end-to-end against the live VPS** (onboarding w/ OTP `000000` → Discover with real
pubs + events carousel → pub detail → reserve). It's on the **"Sunset" design** (vibrant orange, full
light+dark, events-first) with **real data wired in**.

**Design journey / decision pending:**
- Warm-pub look (amber + serif) — ❌ rejected by user.
- **Sunset** (orange `#EA6113/#F88F22/#FBB931/#FFE3B3`, light+dark, events carousel) — ✅ current, liked.
  Only **Discover + EventDetail** got the Sunset restyle; onboarding/pub-detail/reserve/bookings still use
  the old layout (they inherit the orange tint).
- **Uber-Eats-style layout** — user REQUESTED it; the build agent stalled on an infra timeout before
  writing code. **NOT built.** See task #13.

**⚠️ THE OPEN FORK (ask the user before proceeding):** keep polishing **Sunset** across all screens, OR
**retry the Uber-Eats layout**? This decision drives most remaining UI work.

**Open PRs on GitHub (`rythmn1111/pubster`) — nothing merged yet:**
- PR #1 `ui-redesign` → `phase-1-foundation` — warm-pub look (**rejected; can close**).
- PR #2 `redesign-events-home` → `phase-1-foundation` — Sunset redesign (mock data).
- PR #3 `wire-live-vps-data` → `redesign-events-home` — live VPS data (makes the app functional). Stacks on
  #2; retarget to `phase-1-foundation` after #2 merges.

**Cleanup debts before shipping:** remove iOS debug launch flags (`-previewMain`, `-openEventDetail`);
tighten the dev-only `NSAllowsArbitraryLoads` ATS (or move backend to HTTPS); fix Keychain access for
unsigned simulator builds (add `keychain-access-groups` entitlement / ad-hoc signing) — currently the app
is run as an ad-hoc-signed build so tokens persist. **Web dashboard is built but NOT deployed** (only the
API is). To point the iOS build at the VPS, build with `API_BASE_URL='http://147.93.169.15:4000/api/v1'`.

**VPS deploy specifics:** repo cloned at `/root/pubster` (deployed from `main`); prod `.env` at
`services/api/.env` (untracked, secrets generated on server); Postgres role `pubster` / db `pubster`;
PM2 app `pubster-api` (`pm2 save`d). Server is shared (~18 other apps) — port 4000 is ours; NEVER
hand-edit on the VPS (commit → push → pull → deploy; see §2).

**Next major work (unstarted):** Phase 2 (event cover charges + join, food pre-order, stubbed payments)
and Phase 3 (manager metrics, push notifications). See §5/§10.

---

## 1. The overall goal — what Pubster is

Pubster is a **pub discovery + reservation + events platform** with a native iOS consumer app, two web
dashboards for pub staff, and a backend API. The full product vision:

- **Consumers** open the iOS app, see the **nearest pubs around them**, and browse each pub's **menu** and
  the **events** happening there.
- They can **reserve a table** for a **time slot** (pick a time frame → enter party size → see if a suitable
  table is free → book).
- Where an **event** is running, they can **join it** — which can carry a **per-person cover charge**.
- They can **pre-order food** from the menu against their reservation.
- **Onboarding is phone number + OTP.** For now the OTP is a **dummy** system: any phone number logs in with
  the dummy code `000000` — **but a real user is created in the database** (only SMS/verification is stubbed),
  so everything downstream behaves realistically for testing.

On the **pub side** there are **two logins**:
1. **General Dashboard** (web, for computers/iPads) — floor staff see reservation status, the order queue,
   and can **add/remove tables**.
2. **Manager Dashboard** (web, elevated) — all the metrics and managerial tools. The manager sets the pub's
   **total capacity** and defines the **table inventory** (e.g. "2× 2-seat, 5× 6-seat, …").

Everything is a **monorepo**. The backend runs on our **VPS** as **PM2** processes, deployed strictly via
git (never hand-edited on the server).

---

## 2. The four surfaces

| Surface | Who | Tech | Purpose |
|---|---|---|---|
| **Consumer app** | End users | Native Swift / SwiftUI | Discover nearest pubs, menu, events; reserve tables w/ slots; join events; pre-order |
| **General Dashboard** | Floor staff | Next.js (web) | Live reservations, order queue, add/remove tables |
| **Manager Dashboard** | Manager | Next.js (web, elevated) | Metrics + config: capacity, table inventory, menu, events, pricing |
| **Backend API** | — | Fastify + Prisma, PM2 on VPS | Serves all clients + the database |

*(The two dashboards are one Next.js app with role-based access, not two separate apps.)*

---

## 3. Tech stack & architecture

- **Monorepo:** pnpm workspaces + Turborepo. Layout: `apps/ios`, `apps/dashboard`, `services/api`,
  `packages/shared` (shared TypeScript DTOs).
- **Backend:** Node + TypeScript, **Fastify**, run as a **PM2** process. REST under `/api/v1`.
- **Database:** **PostgreSQL + PostGIS** (PostGIS powers the "nearest pubs" geo queries), via **Prisma** (v6).
- **Web:** **Next.js (App Router)**, single role-gated app (staff vs manager).
- **iOS:** native **SwiftUI**, min iOS 17, project generated by **XcodeGen** (keeps `.xcodeproj` out of git).
- **Auth:** JWT access (15m) + rotating refresh (30d, hashed). Consumers = phone+dummy-OTP; staff/manager =
  email+password (argon2id).
- **Money/payments:** integer cents, currency default **USD**; payments are **stubbed for MVP** (recorded as
  "paid", no real money) — real Stripe deferred.

---

## 4. Golden rule (from CLAUDE.md §2) — never edit the VPS directly

The server is **deploy-only**. The only path is: **commit → push to GitHub → pull on the server →
deploy with a proper `.env` → `pm2 reload`.** Never hand-edit application files over SSH; fix in the repo and
redeploy. `.env` lives on the server (and locally), never committed.

---

## 5. Build phases

- **Phase 1 — Core (foundation).** ✅ **DONE** (see §6): monorepo + backend (auth, pubs/menu, reservations)
  + DB/seed + general dashboard + iOS app.
- **Phase 2 — Commerce.** ⏭️ Not started: events cover charges, join-event, pre-order food, stubbed payments,
  dashboard order queue + event management, iOS event/pre-order/payment/bookings screens.
- **Phase 3 — Insight.** ⏭️ Not started: manager metrics (revenue, occupancy, no-shows, top items),
  push notifications (APNs), super-admin pub onboarding + manager account creation.

---

## 6. ✅ What is DONE — Phase 1, in detail

All committed on `phase-1-foundation`. Commit history (newest first):

```
7ead990  merge dashboard  (HEAD)
b4f8d1b  feat(dashboard): Next.js — staff/manager login, reservations + table management
3e853b2  feat(ios): SwiftUI app — onboarding (dummy OTP), discover, pub detail, reserve
a176d00  feat(reservations): table CRUD + slot availability + race-safe booking/cancel + staff mgmt
b3d09ac  feat(pubs): public nearest (PostGIS) + detail + menu + upcoming events
8b5753c  feat(auth): dummy-OTP + email/password, JWT access + rotating refresh, requireRole
ec3bcb7  feat(db): full Prisma schema (PostGIS) + init migration + seed
ce285ae  docs(local-dev)
4f33a34  chore: scaffold monorepo (pnpm+turbo) + Fastify/Prisma skeleton + shared package
62f4865  docs: CLAUDE.md + architecture docs
77d8af2  Initial commit
```

### 6.1 Monorepo + backend skeleton (`4f33a34`)
pnpm workspaces + Turborepo, base tsconfig, eslint/prettier, `.gitignore`, PM2 `ecosystem.config.js`,
`scripts/deploy.sh`. `services/api` Fastify skeleton (zod-validated env, Prisma client, health routes,
central error handler `{ error: { code, message } }`, module folders). `packages/shared` for DTOs.

### 6.2 Database + seed (`ec3bcb7`)
**11 models** — User, Pub, RestaurantTable, Reservation, Event, MenuCategory, MenuItem, Order, OrderItem,
Payment, RefreshToken — and **6 enums**. `Pub.location` is a PostGIS `geography(Point,4326)` with a GiST
index. Applied migration + idempotent seed:
- **4 real Boston pubs** (The Bell in Hand, The Black Rose, Cheers Beacon Hill, Lansdowne Pub) with
  coordinates, hours, photos, 90-minute slots.
- Each pub: **7 tables** (2× 2-seat, 3× 4-seat, 2× 6-seat) = 28 total, a **menu** (categories + items), and
  **one upcoming event** with a cover charge.
- **Seeded dashboard accounts:** manager `manager@bellinhand.test` / `ManagerPass123!`,
  staff `staff@bellinhand.test` / `StaffPass123!`.

### 6.3 Auth (`8b5753c`)
`/api/v1/auth`: `otp/request`, `otp/verify` (code `000000` → upserts a real consumer user + tokens),
`login` (staff/manager email+password), `refresh` (rotates, revokes old), `logout`, `GET /me`. JWT access +
hashed rotating refresh tokens; `requireAuth`, `requireRole(...)`, and pub-scope guards.
**Verified: 12/12 fastify.inject tests.**

### 6.4 Pubs / menu / events (`b3d09ac`) — public reads
`GET /pubs/nearest?lat&lng&radius&limit` (PostGIS `ST_DWithin`/`ST_Distance`, distance-ordered),
`GET /pubs/:id`, `GET /pubs/:id/menu`, `GET /pubs/:id/events` (upcoming). **Verified: 10 tests** — nearest
returns the 4 pubs ordered by distance (Bell in Hand ~157m → Lansdowne ~3489m).

### 6.5 Reservations + tables (`a176d00`) — the core booking logic
- **Tables** (staff/manager, pub-scoped): list, add (with quantity), edit, delete.
- **Availability** (public): generates slots from opening hours; for a party size, finds the **smallest table
  size class with free capacity** (exactly per `docs/DATABASE.md`).
- **Booking** (consumer): **race-safe** — a per-pub Postgres advisory lock inside a transaction re-checks
  availability before inserting, so concurrent bookings can't overbook. Plus `reservations/me`, cancel, staff
  list-by-date, and staff status updates (seated/completed/no_show).
- **Verified: 51/51 tests**, including smallest-fit (party 2→2-seat, 3→4-seat, 5→6-seat, 7→rejected),
  overbooking escalation, **a true concurrency test** (two simultaneous bookings for the last table →
  exactly one wins), and cancel-frees-capacity.

### 6.6 General Dashboard (`b4f8d1b`) — `apps/dashboard`, Next.js
Staff/manager email login (token storage + transparent refresh on 401), `GET /me` for role+pubId, protected
routes. Pages: **/reservations** (today's list + occupancy summary + status controls), **/tables**
(add/edit/delete inventory), **/metrics** (manager-only "coming soon" stub). **Verified:** `next build`
succeeds, all routes prerender, typecheck/lint/format clean.

### 6.7 iOS app (`3e853b2`) — `apps/ios`, SwiftUI via XcodeGen
App scaffold + router; `APIClient` (URLSession async/await, Codable DTOs, **Keychain** token storage,
single-flight refresh on 401); ATS localhost exception. Screens: **Onboarding** (phone → OTP `000000` →
name → location), **Discover** (MapKit + distance-sorted list; falls back to Boston if no location),
**PubDetail** (info/menu/events + reserve), **Reserve** (date + party → availability → slot → confirm),
**MyBookings**. **Verified:** `xcodebuild` BUILD SUCCEEDED for the iPhone 16 simulator; app launched and the
onboarding screen renders correctly.

### 6.8 Whole-system verification
- **62 automated tests** across the API (51 reservations/pubs + 12 auth − overlap) — all green.
- A **19-step live end-to-end run over real HTTP** (not just in-process): consumer OTP → nearest →
  availability → **create reservation** → `/me`; manager login → **sees that same reservation** (cross-
  component data flow proven) → table CRUD → status update; plus auth negatives (`401`/`403`). All passed;
  the DB was cleaned back to its seeded baseline afterward.

---

## 7. Current state — where the code lives

- **Everything is LOCAL.** Nothing is on the VPS. The code is **not even on GitHub yet** (push is blocked —
  see §8).
- All work is on the **`phase-1-foundation`** branch; `main` still points at the initial commit.
- Runs only against the **local** PostgreSQL 17 + PostGIS 3.6.4 (`pubster` database). See `docs/LOCAL_DEV.md`.

---

## 8. 🚧 What we're doing NOW — deploy to the VPS + demo the app

**Goal right now:** push the code, deploy the backend to the VPS via the git protocol, get it running, and
show the app working against it.

**Server facts** (`,server` = `ssh root@147.93.169.15`, assessed 2026-07-02):
- Ubuntu 24.04, **Node 22 ✓, npm ✓, pm2 ✓**, 120 GB free.
- **Missing: pnpm, PostgreSQL, PostGIS**, nginx.
- It's a **busy shared server** — ~18 other pm2 apps already run there (copybot, f1-slots, papertrader,
  wa-bot, weatherboard, …). We must pick a **free port** for the Pubster API and not disturb the others.
- No `pubster` directory yet.

### 🔴 The current blocker
**GitHub push is denied.** The local `gh` is authenticated as **`dixit3720`**, which lacks write access to
**`rythmn1111/pubster`**:
```
remote: Permission to rythmn1111/pubster.git denied to dixit3720.  (HTTP 403)
```
Because the deploy protocol is *push → pull-on-server*, **nothing can reach the VPS until push works.**

**To unblock (pick one):**
1. Add `dixit3720` as a **collaborator** on `rythmn1111/pubster` (then I push), or
2. **Re-auth** git/gh as the `rythmn1111` account (`! gh auth login`), or
3. Point `origin` at a repo the current account **owns/can push to**.

---

## 9. ⏭️ What's NEXT

**Immediate (to finish the deploy + demo):**
1. Unblock GitHub push (§8) → push `phase-1-foundation` (and/or merge to `main`).
2. **Provision the VPS** (via SSH, environment only — not app edits): install **pnpm** (corepack),
   **PostgreSQL + PostGIS**, create the `pubster` DB + enable PostGIS.
3. **Clone the repo on the server**, create the production **`.env`** (real JWT secrets, `DATABASE_URL`,
   a chosen free `PORT`, `DUMMY_OTP_CODE`, `CURRENCY`).
4. `pnpm install --frozen-lockfile` → `prisma migrate deploy` → seed → build → **`pm2 start`** (add to
   `ecosystem.config.js`), all via `scripts/deploy.sh`.
5. Expose the API (reverse proxy / port) and **point a client at it** for the demo. Note: iOS App Transport
   Security wants HTTPS for non-localhost, so a real demo against the VPS needs either a domain+TLS or an ATS
   exception; the simplest reliable demo is the **iOS app + dashboard against the local backend** (already
   proven) with screenshots — decide which the user prefers.

**Then Phase 2 (Commerce):** event cover charges + join-event, food pre-order, **stubbed payments** (Payment
records), dashboard order queue + event management, and the matching iOS screens.

**Then Phase 3 (Insight):** manager metrics dashboard, APNs push notifications, super-admin pub onboarding +
manager account creation.

---

## 10. Key facts / how to run

- **Local dev:** see `docs/LOCAL_DEV.md`. TL;DR: local Postgres 17 + PostGIS, `pnpm install`,
  `prisma migrate deploy`, `prisma db seed`, `pnpm --filter @pubster/api dev` → health at
  `http://localhost:4000/api/v1/health`.
- **Seeded logins:** manager `manager@bellinhand.test` / `ManagerPass123!`;
  staff `staff@bellinhand.test` / `StaffPass123!`; consumer = any phone + OTP **`000000`**.
- **VPS:** `147.93.169.15` (Ubuntu 24.04), reached via the `,server` alias. Deploy-only (see §4).
- **Currency:** `USD` (configurable; low-stakes while payments are stubbed).

---

## 11. Deferred / known limitations (by design, for MVP)

- **Payments not built** — Phase 2 (will be stubbed, not real money).
- **Events are read-only** so far — joining/charging is Phase 2.
- **Dev `.env` uses placeholder JWT secrets** — real secrets go in the server `.env` at deploy.
- **Timezone**: slot/date handling treats wall-clock times as UTC (MVP simplification), consistently on
  backend + clients; per-pub IANA timezones deferred.
- **No rate limiting** on auth endpoints yet (deferred per `docs/BACKEND.md`).
- **UUID path params** return `400` (not `404`) for malformed ids.
