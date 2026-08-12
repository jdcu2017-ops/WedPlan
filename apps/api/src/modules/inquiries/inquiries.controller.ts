import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AccessTokenPayload } from "../../common/types/jwt-payload";
import { CreateInquiryDto } from "./dto/create-inquiry.dto";
import { ListInquiriesQueryDto } from "./dto/list-inquiries.query.dto";
import { UpdateEventDateDto } from "./dto/update-event-date.dto";
import { InquiriesService } from "./inquiries.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("inquiries")
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Roles("inquirer")
  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateInquiryDto) {
    return this.inquiriesService.create(user.sub, dto);
  }

  @Roles("inquirer", "vendor")
  @Get()
  list(@CurrentUser() user: AccessTokenPayload, @Query() query: ListInquiriesQueryDto) {
    return this.inquiriesService.listForUser(
      user.sub,
      user.role as "inquirer" | "vendor",
      query.status,
    );
  }

  @Roles("inquirer", "vendor")
  @Get(":id")
  getOne(@CurrentUser() user: AccessTokenPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.inquiriesService.getForParticipant(user.sub, id);
  }

  @Roles("inquirer")
  @Patch(":id/event-date")
  setEventDate(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDateDto,
  ) {
    return this.inquiriesService.setEventDate(user.sub, id, dto.eventDate);
  }

  @Roles("vendor")
  @Post(":id/decline")
  decline(@CurrentUser() user: AccessTokenPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.inquiriesService.decline(user.sub, id);
  }

  @Roles("inquirer", "vendor")
  @Post(":id/close")
  close(@CurrentUser() user: AccessTokenPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.inquiriesService.close(user.sub, id);
  }
}
