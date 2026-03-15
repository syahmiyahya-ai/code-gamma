import { db } from "../db/db";
import { auditService } from "./auditService";
import { rosterValidationService } from "./rosterValidationService";
import { logger } from "../utils/logger";

export const rosterService = {
  getShiftTypes: () => {
    return db.prepare("SELECT * FROM shift_types").all();
  },

  getShifts: (start: string, end: string) => {
    return db.prepare("SELECT * FROM shifts WHERE date BETWEEN ? AND ?").all(start, end);
  },

  updateShift: (params: {
    user_id: string;
    date: string;
    shift_code: string;
    is_code_blue: boolean;
    changed_by: string;
    confirm?: boolean;
  }) => {
    const { user_id, date, shift_code, is_code_blue, changed_by, confirm } = params;
    
    // Validation
    const validation = rosterValidationService.validateShift(user_id, date, shift_code);
    if (!validation.valid && !confirm) {
      logger.warn("SHIFT_VALIDATION_FAILED", changed_by, { user_id, date, shift_code, errors: validation.errors });
      throw new Error(`Validation failed: ${validation.errors.join(". ")}. Use 'confirm: true' to override.`);
    }

    if (!validation.valid && confirm) {
      logger.info("SHIFT_VALIDATION_OVERRIDDEN", changed_by, { user_id, date, shift_code, errors: validation.errors });
    }

    // Check if shift exists
    const existing = db.prepare("SELECT * FROM shifts WHERE user_id = ? AND date = ?").get(user_id, date) as any;
    
    // If shift_code is null, we are clearing the shift
    if (shift_code === null) {
      if (existing) {
        db.prepare("DELETE FROM shifts WHERE id = ?").run(existing.id);
        
        auditService.logAuditEvent({
          actorUserId: changed_by,
          eventType: 'ROSTER_ENTRY_DELETED',
          entityType: 'SHIFT',
          entityId: existing.id,
          beforeState: existing,
          afterState: null,
          metadata: { source: 'rosterService.updateShift' }
        });

        // Legacy audit log
        db.prepare("INSERT INTO shift_audit_logs (shift_id, action, changed_by, old_data) VALUES (?, ?, ?, ?)")
          .run(existing.id, "DELETE", changed_by, JSON.stringify(existing));
        
        return existing.id;
      }
      return null;
    }

    let shift_id: number;
    let eventType: string;
    let beforeState: any = null;
    let afterState: any = null;

    if (existing) {
      db.prepare("UPDATE shifts SET shift_code = ?, is_code_blue = ? WHERE id = ?")
        .run(shift_code, is_code_blue ? 1 : 0, existing.id);
      shift_id = Number(existing.id);
      eventType = 'UPDATE';
      beforeState = existing;
      afterState = { shift_code, is_code_blue };
      
      // Legacy audit log
      db.prepare("INSERT INTO shift_audit_logs (shift_id, action, changed_by, old_data, new_data) VALUES (?, ?, ?, ?, ?)")
        .run(shift_id, "UPDATE", changed_by, JSON.stringify(existing), JSON.stringify({ shift_code, is_code_blue }));
    } else {
      const result = db.prepare("INSERT INTO shifts (user_id, date, shift_code, is_code_blue) VALUES (?, ?, ?, ?)")
        .run(user_id, date, shift_code, is_code_blue ? 1 : 0);
      shift_id = Number(result.lastInsertRowid);
      eventType = 'CREATE';
      afterState = { user_id, date, shift_code, is_code_blue };
      
      // Legacy audit log
      db.prepare("INSERT INTO shift_audit_logs (shift_id, action, changed_by, new_data) VALUES (?, ?, ?, ?)")
        .run(shift_id, "CREATE", changed_by, JSON.stringify({ user_id, date, shift_code, is_code_blue }));
    }

    // New Audit System Integration
    auditService.logAuditEvent({
      actorUserId: changed_by,
      eventType: eventType === 'CREATE' ? 'ROSTER_ENTRY_CREATED' : 'ROSTER_ENTRY_UPDATED',
      entityType: 'SHIFT',
      entityId: shift_id,
      beforeState,
      afterState,
      metadata: { source: 'rosterService.updateShift', overridden: !validation.valid }
    });
    
    return shift_id;
  },

  publishRoster: (params: { start_date: string, end_date: string, changed_by: string, confirm: boolean }) => {
    const { start_date, end_date, changed_by, confirm } = params;
    if (!confirm) {
      throw new Error("Action requires confirmation flag 'confirm: true'");
    }

    logger.info("ROSTER_PUBLISHED", changed_by, { start_date, end_date });
    
    auditService.logAuditEvent({
      actorUserId: changed_by,
      eventType: 'ROSTER_PUBLISHED',
      entityType: 'ROSTER',
      entityId: `${start_date}_${end_date}`,
      metadata: { start_date, end_date }
    });

    return true;
  },

  deleteRoster: (params: { start_date: string, end_date: string, changed_by: string, confirm: boolean }) => {
    const { start_date, end_date, changed_by, confirm } = params;
    if (!confirm) {
      throw new Error("Action requires confirmation flag 'confirm: true'");
    }

    const result = db.prepare("DELETE FROM shifts WHERE date BETWEEN ? AND ?").run(start_date, end_date);
    
    logger.warn("ROSTER_DELETED", changed_by, { start_date, end_date, count: result.changes });
    
    auditService.logAuditEvent({
      actorUserId: changed_by,
      eventType: 'ROSTER_DELETED',
      entityType: 'ROSTER',
      entityId: `${start_date}_${end_date}`,
      metadata: { start_date, end_date, deleted_count: result.changes }
    });

    return result.changes;
  },

  getAuditLogs: () => {
    return db.prepare(`
      SELECT l.*, u.name as changer_name 
      FROM shift_audit_logs l 
      JOIN users u ON l.changed_by = u.id 
      ORDER BY timestamp DESC LIMIT 50
    `).all();
  }
};
