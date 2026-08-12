import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InquiriesRepository } from "../inquiries/inquiries.repository";
import {
  BookingRow,
  BookingsRepository,
  DateUnavailableError,
  QuoteNotAcceptableError,
} from "./bookings.repository";
import { QuotesRepository } from "./quotes.repository";

@Injectable()
export class BookingsService {
  constructor(
    private readonly bookingsRepo: BookingsRepository,
    private readonly quotesRepo: QuotesRepository,
    private readonly inquiriesRepo: InquiriesRepository,
  ) {}

  async acceptQuote(inquirerId: string, quoteId: string) {
    const quote = await this.quotesRepo.findById(quoteId);
    if (!quote) {
      throw new NotFoundException("Quote not found");
    }
    const inquiry = await this.inquiriesRepo.findById(quote.inquiry_id);
    if (!inquiry) {
      throw new NotFoundException("Inquiry not found");
    }
    if (inquiry.inquirer_id !== inquirerId) {
      throw new ForbiddenException("Not your inquiry");
    }
    if (quote.status !== "sent") {
      throw new ConflictException("Only a sent quote can be accepted");
    }
    // Guards against accepting two different 'sent' quotes on the same
    // inquiry (each quote's own status only rules out re-accepting itself).
    if (inquiry.status !== "open" && inquiry.status !== "quoted") {
      throw new ConflictException("This inquiry already has an active hold or booking");
    }
    if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
      await this.quotesRepo.transitionStatus(quoteId, ["sent"], "expired");
      throw new ConflictException("This quote has expired");
    }
    if (!inquiry.event_date) {
      throw new BadRequestException("Inquiry is missing an event date");
    }

    try {
      const booking = await this.bookingsRepo.acceptQuoteAndCreateBooking({
        quoteId: quote.id,
        inquiryId: inquiry.id,
        inquirerId,
        vendorId: inquiry.vendor_id,
        eventDate: inquiry.event_date,
        totalAmount: Number(quote.total_amount),
      });
      return this.toDto(booking);
    } catch (err) {
      if (err instanceof DateUnavailableError) {
        throw new ConflictException(
          "This vendor is no longer available on the requested date",
        );
      }
      if (err instanceof QuoteNotAcceptableError) {
        throw new ConflictException("This quote was already accepted or is no longer available");
      }
      throw err;
    }
  }

  async listForUser(userId: string, role: "inquirer" | "vendor") {
    const column = role === "inquirer" ? "inquirer_id" : "vendor_id";
    const rows = await this.bookingsRepo.listForParticipant(userId, column);
    return rows.map((r) => this.toDto(r));
  }

  async getForParticipant(userId: string, bookingId: string) {
    const row = await this.getOwnedRow(bookingId, userId);
    return this.toDto(row);
  }

  async cancel(userId: string, bookingId: string, reason: string) {
    const row = await this.getOwnedRow(bookingId, userId);
    const cancellableFrom = ["hold", "contracted", "deposit_paid", "confirmed"];
    if (!cancellableFrom.includes(row.status)) {
      throw new ConflictException("Booking cannot be cancelled from its current status");
    }
    const updated = await this.bookingsRepo.cancel(bookingId, reason);
    if (!updated) {
      throw new ConflictException("Booking status changed concurrently, please retry");
    }
    return this.toDto(updated);
  }

  private async getOwnedRow(bookingId: string, userId: string): Promise<BookingRow> {
    const row = await this.bookingsRepo.findById(bookingId);
    if (!row) {
      throw new NotFoundException("Booking not found");
    }
    if (row.inquirer_id !== userId && row.vendor_id !== userId) {
      throw new ForbiddenException("Not a participant in this booking");
    }
    return row;
  }

  private toDto(row: BookingRow) {
    return {
      id: row.id,
      quoteId: row.quote_id,
      inquirerId: row.inquirer_id,
      vendorId: row.vendor_id,
      vendorBusinessName: row.vendor_business_name,
      inquirerDisplayName: row.inquirer_display_name,
      eventDate: row.event_date,
      status: row.status,
      contractDocUrl: row.contract_doc_url,
      totalAmount: Number(row.total_amount),
      depositPaidAt: row.deposit_paid_at,
      balanceDueAt: row.balance_due_at,
      cancelledAt: row.cancelled_at,
      cancellationReason: row.cancellation_reason,
      createdAt: row.created_at,
    };
  }
}
