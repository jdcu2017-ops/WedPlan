import { Injectable } from "@nestjs/common";
import type { BookingStatus } from "@wedplan/shared";
import { DatabaseService } from "../../database/database.service";

export interface BookingRow {
  id: string;
  quote_id: string;
  inquirer_id: string;
  vendor_id: string;
  event_date: string;
  status: BookingStatus;
  contract_doc_url: string | null;
  total_amount: string;
  deposit_paid_at: string | null;
  balance_due_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  vendor_business_name: string;
  inquirer_display_name: string;
}

// Same reasoning as inquiries.repository.ts's EXTRA_FIELDS_SUBQUERY — both
// FKs guarantee the referenced profile rows exist, so a list/detail view
// never has to show raw UUIDs for who's on the other end of a booking.
const BOOKING_COLUMNS = `
  id, quote_id, inquirer_id, vendor_id, event_date, status, contract_doc_url, total_amount,
  deposit_paid_at, balance_due_at, cancelled_at, cancellation_reason, created_at,
  (SELECT business_name FROM vendor_profiles WHERE user_id = bookings.vendor_id) AS vendor_business_name,
  (SELECT display_name FROM inquirer_profiles WHERE user_id = bookings.inquirer_id) AS inquirer_display_name
`;

// Thrown from inside the accept-quote transaction so the service can map it
// to a clean 409 without the repository depending on @nestjs/common.
export class DateUnavailableError extends Error {}
export class QuoteNotAcceptableError extends Error {}

@Injectable()
export class BookingsRepository {
  constructor(private readonly db: DatabaseService) {}

  // The one place in the app where a date actually gets locked. Mirrors the
  // safe-claim pattern documented in db/migrations/005_availability.sql
  // exactly: the conditional UPDATE only fires when the slot is still 'open',
  // so two inquirers racing to accept quotes for the same vendor+date can
  // never both succeed — the loser gets DateUnavailableError, not a corrupted
  // booking. Booking creation, the slot's booking_id backfill, the quote's
  // acceptance, and the inquiry's status all happen in the same transaction
  // as the claim, so nothing partially commits if any step fails.
  async acceptQuoteAndCreateBooking(params: {
    quoteId: string;
    inquiryId: string;
    inquirerId: string;
    vendorId: string;
    eventDate: string;
    totalAmount: number;
  }): Promise<BookingRow> {
    return this.db.withTransaction(async (client) => {
      const claim = await client.query<{ id: string }>(
        `INSERT INTO availability_slots (vendor_id, date, status, hold_expires_at)
         VALUES ($1, $2, 'tentative_hold', now() + interval '72 hours')
         ON CONFLICT (vendor_id, date) DO UPDATE
           SET status = 'tentative_hold', hold_expires_at = EXCLUDED.hold_expires_at
           WHERE availability_slots.status = 'open'
         RETURNING id`,
        [params.vendorId, params.eventDate],
      );
      if ((claim.rowCount ?? 0) === 0) {
        throw new DateUnavailableError();
      }
      const availabilitySlotId = claim.rows[0].id;

      const quoteUpdate = await client.query(
        `UPDATE quotes SET status = 'accepted', updated_at = now() WHERE id = $1 AND status = 'sent'`,
        [params.quoteId],
      );
      if ((quoteUpdate.rowCount ?? 0) === 0) {
        throw new QuoteNotAcceptableError();
      }

      const bookingResult = await client.query<BookingRow>(
        `INSERT INTO bookings (quote_id, inquirer_id, vendor_id, event_date, status, total_amount)
         VALUES ($1, $2, $3, $4, 'hold', $5)
         RETURNING ${BOOKING_COLUMNS}`,
        [params.quoteId, params.inquirerId, params.vendorId, params.eventDate, params.totalAmount],
      );
      const booking = bookingResult.rows[0];

      await client.query(`UPDATE availability_slots SET booking_id = $1 WHERE id = $2`, [
        booking.id,
        availabilitySlotId,
      ]);
      await client.query(`UPDATE inquiries SET status = 'hold', updated_at = now() WHERE id = $1`, [
        params.inquiryId,
      ]);

      return booking;
    });
  }

  async findById(id: string): Promise<BookingRow | undefined> {
    const result = await this.db.query<BookingRow>(
      `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE id = $1`,
      [id],
    );
    return result.rows[0];
  }

  async listForParticipant(
    userId: string,
    column: "inquirer_id" | "vendor_id",
  ): Promise<BookingRow[]> {
    const result = await this.db.query<BookingRow>(
      `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE ${column} = $1 ORDER BY event_date DESC`,
      [userId],
    );
    return result.rows;
  }

  // Background sweep (see HoldExpiryJob): releases every tentative_hold slot
  // whose hold_expires_at has passed, cancels the booking it was holding for,
  // and closes the inquiry behind that booking — all as one statement so a
  // concurrent run of this same sweep can't double-process the same rows
  // (once a row flips out of 'tentative_hold'/'hold', it no longer matches).
  async sweepExpiredHolds(): Promise<number> {
    const result = await this.db.query<{ id: string }>(
      `WITH expired AS (
         SELECT id AS slot_id, booking_id
         FROM availability_slots
         WHERE status = 'tentative_hold' AND hold_expires_at < now() AND booking_id IS NOT NULL
       ),
       released AS (
         UPDATE availability_slots a
         SET status = 'open', hold_expires_at = NULL, booking_id = NULL, updated_at = now()
         FROM expired e
         WHERE a.id = e.slot_id
       ),
       cancelled_bookings AS (
         UPDATE bookings b
         SET status = 'cancelled', cancelled_at = now(),
             cancellation_reason = 'Hold expired before deposit was received', updated_at = now()
         FROM expired e
         WHERE b.id = e.booking_id AND b.status = 'hold'
         RETURNING b.id, b.quote_id
       )
       UPDATE inquiries i
       SET status = 'closed', updated_at = now()
       FROM cancelled_bookings cb
       JOIN quotes q ON q.id = cb.quote_id
       WHERE i.id = q.inquiry_id AND i.status = 'hold'
       RETURNING i.id`,
      [],
    );
    return result.rowCount ?? 0;
  }

  // Cancelling releases the date: the slot goes back to 'open' (or is removed
  // if it had no other purpose) so someone else can book it.
  async cancel(bookingId: string, reason: string): Promise<BookingRow | undefined> {
    return this.db.withTransaction(async (client) => {
      const result = await client.query<BookingRow>(
        `UPDATE bookings SET status = 'cancelled', cancelled_at = now(), cancellation_reason = $2, updated_at = now()
         WHERE id = $1 AND status IN ('hold', 'contracted', 'deposit_paid', 'confirmed')
         RETURNING ${BOOKING_COLUMNS}`,
        [bookingId, reason],
      );
      const booking = result.rows[0];
      if (!booking) {
        return undefined;
      }
      await client.query(
        `UPDATE availability_slots SET status = 'open', hold_expires_at = NULL, booking_id = NULL, updated_at = now()
         WHERE booking_id = $1`,
        [bookingId],
      );
      return booking;
    });
  }
}
