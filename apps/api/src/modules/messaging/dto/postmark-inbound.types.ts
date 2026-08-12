// Plain interfaces (no class-validator decorators) describing the slice of
// Postmark's Inbound Parse payload we actually read. Deliberately NOT a
// class-validated DTO: the global ValidationPipe has whitelist/forbidNonWhitelisted
// enabled, and Postmark's real payload has dozens of fields we don't otherwise
// care about — a decorated class here would reject every real webhook call.
// Because this is a plain interface, Nest sees no reflected metatype and skips
// validation for this param entirely.
export interface PostmarkInboundHeader {
  Name: string;
  Value: string;
}

export interface PostmarkInboundPayload {
  From: string;
  FromFull?: { Email: string; Name?: string };
  Subject?: string;
  TextBody?: string;
  MessageID?: string;
  Headers?: PostmarkInboundHeader[];
}
