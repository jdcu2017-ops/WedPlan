import { Injectable } from "@nestjs/common";
import type { QuoteLineItem, QuoteStatus } from "@wedplan/shared";
import { DatabaseService } from "../../database/database.service";

export interface QuoteRow {
  id: string;
  inquiry_id: string;
  line_items: QuoteLineItem[];
  total_amount: string;
  deposit_amount: string;
  valid_until: string | null;
  status: QuoteStatus;
  created_at: string;
}

const QUOTE_COLUMNS =
  "id, inquiry_id, line_items, total_amount, deposit_amount, valid_until, status, created_at";

@Injectable()
export class QuotesRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(
    inquiryId: string,
    lineItems: QuoteLineItem[],
    totalAmount: number,
    depositAmount: number,
    validUntil: string | null,
  ): Promise<QuoteRow> {
    // node-postgres serializes plain JS arrays as Postgres array literals, not
    // JSON — for a jsonb column we have to stringify ourselves and cast.
    const result = await this.db.query<QuoteRow>(
      `INSERT INTO quotes (inquiry_id, line_items, total_amount, deposit_amount, valid_until)
       VALUES ($1, $2::jsonb, $3, $4, $5)
       RETURNING ${QUOTE_COLUMNS}`,
      [inquiryId, JSON.stringify(lineItems), totalAmount, depositAmount, validUntil],
    );
    return result.rows[0];
  }

  async update(
    quoteId: string,
    lineItems: QuoteLineItem[],
    totalAmount: number,
    depositAmount: number,
    validUntil: string | null,
  ): Promise<QuoteRow | undefined> {
    const result = await this.db.query<QuoteRow>(
      `UPDATE quotes SET line_items = $2::jsonb, total_amount = $3, deposit_amount = $4,
         valid_until = $5, updated_at = now()
       WHERE id = $1 AND status = 'draft'
       RETURNING ${QUOTE_COLUMNS}`,
      [quoteId, JSON.stringify(lineItems), totalAmount, depositAmount, validUntil],
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<QuoteRow | undefined> {
    const result = await this.db.query<QuoteRow>(
      `SELECT ${QUOTE_COLUMNS} FROM quotes WHERE id = $1`,
      [id],
    );
    return result.rows[0];
  }

  async listForInquiry(inquiryId: string): Promise<QuoteRow[]> {
    const result = await this.db.query<QuoteRow>(
      `SELECT ${QUOTE_COLUMNS} FROM quotes WHERE inquiry_id = $1 ORDER BY created_at DESC`,
      [inquiryId],
    );
    return result.rows;
  }

  async transitionStatus(
    id: string,
    fromStatuses: QuoteStatus[],
    toStatus: QuoteStatus,
  ): Promise<QuoteRow | undefined> {
    const result = await this.db.query<QuoteRow>(
      `UPDATE quotes SET status = $1, updated_at = now()
       WHERE id = $2 AND status = ANY($3::quote_status[])
       RETURNING ${QUOTE_COLUMNS}`,
      [toStatus, id, fromStatuses],
    );
    return result.rows[0];
  }
}
