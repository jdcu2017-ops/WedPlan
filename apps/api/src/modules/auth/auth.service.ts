import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { authenticator } from "otplib";
import type { UserRole } from "@wedplan/shared";
import { decryptSecret, encryptSecret, generateOpaqueToken, sha256Hex } from "../../common/utils/crypto.util";
import { parseDurationMs } from "../../common/utils/duration.util";
import { AuthRepository } from "./auth.repository";
import type { MfaTicketPayload } from "../../common/types/jwt-payload";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(email: string, password: string, role: Extract<UserRole, "inquirer" | "vendor">) {
    const existing = await this.repo.findByEmail(email);
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }
    const passwordHash = await argon2.hash(password);
    const user = await this.repo.createUser(email, passwordHash, role);
    return { id: user.id, email: user.email, role: user.role };
  }

  async login(email: string, password: string): Promise<TokenPair | { mfaRequired: true; mfaTicket: string }> {
    const user = await this.repo.findByEmail(email);
    if (!user || !user.is_active) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.mfa_enabled) {
      const mfaTicket = await this.jwt.signAsync(
        { sub: user.id, mfaPending: true } satisfies MfaTicketPayload,
        {
          secret: this.config.get<string>("jwt.accessSecret"),
          expiresIn: this.config.get<string>("mfa.ticketTtl"),
        },
      );
      return { mfaRequired: true, mfaTicket };
    }

    return this.issueTokenPair(user.id, user.role);
  }

  async completeMfaLogin(mfaTicket: string, code: string): Promise<TokenPair> {
    let payload: MfaTicketPayload;
    try {
      payload = await this.jwt.verifyAsync<MfaTicketPayload>(mfaTicket, {
        secret: this.config.get<string>("jwt.accessSecret"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired MFA ticket");
    }
    if (!payload.mfaPending) {
      throw new UnauthorizedException("Invalid MFA ticket");
    }

    const user = await this.repo.findById(payload.sub);
    if (!user || !user.mfa_enabled || !user.mfa_secret) {
      throw new UnauthorizedException("MFA is not enabled for this account");
    }

    const secret = decryptSecret(user.mfa_secret, this.encryptionKey());
    const valid = authenticator.verify({ token: code, secret });
    if (!valid) {
      throw new UnauthorizedException("Invalid MFA code");
    }

    return this.issueTokenPair(user.id, user.role);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = sha256Hex(refreshToken);
    const record = await this.repo.findActiveRefreshToken(tokenHash);
    if (!record) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    // Rotate: revoke the presented token before issuing a new one.
    await this.repo.revokeRefreshToken(record.id);

    const user = await this.repo.findById(record.user_id);
    if (!user || !user.is_active) {
      throw new UnauthorizedException("Account no longer active");
    }
    return this.issueTokenPair(user.id, user.role);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.repo.revokeRefreshTokenByHash(sha256Hex(refreshToken));
  }

  async enrollMfa(userId: string) {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new UnauthorizedException("Account not found");
    }
    const secret = authenticator.generateSecret();
    const encrypted = encryptSecret(secret, this.encryptionKey());
    await this.repo.setMfaSecret(userId, encrypted);
    const otpauthUrl = authenticator.keyuri(
      user.email,
      this.config.get<string>("mfa.issuer")!,
      secret,
    );
    return { otpauthUrl };
  }

  async confirmMfaEnrollment(userId: string, code: string): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user?.mfa_secret) {
      throw new UnauthorizedException("No MFA enrollment in progress");
    }
    const secret = decryptSecret(user.mfa_secret, this.encryptionKey());
    if (!authenticator.verify({ token: code, secret })) {
      throw new UnauthorizedException("Invalid MFA code");
    }
    await this.repo.enableMfa(userId);
  }

  private async issueTokenPair(userId: string, role: UserRole): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, role },
      {
        secret: this.config.get<string>("jwt.accessSecret"),
        expiresIn: this.config.get<string>("jwt.accessTtl"),
      },
    );

    const refreshToken = generateOpaqueToken();
    const refreshTtl = this.config.get<string>("jwt.refreshTtl")!;
    const expiresAt = new Date(Date.now() + parseDurationMs(refreshTtl));
    await this.repo.storeRefreshToken(userId, sha256Hex(refreshToken), expiresAt);

    return { accessToken, refreshToken };
  }

  private encryptionKey(): string {
    const key = this.config.get<string>("encryptionKey");
    if (!key) {
      throw new Error("ENCRYPTION_KEY is not configured");
    }
    return key;
  }
}
