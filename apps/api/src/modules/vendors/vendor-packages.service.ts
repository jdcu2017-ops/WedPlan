import { Injectable, NotFoundException } from "@nestjs/common";
import { CreatePackageAddonDto } from "./dto/create-package-addon.dto";
import { UpsertVendorPackageDto } from "./dto/upsert-vendor-package.dto";
import type { PackageAddonRow } from "./vendor-packages.repository";
import { VendorPackagesRepository } from "./vendor-packages.repository";
import type { VendorPackageRow } from "./vendors.repository";

@Injectable()
export class VendorPackagesService {
  constructor(private readonly repo: VendorPackagesRepository) {}

  async listOwn(vendorId: string) {
    const packages = await this.repo.listOwn(vendorId);
    const addons = await this.repo.listAddonsForPackages(packages.map((p) => p.id));
    const addonsByPackage = new Map<string, PackageAddonRow[]>();
    for (const addon of addons) {
      const bucket = addonsByPackage.get(addon.package_id) ?? [];
      bucket.push(addon);
      addonsByPackage.set(addon.package_id, bucket);
    }
    return packages.map((p) => this.toPackageDto(p, addonsByPackage.get(p.id) ?? []));
  }

  async create(vendorId: string, dto: UpsertVendorPackageDto) {
    const row = await this.repo.create(vendorId, dto);
    return this.toPackageDto(row, []);
  }

  async update(vendorId: string, packageId: string, dto: UpsertVendorPackageDto) {
    const row = await this.repo.update(vendorId, packageId, dto);
    if (!row) {
      throw new NotFoundException("Package not found");
    }
    return this.toPackageDto(row, []);
  }

  async delete(vendorId: string, packageId: string) {
    const deleted = await this.repo.delete(vendorId, packageId);
    if (!deleted) {
      throw new NotFoundException("Package not found");
    }
  }

  async addAddon(vendorId: string, packageId: string, dto: CreatePackageAddonDto) {
    const addon = await this.repo.addAddon(vendorId, packageId, dto);
    if (!addon) {
      throw new NotFoundException("Package not found");
    }
    return this.toAddonDto(addon);
  }

  async removeAddon(vendorId: string, packageId: string, addonId: string) {
    const deleted = await this.repo.removeAddon(vendorId, packageId, addonId);
    if (!deleted) {
      throw new NotFoundException("Add-on not found");
    }
  }

  private toPackageDto(row: VendorPackageRow, addons: PackageAddonRow[]) {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      pricingType: row.pricing_type,
      basePrice: row.base_price !== null ? Number(row.base_price) : null,
      depositPct: Number(row.deposit_pct),
      cancellationPolicy: row.cancellation_policy,
      isActive: row.is_active,
      addons: addons.map((a) => this.toAddonDto(a)),
    };
  }

  private toAddonDto(row: PackageAddonRow) {
    return { id: row.id, name: row.name, price: Number(row.price) };
  }
}
