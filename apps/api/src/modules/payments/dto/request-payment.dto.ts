import { Type } from "class-transformer";
import { IsIn, IsNumber, Min, ValidateIf } from "class-validator";

export class RequestPaymentDto {
  @IsIn(["deposit", "milestone", "final"])
  type!: "deposit" | "milestone" | "final";

  // Required for milestone/final; ignored for deposit (taken from the quote).
  @ValidateIf((dto: RequestPaymentDto) => dto.type !== "deposit")
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;
}
