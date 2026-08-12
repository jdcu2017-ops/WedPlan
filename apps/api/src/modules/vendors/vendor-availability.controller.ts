import { Body, Controller, Get, Put, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AccessTokenPayload } from "../../common/types/jwt-payload";
import { AvailabilityRangeQueryDto } from "./dto/availability-range.query.dto";
import { UpsertAvailabilityDto } from "./dto/upsert-availability.dto";
import { VendorAvailabilityService } from "./vendor-availability.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("vendor")
@Controller("vendors/me/availability")
export class VendorAvailabilityController {
  constructor(private readonly availabilityService: VendorAvailabilityService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload, @Query() range: AvailabilityRangeQueryDto) {
    return this.availabilityService.listOwn(user.sub, range);
  }

  @Put()
  upsert(@CurrentUser() user: AccessTokenPayload, @Body() dto: UpsertAvailabilityDto) {
    return this.availabilityService.upsert(user.sub, dto);
  }
}
