# WedPlan — Wedding Vendor Marketplace & Planning Platform
### Product & Technical Specification (for Claude Code build-out)

---

## 1. Product Overview

**WedPlan** is a two-sided marketplace connecting couples ("Inquirers") with wedding vendors (venues, DJs, caterers, photographers, florists, and other categories) to discover, message, book, and manage every vendor relationship for a wedding in one place — with a synced planning checklist and secure in-app + email-tracked communication.

**Primary user roles:**
1. **Inquirer (Couple/Planner)** — browses vendors, sends inquiries, books, tracks checklist, manages budget, stores wedding details.
2. **Vendor** — manages profile, pricing, availability calendar, responds to inquiries, locks in bookings, gets paid.
3. **Admin** — moderates vendor listings, handles disputes, manages platform payments/fees, oversees security/compliance.

---

## 2. Core User Flows

### 2.1 Inquirer Flow
- Sign up → create a "Wedding Profile" (date, location, guest count, budget, style/theme)
- Browse/search vendors by category, location, date availability, price range, rating
- View vendor profile: portfolio, packages/rates, reviews, availability calendar
- Send inquiry (structured form + free text) → starts a Conversation Thread
- Negotiate details in-thread (in-app + mirrored to email)
- Receive a formal **Quote/Proposal** from vendor → accept → deposit/payment → date locks
- Booking appears on the Inquirer's **Master Checklist & Timeline**
- Track tasks (auto-generated per category + custom tasks), mark complete
- Central "Wedding Hub" dashboard: all vendors, contracts, payment schedule, documents, countdown

### 2.2 Vendor Flow
- Sign up → business verification (license/insurance upload, admin review)
- Build profile: categories served, service area, portfolio media, packages & rate cards (flat, hourly, per-guest, tiered)
- Manage **Availability Calendar** (open/blocked/tentative-hold/booked dates)
- Receive inquiries → respond via in-app messaging (synced to their email)
- Send quotes/proposals with line-item pricing → convert to contract
- On acceptance + deposit, date auto-locks (blocks calendar, prevents double-booking)
- Manage booking details, upload contracts/invoices, mark milestones (deposit paid, final payment, day-of confirmed)

### 2.3 Admin Flow
- Approve/reject vendor applications
- Monitor disputes/refunds, flagged messages
- Configure platform commission/fees, payment payouts
- View audit logs, manage category taxonomy

---

## 3. Feature List by Module

### 3.1 Marketplace & Search
- Vendor categories (extensible taxonomy): Venue, DJ/Entertainment, Catering, Photography, Videography, Florist, Officiant, Cake/Bakery, Hair & Makeup, Rentals (tents/furniture), Transportation, Planner/Coordinator, Invitations/Stationery, Favors, Other
- Filters: location/radius, date availability, price range, category-specific attributes (e.g., venue capacity, cuisine type), rating
- Full-text search + sort (relevance, price, rating, distance)
- Vendor profile pages: bio, gallery, packages, reviews, FAQ, availability preview

### 3.2 Rates & Packages (Vendor-side)
- Flat-rate packages, hourly rates, per-guest pricing, tiered add-ons
- Seasonal/date-based pricing rules (peak season surcharge)
- Custom quote builder for one-off requests
- Deposit % / payment schedule configuration per vendor

### 3.3 Messaging & Communication
- In-app threaded messaging per inquiry/booking
- **Email mirroring**: every in-app message sent as email (via transactional email service) to the counterpart; replies to that email route back into the in-app thread (inbound email parsing)
- Full audit trail — every message timestamped, immutable, tied to a booking ID
- Read receipts, notification preferences (push/email/SMS)
- File/document sharing in-thread (contracts, mood boards, invoices)
- Auto-flagging for suspicious/abusive content

### 3.4 Booking & Calendar Locking
- Vendor calendar states: `open`, `tentative_hold` (time-limited, e.g., 48–72 hrs), `booked`, `blocked`
- Concurrency-safe date locking (prevent two inquirers locking the same date) — DB-level transaction + optimistic locking
- Auto-expiring holds if deposit not paid within window
- Contract generation (templated, e-signature integration)
- Booking status lifecycle: `inquiry → quoted → hold → contracted → deposit_paid → confirmed → completed / cancelled`

### 3.5 Checklist & Task Tracking (Inquirer-side)
- Auto-generated master checklist based on wedding date (timeline-driven: 12mo/9mo/6mo/3mo/1mo/1wk out)
- Category-linked tasks (booking a vendor auto-creates/updates related tasks)
- Custom tasks, due dates, assignees (couple, planner, family)
- Progress dashboard (% complete, budget vs. actual spend)
- Document vault: contracts, receipts, inspiration images, guest list, seating chart

### 3.6 Payments
- Stripe Connect (marketplace model): platform collects commission, vendors receive payouts
- Deposit + milestone payment schedules, invoicing
- Escrow-style hold optional (release on service date/confirmation)
- Refund/cancellation policy engine per vendor

### 3.7 Reviews & Trust
- Post-wedding verified reviews (only after completed booking)
- Vendor response to reviews
- Dispute resolution workflow (admin-mediated)

### 3.8 Notifications
- Email + push + optional SMS
- Triggers: new inquiry, new message, quote received, hold expiring, payment due, task due soon, booking confirmed

---

## 4. Security Requirements (Non-negotiable)

- **Auth**: OAuth2/OIDC (email+password with Argon2/bcrypt hashing, + optional Google/Apple SSO), mandatory MFA for vendors handling payments
- **Session management**: short-lived JWT access tokens + rotating refresh tokens, revocation list
- **RBAC**: strict role separation (inquirer/vendor/admin) enforced at API layer, not just UI
- **Data encryption**: TLS 1.2+ in transit; AES-256 at rest for PII, documents, and payment metadata
- **PCI compliance**: never store raw card data — delegate to Stripe/payment processor tokenization
- **PII handling**: field-level encryption for sensitive data (addresses, phone, contracts); minimize retention; GDPR/CCPA-style data export & deletion endpoints
- **Email correspondence security**: inbound email parsing via signed webhook (e.g., SendGrid Inbound Parse/Postmark) with sender verification to prevent spoofed message injection into threads
- **File uploads**: virus/malware scanning, signed short-lived URLs (S3 pre-signed), file-type allowlisting
- **Rate limiting & abuse protection**: on auth endpoints, messaging, inquiry spam
- **Audit logging**: immutable log of bookings, payments, calendar locks, admin actions
- **Double-booking integrity**: DB transaction isolation (SERIALIZABLE or row-level locks) on calendar-write operations
- **Vendor verification**: business license/insurance document review gate before "verified" badge
- **Input validation/sanitization** everywhere (XSS, SQLi, CSRF protections; CSP headers)
- **Secrets management**: environment-based secrets via a vault (never hardcoded), rotated keys

---

## 5. Data Model (Core Entities)

```
User
 ├─ id, email, password_hash, role[inquirer|vendor|admin], mfa_enabled, created_at

InquirerProfile
 ├─ user_id, wedding_date, venue_location, guest_count, budget_total, style_tags[]

VendorProfile
 ├─ user_id, business_name, categories[], service_area, bio, verification_status,
 │  insurance_doc_url, avg_rating

VendorPackage
 ├─ id, vendor_id, name, category, pricing_type[flat|hourly|per_guest|tiered],
 │  base_price, deposit_pct, cancellation_policy

AvailabilitySlot
 ├─ id, vendor_id, date, status[open|tentative_hold|booked|blocked], hold_expires_at

Inquiry
 ├─ id, inquirer_id, vendor_id, category, event_date, status, created_at

Conversation
 ├─ id, inquiry_id, participants[], created_at

Message
 ├─ id, conversation_id, sender_id, body, attachments[], email_message_id,
 │  sent_via[app|email], created_at

Quote
 ├─ id, inquiry_id, line_items[], total, deposit_amount, valid_until, status

Booking
 ├─ id, quote_id, inquirer_id, vendor_id, event_date, status,
 │  contract_doc_url, deposit_paid_at, balance_due_at, total_amount

Payment
 ├─ id, booking_id, amount, type[deposit|milestone|final|refund], stripe_ref, status

ChecklistTask
 ├─ id, inquirer_id, booking_id(nullable), title, category, due_date, status, assignee

Review
 ├─ id, booking_id, rating, body, vendor_response, created_at

Document
 ├─ id, owner_id, booking_id(nullable), type, file_url, uploaded_at
```

---

## 6. Suggested Tech Stack

| Layer | Recommendation |
|---|---|
| Frontend (web) | React + TypeScript, Next.js (SSR for SEO on vendor pages), Tailwind CSS |
| Mobile (optional phase 2) | React Native |
| Backend | Node.js (NestJS) or Python (FastAPI) — REST + WebSocket for live messaging |
| Database | PostgreSQL (relational integrity critical for bookings/calendar) |
| Cache/queues | Redis (holds/locks, session cache), BullMQ/Celery for async jobs (email sync, notifications, hold-expiry) |
| Search | Postgres full-text or Meilisearch/Algolia for vendor search |
| File storage | S3-compatible (AWS S3 or Cloudflare R2) with signed URLs |
| Email (transactional + inbound parse) | Postmark or SendGrid (Inbound Parse Webhook) |
| Payments | Stripe Connect (marketplace payouts) |
| E-signature | DocuSign API or HelloSign/Dropbox Sign |
| Auth | Auth0/Clerk, or self-managed with Passport.js/NextAuth |
| Realtime messaging | WebSockets (Socket.IO) or Pusher |
| Hosting/Infra | Vercel (frontend) + Railway/Render/AWS ECS (backend) + managed Postgres (RDS/Supabase) |
| Monitoring | Sentry (errors), Datadog/Grafana (metrics), audit log table + CloudWatch |

---

## 7. Phased Build Plan (for Claude Code execution)

**Phase 1 — Foundation**
- Project scaffold (monorepo: `/apps/web`, `/apps/api`, `/packages/shared`)
- Auth (signup/login, roles, MFA), DB schema + migrations
- Basic vendor profile CRUD + inquirer profile CRUD

**Phase 2 — Marketplace Core**
- Vendor search/browse/filter, vendor public profile pages
- Package/rate management (vendor side)
- Inquiry creation flow

**Phase 3 — Messaging & Email Sync**
- In-app threaded messaging + WebSocket live updates
- Outbound email mirror on message send
- Inbound email webhook parser → thread reply injection

**Phase 4 — Booking, Calendar Locking, Payments**
- Availability calendar UI + concurrency-safe locking logic
- Quote → contract → Stripe Connect deposit flow
- Hold-expiry background job

**Phase 5 — Checklist & Wedding Hub**
- Auto-generated timeline/checklist engine
- Document vault, budget tracker dashboard

**Phase 6 — Trust, Admin, Hardening**
- Reviews, vendor verification/admin panel
- Security hardening pass (rate limiting, audit logs, pen-test checklist)
- Notification system (email/push/SMS)

---

## 8. Open Assumptions (confirm/adjust before build)
- Web-first (desktop + responsive mobile web), native app deferred to later phase
- Stripe Connect used for payments/payouts (commission-based marketplace model)
- Platform takes a % commission per booking (rate TBD)
- English/US-market only for v1 (currency, date formats)
- Vendors are individually verified businesses, not sub-agencies with multiple staff logins (v1)

---

## 9. Handoff Notes for Claude Code
When starting the build, feed Claude Code this spec plus the phase order above. Recommended first prompt: *"Scaffold Phase 1 of the WedPlan spec: monorepo structure, Postgres schema/migrations for the entities in Section 5, and auth with role-based access per Section 4."* Build and test each phase before moving to the next — the calendar-locking logic (Section 3.4 / Section 4) is the highest-risk component and deserves dedicated test coverage for race conditions.
