export default () => ({
  port: parseInt(process.env.API_PORT ?? "4000", 10),
  webUrl: process.env.WEB_URL ?? "http://localhost:3000",
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "30d",
  },
  mfa: {
    issuer: process.env.MFA_ISSUER ?? "WedPlan",
    ticketTtl: process.env.MFA_TICKET_TTL ?? "5m",
  },
  encryptionKey: process.env.ENCRYPTION_KEY,
  email: {
    provider: process.env.EMAIL_PROVIDER ?? "postmark",
    apiKey: process.env.EMAIL_API_KEY,
    fromAddress: process.env.EMAIL_FROM_ADDRESS,
    inboundWebhookSecret: process.env.EMAIL_INBOUND_WEBHOOK_SECRET,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    platformCommissionPct: parseFloat(process.env.PLATFORM_COMMISSION_PCT ?? "10"),
  },
});
