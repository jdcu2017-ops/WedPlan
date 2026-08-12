import { Injectable } from "@nestjs/common";
import type { TaskStatus } from "@wedplan/shared";
import { DatabaseService } from "../../database/database.service";
import { ChecklistTemplateItem, computeDueDate } from "./checklist-template";

export interface ChecklistTaskRow {
  id: string;
  inquirer_id: string;
  booking_id: string | null;
  title: string;
  category: string | null;
  due_date: string | null;
  status: TaskStatus;
  assignee: string | null;
  is_auto_generated: boolean;
  created_at: string;
}

const TASK_COLUMNS =
  "id, inquirer_id, booking_id, title, category, due_date, status, assignee, is_auto_generated, created_at";

@Injectable()
export class ChecklistRepository {
  constructor(private readonly db: DatabaseService) {}

  async findWeddingDate(inquirerId: string): Promise<string | undefined> {
    const result = await this.db.query<{ wedding_date: string | null }>(
      `SELECT wedding_date FROM inquirer_profiles WHERE user_id = $1`,
      [inquirerId],
    );
    return result.rows[0]?.wedding_date ?? undefined;
  }

  async findBudgetTotal(inquirerId: string): Promise<string | null | undefined> {
    const result = await this.db.query<{ budget_total: string | null }>(
      `SELECT budget_total FROM inquirer_profiles WHERE user_id = $1`,
      [inquirerId],
    );
    return result.rows[0]?.budget_total;
  }

  // Sum of each live booking's total_amount, per the inquiry category that
  // produced it — what the inquirer is on the hook for, whether or not
  // they've paid it yet.
  async findCommittedByCategory(
    inquirerId: string,
  ): Promise<{ category: string; committed: string }[]> {
    const result = await this.db.query<{ category: string; committed: string }>(
      `SELECT i.category, SUM(b.total_amount) AS committed
       FROM bookings b
       JOIN quotes q ON q.id = b.quote_id
       JOIN inquiries i ON i.id = q.inquiry_id
       WHERE b.inquirer_id = $1 AND b.status != 'cancelled'
       GROUP BY i.category`,
      [inquirerId],
    );
    return result.rows;
  }

  // Sum of succeeded, non-refund payments, per category. A refunded payment
  // is excluded automatically — payments.service flips its status to
  // 'refunded' (not 'succeeded') once the refund completes, so there's no
  // double-counting to net out here.
  async findPaidByCategory(inquirerId: string): Promise<{ category: string; paid: string }[]> {
    const result = await this.db.query<{ category: string; paid: string }>(
      `SELECT i.category, SUM(p.amount) AS paid
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       JOIN quotes q ON q.id = b.quote_id
       JOIN inquiries i ON i.id = q.inquiry_id
       WHERE b.inquirer_id = $1 AND p.status = 'succeeded' AND p.type != 'refund'
       GROUP BY i.category`,
      [inquirerId],
    );
    return result.rows;
  }

  // Categories the inquirer currently has a live (non-cancelled) booking for,
  // sourced from the original inquiry's category — used to auto-complete
  // matching template tasks.
  async findBookedCategories(inquirerId: string): Promise<string[]> {
    const result = await this.db.query<{ category: string }>(
      `SELECT DISTINCT i.category
       FROM bookings b
       JOIN quotes q ON q.id = b.quote_id
       JOIN inquiries i ON i.id = q.inquiry_id
       WHERE b.inquirer_id = $1 AND b.status != 'cancelled'`,
      [inquirerId],
    );
    return result.rows.map((r) => r.category);
  }

  async listForInquirer(inquirerId: string): Promise<ChecklistTaskRow[]> {
    const result = await this.db.query<ChecklistTaskRow>(
      `SELECT ${TASK_COLUMNS} FROM checklist_tasks WHERE inquirer_id = $1
       ORDER BY due_date NULLS LAST, created_at`,
      [inquirerId],
    );
    return result.rows;
  }

  async findById(id: string): Promise<ChecklistTaskRow | undefined> {
    const result = await this.db.query<ChecklistTaskRow>(
      `SELECT ${TASK_COLUMNS} FROM checklist_tasks WHERE id = $1`,
      [id],
    );
    return result.rows[0];
  }

  async existingTitles(inquirerId: string): Promise<Set<string>> {
    const result = await this.db.query<{ title: string }>(
      `SELECT title FROM checklist_tasks WHERE inquirer_id = $1 AND is_auto_generated = true`,
      [inquirerId],
    );
    return new Set(result.rows.map((r) => r.title));
  }

  // Inserts the subset of the template not already present for this
  // inquirer (idempotent — safe to call generate() more than once, e.g.
  // after the wedding date changes).
  async generateFromTemplate(
    inquirerId: string,
    weddingDate: string,
    template: ChecklistTemplateItem[],
  ): Promise<number> {
    const existing = await this.existingTitles(inquirerId);
    const toInsert = template.filter((item) => !existing.has(item.title));
    if (toInsert.length === 0) return 0;

    await this.db.withTransaction(async (client) => {
      for (const item of toInsert) {
        await client.query(
          `INSERT INTO checklist_tasks (inquirer_id, title, category, due_date, is_auto_generated)
           VALUES ($1, $2, $3, $4, true)`,
          [inquirerId, item.title, item.category, computeDueDate(weddingDate, item)],
        );
      }
    });
    return toInsert.length;
  }

  async markDoneByCategories(inquirerId: string, categories: string[]): Promise<void> {
    if (categories.length === 0) return;
    await this.db.query(
      `UPDATE checklist_tasks SET status = 'done', updated_at = now()
       WHERE inquirer_id = $1 AND category = ANY($2::text[]) AND status != 'done'`,
      [inquirerId, categories],
    );
  }

  async create(
    inquirerId: string,
    task: { title: string; category?: string; dueDate?: string; assignee?: string },
  ): Promise<ChecklistTaskRow> {
    const result = await this.db.query<ChecklistTaskRow>(
      `INSERT INTO checklist_tasks (inquirer_id, title, category, due_date, assignee, is_auto_generated)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING ${TASK_COLUMNS}`,
      [inquirerId, task.title, task.category ?? null, task.dueDate ?? null, task.assignee ?? null],
    );
    return result.rows[0];
  }

  async update(
    id: string,
    inquirerId: string,
    task: { title: string; category?: string; dueDate?: string; status: TaskStatus; assignee?: string },
  ): Promise<ChecklistTaskRow | undefined> {
    const result = await this.db.query<ChecklistTaskRow>(
      `UPDATE checklist_tasks SET
         title = $3, category = $4, due_date = $5, status = $6, assignee = $7, updated_at = now()
       WHERE id = $1 AND inquirer_id = $2
       RETURNING ${TASK_COLUMNS}`,
      [
        id,
        inquirerId,
        task.title,
        task.category ?? null,
        task.dueDate ?? null,
        task.status,
        task.assignee ?? null,
      ],
    );
    return result.rows[0];
  }

  async delete(id: string, inquirerId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM checklist_tasks WHERE id = $1 AND inquirer_id = $2`,
      [id, inquirerId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
