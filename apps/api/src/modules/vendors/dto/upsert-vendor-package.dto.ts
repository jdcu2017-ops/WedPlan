import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import type { PricingType } from "@wedplan/shared";

const PRICING_TYPES: PricingType[] = ["flat", "hourly", "per_guest", "tiered", "custom_quote"];

export class UpsertVendorPackageDto {
  @IsString()
  name!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(PRICING_TYPES)
  pricingType!: PricingType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  depositPct?: number;

  @IsOptional()
  @IsString()
  cancellationPolicy?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
