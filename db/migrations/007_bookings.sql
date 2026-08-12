-- 007_bookings.sql
-- Quotes are proposals; Bookings are the confirmed, contracted result.

CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'declined', 'expired');

CREATE TABLE quotes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id      UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    line_items      JSONB NOT NULL DEFAULT '[]',   -- [{ "label": "...", "amount": 000.00 }]
    total_amount    NUMERIC(12,2) NOT NULL,
    deposit_amount  NUMERIC(12,2) NOT NULL,
    valid_until     TIMESTAMPTZ,
    status          quote_status NOT NULL DEFAULT 'draft',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotes_inquiry ON quotes(inquiry_id);

CREATE TYPE booking_status AS ENUM (
    'hold', 'contracted', 'deposit_paid', 'confirmed', 'completed', 'cancelled'
);

CREATE TABLE bookings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id            UUID NOT NULL REFERENCES quotes(id),
    inquirer_id         UUID NOT NULL REFERENCES inquirer_profiles(user_id),
    vendor_id           UUID NOT NULL REFERENCES vendor_profiles(user_id),
    event_date          DATE NOT NULL,
    status              booking_status NOT NULL DEFAULT 'hold',
    contract_doc_url    TEXT,
    total_amount        NUMERIC(12,2) NOT NULL,
    deposit_paid_at     TIMESTAMPTZ,
    balance_due_at      DATE,
    cancelled_at        TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_inquirer ON bookings(inquirer_id);
CREATE INDEX idx_bookings_vendor ON bookings(vendor_id);
CREATE INDEX idx_bookings_status ON bookings(status);

-- Now that bookings exists, wire it back into availability_slots.
ALTER TABLE availability_slots
    ADD CONSTRAINT fk_availability_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
