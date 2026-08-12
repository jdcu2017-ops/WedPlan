import { ConflictException, Injectable } from "@nestjs/common";
import { assertValidDateRange } from "../../common/utils/date-range.util";
import { AvailabilityRangeQueryDto } from "./dto/availability-range.query.dto";
import { UpsertAvailabilityDto } from "./dto/upsert-availability.dto";
import { VendorAvailabilityRepository } from "./vendor-availability.repository";

@Injectable()
export class VendorAvailabilityService {
  constructor(private readonly repo: VendorAvailabilityRepository) {}

  async listOwn(vendorId: string, range: AvailabilityRangeQueryDto) {
    assertValidDateRange(range.from, range.to);
    const rows = await this.repo.listOwn(vendorId, range.from, range.to);
    return rows.map((r) => ({
      date: r.date,
      status: r.status,
      notes: r.notes,
      holdExpiresAt: r.hold_expires_at,
    }));
  }

  async upsert(vendorId: string, dto: UpsertAvailabilityDto) {
    const row = await this.repo.upsert(vendorId, dto);
    if (!row) {
      throw new ConflictException(
        "This date is currently on hold or booked and cannot be changed directly",
      );
    }
    return { date: row.date, status: row.status, notes: row.notes };
  }
}
