# Migrations

Plain numbered SQL migrations, applied in order. Use `node-pg-migrate`,
`Prisma migrate`, `Drizzle`, or `Flyway` to run these — pick one and have
Claude Code wire it up in Phase 1 (these files are the source of truth for
the schema regardless of which migration tool ends up running them).

Order matters:

| File | Contents |
|---|---|
| 001_extensions.sql | pgcrypto, citext, btree_gist |
| 002_users.sql | users, refresh_tokens |
| 003_profiles.sql | inquirer_profiles, vendor_profiles |
| 004_vendor_packages.sql | vendor_packages, vendor_package_addons |
| 005_availability.sql | availability_slots — **concurrency-critical**, read the comments in this file before touching booking logic |
| 006_messaging.sql | inquiries, conversations, messages, message_attachments |
| 007_bookings.sql | quotes, bookings (+ FK back into availability_slots) |
| 008_payments.sql | payments (Stripe references only, no card data) |
| 009_checklist.sql | checklist_tasks |
| 010_reviews_documents.sql | reviews, documents |
| 011_audit_log.sql | audit_log (append-only) |
| 012_vendor_stripe_accounts.sql | vendor_stripe_accounts — Stripe Connect account per vendor |

Apply locally:

## Testing the calendar-locking logic

`apps/api/test/integration/availability-locking.spec.ts` races real concurrent
transactions against a live Postgres to prove two inquirers can never both
lock the same vendor+date (spec Section 3.4). It needs its own database with
these migrations applied:

```
docker compose up -d
psql postgres://wedplan:wedplan_dev_password@localhost:5432/wedplan -f db/migrations/001_extensions.sql
# ...repeat in numeric order, or point your migration tool at this folder
```
