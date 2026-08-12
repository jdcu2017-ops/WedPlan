import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";

// Append-only per db/migrations/011_audit_log.sql — never update or delete
// these rows from application code.
@Injectable()
export class AuditLogService {
  constructor(private readonly db: DatabaseService) {}

  async record(params: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        params.actorId,
        params.action,
        params.entityType,
        params.entityId ?? null,
        JSON.stringify(params.metadata ?? {}),
      ],
    );
  }
}
