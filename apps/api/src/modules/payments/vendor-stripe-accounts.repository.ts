import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";

export interface VendorStripeAccountRow {
  vendor_id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_complete: boolean;
}

@Injectable()
export class VendorStripeAccountsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findVendorEmail(vendorId: string): Promise<string | undefined> {
    const result = await this.db.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [
      vendorId,
    ]);
    return result.rows[0]?.email;
  }

  async findByVendorId(vendorId: string): Promise<VendorStripeAccountRow | undefined> {
    const result = await this.db.query<VendorStripeAccountRow>(
      `SELECT vendor_id, stripe_account_id, charges_enabled, payouts_enabled, onboarding_complete
       FROM vendor_stripe_accounts WHERE vendor_id = $1`,
      [vendorId],
    );
    return result.rows[0];
  }

  async create(vendorId: string, stripeAccountId: string): Promise<VendorStripeAccountRow> {
    const result = await this.db.query<VendorStripeAccountRow>(
      `INSERT INTO vendor_stripe_accounts (vendor_id, stripe_account_id)
       VALUES ($1, $2)
       RETURNING vendor_id, stripe_account_id, charges_enabled, payouts_enabled, onboarding_complete`,
      [vendorId, stripeAccountId],
    );
    return result.rows[0];
  }

  async updateStatusByStripeAccountId(
    stripeAccountId: string,
    status: { chargesEnabled: boolean; payoutsEnabled: boolean; onboardingComplete: boolean },
  ): Promise<VendorStripeAccountRow | undefined> {
    const result = await this.db.query<VendorStripeAccountRow>(
      `UPDATE vendor_stripe_accounts
       SET charges_enabled = $2, payouts_enabled = $3, onboarding_complete = $4, updated_at = now()
       WHERE stripe_account_id = $1
       RETURNING vendor_id, stripe_account_id, charges_enabled, payouts_enabled, onboarding_complete`,
      [stripeAccountId, status.chargesEnabled, status.payoutsEnabled, status.onboardingComplete],
    );
    return result.rows[0];
  }
}
