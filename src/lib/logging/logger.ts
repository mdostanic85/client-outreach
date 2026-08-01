import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "email",
      "body",
      "bodyGenerated",
      "bodyFinal",
      "apiKey",
      "authorization",
      "req.headers.authorization",
      "*.email",
      "*.apiKey",
      "*.body",
      "*.bodyFinal",
      "*.bodyGenerated",
    ],
    censor: "[REDACTED]",
  },
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
