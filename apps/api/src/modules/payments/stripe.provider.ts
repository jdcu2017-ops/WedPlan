import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

// Thin wrapper around the Stripe SDK — destination charges (platform is
// merchant of record, funds transfer to the vendor's connected account minus
// our application fee), matching spec 3.6's "platform collects commission,
// vendors receive payouts" model.
@Injectable()
export class StripeProvider {
  private readonly client: Stripe | undefined;

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.get<string>("stripe.secretKey");
    if (secretKey && secretKey !== "changeme") {
      this.client = new Stripe(secretKey);
    }
  }

  private getClient(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException("Stripe is not configured on this server");
    }
    return this.client;
  }

  async createExpressAccount(email: string): Promise<string> {
    const account = await this.getClient().accounts.create({
      type: "express",
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    return account.id;
  }

  async createOnboardingLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<string> {
    const link = await this.getClient().accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
    return link.url;
  }

  retrieveAccount(accountId: string): Promise<Stripe.Account> {
    return this.getClient().accounts.retrieve(accountId);
  }

  createDestinationPaymentIntent(params: {
    amountCents: number;
    applicationFeeCents: number;
    destinationAccountId: string;
    metadata: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    return this.getClient().paymentIntents.create({
      amount: params.amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      application_fee_amount: params.applicationFeeCents,
      transfer_data: { destination: params.destinationAccountId },
      metadata: params.metadata,
    });
  }

  // Stripe returns client_secret on retrieve, not just create — needed so
  // whoever is actually paying (the inquirer) can fetch it, since the vendor
  // is the one who calls createDestinationPaymentIntent in the first place.
  retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.getClient().paymentIntents.retrieve(paymentIntentId);
  }

  createRefund(paymentIntentId: string): Promise<Stripe.Refund> {
    return this.getClient().refunds.create({ payment_intent: paymentIntentId });
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.config.get<string>("stripe.webhookSecret");
    if (!webhookSecret || webhookSecret === "changeme") {
      throw new ServiceUnavailableException("Stripe webhook secret is not configured");
    }
    return this.getClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}
