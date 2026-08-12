-- 008_payments.sql
-- Payment records reference Stripe objects; no raw card data is ever stored here.

CREATE TYPE payment_type AS ENUM ('deposit', 'milestone', 'final', 'refund');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    amount          NUMERIC(12,2) NOT NULL,
    type            payment_type NOT NULL,
    status          payment_status NOT NULL DEFAULT 'pending',
    stripe_ref      TEXT,              -- PaymentIntent / Charge / Refund id
    stripe_connect_account TEXT,       -- vendor's connected account id
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(status);
