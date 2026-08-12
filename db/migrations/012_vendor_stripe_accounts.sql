-- 012_vendor_stripe_accounts.sql
-- Stripe Connect account per vendor. Split out from vendor_profiles (rather
-- than adding columns there) to match the existing style of keeping
-- integration-specific state in its own table (see refresh_tokens).

CREATE TABLE vendor_stripe_accounts (
    vendor_id           UUID PRIMARY KEY REFERENCES vendor_profiles(user_id) ON DELETE CASCADE,
    stripe_account_id   TEXT NOT NULL UNIQUE,
    charges_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    payouts_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
