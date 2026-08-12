import { IsEmail, IsIn, MinLength } from "class-validator";
import type { UserRole } from "@wedplan/shared";

export class SignupDto {
  @IsEmail()
  email!: string;

  @MinLength(12)
  password!: string;

  @IsIn(["inquirer", "vendor"])
  role!: Extract<UserRole, "inquirer" | "vendor">;
}
