import { IsArray, IsOptional, IsString } from "class-validator";

export class UpdateVendorProfileDto {
  @IsString()
  businessName!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsString()
  serviceArea?: string;

  @IsOptional()
  @IsString()
  bio?: string;
}
