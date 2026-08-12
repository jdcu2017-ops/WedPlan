import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module";
import { EmailProvider } from "./email/email-provider";
import { PostmarkEmailProvider } from "./email/postmark-email.provider";
import { InboundEmailController } from "./inbound-email.controller";
import { InboundEmailService } from "./inbound-email.service";
import { MessagesController } from "./messages.controller";
import { MessagesRepository } from "./messages.repository";
import { MessagesService } from "./messages.service";
import { MessagingGateway } from "./messaging.gateway";

@Module({
  imports: [AuthModule, JwtModule.register({})],
  controllers: [MessagesController, InboundEmailController],
  providers: [
    MessagesService,
    MessagesRepository,
    MessagingGateway,
    InboundEmailService,
    { provide: EmailProvider, useClass: PostmarkEmailProvider },
  ],
})
export class MessagingModule {}
