import { Injectable } from "@nestjs/common";
import type { InquiryStatus } from "@wedplan/shared";
import { DatabaseService } from "../../database/database.service";
import { CreateInquiryDto } from "./dto/create-inquiry.dto";

export interface InquiryRow {
  id: string;
  inquirer_id: string;
  vendor_id: string;
  category: string;
  event_date: string | null;
  status: InquiryStatus;
  created_at: string;
  conversation_id: string;
  vendor_business_name: string;
  inquirer_display_name: string;
}

// Every inquiry has exactly one conversation (created atomically alongside
// it — see create() below), and both FKs guarantee the referenced profile
// rows exist, so these correlated subqueries are safe to reuse wherever an
// inquiry row is selected or returned. Included mainly so list/detail views
// don't have to show raw UUIDs for who's on the other end.
const EXTRA_FIELDS_SUBQUERY = `
  (SELECT id FROM conversations WHERE inquiry_id = inquiries.id) AS conversation_id,
  (SELECT business_name FROM vendor_profiles WHERE user_id = inquiries.vendor_id) AS vendor_business_name,
  (SELECT display_name FROM inquirer_profiles WHERE user_id = inquiries.inquirer_id) AS inquirer_display_name
`;

@Injectable()
export class InquiriesRepository {
  constructor(private readonly db: DatabaseService) {}

  async vendorExists(vendorId: string): Promise<boolean> {
    const result = await this.db.query(`SELECT 1 FROM vendor_profiles WHERE user_id = $1`, [vendorId]);
    return (result.rowCount ?? 0) > 0;
  }

  async inquirerProfileExists(inquirerId: string): Promise<boolean> {
    const result = await this.db.query(`SELECT 1 FROM inquirer_profiles WHERE user_id = $1`, [
      inquirerId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  // Creates the inquiry, its 1:1 conversation, and the optional opening
  // message as a single unit — a conversation without an inquiry (or vice
  // versa) would violate the domain model, so this can't be split across
  // separate non-transactional inserts.
  async create(inquirerId: string, dto: CreateInquiryDto): Promise<InquiryRow> {
    return this.db.withTransaction(async (client) => {
      const inquiryResult = await client.query<
        Omit<InquiryRow, "conversation_id" | "vendor_business_name" | "inquirer_display_name">
      >(
        `INSERT INTO inquiries (inquirer_id, vendor_id, category, event_date)
         VALUES ($1, $2, $3, $4)
         RETURNING id, inquirer_id, vendor_id, category, event_date, status, created_at`,
        [inquirerId, dto.vendorId, dto.category, dto.eventDate ?? null],
      );
      const inquiry = inquiryResult.rows[0];

      const conversationResult = await client.query<{ id: string }>(
        `INSERT INTO conversations (inquiry_id) VALUES ($1) RETURNING id`,
        [inquiry.id],
      );

      if (dto.message) {
        await client.query(
          `INSERT INTO messages (conversation_id, sender_id, body, sent_via)
           VALUES ($1, $2, $3, 'app')`,
          [conversationResult.rows[0].id, inquirerId, dto.message],
        );
      }

      const namesResult = await client.query<{
        vendor_business_name: string;
        inquirer_display_name: string;
      }>(
        `SELECT
           (SELECT business_name FROM vendor_profiles WHERE user_id = $1) AS vendor_business_name,
           (SELECT display_name FROM inquirer_profiles WHERE user_id = $2) AS inquirer_display_name`,
        [dto.vendorId, inquirerId],
      );

      return {
        ...inquiry,
        conversation_id: conversationResult.rows[0].id,
        ...namesResult.rows[0],
      };
    });
  }

  async findById(id: string): Promise<InquiryRow | undefined> {
    const result = await this.db.query<InquiryRow>(
      `SELECT id, inquirer_id, vendor_id, category, event_date, status, created_at, ${EXTRA_FIELDS_SUBQUERY}
       FROM inquiries WHERE id = $1`,
      [id],
    );
    return result.rows[0];
  }

  async listForParticipant(
    userId: string,
    column: "inquirer_id" | "vendor_id",
    status?: InquiryStatus,
  ): Promise<InquiryRow[]> {
    const params: unknown[] = [userId];
    let where = `${column} = $1`;
    if (status) {
      params.push(status);
      where += ` AND status = $2`;
    }
    const result = await this.db.query<InquiryRow>(
      `SELECT id, inquirer_id, vendor_id, category, event_date, status, created_at, ${EXTRA_FIELDS_SUBQUERY}
       FROM inquiries WHERE ${where}
       ORDER BY created_at DESC`,
      params,
    );
    return result.rows;
  }

  async updateEventDate(id: string, eventDate: string): Promise<InquiryRow | undefined> {
    const result = await this.db.query<InquiryRow>(
      `UPDATE inquiries SET event_date = $1, updated_at = now()
       WHERE id = $2 AND status = ANY('{open,quoted}'::inquiry_status[])
       RETURNING id, inquirer_id, vendor_id, category, event_date, status, created_at, ${EXTRA_FIELDS_SUBQUERY}`,
      [eventDate, id],
    );
    return result.rows[0];
  }

  async transitionStatus(
    id: string,
    fromStatuses: InquiryStatus[],
    toStatus: InquiryStatus,
  ): Promise<InquiryRow | undefined> {
    const result = await this.db.query<InquiryRow>(
      `UPDATE inquiries SET status = $1, updated_at = now()
       WHERE id = $2 AND status = ANY($3::inquiry_status[])
       RETURNING id, inquirer_id, vendor_id, category, event_date, status, created_at, ${EXTRA_FIELDS_SUBQUERY}`,
      [toStatus, id, fromStatuses],
    );
    return result.rows[0];
  }
}
