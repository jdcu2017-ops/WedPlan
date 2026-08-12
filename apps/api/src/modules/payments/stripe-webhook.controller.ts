import { BadRequestException, Controller, Headers, Post, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { PaymentsService } from "./payments.service";
import { StripeProvider } from "./stripe.provider";

// Public endpoint (no JWT — the caller is Stripe, verified via signature
// instead). Requires NestFactory.create(AppModule, { rawBody: true }) in
// main.ts so req.rawBody is the untouched request body Stripe signed.
@Controller("webhooks/stripe")
export class StripeWebhookController {
  constructor(
    private readonly stripeProvider: StripeProvider,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post()
  handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string | undefined,
  ) {
    if (!req.rawBody || !signature) {
      throw new BadRequestException("Missing Stripe signature or raw body");
    }
    const event = this.stripeProvider.constructWebhookEvent(req.rawBody, signature);
    return this.paymentsService.handleWebhookEvent(event);
  }
}
