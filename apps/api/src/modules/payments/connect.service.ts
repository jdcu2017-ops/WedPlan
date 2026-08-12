import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StripeProvider } from "./stripe.provider";
import { VendorStripeAccountRow, VendorStripeAccountsRepository } from "./vendor-stripe-accounts.repository";

@Injectable()
export class ConnectService {
  constructor(
    private readonly stripeProvider: StripeProvider,
    private readonly repo: VendorStripeAccountsRepository,
    private readonly config: ConfigService,
  ) {}

  async createOnboardingLink(vendorId: string): Promise<{ url: string }> {
    const account = await this.getOrCreateAccount(vendorId);
    const webUrl = this.config.get<string>("webUrl");
    const url = await this.stripeProvider.createOnboardingLink(
      account.stripe_account_id,
      `${webUrl}/vendor/payments/onboarding?refresh=true`,
      `${webUrl}/vendor/payments/onboarding?complete=true`,
    );
    return { url };
  }

  async getStatus(vendorId: string) {
    const account = await this.repo.findByVendorId(vendorId);
    return {
      onboardingComplete: account?.onboarding_complete ?? false,
      chargesEnabled: account?.charges_enabled ?? false,
      payoutsEnabled: account?.payouts_enabled ?? false,
    };
  }

  private async getOrCreateAccount(vendorId: string): Promise<VendorStripeAccountRow> {
    const existing = await this.repo.findByVendorId(vendorId);
    if (existing) {
      return existing;
    }
    const email = await this.repo.findVendorEmail(vendorId);
    if (!email) {
      throw new NotFoundException("Vendor not found");
    }
    const stripeAccountId = await this.stripeProvider.createExpressAccount(email);
    return this.repo.create(vendorId, stripeAccountId);
  }
}
