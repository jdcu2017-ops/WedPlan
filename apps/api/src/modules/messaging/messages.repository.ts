import { Injectable } from "@nestjs/common";
import type { MessageChannel } from "@wedplan/shared";
import { DatabaseService } from "../../database/database.service";

export interface ConversationParticipants {
  conversation_id: string;
  inquiry_id: string;
  inquirer_id: string;
  vendor_id: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  sent_via: MessageChannel;
  email_message_id: string | null;
  read_at: string | null;
  flagged: boolean;
  flagged_reason: string | null;
  created_at: string;
}

export interface MessageAttachmentRow {
  id: string;
  message_id: string;
  file_url: string;
  file_name: string;
  content_type: string | null;
}

export interface NewAttachment {
  fileUrl: string;
  fileName: string;
  contentType?: string;
}

@Injectable()
export class MessagesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findParticipants(conversationId: string): Promise<ConversationParticipants | undefined> {
    const result = await this.db.query<ConversationParticipants>(
      `SELECT c.id AS conversation_id, i.id AS inquiry_id, i.inquirer_id, i.vendor_id
       FROM conversations c
       JOIN inquiries i ON i.id = c.inquiry_id
       WHERE c.id = $1`,
      [conversationId],
    );
    return result.rows[0];
  }

  async listMessages(conversationId: string, before?: string, limit = 50): Promise<MessageRow[]> {
    const params: unknown[] = [conversationId];
    let where = `conversation_id = $1`;
    if (before) {
      params.push(before);
      where += ` AND created_at < $${params.length}`;
    }
    params.push(limit);
    const result = await this.db.query<MessageRow>(
      `SELECT id, conversation_id, sender_id, body, sent_via, email_message_id, read_at, flagged, flagged_reason, created_at
       FROM messages WHERE ${where}
       ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return result.rows;
  }

  async listAttachments(messageIds: string[]): Promise<MessageAttachmentRow[]> {
    if (messageIds.length === 0) return [];
    const result = await this.db.query<MessageAttachmentRow>(
      `SELECT id, message_id, file_url, file_name, content_type
       FROM message_attachments WHERE message_id = ANY($1::uuid[])`,
      [messageIds],
    );
    return result.rows;
  }

  async findById(messageId: string): Promise<MessageRow | undefined> {
    const result = await this.db.query<MessageRow>(
      `SELECT id, conversation_id, sender_id, body, sent_via, email_message_id, read_at, flagged, flagged_reason, created_at
       FROM messages WHERE id = $1`,
      [messageId],
    );
    return result.rows[0];
  }

  async findByEmailMessageId(emailMessageId: string): Promise<MessageRow | undefined> {
    const result = await this.db.query<MessageRow>(
      `SELECT id, conversation_id, sender_id, body, sent_via, email_message_id, read_at, flagged, flagged_reason, created_at
       FROM messages WHERE email_message_id = $1`,
      [emailMessageId],
    );
    return result.rows[0];
  }

  async create(
    conversationId: string,
    senderId: string,
    body: string,
    sentVia: MessageChannel,
    flagged: boolean,
    flaggedReason: string | undefined,
    attachments: NewAttachment[],
  ): Promise<{ message: MessageRow; attachments: MessageAttachmentRow[] }> {
    return this.db.withTransaction(async (client) => {
      const messageResult = await client.query<MessageRow>(
        `INSERT INTO messages (conversation_id, sender_id, body, sent_via, flagged, flagged_reason)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, conversation_id, sender_id, body, sent_via, email_message_id, read_at, flagged, flagged_reason, created_at`,
        [conversationId, senderId, body, sentVia, flagged, flaggedReason ?? null],
      );
      const message = messageResult.rows[0];

      const attachmentRows: MessageAttachmentRow[] = [];
      for (const attachment of attachments) {
        const attachmentResult = await client.query<MessageAttachmentRow>(
          `INSERT INTO message_attachments (message_id, file_url, file_name, content_type)
           VALUES ($1, $2, $3, $4)
           RETURNING id, message_id, file_url, file_name, content_type`,
          [message.id, attachment.fileUrl, attachment.fileName, attachment.contentType ?? null],
        );
        attachmentRows.push(attachmentResult.rows[0]);
      }

      return { message, attachments: attachmentRows };
    });
  }

  async findUserEmail(userId: string): Promise<string | undefined> {
    const result = await this.db.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [
      userId,
    ]);
    return result.rows[0]?.email;
  }

  async setEmailMessageId(messageId: string, emailMessageId: string): Promise<void> {
    await this.db.query(`UPDATE messages SET email_message_id = $1 WHERE id = $2`, [
      emailMessageId,
      messageId,
    ]);
  }

  async markRead(messageId: string, readerId: string): Promise<MessageRow | undefined> {
    const result = await this.db.query<MessageRow>(
      `UPDATE messages SET read_at = now()
       WHERE id = $1 AND read_at IS NULL AND sender_id != $2
       RETURNING id, conversation_id, sender_id, body, sent_via, email_message_id, read_at, flagged, flagged_reason, created_at`,
      [messageId, readerId],
    );
    return result.rows[0];
  }
}
