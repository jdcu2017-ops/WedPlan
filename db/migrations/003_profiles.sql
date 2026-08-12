-- 003_profiles.sql
-- Role-specific profile data, 1:1 with users.

CREATE TABLE inquirer_profiles (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name    TEXT NOT NULL,
    wedding_date    DATE,
    venue_location  TEXT,
    guest_count     INTEGER,
    budget_total    NUMERIC(12,2),
    style_tags      TEXT[] DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');

CREATE TABLE vendor_profiles (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    business_name       TEXT NOT NULL,
    categories          TEXT[] NOT NULL DEFAULT '{}',   -- e.g. {'dj','catering'}
    service_area        TEXT,
    bio                 TEXT,
    verification_status verification_status NOT NULL DEFAULT 'unverified',
    insurance_doc_url   TEXT,
    license_doc_url     TEXT,
    avg_rating          NUMERIC(3,2) DEFAULT 0,
    review_count        INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendor_profiles_categories ON vendor_profiles USING GIN (categories);
CREATE INDEX idx_vendor_profiles_service_area ON vendor_profiles (service_area);
