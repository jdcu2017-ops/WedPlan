import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailProvider, SendEmailResult } from "./email-provider";

interface PostmarkSendResponse {
  MessageID: string;
}

// Talks to Postmark's plain HTTPS JSON API directly via fetch, rather than
// pulling in the postmark SDK — one dependency-free call is all this needs.
@Injectable()
export class PostmarkEmailProvider extends EmailProvider {
  private readonly logger = new Logger(PostmarkEmailProvider.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  async send(params: {
    to: string;
    subject: string;
    textBody: string;
    replyTo?: string;
  }): Promise<SendEmailResult> {
    const apiKey = this.config.get<string>("email.apiKey");
    const from = this.config.get<string>("email.fromAddress");

    if (!apiKey || apiKey === "changeme") {
      this.logger.warn(
        `EMAIL_API_KEY not configured — skipping outbound email mirror to ${params.to}`,
      );
      return { providerMessageId: null };
    }

    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": apiKey,
      },
      body: JSON.stringify({
        From: from,
        To: params.to,
        Subject: params.subject,
        TextBody: params.textBody,
        ReplyTo: params.replyTo,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Postmark send failed (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as PostmarkSendResponse;
    return { providerMessageId: data.MessageID };
  }
}
