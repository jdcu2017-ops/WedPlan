import { Injectable } from "@nestjs/common";
import type { PaymentStatus, PaymentType } from "@wedplan/shared";
import { DatabaseService } from "../../database/database.service";

export interface PaymentRow {
  id: string;
  booking_id: string;
  amount: string;
  type: PaymentType;
  status: PaymentStatus;
  stripe_ref: string | null;
  stripe_connect_account: string | null;
  created_at: string;
}

export interface BookingPaymentContext {
  id: string;
  inquirer_id: string;
  vendor_id: string;
  status: string;
  total_amount: string;
  deposit_amount: string;
}

const PAYMENT_COLUMNS =
  "id, booking_id, amount, type, status, stripe_ref, stripe_connect_account, created_at";

@Injectable()
export class PaymentsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findBookingWithQuote(bookingId: string): Promise<BookingPaymentContext | undefined> {
    const result = await this.db.query<BookingPaymentContext>(
      `SELECT b.id, b.inquirer_id, b.vendor_id, b.status, b.total_amount, q.deposit_amount
       FROM bookings b JOIN quotes q ON q.id = b.quote_id
       WHERE b.id = $1`,
      [bookingId],
    );
    return result.rows[0];
  }

  async hasActivePayment(bookingId: string, type: PaymentType): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM payments WHERE booking_id = $1 AND type = $2 AND status IN ('pending', 'succeeded')`,
      [bookingId, type],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async create(params: {
    bookingId: string;
    amount: number;
    type: PaymentType;
    stripeRef: string;
    stripeConnectAccount: string;
  }): Promise<PaymentRow> {
    const result = await this.db.query<PaymentRow>(
      `INSERT INTO payments (booking_id, amount, type, status, stripe_ref, stripe_connect_account)
       VALUES ($1, $2, $3, 'pending', $4, $5)
       RETURNING ${PAYMENT_COLUMNS}`,
      [params.bookingId, params.amount, params.type, params.stripeRef, params.stripeConnectAccount],
    );
    return result.rows[0];
  }

  async createRefundRecord(params: {
    bookingId: string;
    amount: number;
    stripeRef: string;
    stripeConnectAccount: string | null;
  }): Promise<PaymentRow> {
    const result = await this.db.query<PaymentRow>(
      `INSERT INTO payments (booking_id, amount, type, status, stripe_ref, stripe_connect_account)
       VALUES ($1, $2, 'refund', 'pending', $3, $4)
       RETURNING ${PAYMENT_COLUMNS}`,
      [params.bookingId, params.amount, params.stripeRef, params.stripeConnectAccount],
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<PaymentRow | undefined> {
    const result = await this.db.query<PaymentRow>(
      `SELECT ${PAYMENT_COLUMNS} FROM payments WHERE id = $1`,
      [id],
    );
    return result.rows[0];
  }

  async findByStripeRef(stripeRef: string): Promise<PaymentRow | undefined> {
    const result = await this.db.query<PaymentRow>(
      `SELECT ${PAYMENT_COLUMNS} FROM payments WHERE stripe_ref = $1`,
      [stripeRef],
    );
    return result.rows[0];
  }

  async listForBooking(bookingId: string): Promise<PaymentRow[]> {
    const result = await this.db.query<PaymentRow>(
      `SELECT ${PAYMENT_COLUMNS} FROM payments WHERE booking_id = $1 ORDER BY created_at DESC`,
      [bookingId],
    );
    return result.rows;
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<PaymentRow | undefined> {
    const result = await this.db.query<PaymentRow>(
      `UPDATE payments SET status = $1, updated_at = now() WHERE id = $2 RETURNING ${PAYMENT_COLUMNS}`,
      [status, id],
    );
    return result.rows[0];
  }

  async markBookingDepositPaid(bookingId: string): Promise<void> {
    await this.db.query(
      `UPDATE bookings SET status = 'deposit_paid', deposit_paid_at = now(), updated_at = now()
       WHERE id = $1 AND status IN ('hold', 'contracted')`,
      [bookingId],
    );
  }
}
