import winston from "winston";

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/app.log" }),
  ],
});

export function logStartup(message: string) {
  logger.info(`🚀 ${message}`);
}

export function logError(context: string, error: unknown) {
  logger.error(`${context}: ${error instanceof Error ? error.stack : String(error)}`);
}
