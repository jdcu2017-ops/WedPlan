import { Length } from "class-validator";

export class MfaVerifyDto {
  @Length(6, 6)
  code!: string;
}
