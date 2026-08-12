import { randomUUID } from "crypto";
import { Pool } from "pg";

// Integration tests hit a real Postgres — the calendar-locking guarantees in
// db/migrations/005_availability.sql rely on actual row-level locking, which
// a mocked DB layer can't exercise. Point TEST_DATABASE_URL at a database
// that already has all of db/migrations/*.sql applied (see
// db/migrations/README.md); defaults match docker-compose.yml / .env.example.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://wedplan:wedplan_dev_password@localhost:5432/wedplan_test";

export const pool = new Pool({ connectionString: TEST_DATABASE_URL });

export async function truncateAll(): Promise<void> {
  await pool.query(
    `TRUNCATE TABLE bookings, quotes, availability_slots, inquiries,
       vendor_profiles, inquirer_profiles, users RESTART IDENTITY CASCADE`,
  );
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export async function createVendor(businessName = "Test Vendor"): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, 'x', 'vendor') RETURNING id`,
    [`vendor-${randomUUID()}@example.com`],
  );
  const vendorId = rows[0].id;
  await pool.query(`INSERT INTO vendor_profiles (user_id, business_name) VALUES ($1, $2)`, [
    vendorId,
    businessName,
  ]);
  return vendorId;
}

export async function createInquirer(displayName = "Test Couple"): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, 'x', 'inquirer') RETURNING id`,
    [`inquirer-${randomUUID()}@example.com`],
  );
  const inquirerId = rows[0].id;
  await pool.query(`INSERT INTO inquirer_profiles (user_id, display_name) VALUES ($1, $2)`, [
    inquirerId,
    displayName,
  ]);
  return inquirerId;
}

export async function createSentQuote(params: {
  inquirerId: string;
  vendorId: string;
  eventDate: string;
  totalAmount?: number;
}): Promise<{ quoteId: string; inquiryId: string }> {
  const total = params.totalAmount ?? 5000;
  const { rows: inquiryRows } = await pool.query<{ id: string }>(
    `INSERT INTO inquiries (inquirer_id, vendor_id, category, event_date, status)
     VALUES ($1, $2, 'venue', $3, 'quoted') RETURNING id`,
    [params.inquirerId, params.vendorId, params.eventDate],
  );
  const inquiryId = inquiryRows[0].id;
  const { rows: quoteRows } = await pool.query<{ id: string }>(
    `INSERT INTO quotes (inquiry_id, line_items, total_amount, deposit_amount, status)
     VALUES ($1, '[]', $2, $3, 'sent') RETURNING id`,
    [inquiryId, total, total * 0.2],
  );
  return { quoteId: quoteRows[0].id, inquiryId };
}
