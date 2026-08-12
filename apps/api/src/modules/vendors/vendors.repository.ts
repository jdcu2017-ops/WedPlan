import { Injectable } from "@nestjs/common";
import type { AvailabilityStatus, PricingType, VerificationStatus } from "@wedplan/shared";
import { DatabaseService } from "../../database/database.service";
import type { VendorSortOption } from "./dto/search-vendors.query.dto";

export interface VendorSearchFilters {
  categories?: string[];
  location?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  date?: string;
  sort?: VendorSortOption;
  page: number;
  pageSize: number;
}

export interface VendorSearchRow {
  user_id: string;
  business_name: string;
  categories: string[];
  service_area: string | null;
  bio: string | null;
  verification_status: VerificationStatus;
  avg_rating: string;
  review_count: number;
  min_price: string | null;
  total_count: string;
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

export interface VendorPackageRow {
  id: string;
  vendor_id: string;
  name: string;
  category: string;
  description: string | null;
  pricing_type: PricingType;
  base_price: string | null;
  deposit_pct: string;
  cancellation_policy: string | null;
  is_active: boolean;
}

export interface AvailabilitySlotRow {
  date: string;
  status: AvailabilityStatus;
}

@Injectable()
export class VendorsRepository {
  constructor(private readonly db: DatabaseService) {}

  async search(filters: VendorSearchFilters) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    const push = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (filters.categories?.length) {
      conditions.push(`vp.categories && ${push(filters.categories)}::text[]`);
    }
    if (filters.location) {
      conditions.push(`vp.service_area ILIKE ${push(`%${filters.location}%`)}`);
    }
    if (filters.search) {
      const term = push(`%${filters.search}%`);
      conditions.push(`(vp.business_name ILIKE ${term} OR vp.bio ILIKE ${term})`);
    }
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
      conditions.push(
        `EXISTS (SELECT 1 FROM vendor_packages WHERE vendor_id = vp.user_id AND is_active AND base_price BETWEEN ${push(filters.minPrice)} AND ${push(filters.maxPrice)})`,
      );
    } else if (filters.minPrice !== undefined) {
      conditions.push(
        `EXISTS (SELECT 1 FROM vendor_packages WHERE vendor_id = vp.user_id AND is_active AND base_price >= ${push(filters.minPrice)})`,
      );
    } else if (filters.maxPrice !== undefined) {
      conditions.push(
        `EXISTS (SELECT 1 FROM vendor_packages WHERE vendor_id = vp.user_id AND is_active AND base_price <= ${push(filters.maxPrice)})`,
      );
    }
    if (filters.date) {
      conditions.push(
        `NOT EXISTS (SELECT 1 FROM availability_slots WHERE vendor_id = vp.user_id AND date = ${push(filters.date)} AND status IN ('booked', 'blocked', 'tentative_hold'))`,
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderBy =
      filters.sort === "rating"
        ? "vp.avg_rating DESC NULLS LAST"
        : filters.sort === "price"
          ? "min_price ASC NULLS LAST"
          : "vp.created_at DESC";

    const limit = push(filters.pageSize);
    const offset = push((filters.page - 1) * filters.pageSize);

    const result = await this.db.query<VendorSearchRow>(
      `SELECT
         vp.user_id, vp.business_name, vp.categories, vp.service_area, vp.bio,
         vp.verification_status, vp.avg_rating, vp.review_count,
         (SELECT MIN(base_price) FROM vendor_packages
            WHERE vendor_id = vp.user_id AND is_active AND base_price IS NOT NULL) AS min_price,
         COUNT(*) OVER() AS total_count
       FROM vendor_profiles vp
       ${where}
       ORDER BY ${orderBy}
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    return result.rows;
  }

  async findProfile(vendorId: string): Promise<VendorProfileRow | undefined> {
    const result = await this.db.query<VendorProfileRow>(
      `SELECT user_id, business_name, categories, service_area, bio, verification_status, avg_rating, review_count
       FROM vendor_profiles WHERE user_id = $1`,
      [vendorId],
    );
    return result.rows[0];
  }

  async findActivePackages(vendorId: string): Promise<VendorPackageRow[]> {
    const result = await this.db.query<VendorPackageRow>(
      `SELECT id, vendor_id, name, category, description, pricing_type, base_price, deposit_pct, cancellation_policy, is_active
       FROM vendor_packages WHERE vendor_id = $1 AND is_active = true
       ORDER BY category, name`,
      [vendorId],
    );
    return result.rows;
  }

  async findAvailability(vendorId: string, from: string, to: string): Promise<AvailabilitySlotRow[]> {
    const result = await this.db.query<AvailabilitySlotRow>(
      `SELECT date, status FROM availability_slots
       WHERE vendor_id = $1 AND date BETWEEN $2 AND $3
       ORDER BY date`,
      [vendorId, from, to],
    );
    return result.rows;
  }
}
