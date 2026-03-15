import { db } from "../db/db";

export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  SECURITY = "SECURITY"
}

export interface LogEntry {
  actorUserId?: string;
  event: string;
  details?: any;
  level?: LogLevel;
}

/**
 * Structured Logger for Code Gamma
 * Tracks critical system events, errors, and security violations.
 */
export const logger = {
  log: (entry: LogEntry) => {
    const { actorUserId = "SYSTEM", event, details, level = LogLevel.INFO } = entry;
    const timestamp = new Date().toISOString();
    
    // For now, we log to console in a structured format.
    // In a real production app, this could also write to a file or a logging service.
    const logPayload = {
      timestamp,
      level,
      actorUserId,
      event,
      details
    };

    console.log(`[LOG][${level}] ${event} - Actor: ${actorUserId}`, details ? JSON.stringify(details) : "");

    // Optionally, we could store critical logs in the database if needed, 
    // but audit_events already covers many domain-level changes.
    // This logger is more for operational/system-level observability.
  },

  info: (event: string, actorUserId?: string, details?: any) => {
    logger.log({ event, actorUserId, details, level: LogLevel.INFO });
  },

  warn: (event: string, actorUserId?: string, details?: any) => {
    logger.log({ event, actorUserId, details, level: LogLevel.WARN });
  },

  error: (event: string, actorUserId?: string, details?: any) => {
    logger.log({ event, actorUserId, details, level: LogLevel.ERROR });
  },

  security: (event: string, actorUserId?: string, details?: any) => {
    logger.log({ event, actorUserId, details, level: LogLevel.SECURITY });
  }
};
