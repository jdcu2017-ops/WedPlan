import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class UpdateInquirerProfileDto {
  @IsString()
  displayName!: string;

  @IsOptional()
  @IsDateString()
  weddingDate?: string;

  @IsOptional()
  @IsString()
  venueLocation?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  guestCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetTotal?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  styleTags?: string[];
}
