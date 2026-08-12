import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConnectController } from "./connect.controller";
import { ConnectService } from "./connect.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsRepository } from "./payments.repository";
import { PaymentsService } from "./payments.service";
import { StripeProvider } from "./stripe.provider";
import { StripeWebhookController } from "./stripe-webhook.controller";
import { VendorStripeAccountsRepository } from "./vendor-stripe-accounts.repository";

@Module({
  imports: [AuthModule],
  controllers: [ConnectController, PaymentsController, StripeWebhookController],
  providers: [
    ConnectService,
    PaymentsService,
    PaymentsRepository,
    VendorStripeAccountsRepository,
    StripeProvider,
  ],
})
export class PaymentsModule {}
