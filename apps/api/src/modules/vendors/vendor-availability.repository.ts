import { Injectable } from "@nestjs/common";
import type { AvailabilityStatus } from "@wedplan/shared";
import { DatabaseService } from "../../database/database.service";
import { UpsertAvailabilityDto } from "./dto/upsert-availability.dto";

export interface OwnAvailabilitySlotRow {
  date: string;
  status: AvailabilityStatus;
  notes: string | null;
  hold_expires_at: string | null;
}

@Injectable()
export class VendorAvailabilityRepository {
  constructor(private readonly db: DatabaseService) {}

  async listOwn(vendorId: string, from: string, to: string): Promise<OwnAvailabilitySlotRow[]> {
    const result = await this.db.query<OwnAvailabilitySlotRow>(
      `SELECT date, status, notes, hold_expires_at FROM availability_slots
       WHERE vendor_id = $1 AND date BETWEEN $2 AND $3
       ORDER BY date`,
      [vendorId, from, to],
    );
    return result.rows;
  }

  // Vendor-initiated open/blocked toggle. Mirrors the safe-claim pattern
  // documented in db/migrations/005_availability.sql: the UPDATE branch only
  // fires when the row isn't currently tentative_hold/booked, so a vendor can
  // never silently clobber an in-progress booking transaction. An empty
  // result means that guard rejected the write.
  async upsert(vendorId: string, dto: UpsertAvailabilityDto): Promise<OwnAvailabilitySlotRow | undefined> {
    const result = await this.db.query<OwnAvailabilitySlotRow>(
      `INSERT INTO availability_slots (vendor_id, date, status, notes, hold_expires_at)
       VALUES ($1, $2, $3, $4, NULL)
       ON CONFLICT (vendor_id, date) DO UPDATE
         SET status = EXCLUDED.status, notes = EXCLUDED.notes, hold_expires_at = NULL, updated_at = now()
         WHERE availability_slots.status NOT IN ('tentative_hold', 'booked')
       RETURNING date, status, notes, hold_expires_at`,
      [vendorId, dto.date, dto.status, dto.notes ?? null],
    );
    return result.rows[0];
  }
}
