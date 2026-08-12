-- 004_vendor_packages.sql
-- Vendor-defined rate cards / packages.

CREATE TYPE pricing_type AS ENUM ('flat', 'hourly', 'per_guest', 'tiered', 'custom_quote');

CREATE TABLE vendor_packages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendor_profiles(user_id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    category            TEXT NOT NULL,
    description         TEXT,
    pricing_type        pricing_type NOT NULL,
    base_price          NUMERIC(12,2),
    deposit_pct         NUMERIC(5,2) NOT NULL DEFAULT 25.00,  -- % of total due at booking
    cancellation_policy TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendor_packages_vendor ON vendor_packages(vendor_id);
CREATE INDEX idx_vendor_packages_category ON vendor_packages(category);

-- Optional line-item add-ons within a package (e.g. extra hour, upgraded lens kit).
CREATE TABLE vendor_package_addons (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id  UUID NOT NULL REFERENCES vendor_packages(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    price       NUMERIC(12,2) NOT NULL
);
