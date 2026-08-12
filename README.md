# WedPlan — Starter Scaffold

This is the Phase 1 skeleton for the WedPlan marketplace, meant to be dropped
into a repo and built out with Claude Code following `docs/wedding_marketplace_spec.md`.

## Structure

```
apps/
  api/            NestJS (or FastAPI) backend — one module folder per domain
    src/modules/auth
    src/modules/users
    src/modules/vendors
    src/modules/inquiries
    src/modules/messaging
    src/modules/bookings
    src/modules/payments
    src/modules/checklist
  web/            Next.js frontend
packages/
  shared/         Shared TypeScript types (User, Booking, Message, etc.)
db/
  migrations/     Numbered raw SQL migrations (Postgres) — see db/migrations/README.md
docs/
  wedding_marketplace_spec.md   Full product/technical spec
```

## Getting started with Claude Code

1. `cd` into this repo and run `claude` (or open it in Claude Code).
2. First prompt suggestion:
   > "Read docs/wedding_marketplace_spec.md and db/migrations/*.sql. Scaffold the
   > NestJS API in apps/api using these migrations as the source of truth for
   > entities. Start with the auth and users modules, then vendors."
3. Build one module/phase at a time (see spec Section 7) and run the migrations
   against a local Postgres (`docker compose up -d`) before moving on.
4. The calendar-locking logic in `db/migrations/005_availability.sql` is the
   highest-risk piece — write concurrency tests for it before Phase 4 sign-off.

## Local dev services

```
docker compose up -d      # starts Postgres + Redis
cp .env.example .env      # fill in secrets
```
