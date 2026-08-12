import type { UserRole } from "@wedplan/shared";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface MfaTicketPayload {
  sub: string;
  mfaPending: true;
}
