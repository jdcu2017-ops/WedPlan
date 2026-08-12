import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AccessTokenPayload } from "../../common/types/jwt-payload";
import { BookingsService } from "./bookings.service";
import { CreateQuoteDto } from "./dto/create-quote.dto";
import { QuotesService } from "./quotes.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Roles("vendor")
  @Post("inquiries/:inquiryId/quotes")
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Param("inquiryId", ParseUUIDPipe) inquiryId: string,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.quotesService.create(user.sub, inquiryId, dto);
  }

  @Roles("inquirer", "vendor")
  @Get("inquiries/:inquiryId/quotes")
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Param("inquiryId", ParseUUIDPipe) inquiryId: string,
  ) {
    return this.quotesService.listForInquiry(user.sub, inquiryId);
  }

  @Roles("vendor")
  @Put("quotes/:id")
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.quotesService.update(user.sub, id, dto);
  }

  @Roles("vendor")
  @Post("quotes/:id/send")
  send(@CurrentUser() user: AccessTokenPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.quotesService.send(user.sub, id);
  }

  @Roles("inquirer")
  @Post("quotes/:id/decline")
  decline(@CurrentUser() user: AccessTokenPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.quotesService.decline(user.sub, id);
  }

  @Roles("inquirer")
  @Post("quotes/:id/accept")
  accept(@CurrentUser() user: AccessTokenPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.bookingsService.acceptQuote(user.sub, id);
  }
}
