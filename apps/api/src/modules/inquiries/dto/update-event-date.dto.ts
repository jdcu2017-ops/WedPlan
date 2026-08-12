import { IsDateString } from "class-validator";

export class UpdateEventDateDto {
  @IsDateString()
  eventDate!: string;
}
