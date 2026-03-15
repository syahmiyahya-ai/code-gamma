import { db } from "../db/db";
import { logger } from "../utils/logger";

export enum NotificationType {
  SYSTEM = "SYSTEM",
  LEAVE_UPDATE = "LEAVE_UPDATE",
  SWAP_REQUEST = "SWAP_REQUEST",
  ROSTER_PUBLISHED = "ROSTER_PUBLISHED",
  TASK_ASSIGNED = "TASK_ASSIGNED",
  REMINDER = "REMINDER"
}

export interface NotificationParams {
  userId: string;
  title: string;
  message: string;
  type: NotificationType | string;
  relatedEntityId?: string;
}

/**
 * Event-Based Notification System
 * Centralizes notification creation and dispatching.
 */
export const notificationService = {
  /**
   * Creates a notification for a user.
   */
  createNotification: (params: NotificationParams) => {
    const { userId, title, message, type, relatedEntityId } = params;
    const id = Math.random().toString(36).substring(7);
    
    try {
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, related_entity_id) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, userId, title, message, type, relatedEntityId || null);
      
      logger.info("NOTIFICATION_CREATED", "SYSTEM", { userId, type, id });
      return id;
    } catch (error) {
      logger.error("NOTIFICATION_FAILED", "SYSTEM", { error, userId, type });
      throw error;
    }
  },

  /**
   * Mark all notifications as read for a user.
   */
  markAllAsRead: (userId: string) => {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(userId);
  },

  /**
   * Mark a specific notification as read.
   */
  markAsRead: (id: string) => {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(id);
  },

  /**
   * Get notifications for a user.
   */
  getNotifications: (userId: string) => {
    return db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC").all(userId);
  }
};
