import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import type { VendorPackageRow } from "./vendors.repository";
import { UpsertVendorPackageDto } from "./dto/upsert-vendor-package.dto";
import { CreatePackageAddonDto } from "./dto/create-package-addon.dto";

export interface PackageAddonRow {
  id: string;
  package_id: string;
  name: string;
  price: string;
}

@Injectable()
export class VendorPackagesRepository {
  constructor(private readonly db: DatabaseService) {}

  async listOwn(vendorId: string): Promise<VendorPackageRow[]> {
    const result = await this.db.query<VendorPackageRow>(
      `SELECT id, vendor_id, name, category, description, pricing_type, base_price, deposit_pct, cancellation_policy, is_active
       FROM vendor_packages WHERE vendor_id = $1
       ORDER BY category, name`,
      [vendorId],
    );
    return result.rows;
  }

  async listAddonsForPackages(packageIds: string[]): Promise<PackageAddonRow[]> {
    if (packageIds.length === 0) return [];
    const result = await this.db.query<PackageAddonRow>(
      `SELECT id, package_id, name, price FROM vendor_package_addons WHERE package_id = ANY($1::uuid[])`,
      [packageIds],
    );
    return result.rows;
  }

  async create(vendorId: string, dto: UpsertVendorPackageDto): Promise<VendorPackageRow> {
    const result = await this.db.query<VendorPackageRow>(
      `INSERT INTO vendor_packages (vendor_id, name, category, description, pricing_type, base_price, deposit_pct, cancellation_policy)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 25.00), $8)
       RETURNING id, vendor_id, name, category, description, pricing_type, base_price, deposit_pct, cancellation_policy, is_active`,
      [
        vendorId,
        dto.name,
        dto.category,
        dto.description ?? null,
        dto.pricingType,
        dto.basePrice ?? null,
        dto.depositPct ?? null,
        dto.cancellationPolicy ?? null,
      ],
    );
    return result.rows[0];
  }

  async update(
    vendorId: string,
    packageId: string,
    dto: UpsertVendorPackageDto,
  ): Promise<VendorPackageRow | undefined> {
    const result = await this.db.query<VendorPackageRow>(
      `UPDATE vendor_packages SET
         name = $3, category = $4, description = $5, pricing_type = $6,
         base_price = $7, deposit_pct = COALESCE($8, deposit_pct), cancellation_policy = $9,
         is_active = COALESCE($10, is_active), updated_at = now()
       WHERE id = $1 AND vendor_id = $2
       RETURNING id, vendor_id, name, category, description, pricing_type, base_price, deposit_pct, cancellation_policy, is_active`,
      [
        packageId,
        vendorId,
        dto.name,
        dto.category,
        dto.description ?? null,
        dto.pricingType,
        dto.basePrice ?? null,
        dto.depositPct ?? null,
        dto.cancellationPolicy ?? null,
        dto.isActive ?? null,
      ],
    );
    return result.rows[0];
  }

  async delete(vendorId: string, packageId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM vendor_packages WHERE id = $1 AND vendor_id = $2`,
      [packageId, vendorId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async addAddon(
    vendorId: string,
    packageId: string,
    dto: CreatePackageAddonDto,
  ): Promise<PackageAddonRow | undefined> {
    const result = await this.db.query<PackageAddonRow>(
      `INSERT INTO vendor_package_addons (package_id, name, price)
       SELECT vp.id, $2, $3
       FROM vendor_packages vp
       WHERE vp.id = $1 AND vp.vendor_id = $4
       RETURNING id, package_id, name, price`,
      [packageId, dto.name, dto.price, vendorId],
    );
    return result.rows[0];
  }

  async removeAddon(vendorId: string, packageId: string, addonId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM vendor_package_addons
       WHERE id = $1 AND package_id = $2
         AND package_id IN (SELECT id FROM vendor_packages WHERE vendor_id = $3)`,
      [addonId, packageId, vendorId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
