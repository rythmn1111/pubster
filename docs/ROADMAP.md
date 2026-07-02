# Pubster — Build Roadmap ("what to do")

Living checklist of build work. Mirrors the phases in `CLAUDE.md` §10. Each phase should end
review-ready (installs, typechecks, seed data works). Deploy protocol reminder: **never edit the
VPS directly** — commit → push → pull on server → deploy with `.env` → `pm2 reload`.

## Phase 0 — Foundations (in progress)
- [x] `CLAUDE.md` (source of truth)
- [x] `docs/ROADMAP.md` (this file)
- [x] `docs/DATABASE.md` (data model)
- [x] `docs/BACKEND.md` (backend architecture)
- [x] Monorepo scaffold: pnpm workspaces + Turborepo, base `tsconfig`, eslint/prettier, `.gitignore`
- [x] `services/api` Fastify skeleton (env, prisma client, health, error handler, module layout)
- [x] `packages/shared` skeleton (shared TS types)

## Phase 1 — Core
**Backend**
- [x] Prisma schema for all core entities (see `DATABASE.md`) + initial migration
- [x] Seed script: 3–5 pubs (coordinates), table inventories, a menu each, one upcoming event
- [x] Auth: consumer phone + dummy OTP (real DB user), staff/manager email+password, JWT + refresh
- [x] Pubs: `GET nearest` (PostGIS), `GET detail`
- [x] Menu: `GET` categories + items for a pub
- [ ] Tables: CRUD (staff/manager) — inventory by size
- [ ] Reservations: availability (time frame + party count → size-class availability), create, list mine, cancel

**General Dashboard (Next.js)**
- [ ] App scaffold + role-based auth (staff/manager)
- [ ] Staff login (email/password)
- [ ] Today's reservations view + occupancy
- [ ] Table management (add/remove/edit)

**iOS (SwiftUI)**
- [ ] XcodeGen project + app skeleton, networking layer, Keychain token storage
- [ ] Onboarding: phone → OTP (`000000`) → name → location permission
- [ ] Discover: nearest pubs (map + list)
- [ ] Pub detail: info + menu + events
- [ ] Reserve: time frame → party count → availability → confirm

## Phase 2 — Commerce
- [ ] Events: manager CRUD, capacity cap, cover charge
- [ ] Join event as part of a reservation (charge = cover × party)
- [ ] Pre-order: order against reservation slot, pay upfront (stubbed)
- [ ] Payments: stubbed provider records "paid" (Payment rows for cover + food)
- [ ] Dashboard: order queue (preparing/ready/served), event management
- [ ] iOS: event join, pre-order flow, payment (stub), my bookings/tickets

## Phase 3 — Insight
- [ ] Manager metrics (revenue, occupancy %, reservations, no-shows, event revenue, top items)
- [ ] Manager dashboard metrics UI
- [ ] Push notifications (APNs): reservation confirmation + reminders
- [ ] Super-admin: pub onboarding + manager account creation

## Cross-cutting (as needed)
- [ ] OpenAPI from Fastify → generate shared client types in `packages/shared`
- [ ] Deploy: `ecosystem.config.js` + `scripts/deploy.sh` (run ON server after pull)
- [ ] Tests: vitest + supertest for auth, availability, booking
- [ ] CI (lint/typecheck/test) — later
