import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type Stripe from "stripe";
import { AuditLogService } from "../../common/audit/audit-log.service";
import { RefundPaymentDto } from "./dto/refund-payment.dto";
import { RequestPaymentDto } from "./dto/request-payment.dto";
import { PaymentRow, PaymentsRepository } from "./payments.repository";
import { StripeProvider } from "./stripe.provider";
import { VendorStripeAccountsRepository } from "./vendor-stripe-accounts.repository";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepo: PaymentsRepository,
    private readonly vendorAccountsRepo: VendorStripeAccountsRepository,
    private readonly stripeProvider: StripeProvider,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  async requestPayment(vendorId: string, bookingId: string, dto: RequestPaymentDto) {
    const booking = await this.paymentsRepo.findBookingWithQuote(bookingId);
    if (!booking) {
      throw new NotFoundException("Booking not found");
    }
    if (booking.vendor_id !== vendorId) {
      throw new ForbiddenException("Not your booking");
    }

    let amount: number;
    if (dto.type === "deposit") {
      if (await this.paymentsRepo.hasActivePayment(bookingId, "deposit")) {
        throw new ConflictException("A deposit payment has already been requested or paid");
      }
      amount = Number(booking.deposit_amount);
    } else {
      if (dto.amount === undefined) {
        throw new BadRequestException("amount is required for milestone/final payments");
      }
      amount = dto.amount;
    }

    const vendorAccount = await this.vendorAccountsRepo.findByVendorId(vendorId);
    if (!vendorAccount || !vendorAccount.charges_enabled) {
      throw new BadRequestException(
        "Vendor has not completed Stripe onboarding yet — cannot accept payments",
      );
    }

    const commissionPct = this.config.get<number>("stripe.platformCommissionPct") ?? 10;
    const amountCents = Math.round(amount * 100);
    const applicationFeeCents = Math.round(amountCents * (commissionPct / 100));

    const intent = await this.stripeProvider.createDestinationPaymentIntent({
      amountCents,
      applicationFeeCents,
      destinationAccountId: vendorAccount.stripe_account_id,
      metadata: { bookingId, type: dto.type },
    });

    const payment = await this.paymentsRepo.create({
      bookingId,
      amount,
      type: dto.type,
      stripeRef: intent.id,
      stripeConnectAccount: vendorAccount.stripe_account_id,
    });

    await this.auditLog.record({
      actorId: vendorId,
      action: "payment.requested",
      entityType: "payment",
      entityId: payment.id,
      metadata: { bookingId, type: dto.type, amount },
    });

    return { ...this.toDto(payment), clientSecret: intent.client_secret };
  }

  async listForBooking(userId: string, bookingId: string) {
    const booking = await this.paymentsRepo.findBookingWithQuote(bookingId);
    if (!booking) {
      throw new NotFoundException("Booking not found");
    }
    if (booking.inquirer_id !== userId && booking.vendor_id !== userId) {
      throw new ForbiddenException("Not a participant in this booking");
    }
    const rows = await this.paymentsRepo.listForBooking(bookingId);

    // Only the inquirer ever needs to actually complete a pending payment —
    // the vendor already got the client_secret once, at request time, and
    // has no use for it afterward. Stripe returns client_secret on retrieve
    // as well as create, so this re-fetches it for whichever payments are
    // still awaiting confirmation.
    const isInquirer = booking.inquirer_id === userId;
    return Promise.all(
      rows.map(async (row) => {
        if (isInquirer && row.status === "pending" && row.stripe_ref) {
          const intent = await this.stripeProvider.retrievePaymentIntent(row.stripe_ref);
          return { ...this.toDto(row), clientSecret: intent.client_secret };
        }
        return this.toDto(row);
      }),
    );
  }

  async refund(vendorId: string, paymentId: string, dto: RefundPaymentDto) {
    const payment = await this.paymentsRepo.findById(paymentId);
    if (!payment) {
      throw new NotFoundException("Payment not found");
    }
    const booking = await this.paymentsRepo.findBookingWithQuote(payment.booking_id);
    if (!booking || booking.vendor_id !== vendorId) {
      throw new ForbiddenException("Not your booking");
    }
    if (payment.type === "refund") {
      throw new BadRequestException("Cannot refund a refund");
    }
    if (payment.status !== "succeeded") {
      throw new ConflictException("Only a succeeded payment can be refunded");
    }
    if (!payment.stripe_ref) {
      throw new BadRequestException("Payment has no Stripe reference to refund");
    }

    const refund = await this.stripeProvider.createRefund(payment.stripe_ref);
    const record = await this.paymentsRepo.createRefundRecord({
      bookingId: payment.booking_id,
      amount: Number(payment.amount),
      stripeRef: refund.id,
      stripeConnectAccount: payment.stripe_connect_account,
    });

    await this.auditLog.record({
      actorId: vendorId,
      action: "payment.refund_requested",
      entityType: "payment",
      entityId: record.id,
      metadata: { originalPaymentId: paymentId, reason: dto.reason },
    });

    return this.toDto(record);
  }

  // Stripe is the only caller — signature already verified by the controller
  // via StripeProvider.constructWebhookEvent before this runs.
  async handleWebhookEvent(event: Stripe.Event): Promise<{ received: true }> {
    switch (event.type) {
      case "payment_intent.succeeded":
        await this.onPaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await this.onPaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case "refund.updated":
        await this.onRefundUpdated(event.data.object as Stripe.Refund);
        break;
      case "account.updated":
        await this.onAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        break;
    }
    return { received: true };
  }

  private async onPaymentIntentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentsRepo.findByStripeRef(intent.id);
    if (!payment) return;
    await this.paymentsRepo.updateStatus(payment.id, "succeeded");
    if (payment.type === "deposit") {
      await this.paymentsRepo.markBookingDepositPaid(payment.booking_id);
    }
    await this.auditLog.record({
      actorId: null,
      action: "payment.succeeded",
      entityType: "payment",
      entityId: payment.id,
      metadata: { stripeRef: intent.id },
    });
  }

  private async onPaymentIntentFailed(intent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentsRepo.findByStripeRef(intent.id);
    if (!payment) return;
    await this.paymentsRepo.updateStatus(payment.id, "failed");
  }

  // A refund touches two rows: our own 'refund'-type record (keyed by the
  // Stripe refund id) tracks whether the refund itself went through, while
  // the original charge's payment row gets marked 'refunded' once it has.
  private async onRefundUpdated(refund: Stripe.Refund): Promise<void> {
    const refundStatus =
      refund.status === "succeeded"
        ? "succeeded"
        : refund.status === "failed" || refund.status === "canceled"
          ? "failed"
          : "pending";
    const refundRecord = await this.paymentsRepo.findByStripeRef(refund.id);
    if (refundRecord) {
      await this.paymentsRepo.updateStatus(refundRecord.id, refundStatus);
    }
    if (refundStatus === "succeeded" && typeof refund.payment_intent === "string") {
      const originalPayment = await this.paymentsRepo.findByStripeRef(refund.payment_intent);
      if (originalPayment) {
        await this.paymentsRepo.updateStatus(originalPayment.id, "refunded");
      }
    }
  }

  private async onAccountUpdated(account: Stripe.Account): Promise<void> {
    await this.vendorAccountsRepo.updateStatusByStripeAccountId(account.id, {
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      onboardingComplete: account.details_submitted ?? false,
    });
  }

  private toDto(row: PaymentRow) {
    return {
      id: row.id,
      bookingId: row.booking_id,
      amount: Number(row.amount),
      type: row.type,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}
