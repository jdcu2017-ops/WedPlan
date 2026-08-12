import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../../src/database/database.service";
import {
  BookingsRepository,
  DateUnavailableError,
} from "../../src/modules/bookings/bookings.repository";
import { VendorAvailabilityRepository } from "../../src/modules/vendors/vendor-availability.repository";
import {
  closePool,
  createInquirer,
  createSentQuote,
  createVendor,
  pool,
  TEST_DATABASE_URL,
  truncateAll,
} from "../support/db";

// Spec 3.4 / README: "the calendar-locking logic ... is the highest-risk
// piece — write concurrency tests for it before Phase 4 sign-off." These
// tests race real concurrent transactions against a real Postgres to prove
// two inquirers can never both lock the same vendor+date.
describe("Availability calendar locking (concurrency)", () => {
  let db: DatabaseService;
  let bookingsRepo: BookingsRepository;

  beforeAll(() => {
    const config = { get: () => TEST_DATABASE_URL } as unknown as ConfigService;
    db = new DatabaseService(config);
    bookingsRepo = new BookingsRepository(db);
  });

  afterEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await db.onModuleDestroy();
    await closePool();
  });

  it("lets exactly one of two concurrent quote-acceptances claim the same vendor+date", async () => {
    const vendorId = await createVendor();
    const inquirerA = await createInquirer("Couple A");
    const inquirerB = await createInquirer("Couple B");
    const eventDate = "2027-06-12";

    const { quoteId: quoteA, inquiryId: inquiryA } = await createSentQuote({
      inquirerId: inquirerA,
      vendorId,
      eventDate,
    });
    const { quoteId: quoteB, inquiryId: inquiryB } = await createSentQuote({
      inquirerId: inquirerB,
      vendorId,
      eventDate,
    });

    const [resultA, resultB] = await Promise.allSettled([
      bookingsRepo.acceptQuoteAndCreateBooking({
        quoteId: quoteA,
        inquiryId: inquiryA,
        inquirerId: inquirerA,
        vendorId,
        eventDate,
        totalAmount: 5000,
      }),
      bookingsRepo.acceptQuoteAndCreateBooking({
        quoteId: quoteB,
        inquiryId: inquiryB,
        inquirerId: inquirerB,
        vendorId,
        eventDate,
        totalAmount: 5000,
      }),
    ]);

    const fulfilled = [resultA, resultB].filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof bookingsRepo.acceptQuoteAndCreateBooking>>> =>
        r.status === "fulfilled",
    );
    const rejected = [resultA, resultB].filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(DateUnavailableError);

    const { rows: bookingRows } = await pool.query(
      `SELECT status FROM bookings WHERE vendor_id = $1 AND event_date = $2`,
      [vendorId, eventDate],
    );
    expect(bookingRows).toHaveLength(1);
    expect(bookingRows[0].status).toBe("hold");

    const { rows: slotRows } = await pool.query(
      `SELECT status, booking_id FROM availability_slots WHERE vendor_id = $1 AND date = $2`,
      [vendorId, eventDate],
    );
    expect(slotRows).toHaveLength(1);
    expect(slotRows[0].status).toBe("tentative_hold");
    expect(slotRows[0].booking_id).toBe(fulfilled[0].value.id);
  });

  it("serializes many concurrent racers down to a single winner", async () => {
    const vendorId = await createVendor();
    const eventDate = "2027-09-04";

    const racers = await Promise.all(
      Array.from({ length: 8 }, async (_, i) => {
        const inquirerId = await createInquirer(`Racer ${i}`);
        const { quoteId, inquiryId } = await createSentQuote({ inquirerId, vendorId, eventDate });
        return { inquirerId, quoteId, inquiryId };
      }),
    );

    const results = await Promise.allSettled(
      racers.map((r) =>
        bookingsRepo.acceptQuoteAndCreateBooking({
          quoteId: r.quoteId,
          inquiryId: r.inquiryId,
          inquirerId: r.inquirerId,
          vendorId,
          eventDate,
          totalAmount: 1000,
        }),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(7);
    for (const r of results) {
      if (r.status === "rejected") {
        expect(r.reason).toBeInstanceOf(DateUnavailableError);
      }
    }

    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM bookings WHERE vendor_id = $1 AND event_date = $2`,
      [vendorId, eventDate],
    );
    expect(rows[0].n).toBe(1);
  });

  it("does not let a losing racer's quote end up accepted", async () => {
    const vendorId = await createVendor();
    const inquirerA = await createInquirer("Couple A");
    const inquirerB = await createInquirer("Couple B");
    const eventDate = "2027-11-20";

    const { quoteId: quoteA, inquiryId: inquiryA } = await createSentQuote({
      inquirerId: inquirerA,
      vendorId,
      eventDate,
    });
    const { quoteId: quoteB, inquiryId: inquiryB } = await createSentQuote({
      inquirerId: inquirerB,
      vendorId,
      eventDate,
    });

    await Promise.allSettled([
      bookingsRepo.acceptQuoteAndCreateBooking({
        quoteId: quoteA,
        inquiryId: inquiryA,
        inquirerId: inquirerA,
        vendorId,
        eventDate,
        totalAmount: 3000,
      }),
      bookingsRepo.acceptQuoteAndCreateBooking({
        quoteId: quoteB,
        inquiryId: inquiryB,
        inquirerId: inquirerB,
        vendorId,
        eventDate,
        totalAmount: 3000,
      }),
    ]);

    // The losing transaction must roll back entirely — its quote is left
    // exactly as it was ('sent'), not stranded in a half-applied 'accepted'
    // state, since acceptQuoteAndCreateBooking runs inside one transaction.
    const { rows } = await pool.query<{ status: string }>(
      `SELECT status FROM quotes WHERE id IN ($1, $2) ORDER BY status`,
      [quoteA, quoteB],
    );
    expect(rows.map((r) => r.status).sort()).toEqual(["accepted", "sent"]);
  });

  it("prevents a vendor from directly reopening a date that's on hold from an accepted quote", async () => {
    const vendorId = await createVendor();
    const inquirerId = await createInquirer();
    const eventDate = "2027-04-01";
    const { quoteId, inquiryId } = await createSentQuote({ inquirerId, vendorId, eventDate });

    await bookingsRepo.acceptQuoteAndCreateBooking({
      quoteId,
      inquiryId,
      inquirerId,
      vendorId,
      eventDate,
      totalAmount: 2000,
    });

    const availabilityRepo = new VendorAvailabilityRepository(db);
    const result = await availabilityRepo.upsert(vendorId, {
      date: eventDate,
      status: "open",
      notes: undefined,
    });

    expect(result).toBeUndefined();
    const { rows } = await pool.query<{ status: string }>(
      `SELECT status FROM availability_slots WHERE vendor_id = $1 AND date = $2`,
      [vendorId, eventDate],
    );
    expect(rows[0].status).toBe("tentative_hold");
  });
});
