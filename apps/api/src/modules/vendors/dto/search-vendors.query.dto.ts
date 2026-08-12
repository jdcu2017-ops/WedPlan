import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export type VendorSortOption = "rating" | "price" | "newest";

export class SearchVendorsQueryDto {
  @IsOptional()
  @IsString()
  categories?: string; // comma-separated, e.g. "dj,catering"

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsIn(["rating", "price", "newest"])
  sort?: VendorSortOption;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
