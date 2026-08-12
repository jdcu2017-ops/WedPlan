import { Body, Controller, Post, Query, Req, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { secureCompare } from "../../common/utils/crypto.util";
import { PostmarkInboundPayload } from "./dto/postmark-inbound.types";
import { InboundEmailService } from "./inbound-email.service";

// Public endpoint (no JWT — the caller is Postmark, not a logged-in user).
// Configure Postmark's Inbound Parse webhook URL as:
//   https://api.yourdomain.com/webhooks/email/inbound?secret=<EMAIL_INBOUND_WEBHOOK_SECRET>
@Controller("webhooks/email/inbound")
export class InboundEmailController {
  constructor(
    private readonly inboundEmailService: InboundEmailService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async handle(
    @Req() req: Request,
    @Query("secret") querySecret: string | undefined,
    @Body() payload: PostmarkInboundPayload,
  ) {
    this.assertAuthorized(req, querySecret);
    return this.inboundEmailService.handle(payload);
  }

  private assertAuthorized(req: Request, querySecret: string | undefined): void {
    const expected = this.config.get<string>("email.inboundWebhookSecret");
    if (!expected || expected === "changeme") {
      throw new UnauthorizedException("Inbound email webhook is not configured");
    }
    const provided = (req.headers["x-inbound-secret"] as string | undefined) ?? querySecret;
    if (!provided || !secureCompare(provided, expected)) {
      throw new UnauthorizedException("Invalid inbound webhook secret");
    }
  }
}
