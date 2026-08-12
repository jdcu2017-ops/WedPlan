import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ListMessagesQueryDto } from "./dto/list-messages.query.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { EmailProvider } from "./email/email-provider";
import { MessagingGateway } from "./messaging.gateway";
import type {
  ConversationParticipants,
  MessageAttachmentRow,
  MessageRow,
} from "./messages.repository";
import { MessagesRepository } from "./messages.repository";
import { detectSuspiciousContent } from "./utils/content-flagging.util";

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly repo: MessagesRepository,
    private readonly emailProvider: EmailProvider,
    private readonly gateway: MessagingGateway,
  ) {}

  async listMessages(userId: string, conversationId: string, query: ListMessagesQueryDto) {
    await this.assertParticipant(conversationId, userId);
    const rows = await this.repo.listMessages(conversationId, query.before, query.limit ?? 50);
    const attachments = await this.repo.listAttachments(rows.map((r) => r.id));
    const attachmentsByMessage = new Map<string, MessageAttachmentRow[]>();
    for (const a of attachments) {
      const bucket = attachmentsByMessage.get(a.message_id) ?? [];
      bucket.push(a);
      attachmentsByMessage.set(a.message_id, bucket);
    }
    // Repo returns newest-first for cursor pagination; reverse to chronological order for display.
    return rows
      .slice()
      .reverse()
      .map((r) => this.toMessageDto(r, attachmentsByMessage.get(r.id) ?? []));
  }

  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto) {
    const participants = await this.assertParticipant(conversationId, userId);
    const { flagged, reason } = detectSuspiciousContent(dto.body);

    const { message, attachments } = await this.repo.create(
      conversationId,
      userId,
      dto.body,
      "app",
      flagged,
      reason,
      dto.attachments?.map((a) => ({
        fileUrl: a.fileUrl,
        fileName: a.fileName,
        contentType: a.contentType,
      })) ?? [],
    );

    const dtoResult = this.toMessageDto(message, attachments);
    this.gateway.broadcastMessage(conversationId, dtoResult);
    void this.mirrorToEmail(participants, message);
    return dtoResult;
  }

  async markRead(userId: string, messageId: string) {
    const message = await this.repo.findById(messageId);
    if (!message) {
      throw new NotFoundException("Message not found");
    }
    await this.assertParticipant(message.conversation_id, userId);
    if (message.sender_id === userId) {
      throw new BadRequestException("Cannot mark your own message as read");
    }
    const updated = await this.repo.markRead(messageId, userId);
    return this.toMessageDto(updated ?? message, []);
  }

  private async assertParticipant(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipants> {
    const participants = await this.repo.findParticipants(conversationId);
    if (!participants) {
      throw new NotFoundException("Conversation not found");
    }
    if (participants.inquirer_id !== userId && participants.vendor_id !== userId) {
      throw new ForbiddenException("Not a participant in this conversation");
    }
    return participants;
  }

  // Best-effort: email delivery never blocks or fails the in-app send, since
  // the message is already durably persisted by the time this runs.
  private async mirrorToEmail(participants: ConversationParticipants, message: MessageRow): Promise<void> {
    try {
      const recipientId =
        message.sender_id === participants.inquirer_id
          ? participants.vendor_id
          : participants.inquirer_id;
      const recipientEmail = await this.repo.findUserEmail(recipientId);
      if (!recipientEmail) return;

      const result = await this.emailProvider.send({
        to: recipientEmail,
        subject: "New message on WedPlan",
        textBody: message.body,
      });
      if (result.providerMessageId) {
        await this.repo.setEmailMessageId(message.id, result.providerMessageId);
      }
    } catch (err) {
      this.logger.error(`Email mirror failed for message ${message.id}`, err as Error);
    }
  }

  private toMessageDto(row: MessageRow, attachments: MessageAttachmentRow[]) {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      body: row.body,
      sentVia: row.sent_via,
      readAt: row.read_at,
      flagged: row.flagged,
      createdAt: row.created_at,
      attachments: attachments.map((a) => ({
        id: a.id,
        fileUrl: a.file_url,
        fileName: a.file_name,
        contentType: a.content_type,
      })),
    };
  }
}
