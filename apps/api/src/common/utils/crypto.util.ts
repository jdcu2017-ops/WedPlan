import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

// AES-256-GCM at-rest encryption for sensitive columns (e.g. mfa_secret) that
// need to be decrypted by the app later, unlike passwords which are one-way hashed.
export function encryptSecret(plaintext: string, key: string): string {
  const derivedKey = scryptSync(key, "wedplan-mfa", 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptSecret(payload: string, key: string): string {
  const derivedKey = scryptSync(key, "wedplan-mfa", 32);
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", derivedKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateOpaqueToken(): string {
  return randomBytes(48).toString("hex");
}

// Constant-time comparison for shared-secret checks (e.g. inbound webhook
// auth) so response timing can't leak how much of the secret matched.
export function secureCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
