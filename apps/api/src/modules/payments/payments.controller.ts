import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AccessTokenPayload } from "../../common/types/jwt-payload";
import { RefundPaymentDto } from "./dto/refund-payment.dto";
import { RequestPaymentDto } from "./dto/request-payment.dto";
import { PaymentsService } from "./payments.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Roles("vendor")
  @Post("bookings/:bookingId/payments")
  request(
    @CurrentUser() user: AccessTokenPayload,
    @Param("bookingId", ParseUUIDPipe) bookingId: string,
    @Body() dto: RequestPaymentDto,
  ) {
    return this.paymentsService.requestPayment(user.sub, bookingId, dto);
  }

  @Roles("inquirer", "vendor")
  @Get("bookings/:bookingId/payments")
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Param("bookingId", ParseUUIDPipe) bookingId: string,
  ) {
    return this.paymentsService.listForBooking(user.sub, bookingId);
  }

  @Roles("vendor")
  @Post("payments/:id/refund")
  refund(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RefundPaymentDto,
  ) {
    return this.paymentsService.refund(user.sub, id, dto);
  }
}
