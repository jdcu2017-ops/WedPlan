import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AccessTokenPayload } from "../../common/types/jwt-payload";
import { UpdateInquirerProfileDto } from "./dto/update-inquirer-profile.dto";
import { UpdateVendorProfileDto } from "./dto/update-vendor-profile.dto";
import { UsersService } from "./users.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  getMe(@CurrentUser() user: AccessTokenPayload) {
    return this.usersService.getMe(user.sub);
  }

  @Roles("inquirer")
  @Put("me/inquirer-profile")
  updateInquirerProfile(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateInquirerProfileDto,
  ) {
    return this.usersService.updateInquirerProfile(user.sub, dto);
  }

  @Roles("vendor")
  @Put("me/vendor-profile")
  updateVendorProfile(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateVendorProfileDto,
  ) {
    return this.usersService.updateVendorProfile(user.sub, dto);
  }
}
