import { Injectable } from "@nestjs/common";
import type { UserRole } from "@wedplan/shared";
import { DatabaseService } from "../../database/database.service";

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  mfa_enabled: boolean;
  mfa_secret: string | null;
  email_verified_at: string | null;
  is_active: boolean;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly db: DatabaseService) {}

  async createUser(email: string, passwordHash: string, role: UserRole): Promise<UserRecord> {
    const result = await this.db.query<UserRecord>(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, password_hash, role, mfa_enabled, mfa_secret, email_verified_at, is_active`,
      [email, passwordHash, role],
    );
    return result.rows[0];
  }

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const result = await this.db.query<UserRecord>(
      `SELECT id, email, password_hash, role, mfa_enabled, mfa_secret, email_verified_at, is_active
       FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<UserRecord | undefined> {
    const result = await this.db.query<UserRecord>(
      `SELECT id, email, password_hash, role, mfa_enabled, mfa_secret, email_verified_at, is_active
       FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0];
  }

  async setMfaSecret(userId: string, encryptedSecret: string): Promise<void> {
    await this.db.query(`UPDATE users SET mfa_secret = $1, updated_at = now() WHERE id = $2`, [
      encryptedSecret,
      userId,
    ]);
  }

  async enableMfa(userId: string): Promise<void> {
    await this.db.query(`UPDATE users SET mfa_enabled = true, updated_at = now() WHERE id = $1`, [
      userId,
    ]);
  }

  async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  }

  async findActiveRefreshToken(tokenHash: string) {
    const result = await this.db.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM refresh_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [tokenHash],
    );
    return result.rows[0];
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.db.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [id]);
  }

  async revokeRefreshTokenByHash(tokenHash: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  }
}
