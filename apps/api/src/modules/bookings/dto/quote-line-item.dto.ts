import { Type } from "class-transformer";
import { IsNumber, IsString, Min } from "class-validator";

export class QuoteLineItemDto {
  @IsString()
  label!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;
}
