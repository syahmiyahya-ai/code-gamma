import { db } from "../db/db";
import { auditService } from "./auditService";
import { notificationService, NotificationType } from "./notificationService";

export const taskService = {
  getTasks: () => {
    return db.prepare(`
      SELECT t.*, u.name as creator_name,
      (SELECT COUNT(*) FROM task_assignments WHERE task_id = t.id) as total_assigned,
      (SELECT COUNT(*) FROM task_assignments WHERE task_id = t.id AND status = 'COMPLETED') as completed_count
      FROM tasks t
      JOIN users u ON t.created_by = u.id
      ORDER BY 
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
        due_date ASC
    `).all();
  },

  getTaskAssignments: (taskId: number) => {
    return db.prepare(`
      SELECT ta.*, u.name as user_name
      FROM task_assignments ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = ?
    `).all(taskId);
  },

  getMyTasks: (userId: string) => {
    return db.prepare(`
      SELECT ta.*, t.title, t.description, t.due_date, t.is_edited, t.is_deleted
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      WHERE ta.user_id = ?
      ORDER BY 
        CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
        t.due_date ASC
    `).all(userId);
  },

  createTask: (params: { title: string, description?: string, due_date?: string, created_by: string, user_ids: string[] }) => {
    const { title, description, due_date, created_by, user_ids } = params;
    
    const transaction = db.transaction(() => {
      const taskResult = db.prepare("INSERT INTO tasks (title, description, due_date, created_by) VALUES (?, ?, ?, ?)")
        .run(title, description || null, due_date || null, created_by);
      const taskId = Number(taskResult.lastInsertRowid);

      const insertAssignment = db.prepare("INSERT INTO task_assignments (task_id, user_id) VALUES (?, ?)");
      for (const userId of user_ids) {
        insertAssignment.run(taskId, userId);
        
        // Rich notification message
        const descSnippet = description ? (description.length > 60 ? description.substring(0, 57) + '...' : description) : 'No description provided.';
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        const message = `You have been assigned a new task: "${title}"\n\n` +
                        `Description: ${descSnippet}\n` +
                        `${due_date ? `Due Date: ${due_date}\n` : ''}` +
                        `View your tasks here: ${appUrl}`;

        // Notify user
        notificationService.createNotification({
          userId: userId,
          title: "New Task Assigned",
          message,
          type: NotificationType.TASK_ASSIGNED,
          relatedEntityId: taskId.toString()
        });
      }

      auditService.logAuditEvent({
        actorUserId: created_by,
        eventType: 'TASK_CREATED',
        entityType: 'TASK',
        entityId: taskId,
        afterState: params
      });

      return taskId;
    });

    return transaction();
  },

  updateTaskAssignment: (assignmentId: number, status: string) => {
    const completed_at = status === 'COMPLETED' ? new Date().toISOString() : null;
    
    db.prepare("UPDATE task_assignments SET status = ?, completed_at = ? WHERE id = ?")
      .run(status, completed_at, assignmentId);

    // Get task_id for audit
    const assignment = db.prepare("SELECT task_id, user_id FROM task_assignments WHERE id = ?").get(assignmentId) as any;
    
    if (assignment) {
      auditService.logAuditEvent({
        actorUserId: assignment.user_id,
        eventType: status === 'COMPLETED' ? 'TASK_COMPLETED' : 'TASK_UPDATED',
        entityType: 'TASK_ASSIGNMENT',
        entityId: assignmentId,
        afterState: { status, completed_at }
      });
    }

    return true;
  },

  updateTask: (taskId: number, params: { title: string, description?: string, due_date?: string }) => {
    const { title, description, due_date } = params;
    db.prepare("UPDATE tasks SET title = ?, description = ?, due_date = ?, is_edited = 1 WHERE id = ?")
      .run(title, description || null, due_date || null, taskId);

    auditService.logAuditEvent({
      actorUserId: 'SYSTEM', // We don't have the actor here easily without passing it
      eventType: 'TASK_UPDATED',
      entityType: 'TASK',
      entityId: taskId,
      afterState: params
    });

    return true;
  },

  deleteTask: (taskId: number) => {
    db.prepare("UPDATE tasks SET is_deleted = 1 WHERE id = ?").run(taskId);

    auditService.logAuditEvent({
      actorUserId: 'SYSTEM',
      eventType: 'TASK_DELETED',
      entityType: 'TASK',
      entityId: taskId,
      afterState: { is_deleted: 1 }
    });

    return true;
  },

  nudgeTask: (userId: string, taskTitle: string) => {
    notificationService.createNotification({
      userId,
      title: "Task Reminder",
      message: `Reminder: Please complete your assigned task: ${taskTitle}`,
      type: NotificationType.REMINDER
    });
    return true;
  }
};
