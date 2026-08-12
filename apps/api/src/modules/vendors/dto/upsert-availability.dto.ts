import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";

// Vendors may only ever set 'open' or 'blocked' directly. 'tentative_hold' and
// 'booked' are exclusively written by the future bookings-module transaction
// (see db/migrations/005_availability.sql) as part of the safe date-claim flow.
export class UpsertAvailabilityDto {
  @IsDateString()
  date!: string;

  @IsIn(["open", "blocked"])
  status!: "open" | "blocked";

  @IsOptional()
  @IsString()
  notes?: string;
}
