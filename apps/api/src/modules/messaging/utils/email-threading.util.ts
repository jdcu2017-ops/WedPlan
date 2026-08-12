import type { PostmarkInboundHeader } from "../dto/postmark-inbound.types";

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Postmark stamps the outbound send's MessageID (a UUID) into the SMTP
// Message-ID header, which reply clients echo back in In-Reply-To/References.
// We stored that same UUID as messages.email_message_id when we sent the
// mirror, so pulling it back out of these headers is how an inbound reply
// gets threaded to the right conversation.
export function extractReferencedMessageId(headers: PostmarkInboundHeader[] | undefined): string | undefined {
  if (!headers) return undefined;
  const candidates = headers.filter((h) => /^(in-reply-to|references)$/i.test(h.Name));
  for (const header of candidates) {
    const match = UUID_PATTERN.exec(header.Value);
    if (match) return match[0];
  }
  return undefined;
}
