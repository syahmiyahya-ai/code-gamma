import { db } from "../db/db";
import { auditService } from "./auditService";
import { notificationService, NotificationType } from "./notificationService";

export const swapService = {
  getSwapRequests: (filters: { user_id?: string, status?: string, is_admin?: boolean, is_giveaway?: boolean }) => {
    const { user_id, status, is_admin, is_giveaway } = filters;
    let query = `
      SELECT ss.*, 
      u1.name as requester_name, u2.name as target_name,
      s1.date as requester_shift_date, s1.shift_code as requester_shift_code,
      s2.date as target_shift_date, s2.shift_code as target_shift_code
      FROM shift_swaps ss
      JOIN users u1 ON ss.requester_id = u1.id
      LEFT JOIN users u2 ON ss.target_user_id = u2.id
      JOIN shifts s1 ON ss.requester_shift_id = s1.id
      LEFT JOIN shifts s2 ON ss.target_shift_id = s2.id
    `;
    let params: any[] = [];
    let conditions = [];

    if (is_admin) {
      if (status) {
        conditions.push("ss.status = ?");
        params.push(status);
      } else {
        conditions.push("ss.status IN ('ACCEPTED', 'APPROVED', 'REJECTED')");
      }
    } else if (is_giveaway) {
      conditions.push("ss.target_user_id IS NULL");
      if (status) {
        conditions.push("ss.status = ?");
        params.push(status);
      }
    } else if (user_id) {
      conditions.push("(ss.requester_id = ? OR ss.target_user_id = ?)");
      params.push(user_id, user_id);
      if (status) {
        conditions.push("ss.status = ?");
        params.push(status);
      }
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY ss.created_at DESC";
    return db.prepare(query).all(...params);
  },

  createSwapRequest: (params: { requester_id: string, requester_shift_id: number, target_user_id?: string, target_shift_id?: number, reason?: string }) => {
    const { requester_id, requester_shift_id, target_user_id, target_shift_id, reason } = params;
    
    const result = db.prepare(`
      INSERT INTO shift_swaps (requester_id, requester_shift_id, target_user_id, target_shift_id, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(requester_id, requester_shift_id, target_user_id || null, target_shift_id || null, reason || null);

    const swapId = Number(result.lastInsertRowid);

    // Notify target user if specified
    if (target_user_id) {
      const requester = db.prepare("SELECT name FROM users WHERE id = ?").get(requester_id) as any;
      notificationService.createNotification({
        userId: target_user_id,
        title: "Shift Swap Request",
        message: `${requester.name} has requested to swap a shift with you.`,
        type: NotificationType.SWAP_REQUEST,
        relatedEntityId: swapId.toString()
      });
    }

    auditService.logAuditEvent({
      actorUserId: requester_id,
      eventType: 'SWAP_REQUESTED',
      entityType: 'SHIFT_SWAP',
      entityId: swapId,
      afterState: params
    });

    return swapId;
  },

  updateSwapStatus: (id: number, status: string, changed_by: string) => {
    const swap = db.prepare("SELECT * FROM shift_swaps WHERE id = ?").get(id) as any;
    if (!swap) throw new Error("Swap request not found");

    const transaction = db.transaction(() => {
      if (status === 'ACCEPTED' && !swap.target_user_id) {
        // This is a giveaway being claimed
        db.prepare("UPDATE shift_swaps SET status = ?, target_user_id = ? WHERE id = ?").run(status, changed_by, id);
        swap.target_user_id = changed_by;
      } else {
        db.prepare("UPDATE shift_swaps SET status = ? WHERE id = ?").run(status, id);
      }

      if (status === 'APPROVED') {
        // Perform the actual swap in the shifts table
        const s1 = db.prepare("SELECT * FROM shifts WHERE id = ?").get(swap.requester_shift_id) as any;
        const s2 = swap.target_shift_id ? db.prepare("SELECT * FROM shifts WHERE id = ?").get(swap.target_shift_id) as any : null;

        if (s2) {
          db.prepare("UPDATE shifts SET user_id = ? WHERE id = ?").run(swap.target_user_id, swap.requester_shift_id);
          db.prepare("UPDATE shifts SET user_id = ? WHERE id = ?").run(swap.requester_id, swap.target_shift_id);
          
          // Legacy audit log
          db.prepare("INSERT INTO shift_audit_logs (shift_id, action, changed_by, old_data, new_data) VALUES (?, ?, ?, ?, ?)")
            .run(swap.requester_shift_id, "SWAP", changed_by, JSON.stringify(s1), JSON.stringify({ user_id: swap.target_user_id }));
          db.prepare("INSERT INTO shift_audit_logs (shift_id, action, changed_by, old_data, new_data) VALUES (?, ?, ?, ?, ?)")
            .run(swap.target_shift_id, "SWAP", changed_by, JSON.stringify(s2), JSON.stringify({ user_id: swap.requester_id }));
        } else {
          // Giveaway
          db.prepare("UPDATE shifts SET user_id = ? WHERE id = ?").run(swap.target_user_id, swap.requester_shift_id);
          db.prepare("INSERT INTO shift_audit_logs (shift_id, action, changed_by, old_data, new_data) VALUES (?, ?, ?, ?, ?)")
            .run(swap.requester_shift_id, "GIVEAWAY", changed_by, JSON.stringify(s1), JSON.stringify({ user_id: swap.target_user_id }));
        }

        // Notify both users
        notificationService.createNotification({
          userId: swap.requester_id,
          title: "Swap Approved",
          message: "Your shift swap request has been approved and the roster updated.",
          type: NotificationType.SYSTEM
        });
        notificationService.createNotification({
          userId: swap.target_user_id,
          title: "Swap Approved",
          message: "A shift swap involving you has been approved and the roster updated.",
          type: NotificationType.SYSTEM
        });
        
        auditService.logAuditEvent({
          actorUserId: changed_by,
          eventType: 'SWAP_APPROVED',
          entityType: 'SHIFT_SWAP',
          entityId: id,
          afterState: { status: 'APPROVED' }
        });
      } else if (status === 'ACCEPTED') {
        const admins = db.prepare("SELECT id FROM users WHERE role IN ('Admin', 'Administrator', 'Manager')").all() as any[];
        const target = db.prepare("SELECT name FROM users WHERE id = ?").get(swap.target_user_id) as any;
        admins.forEach(admin => {
          notificationService.createNotification({
            userId: admin.id,
            title: "Swap Pending Approval",
            message: `${target.name} has accepted a swap request. Admin approval required.`,
            type: NotificationType.SYSTEM,
            relatedEntityId: id.toString()
          });
        });
      } else if (status === 'REJECTED') {
        notificationService.createNotification({
          userId: swap.requester_id,
          title: "Swap Rejected",
          message: "Your shift swap request was rejected.",
          type: NotificationType.SYSTEM
        });
        
        auditService.logAuditEvent({
          actorUserId: changed_by,
          eventType: 'SWAP_REJECTED',
          entityType: 'SHIFT_SWAP',
          entityId: id,
          afterState: { status: 'REJECTED' }
        });
      }
    });

    transaction();
    return true;
  }
};
