import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AccessTokenPayload } from "../../common/types/jwt-payload";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { MfaLoginDto } from "./dto/mfa-login.dto";
import { MfaVerifyDto } from "./dto/mfa-verify.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { SignupDto } from "./dto/signup.dto";

// Auth endpoints are the primary abuse target (credential stuffing, enumeration),
// so they get a tighter throttle than the global default — see AppModule.
@Throttle({ default: { limit: 5, ttl: 60_000 } })
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto.email, dto.password, dto.role);
  }

  @HttpCode(200)
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @HttpCode(200)
  @Post("login/mfa")
  completeMfaLogin(@Body() dto: MfaLoginDto) {
    return this.authService.completeMfaLogin(dto.mfaTicket, dto.code);
  }

  @HttpCode(200)
  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @HttpCode(200)
  @Post("logout")
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post("mfa/enroll")
  enrollMfa(@CurrentUser() user: AccessTokenPayload) {
    return this.authService.enrollMfa(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post("mfa/verify")
  confirmMfa(@CurrentUser() user: AccessTokenPayload, @Body() dto: MfaVerifyDto) {
    return this.authService.confirmMfaEnrollment(user.sub, dto.code);
  }
}
