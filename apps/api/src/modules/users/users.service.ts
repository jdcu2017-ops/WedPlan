import { Injectable, NotFoundException } from "@nestjs/common";
import { UpdateInquirerProfileDto } from "./dto/update-inquirer-profile.dto";
import { UpdateVendorProfileDto } from "./dto/update-vendor-profile.dto";
import {
  InquirerProfileRow,
  UserSummary,
  UsersRepository,
  VendorProfileRow,
} from "./users.repository";

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  async getMe(userId: string) {
    const user = await this.repo.findUserSummary(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const profile =
      user.role === "inquirer"
        ? await this.repo.getInquirerProfile(userId)
        : user.role === "vendor"
          ? await this.repo.getVendorProfile(userId)
          : undefined;

    return {
      user: this.toUserDto(user),
      profile: profile
        ? user.role === "inquirer"
          ? this.toInquirerProfileDto(profile as InquirerProfileRow)
          : this.toVendorProfileDto(profile as VendorProfileRow)
        : null,
    };
  }

  async updateInquirerProfile(userId: string, dto: UpdateInquirerProfileDto) {
    const row = await this.repo.upsertInquirerProfile(userId, dto);
    return this.toInquirerProfileDto(row);
  }

  async updateVendorProfile(userId: string, dto: UpdateVendorProfileDto) {
    const row = await this.repo.upsertVendorProfile(userId, dto);
    return this.toVendorProfileDto(row);
  }

  private toUserDto(row: UserSummary) {
    return { id: row.id, email: row.email, role: row.role, mfaEnabled: row.mfa_enabled };
  }

  private toInquirerProfileDto(row: InquirerProfileRow) {
    return {
      userId: row.user_id,
      displayName: row.display_name,
      weddingDate: row.wedding_date,
      venueLocation: row.venue_location,
      guestCount: row.guest_count,
      budgetTotal: row.budget_total !== null ? Number(row.budget_total) : null,
      styleTags: row.style_tags,
    };
  }

  private toVendorProfileDto(row: VendorProfileRow) {
    return {
      userId: row.user_id,
      businessName: row.business_name,
      categories: row.categories,
      serviceArea: row.service_area,
      bio: row.bio,
      verificationStatus: row.verification_status,
      avgRating: Number(row.avg_rating),
      reviewCount: row.review_count,
    };
  }
}
