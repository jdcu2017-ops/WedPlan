import { Injectable, NotFoundException } from "@nestjs/common";
import { assertValidDateRange } from "../../common/utils/date-range.util";
import { SearchVendorsQueryDto } from "./dto/search-vendors.query.dto";
import { AvailabilityRangeQueryDto } from "./dto/availability-range.query.dto";
import { VendorsRepository } from "./vendors.repository";

const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class VendorsService {
  constructor(private readonly repo: VendorsRepository) {}

  async search(query: SearchVendorsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const categories = query.categories
      ? query.categories.split(",").map((c) => c.trim()).filter(Boolean)
      : undefined;

    const rows = await this.repo.search({
      categories,
      location: query.location,
      search: query.search,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      date: query.date,
      sort: query.sort,
      page,
      pageSize,
    });

    const total = rows.length ? parseInt(rows[0].total_count, 10) : 0;
    return {
      items: rows.map((row) => ({
        vendorId: row.user_id,
        businessName: row.business_name,
        categories: row.categories,
        serviceArea: row.service_area,
        bio: row.bio,
        verificationStatus: row.verification_status,
        avgRating: Number(row.avg_rating),
        reviewCount: row.review_count,
        minPrice: row.min_price !== null ? Number(row.min_price) : null,
      })),
      page,
      pageSize,
      total,
    };
  }

  async getProfile(vendorId: string) {
    const profile = await this.repo.findProfile(vendorId);
    if (!profile) {
      throw new NotFoundException("Vendor not found");
    }
    const packages = await this.repo.findActivePackages(vendorId);
    return {
      vendorId: profile.user_id,
      businessName: profile.business_name,
      categories: profile.categories,
      serviceArea: profile.service_area,
      bio: profile.bio,
      verificationStatus: profile.verification_status,
      avgRating: Number(profile.avg_rating),
      reviewCount: profile.review_count,
      packages: packages.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        pricingType: p.pricing_type,
        basePrice: p.base_price !== null ? Number(p.base_price) : null,
        depositPct: Number(p.deposit_pct),
        cancellationPolicy: p.cancellation_policy,
      })),
    };
  }

  async getPublicAvailability(vendorId: string, range: AvailabilityRangeQueryDto) {
    const profile = await this.repo.findProfile(vendorId);
    if (!profile) {
      throw new NotFoundException("Vendor not found");
    }
    assertValidDateRange(range.from, range.to);
    const slots = await this.repo.findAvailability(vendorId, range.from, range.to);
    return slots.map((s) => ({ date: s.date, status: s.status }));
  }
}
