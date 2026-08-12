-- 005_availability.sql
-- Vendor availability calendar. This is the highest-risk table in the schema:
-- it must be impossible for two inquirers to lock the same vendor+date.
--
-- Strategy:
--   1. One row per (vendor_id, date) enforced by a UNIQUE constraint, so a
--      "date" only ever has a single current status.
--   2. All status transitions (open -> tentative_hold -> booked, etc.) MUST
--      happen inside a DB transaction that does:
--          SELECT ... FOR UPDATE on the target row (or INSERT ... ON CONFLICT)
--      before writing the new status. This serializes concurrent attempts
--      to claim the same date.
--   3. tentative_hold rows carry hold_expires_at; a background job
--      (see Phase 4 in the spec) sweeps expired holds back to 'open'.

CREATE TYPE availability_status AS ENUM ('open', 'tentative_hold', 'booked', 'blocked');

CREATE TABLE availability_slots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id       UUID NOT NULL REFERENCES vendor_profiles(user_id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    status          availability_status NOT NULL DEFAULT 'open',
    hold_expires_at TIMESTAMPTZ,             -- only set when status = 'tentative_hold'
    booking_id      UUID,                    -- set when status = 'booked' (FK added in 007)
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_vendor_date UNIQUE (vendor_id, date),
    CONSTRAINT chk_hold_expiry CHECK (
        (status = 'tentative_hold' AND hold_expires_at IS NOT NULL)
        OR (status != 'tentative_hold')
    )
);

CREATE INDEX idx_availability_vendor_date ON availability_slots(vendor_id, date);
CREATE INDEX idx_availability_status ON availability_slots(status);
CREATE INDEX idx_availability_hold_expiry ON availability_slots(hold_expires_at)
    WHERE status = 'tentative_hold';

-- Example of the safe claim pattern the API layer should use
-- (kept here as a comment for reference, not executed by the migration):
--
-- BEGIN;
--   INSERT INTO availability_slots (vendor_id, date, status, hold_expires_at)
--   VALUES ($1, $2, 'tentative_hold', now() + interval '72 hours')
--   ON CONFLICT (vendor_id, date) DO UPDATE
--     SET status = 'tentative_hold', hold_expires_at = EXCLUDED.hold_expires_at
--     WHERE availability_slots.status = 'open'
--   RETURNING *;
--   -- if RETURNING is empty, the date was not open -> abort transaction, tell user.
-- COMMIT;
