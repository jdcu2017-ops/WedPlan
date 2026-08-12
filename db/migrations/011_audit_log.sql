-- 011_audit_log.sql
-- Append-only audit trail for security-sensitive actions:
-- bookings, payments, calendar-lock changes, and admin actions.

CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID REFERENCES users(id),
    action      TEXT NOT NULL,          -- e.g. 'booking.created', 'availability.lock', 'admin.vendor_verified'
    entity_type TEXT NOT NULL,
    entity_id   UUID,
    metadata    JSONB NOT NULL DEFAULT '{}',
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- Audit log rows should never be updated or deleted by application code.
-- Enforce at the DB role level (revoke UPDATE/DELETE from the app role) once
-- roles are set up in your hosting environment.
