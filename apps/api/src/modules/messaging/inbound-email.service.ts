import { Injectable, Logger } from "@nestjs/common";
import { PostmarkInboundPayload } from "./dto/postmark-inbound.types";
import { MessagingGateway } from "./messaging.gateway";
import { MessagesRepository } from "./messages.repository";
import { detectSuspiciousContent } from "./utils/content-flagging.util";
import { extractReferencedMessageId } from "./utils/email-threading.util";

export type InboundEmailOutcome =
  | { status: "created"; messageId: string }
  | { status: "ignored"; reason: string };

@Injectable()
export class InboundEmailService {
  private readonly logger = new Logger(InboundEmailService.name);

  constructor(
    private readonly repo: MessagesRepository,
    private readonly gateway: MessagingGateway,
  ) {}

  async handle(payload: PostmarkInboundPayload): Promise<InboundEmailOutcome> {
    const referencedId = extractReferencedMessageId(payload.Headers);
    if (!referencedId) {
      this.logger.warn("Inbound email had no matchable In-Reply-To/References header");
      return { status: "ignored", reason: "no_thread_reference" };
    }

    const originalMessage = await this.repo.findByEmailMessageId(referencedId);
    if (!originalMessage) {
      this.logger.warn(`Inbound email referenced unknown email_message_id ${referencedId}`);
      return { status: "ignored", reason: "unknown_thread" };
    }

    const participants = await this.repo.findParticipants(originalMessage.conversation_id);
    if (!participants) {
      return { status: "ignored", reason: "conversation_not_found" };
    }

    // Sender verification (spec 4): the inbound "From" must belong to one of
    // this conversation's two known participants, or we drop the message
    // rather than let a spoofed From inject content into someone else's thread.
    const fromEmail = (payload.FromFull?.Email ?? payload.From ?? "").toLowerCase().trim();
    const [inquirerEmail, vendorEmail] = await Promise.all([
      this.repo.findUserEmail(participants.inquirer_id),
      this.repo.findUserEmail(participants.vendor_id),
    ]);

    let senderId: string | undefined;
    if (inquirerEmail && fromEmail === inquirerEmail.toLowerCase()) {
      senderId = participants.inquirer_id;
    } else if (vendorEmail && fromEmail === vendorEmail.toLowerCase()) {
      senderId = participants.vendor_id;
    }

    if (!senderId) {
      this.logger.warn(
        `Inbound email From (${fromEmail}) did not match either participant of conversation ${participants.conversation_id} — dropping`,
      );
      return { status: "ignored", reason: "sender_mismatch" };
    }

    const body = payload.TextBody ?? "";
    const { flagged, reason } = detectSuspiciousContent(body);
    const { message } = await this.repo.create(
      participants.conversation_id,
      senderId,
      body,
      "email",
      flagged,
      reason,
      [],
    );

    this.gateway.broadcastMessage(participants.conversation_id, {
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      body: message.body,
      sentVia: message.sent_via,
      readAt: message.read_at,
      flagged: message.flagged,
      createdAt: message.created_at,
      attachments: [],
    });

    return { status: "created", messageId: message.id };
  }
}
