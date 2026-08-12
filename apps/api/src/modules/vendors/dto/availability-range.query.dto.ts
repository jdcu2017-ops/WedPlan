import { IsDateString } from "class-validator";

export class AvailabilityRangeQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
