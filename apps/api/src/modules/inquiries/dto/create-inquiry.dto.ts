import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateInquiryDto {
  @IsUUID()
  vendorId!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;
}
