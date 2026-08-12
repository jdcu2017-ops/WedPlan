import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AccessTokenPayload } from "../../common/types/jwt-payload";
import { BookingsService } from "./bookings.service";
import { CancelBookingDto } from "./dto/cancel-booking.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("inquirer", "vendor")
@Controller("bookings")
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.bookingsService.listForUser(user.sub, user.role as "inquirer" | "vendor");
  }

  @Get(":id")
  getOne(@CurrentUser() user: AccessTokenPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.bookingsService.getForParticipant(user.sub, id);
  }

  @Post(":id/cancel")
  cancel(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancel(user.sub, id, dto.reason);
  }
}
