-- 010_reviews_documents.sql

CREATE TABLE reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id      UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body            TEXT,
    vendor_response TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_booking ON reviews(booking_id);

CREATE TYPE document_type AS ENUM (
    'contract', 'invoice', 'receipt', 'insurance', 'license', 'inspiration', 'other'
);

CREATE TABLE documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id  UUID REFERENCES bookings(id) ON DELETE SET NULL,
    type        document_type NOT NULL,
    file_url    TEXT NOT NULL,
    file_name   TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_documents_booking ON documents(booking_id);
