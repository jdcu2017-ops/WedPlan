# API Modules

One folder per domain, matching the phases in `docs/wedding_marketplace_spec.md`:

- `auth/` — signup, login, MFA, JWT issuance/refresh, RBAC guards
- `users/` — inquirer & vendor profile CRUD
- `vendors/` — public search/browse, vendor packages, availability calendar
- `inquiries/` — inquiry creation, status transitions
- `messaging/` — in-app messages, WebSocket gateway, outbound email mirror,
  inbound email webhook handler (see spec Section 3.3 / 4)
- `bookings/` — quote → contract → booking lifecycle, the safe date-locking
  transaction described in `db/migrations/005_availability.sql`
- `payments/` — Stripe Connect integration, deposit/milestone/final payments
- `checklist/` — auto-generated + custom task management

Build these in the order listed above (Phase 1 → Phase 6 in the spec).
Each module should own its own DTOs/validation, service, controller, and
tests; share only cross-cutting types via `@wedplan/shared`.
