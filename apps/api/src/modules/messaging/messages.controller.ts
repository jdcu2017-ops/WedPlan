import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AccessTokenPayload } from "../../common/types/jwt-payload";
import { ListMessagesQueryDto } from "./dto/list-messages.query.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { MessagesService } from "./messages.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("inquirer", "vendor")
@Controller()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get("conversations/:conversationId/messages")
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Param("conversationId", ParseUUIDPipe) conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.messagesService.listMessages(user.sub, conversationId, query);
  }

  @Post("conversations/:conversationId/messages")
  send(
    @CurrentUser() user: AccessTokenPayload,
    @Param("conversationId", ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(user.sub, conversationId, dto);
  }

  @Post("messages/:id/read")
  markRead(@CurrentUser() user: AccessTokenPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.messagesService.markRead(user.sub, id);
  }
}
