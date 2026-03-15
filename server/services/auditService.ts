import { db } from "../db/db";

export interface AuditEventParams {
  actorUserId: string;
  eventType: string;
  entityType: string;
  entityId: string | number;
  beforeState?: any;
  afterState?: any;
  metadata?: any;
}

/**
 * Audit Service
 * Responsible for logging critical operational changes to the audit_events table.
 */
export const auditService = {
  /**
   * Logs an audit event to the database.
   * This function is designed to be resilient and will log errors to the console
   * rather than crashing the main application flow.
   */
  logAuditEvent: (params: AuditEventParams): void => {
    try {
      const {
        actorUserId,
        eventType,
        entityType,
        entityId,
        beforeState,
        afterState,
        metadata,
      } = params;

      const stmt = db.prepare(`
        INSERT INTO audit_events (
          actor_user_id,
          event_type,
          entity_type,
          entity_id,
          before_state,
          after_state,
          metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        actorUserId,
        eventType,
        entityType,
        String(entityId),
        beforeState ? JSON.stringify(beforeState) : null,
        afterState ? JSON.stringify(afterState) : null,
        metadata ? JSON.stringify(metadata) : null
      );

      console.log(`[AUDIT] ${eventType} on ${entityType}:${entityId} by ${actorUserId}`);
    } catch (error) {
      console.error('[AUDIT] Failed to log audit event:', error);
      // We do not throw here to ensure the main operation can continue
      // even if the audit logging fails.
    }
  },
};

/**
 * EXAMPLE INTEGRATION SNIPPET
 * 
 * How to use this service in a route handler (e.g., updating a shift):
 * 
 * app.put("/api/shifts/:id", async (req, res) => {
 *   const { id } = req.params;
 *   const { shift_code, user_id } = req.body;
 *   const actorUserId = req.headers['x-user-id']; // Example of getting actor from header
 * 
 *   // 1. Get before state
 *   const beforeState = db.prepare("SELECT * FROM shifts WHERE id = ?").get(id);
 * 
 *   // 2. Perform the update
 *   db.prepare("UPDATE shifts SET shift_code = ? WHERE id = ?").run(shift_code, id);
 * 
 *   // 3. Get after state
 *   const afterState = db.prepare("SELECT * FROM shifts WHERE id = ?").get(id);
 * 
 *   // 4. Log the audit event
 *   auditService.logAuditEvent({
 *     actorUserId: String(actorUserId),
 *     eventType: 'UPDATE',
 *     entityType: 'SHIFT',
 *     entityId: id,
 *     beforeState,
 *     afterState,
 *     metadata: { reason: 'Manual adjustment by admin' }
 *   });
 * 
 *   res.json({ success: true });
 * });
 */
