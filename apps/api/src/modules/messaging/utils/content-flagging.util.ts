// MVP heuristic for spec 3.3's "auto-flagging for suspicious/abusive content":
// detects attempts to move a conversation off-platform (sharing contact info),
// which is the most common real-world abuse pattern in a marketplace that
// earns its revenue from bookings made through it. Not a substitute for a real
// moderation pipeline — flagged messages still send, just marked for review.
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_PATTERN = /(?:\+?\d[\s.-]?){9,14}\d/;
const URL_PATTERN = /https?:\/\/\S+|www\.\S+/i;

export interface FlagResult {
  flagged: boolean;
  reason?: string;
}

export function detectSuspiciousContent(body: string): FlagResult {
  if (EMAIL_PATTERN.test(body)) {
    return { flagged: true, reason: "Message may contain an email address" };
  }
  if (PHONE_PATTERN.test(body)) {
    return { flagged: true, reason: "Message may contain a phone number" };
  }
  if (URL_PATTERN.test(body)) {
    return { flagged: true, reason: "Message may contain an external link" };
  }
  return { flagged: false };
}
