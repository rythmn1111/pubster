# Pubster — Database Architecture

Engine: **PostgreSQL 16 + PostGIS**. Access via **Prisma**. Money is stored as integer **cents**
with a `currency` code (default `USD`). Timestamps are UTC.

## Conventions
- Primary keys: `uuid` (`@default(uuid())`).
- `createdAt` / `updatedAt` on all mutable tables.
- Opening hours as JSONB (no separate table for MVP).
- Enums via Prisma enums.

## Entities

### User — one table for all humans; `role` distinguishes them
Consumers auth by phone + dummy OTP; staff/manager/admin by email + password.
- `id`, `role` — enum `UserRole { consumer, staff, manager, super_admin }`
- `name`
- `phone` (unique, nullable) — consumers
- `email` (unique, nullable) — staff/manager/admin
- `passwordHash` (nullable, argon2) — staff/manager/admin
- `pubId` (nullable, FK Pub) — pub a staff/manager belongs to
- `createdAt`, `updatedAt`
- Indexes: unique(phone), unique(email), index(pubId)

### Pub
- `id`, `name`, `description`
- `latitude` (Float), `longitude` (Float)
- `location` — PostGIS `geography(Point,4326)` via Prisma `Unsupported`, kept in sync with lat/lng
- `addressLine`, `city`, `region`, `postalCode`
- `phone`, `photos` (String[] URLs)
- `openingHours` (Jsonb) — e.g. `{ "mon": [["17:00","23:30"]], ... }`
- `slotMinutes` (Int, default 90)
- `createdAt`, `updatedAt`
- Indexes: **GiST** index on `location` (added via raw migration)

### RestaurantTable — physical table inventory
One row per physical table. "2× 2-seat + 5× 6-seat" = 7 rows. Reservations consume a table **size
class** from the pool, not a specific row.
- `id`, `pubId` (FK), `seats` (Int), `label` (nullable), `isActive` (Bool, default true)
- `createdAt`, `updatedAt`
- Indexes: index(pubId, seats)

### Reservation
- `id`, `pubId` (FK), `userId` (FK)
- `partyCount` (Int)
- `seats` (Int) — size class consumed (smallest available ≥ partyCount)
- `startTime`, `endTime` (= startTime + `pub.slotMinutes`)
- `status` — enum `ReservationStatus { pending, confirmed, seated, completed, cancelled, no_show }`
- `eventId` (FK Event, nullable) — set if the party joined an overlapping event
- `createdAt`, `updatedAt`
- Indexes: index(pubId, startTime), index(userId), index(eventId)

### Event
- `id`, `pubId` (FK), `name`, `description`
- `startTime`, `endTime`
- `capacity` (Int) — max attendees (sum of joined reservations' partyCount)
- `coverChargeCents` (Int) — per person
- `status` — enum `EventStatus { scheduled, cancelled, completed }`
- `createdAt`, `updatedAt`
- Indexes: index(pubId, startTime)
- Attendance derived: `sum(reservation.partyCount where eventId = event.id and status != cancelled)`

### MenuCategory
- `id`, `pubId` (FK), `name`, `sortOrder` (Int) — index(pubId, sortOrder)

### MenuItem
- `id`, `pubId` (FK), `categoryId` (FK)
- `name`, `description`, `priceCents` (Int), `imageUrl` (nullable)
- `isAvailable` (Bool, default true), `sortOrder` (Int)
- Indexes: index(pubId, categoryId)

### Order — pre-order
- `id`, `reservationId` (FK), `userId` (FK), `pubId` (FK)
- `status` — enum `OrderStatus { pending, paid, preparing, ready, served, cancelled }`
- `totalCents` (Int), `currency` (default USD)
- `createdAt`, `updatedAt` — index(pubId, status), index(reservationId)

### OrderItem
- `id`, `orderId` (FK), `menuItemId` (FK)
- `nameSnapshot`, `unitPriceCents` (Int), `quantity` (Int)

### Payment — stubbed for MVP (recorded as `paid`, no real money)
- `id`, `userId` (FK)
- `kind` — enum `PaymentKind { event_cover, food_order }`
- `refId` (String) — orderId or reservationId
- `amountCents` (Int), `currency` (default USD)
- `status` — enum `PaymentStatus { pending, paid, refunded, failed }` (MVP creates `paid`)
- `provider` (String, default "stub"), `createdAt`
- Indexes: index(userId), index(kind, refId)

### RefreshToken
- `id`, `userId` (FK), `tokenHash` (store hash only), `expiresAt`, `revokedAt` (nullable), `createdAt`
- Indexes: index(userId)

### (Optional, later) OtpChallenge
Not needed for dummy OTP (we upsert the user and accept the dummy code). Add for real SMS.

## Relationships
- Pub 1—N RestaurantTable, MenuCategory, MenuItem, Event, Reservation, Order, User(staff/manager)
- MenuCategory 1—N MenuItem
- Reservation 1—0/1 Order; Reservation N—0/1 Event
- Order 1—N OrderItem; OrderItem N—1 MenuItem
- User 1—N Reservation, Order, Payment, RefreshToken

## Nearest-pubs query (PostGIS)
Prisma can't express geography ops; use a raw query and keep `location` synced with lat/lng.
```sql
SELECT id, name, ST_Distance(location, ST_MakePoint($lng,$lat)::geography) AS distance_m
FROM "Pub"
WHERE ST_DWithin(location, ST_MakePoint($lng,$lat)::geography, $radiusMeters)
ORDER BY distance_m ASC
LIMIT $limit;
```

## Availability logic (reservations)
Given a pub, requested slot `start`, and `partyCount`:
1. Candidate size classes = distinct `seats` of active tables where `seats >= partyCount`, ascending.
2. For the smallest class with free capacity:
   `free = count(active tables of that size) − count(reservations at this pub whose [start,end)
   overlaps AND seats == that size AND status in (pending,confirmed,seated))`.
3. If `free > 0` → available; booking consumes one table of that size (store `seats`).
- **MVP limitations:** no combining multiple tables for large parties, no perfect bin-packing.

## Money & currency
Integer cents everywhere; `currency` default `USD` (configurable — see `CLAUDE.md` §9).
Event cover = `coverChargeCents × partyCount`; food = `Σ(orderItem.unitPriceCents × quantity)`.

## Seeding (Phase 1)
`prisma/seed.ts` seeds 3–5 pubs (real-ish coordinates near a test location), mixed table
inventories, a menu per pub, and one upcoming event — so the app is testable without a
pub-onboarding UI.
