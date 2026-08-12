import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AccessTokenPayload } from "../../common/types/jwt-payload";
import { ConnectService } from "./connect.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("vendor")
@Controller("payments/connect")
export class ConnectController {
  constructor(private readonly connectService: ConnectService) {}

  @Post("onboarding-link")
  createOnboardingLink(@CurrentUser() user: AccessTokenPayload) {
    return this.connectService.createOnboardingLink(user.sub);
  }

  @Get("status")
  getStatus(@CurrentUser() user: AccessTokenPayload) {
    return this.connectService.getStatus(user.sub);
  }
}
