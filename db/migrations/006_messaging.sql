-- 006_messaging.sql
-- Inquiries kick off a conversation thread that is mirrored to email.

CREATE TYPE inquiry_status AS ENUM ('open', 'quoted', 'hold', 'contracted', 'declined', 'closed');

CREATE TABLE inquiries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquirer_id UUID NOT NULL REFERENCES inquirer_profiles(user_id) ON DELETE CASCADE,
    vendor_id   UUID NOT NULL REFERENCES vendor_profiles(user_id) ON DELETE CASCADE,
    category    TEXT NOT NULL,
    event_date  DATE,
    status      inquiry_status NOT NULL DEFAULT 'open',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inquiries_inquirer ON inquiries(inquirer_id);
CREATE INDEX idx_inquiries_vendor ON inquiries(vendor_id);
CREATE INDEX idx_inquiries_status ON inquiries(status);

CREATE TABLE conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id  UUID NOT NULL UNIQUE REFERENCES inquiries(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE message_channel AS ENUM ('app', 'email', 'system');

CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id           UUID NOT NULL REFERENCES users(id),
    body                TEXT NOT NULL,
    sent_via            message_channel NOT NULL DEFAULT 'app',
    email_message_id    TEXT,          -- Message-ID header, used to thread inbound replies
    read_at             TIMESTAMPTZ,
    flagged             BOOLEAN NOT NULL DEFAULT FALSE,
    flagged_reason      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_email_message_id ON messages(email_message_id)
    WHERE email_message_id IS NOT NULL;

CREATE TABLE message_attachments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_url    TEXT NOT NULL,
    file_name   TEXT NOT NULL,
    content_type TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
