import { IsString, Length } from "class-validator";

export class MfaLoginDto {
  @IsString()
  mfaTicket!: string;

  @Length(6, 6)
  code!: string;
}
