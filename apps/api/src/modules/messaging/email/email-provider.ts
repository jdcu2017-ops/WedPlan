export interface SendEmailResult {
  // Provider-generated id, stored on the message row so a later inbound reply
  // (In-Reply-To/References header) can be matched back to this conversation.
  providerMessageId: string | null;
}

// Abstract class (not an interface) so Nest can use it directly as a DI token.
export abstract class EmailProvider {
  abstract send(params: {
    to: string;
    subject: string;
    textBody: string;
    replyTo?: string;
  }): Promise<SendEmailResult>;
}
