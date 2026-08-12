-- 009_checklist.sql
-- Inquirer-facing planning checklist. Tasks can be auto-generated from the
-- wedding date/timeline, or linked to a specific booking, or fully custom.

CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done');

CREATE TABLE checklist_tasks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquirer_id UUID NOT NULL REFERENCES inquirer_profiles(user_id) ON DELETE CASCADE,
    booking_id  UUID REFERENCES bookings(id) ON DELETE SET NULL,
    title       TEXT NOT NULL,
    category    TEXT,
    due_date    DATE,
    status      task_status NOT NULL DEFAULT 'todo',
    assignee    TEXT,               -- free text: "Couple", "Planner", a family member's name, etc.
    is_auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_inquirer ON checklist_tasks(inquirer_id);
CREATE INDEX idx_checklist_status ON checklist_tasks(status);
CREATE INDEX idx_checklist_due_date ON checklist_tasks(due_date);
