import { Injectable } from "@nestjs/common";
import type { UserRole, VerificationStatus } from "@wedplan/shared";
import { DatabaseService } from "../../database/database.service";

export interface UserSummary {
  id: string;
  email: string;
  role: UserRole;
  mfa_enabled: boolean;
}

// Insert/update shapes — distinct from the shared `InquirerProfile`/`VendorProfile`
// read models, since those declare every field as required-but-nullable while
// writes come from partially-filled DTOs.
export interface InquirerProfileInput {
  displayName: string;
  weddingDate?: string;
  venueLocation?: string;
  guestCount?: number;
  budgetTotal?: number;
  styleTags?: string[];
}

export interface VendorProfileInput {
  businessName: string;
  categories?: string[];
  serviceArea?: string;
  bio?: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly db: DatabaseService) {}

  async findUserSummary(userId: string): Promise<UserSummary | undefined> {
    const result = await this.db.query<UserSummary>(
      `SELECT id, email, role, mfa_enabled FROM users WHERE id = $1`,
      [userId],
    );
    return result.rows[0];
  }

  async getInquirerProfile(userId: string) {
    const result = await this.db.query<InquirerProfileRow>(
      `SELECT user_id, display_name, wedding_date, venue_location, guest_count, budget_total, style_tags
       FROM inquirer_profiles WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0];
  }

  async upsertInquirerProfile(userId: string, profile: InquirerProfileInput) {
    const result = await this.db.query<InquirerProfileRow>(
      `INSERT INTO inquirer_profiles (user_id, display_name, wedding_date, venue_location, guest_count, budget_total, style_tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         wedding_date = EXCLUDED.wedding_date,
         venue_location = EXCLUDED.venue_location,
         guest_count = EXCLUDED.guest_count,
         budget_total = EXCLUDED.budget_total,
         style_tags = EXCLUDED.style_tags,
         updated_at = now()
       RETURNING user_id, display_name, wedding_date, venue_location, guest_count, budget_total, style_tags`,
      [
        userId,
        profile.displayName,
        profile.weddingDate ?? null,
        profile.venueLocation ?? null,
        profile.guestCount ?? null,
        profile.budgetTotal ?? null,
        profile.styleTags ?? [],
      ],
    );
    return result.rows[0];
  }

  async getVendorProfile(userId: string) {
    const result = await this.db.query<VendorProfileRow>(
      `SELECT user_id, business_name, categories, service_area, bio, verification_status, avg_rating, review_count
       FROM vendor_profiles WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0];
  }

  async upsertVendorProfile(userId: string, profile: VendorProfileInput) {
    const result = await this.db.query<VendorProfileRow>(
      `INSERT INTO vendor_profiles (user_id, business_name, categories, service_area, bio)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         business_name = EXCLUDED.business_name,
         categories = EXCLUDED.categories,
         service_area = EXCLUDED.service_area,
         bio = EXCLUDED.bio,
         updated_at = now()
       RETURNING user_id, business_name, categories, service_area, bio, verification_status, avg_rating, review_count`,
      [userId, profile.businessName, profile.categories ?? [], profile.serviceArea ?? null, profile.bio ?? null],
    );
    return result.rows[0];
  }
}

export interface InquirerProfileRow {
  user_id: string;
  display_name: string;
  wedding_date: string | null;
  venue_location: string | null;
  guest_count: number | null;
  budget_total: string | null;
  style_tags: string[];
}

export interface VendorProfileRow {
  user_id: string;
  business_name: string;
  categories: string[];
  service_area: string | null;
  bio: string | null;
  verification_status: VerificationStatus;
  avg_rating: string;
  review_count: number;
}
