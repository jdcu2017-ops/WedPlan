import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, Min, ValidateNested } from "class-validator";
import { QuoteLineItemDto } from "./quote-line-item.dto";

export class CreateQuoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineItemDto)
  lineItems!: QuoteLineItemDto[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositAmount!: number;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
