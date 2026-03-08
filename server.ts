import "dotenv/config";
console.log('[SERVER] Starting server.ts...');
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import { syncShiftToGoogleCalendar } from "./server/calendarUtils.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let db: Database.Database;
try {
  db = new Database("roster.db");
  console.log('[SERVER] Database connection established');
} catch (err) {
  console.error('[SERVER] Failed to connect to database:', err);
  process.exit(1);
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone_number TEXT,
    email TEXT,
    avatar_url TEXT,
    google_access_token TEXT,
    google_refresh_token TEXT
  );

  CREATE TABLE IF NOT EXISTS shift_types (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    description TEXT,
    background_color TEXT NOT NULL,
    text_color TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    shift_code TEXT NOT NULL,
    is_code_blue INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(shift_code) REFERENCES shift_types(code)
  );

  CREATE TABLE IF NOT EXISTS shift_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER,
    action TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    old_data TEXT,
    new_data TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id TEXT NOT NULL,
    is_pinned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(uploaded_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- SYSTEM, LEAVE_UPDATE, SWAP_REQUEST, DIRECT_MESSAGE
    related_entity_id TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS owed_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL, -- PN, HKO
    reason TEXT,
    date_earned TEXT NOT NULL,
    date_redeemed TEXT,
    status TEXT DEFAULT 'OWED', -- OWED, REDEEMED
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    created_by TEXT NOT NULL,
    is_edited INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS task_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, COMPLETED
    completed_at DATETIME,
    FOREIGN KEY(task_id) REFERENCES tasks(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS shift_swaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id TEXT NOT NULL,
    requester_shift_id INTEGER NOT NULL,
    target_user_id TEXT, -- Null means it's an open giveaway
    target_shift_id INTEGER, -- Optional, if null it's a giveaway
    status TEXT DEFAULT 'PENDING', -- PENDING, ACCEPTED, APPROVED, REJECTED, CANCELLED
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(requester_id) REFERENCES users(id),
    FOREIGN KEY(requester_shift_id) REFERENCES shifts(id),
    FOREIGN KEY(target_user_id) REFERENCES users(id),
    FOREIGN KEY(target_shift_id) REFERENCES shifts(id)
  );
`);

// Migration: Add avatar_url to users if it doesn't exist
try {
  db.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run();
} catch (e) {
  // Column might already exist
}

// Migration: Add is_edited and is_deleted to tasks if they don't exist
try {
  db.prepare("ALTER TABLE tasks ADD COLUMN is_edited INTEGER DEFAULT 0").run();
} catch (e) {
  // Column might already exist
}
try {
  db.prepare("ALTER TABLE tasks ADD COLUMN is_deleted INTEGER DEFAULT 0").run();
} catch (e) {
  // Column might already exist
}

// Seed initial data if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
if (userCount === 0) {
  const insertUser = db.prepare("INSERT INTO users (id, name, role, phone_number, email) VALUES (?, ?, ?, ?, ?)");
  insertUser.run("1", "Dr. Ahmad", "Admin", "60123456789", "ahmad@hospital.com");
  insertUser.run("2", "Dr. Siti", "Staff", "60123456790", "siti@hospital.com");
  insertUser.run("3", "Dr. Wong", "Staff", "60123456791", "wong@hospital.com");
  insertUser.run("4", "Dr. Kavita", "Staff", "60123456792", "kavita@hospital.com");
  insertUser.run("5", "Dr. Zulkifli", "Staff", "60123456793", "zulkifli@hospital.com");

  const insertShiftType = db.prepare("INSERT INTO shift_types (code, name, start_time, end_time, description, background_color, text_color) VALUES (?, ?, ?, ?, ?, ?, ?)");
  insertShiftType.run("EP", "EP Incharge", "08:00", "17:00", "Emergency Physician Incharge", "#f0fdf4", "#166534");
  insertShiftType.run("AM", "Morning", "08:00", "15:00", "Morning Shift", "#dcfce7", "#166534");
  insertShiftType.run("PM", "Afternoon", "15:00", "22:00", "Afternoon Shift", "#fef9c3", "#854d0e");
  insertShiftType.run("NS", "Night", "22:00", "08:00", "Night Shift (2 days back-to-back)", "#dbeafe", "#1e40af");
  insertShiftType.run("PN", "Postnight Rest", null, null, "Rest day after 2 consecutive NS", "#f3e8ff", "#6b21a8");
  insertShiftType.run("FL", "Flexi", "11:00", "18:00", "Flexi Shift", "#e0f2fe", "#0369a1");
  insertShiftType.run("WP", "Office hour", "08:00", "17:00", "Standard Office Hours", "#fee2e2", "#991b1b");
  insertShiftType.run("HK1", "Offday (Wk 1)", null, null, "Obligatory weekly offday", "#f1f5f9", "#334155");
  insertShiftType.run("HK2", "Offday (Wk 2)", null, null, "Obligatory weekly offday", "#f1f5f9", "#334155");
  insertShiftType.run("HK3", "Offday (Wk 3)", null, null, "Obligatory weekly offday", "#f1f5f9", "#334155");
  insertShiftType.run("HK4", "Offday (Wk 4)", null, null, "Obligatory weekly offday", "#f1f5f9", "#334155");
  insertShiftType.run("HKA", "Public Holiday", null, null, "Public Holiday Off Duty", "#ffedd5", "#9a3412");
  insertShiftType.run("HKO", "Owed Offduty", null, null, "Offduty owed to staff", "#fdf2f8", "#9d174d");
  insertShiftType.run("CR", "Cuti Rehat", null, null, "Annual Leave", "#ecfdf5", "#065f46");
  insertShiftType.run("EL", "Emergency Leave", null, null, "Unplanned Offduty", "#fff1f2", "#9f1239");

  const insertAnnouncement = db.prepare("INSERT INTO announcements (title, content, author_id, is_pinned) VALUES (?, ?, ?, ?)");
  insertAnnouncement.run("Welcome to the New Roster System", "We have successfully launched our new staff roster management system. Please check your shifts and report any discrepancies to the Admin.", "1", 1);
  insertAnnouncement.run("Code Blue Protocol Update", "Please review the updated Code Blue response protocol in the guidelines section. All staff on AM and PM shifts must be familiar with the new assembly points.", "1", 0);

  const insertDocument = db.prepare("INSERT INTO documents (title, category, file_url, uploaded_by) VALUES (?, ?, ?, ?)");
  insertDocument.run("Hospital SOP 2026", "SOP", "https://example.com/sop.pdf", "1");
  insertDocument.run("Leave Application Form", "Forms", "https://example.com/form.pdf", "1");
  insertDocument.run("Clinical Guidelines v2", "Guidelines", "https://example.com/guidelines.pdf", "1");

  const insertNotification = db.prepare("INSERT INTO notifications (id, user_id, title, message, type, is_read) VALUES (?, ?, ?, ?, ?, ?)");
  insertNotification.run(Math.random().toString(36).substring(7), "1", "System Update", "The roster system has been updated to v2.1.", "SYSTEM", 0);
  insertNotification.run(Math.random().toString(36).substring(7), "2", "Shift Swap Request", "Dr. Wong wants to swap their NS shift on March 20th with your AM shift.", "SWAP_REQUEST", 0);

  const insertShift = db.prepare("INSERT INTO shifts (user_id, date, shift_code) VALUES (?, ?, ?)");
  insertShift.run("1", "2026-03-04", "EP");
  insertShift.run("2", "2026-03-04", "AM");
  insertShift.run("3", "2026-03-04", "AM");
  insertShift.run("4", "2026-03-04", "PM");
  insertShift.run("5", "2026-03-04", "NS");
  insertShift.run("1", "2026-03-16", "EP");
  insertShift.run("2", "2026-03-16", "AM");
  insertShift.run("3", "2026-03-16", "AM");
  insertShift.run("4", "2026-03-16", "PM");
  insertShift.run("5", "2026-03-16", "NS");
}

async function startServer() {
  const app = express();
  app.use(express.json());
  
  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    console.log(`[SERVER] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    // Add basic CORS headers for same-origin iframe context
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[SERVER] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[SERVER ERROR]', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  });

  const PORT = 3000;

  // Helper to create notification
  const createNotification = (user_id: string, title: string, message: string, type: string, related_entity_id?: string) => {
    const id = Math.random().toString(36).substring(7);
    db.prepare("INSERT INTO notifications (id, user_id, title, message, type, related_entity_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, user_id, title, message, type, related_entity_id || null);
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/users", (req, res) => {
    try {
      const users = db.prepare("SELECT * FROM users").all();
      res.json(users);
    } catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/notifications", (req, res) => {
    try {
      const { user_id } = req.query;
      if (!user_id) return res.json([]);
      const notifications = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC").all(user_id);
      res.json(notifications);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/notifications/read-all", (req, res) => {
    const { user_id } = req.body;
    db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(user_id);
    res.json({ success: true });
  });

  app.post("/api/notifications/:id/read", (req, res) => {
    const { id } = req.params;
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/notifications/action", (req, res) => {
    try {
      const { notification_id, action } = req.body;
      const notification = db.prepare("SELECT * FROM notifications WHERE id = ?").get(notification_id) as any;
      
      if (!notification) return res.status(404).json({ error: "Notification not found" });

      // Mark notification as read
      db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(notification_id);

      if (notification.type === 'SWAP_REQUEST' && notification.related_entity_id) {
        const swapId = notification.related_entity_id;
        const status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
        
        // Update the swap request status
        // We use the same logic as PATCH /api/shift-swaps/:id but simplified
        const swap = db.prepare("SELECT * FROM shift_swaps WHERE id = ?").get(swapId) as any;
        if (swap) {
          db.prepare("UPDATE shift_swaps SET status = ? WHERE id = ?").run(status, swapId);
          
          if (status === 'ACCEPTED') {
            // Notify admins
            const admins = db.prepare("SELECT id FROM users WHERE role IN ('Admin', 'Administrator', 'Manager')").all() as any[];
            const target = db.prepare("SELECT name FROM users WHERE id = ?").get(swap.target_user_id) as any;
            admins.forEach(admin => {
              createNotification(
                admin.id,
                "Swap Pending Approval",
                `${target.name} has accepted a swap request. Admin approval required.`,
                "SYSTEM",
                swapId.toString()
              );
            });
          } else {
            createNotification(swap.requester_id, "Swap Rejected", "Your shift swap request was rejected.", "SYSTEM");
          }
        }
      }

      res.json({ success: true, message: `Action ${action} processed` });
    } catch (err) {
      console.error("Error processing notification action:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/users", (req, res) => {
    try {
      const { id, name, role, email, avatar_url } = req.body;
      if (!id || !name || !role) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      if (existing) {
        return res.status(409).json({ error: "User already exists" });
      }

      db.prepare("INSERT INTO users (id, name, role, email, avatar_url) VALUES (?, ?, ?, ?, ?)")
        .run(id, name, role, email || null, avatar_url || null);
      
      res.status(201).json({ success: true });
    } catch (err) {
      console.error("Error creating user:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/users/:id", (req, res) => {
    try {
      const { id } = req.params;
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (err) {
      console.error("Error fetching user:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/users/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { phone_number, email, avatar_url } = req.body;
      
      let query = "UPDATE users SET ";
      let params = [];
      let updates = [];

      if (phone_number !== undefined) {
        updates.push("phone_number = ?");
        params.push(phone_number);
      }
      if (email !== undefined) {
        updates.push("email = ?");
        params.push(email);
      }
      if (avatar_url !== undefined) {
        updates.push("avatar_url = ?");
        params.push(avatar_url);
      }

      if (updates.length === 0) return res.json({ success: true });

      query += updates.join(", ") + " WHERE id = ?";
      params.push(id);

      db.prepare(query).run(...params);
      res.json({ success: true });
    } catch (err) {
      console.error("Error updating user:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/leave-requests", (req, res) => {
    try {
      const { user_id } = req.query;
      let query = "SELECT lr.*, u.name as user_name FROM leave_requests lr JOIN users u ON lr.user_id = u.id";
      let params: any[] = [];
      if (user_id) {
        query += " WHERE lr.user_id = ?";
        params.push(user_id);
      }
      query += " ORDER BY created_at DESC";
      const requests = db.prepare(query).all(...params);
      res.json(requests);
    } catch (err) {
      console.error("Error fetching leave requests:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/leave-requests", (req, res) => {
    const { user_id, start_date, end_date, reason } = req.body;
    const result = db.prepare("INSERT INTO leave_requests (user_id, start_date, end_date, reason) VALUES (?, ?, ?, ?)")
      .run(user_id, start_date, end_date, reason);
    res.json({ success: true, id: result.lastInsertRowid });
  });

  app.patch("/api/leave-requests/:id", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const leave = db.prepare("SELECT * FROM leave_requests WHERE id = ?").get(id);
    if (!leave) return res.status(404).json({ error: "Leave request not found" });

    db.prepare("UPDATE leave_requests SET status = ? WHERE id = ?").run(status, id);

    // Trigger notification if approved
    if (status === 'APPROVED') {
      createNotification(
        leave.user_id,
        "Leave Approved",
        `Your leave request from ${leave.start_date} to ${leave.end_date} has been approved.`,
        "LEAVE_UPDATE",
        id.toString()
      );
    }

    res.json({ success: true });
  });

  app.get("/api/shift-types", (req, res) => {
    const types = db.prepare("SELECT * FROM shift_types").all();
    res.json(types);
  });

  app.get("/api/shifts", (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.json([]);
    }
    const shifts = db.prepare("SELECT * FROM shifts WHERE date BETWEEN ? AND ?").all(start, end);
    res.json(shifts);
  });

  app.post("/api/shifts", (req, res) => {
    const { user_id, date, shift_code, is_code_blue, changed_by } = req.body;
    
    // Check if shift exists
    const existing = db.prepare("SELECT * FROM shifts WHERE user_id = ? AND date = ?").get(user_id, date);
    
    let shift_id;
    if (existing) {
      db.prepare("UPDATE shifts SET shift_code = ?, is_code_blue = ? WHERE id = ?")
        .run(shift_code, is_code_blue ? 1 : 0, existing.id);
      shift_id = existing.id;
      
      db.prepare("INSERT INTO shift_audit_logs (shift_id, action, changed_by, old_data, new_data) VALUES (?, ?, ?, ?, ?)")
        .run(shift_id, "UPDATE", changed_by, JSON.stringify(existing), JSON.stringify({ shift_code, is_code_blue }));
    } else {
      const result = db.prepare("INSERT INTO shifts (user_id, date, shift_code, is_code_blue) VALUES (?, ?, ?, ?)")
        .run(user_id, date, shift_code, is_code_blue ? 1 : 0);
      shift_id = result.lastInsertRowid;
      
      db.prepare("INSERT INTO shift_audit_logs (shift_id, action, changed_by, new_data) VALUES (?, ?, ?, ?)")
        .run(shift_id, "CREATE", changed_by, JSON.stringify({ user_id, date, shift_code, is_code_blue }));
    }
    
    res.json({ success: true, id: shift_id });
  });

  app.get("/api/audit-logs", (req, res) => {
    const logs = db.prepare(`
      SELECT l.*, u.name as changer_name 
      FROM shift_audit_logs l 
      JOIN users u ON l.changed_by = u.id 
      ORDER BY timestamp DESC LIMIT 50
    `).all();
    res.json(logs);
  });

  app.get("/api/announcements", (req, res) => {
    const announcements = db.prepare(`
      SELECT a.*, u.name as author_name 
      FROM announcements a 
      JOIN users u ON a.author_id = u.id 
      ORDER BY is_pinned DESC, created_at DESC
    `).all();
    res.json(announcements);
  });

  app.post("/api/announcements", (req, res) => {
    const { title, content, author_id, is_pinned } = req.body;
    const result = db.prepare("INSERT INTO announcements (title, content, author_id, is_pinned) VALUES (?, ?, ?, ?)")
      .run(title, content, author_id, is_pinned ? 1 : 0);
    res.json({ success: true, id: result.lastInsertRowid });
  });

  app.get("/api/documents", (req, res) => {
    const documents = db.prepare(`
      SELECT d.*, u.name as uploader_name 
      FROM documents d 
      JOIN users u ON d.uploaded_by = u.id 
      ORDER BY created_at DESC
    `).all();
    res.json(documents);
  });

  app.post("/api/documents", (req, res) => {
    const { title, category, file_url, uploaded_by } = req.body;
    const result = db.prepare("INSERT INTO documents (title, category, file_url, uploaded_by) VALUES (?, ?, ?, ?)")
      .run(title, category, file_url, uploaded_by);
    res.json({ success: true, id: result.lastInsertRowid });
  });

  app.get("/api/owed-days", (req, res) => {
    const { user_id } = req.query;
    let query = "SELECT o.*, u.name as user_name FROM owed_days o JOIN users u ON o.user_id = u.id";
    let params: any[] = [];
    if (user_id) {
      query += " WHERE o.user_id = ?";
      params.push(user_id);
    }
    query += " ORDER BY date_earned DESC";
    const logs = db.prepare(query).all(...params);
    res.json(logs);
  });

  app.post("/api/owed-days", (req, res) => {
    const { user_id, type, reason, date_earned } = req.body;
    const result = db.prepare("INSERT INTO owed_days (user_id, type, reason, date_earned) VALUES (?, ?, ?, ?)")
      .run(user_id, type, reason, date_earned);
    res.json({ success: true, id: result.lastInsertRowid });
  });

  app.patch("/api/owed-days/:id", (req, res) => {
    const { id } = req.params;
    const { status, date_redeemed } = req.body;
    db.prepare("UPDATE owed_days SET status = ?, date_redeemed = ? WHERE id = ?")
      .run(status, date_redeemed || null, id);
    res.json({ success: true });
  });

  // Task Routes
  app.get("/api/tasks", (req, res) => {
    const tasks = db.prepare(`
      SELECT t.*, u.name as creator_name,
      (SELECT COUNT(*) FROM task_assignments WHERE task_id = t.id) as total_assigned,
      (SELECT COUNT(*) FROM task_assignments WHERE task_id = t.id AND status = 'COMPLETED') as completed_count
      FROM tasks t
      JOIN users u ON t.created_by = u.id
      ORDER BY 
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
        due_date ASC
    `).all();
    res.json(tasks);
  });

  app.get("/api/tasks/:id/assignments", (req, res) => {
    const { id } = req.params;
    const assignments = db.prepare(`
      SELECT ta.*, u.name as user_name
      FROM task_assignments ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = ?
    `).all(id);
    res.json(assignments);
  });

  app.post("/api/tasks", (req, res) => {
    const { title, description, due_date, created_by, user_ids } = req.body;
    
    const transaction = db.transaction(() => {
      const taskResult = db.prepare("INSERT INTO tasks (title, description, due_date, created_by) VALUES (?, ?, ?, ?)")
        .run(title, description, due_date || null, created_by);
      const taskId = taskResult.lastInsertRowid;

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
        createNotification(
          userId,
          "New Task Assigned",
          message,
          "TASK_ALERT",
          taskId.toString()
        );
      }
      return taskId;
    });

    const taskId = transaction();
    res.json({ success: true, id: taskId });
  });

  app.get("/api/my-tasks", (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.json([]);
    const tasks = db.prepare(`
      SELECT ta.*, t.title, t.description, t.due_date, t.is_edited, t.is_deleted
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      WHERE ta.user_id = ?
      ORDER BY 
        CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
        t.due_date ASC
    `).all(user_id);
    res.json(tasks);
  });

  app.patch("/api/task-assignments/:id", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const completed_at = status === 'COMPLETED' ? new Date().toISOString() : null;
    
    db.prepare("UPDATE task_assignments SET status = ?, completed_at = ? WHERE id = ?")
      .run(status, completed_at, id);
    res.json({ success: true });
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    const { title, description, due_date } = req.body;
    db.prepare("UPDATE tasks SET title = ?, description = ?, due_date = ?, is_edited = 1 WHERE id = ?")
      .run(title, description, due_date || null, id);
    res.json({ success: true });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("UPDATE tasks SET is_deleted = 1 WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/tasks/nudge", (req, res) => {
    const { user_id, task_title } = req.body;
    createNotification(
      user_id,
      "Task Reminder",
      `Reminder: Please complete your assigned task: ${task_title}`,
      "REMINDER"
    );
    res.json({ success: true });
  });

  // Shift Swap Routes
  app.get("/api/shift-swaps", (req, res) => {
    try {
      const { user_id, status, is_admin, is_giveaway } = req.query;
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

      if (is_admin === 'true') {
        // Admins see all requests that are ACCEPTED (waiting for approval) or already APPROVED/REJECTED
        // If a status is provided (like ACCEPTED), we filter by it.
        if (status) {
          conditions.push("ss.status = ?");
          params.push(status);
        } else {
          conditions.push("ss.status IN ('ACCEPTED', 'APPROVED', 'REJECTED')");
        }
      } else if (is_giveaway === 'true') {
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
      const swaps = db.prepare(query).all(...params);
      res.json(swaps);
    } catch (err) {
      console.error("Error fetching shift swaps:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/shift-swaps", (req, res) => {
    try {
      const { requester_id, requester_shift_id, target_user_id, target_shift_id, reason } = req.body;
      
      const result = db.prepare(`
        INSERT INTO shift_swaps (requester_id, requester_shift_id, target_user_id, target_shift_id, reason)
        VALUES (?, ?, ?, ?, ?)
      `).run(requester_id, requester_shift_id, target_user_id, target_shift_id || null, reason);

      const swapId = result.lastInsertRowid;

      // Notify target user
      const requester = db.prepare("SELECT name FROM users WHERE id = ?").get(requester_id) as any;
      createNotification(
        target_user_id,
        "Shift Swap Request",
        `${requester.name} has requested to swap a shift with you.`,
        "SWAP_REQUEST",
        swapId.toString()
      );

      res.json({ success: true, id: swapId });
    } catch (err) {
      console.error("Error creating shift swap:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/shift-swaps/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { status, changed_by } = req.body;

      const swap = db.prepare("SELECT * FROM shift_swaps WHERE id = ?").get(id) as any;
      if (!swap) return res.status(404).json({ error: "Swap request not found" });

      const transaction = db.transaction(() => {
        if (status === 'ACCEPTED' && !swap.target_user_id) {
          // This is a giveaway being claimed
          db.prepare("UPDATE shift_swaps SET status = ?, target_user_id = ? WHERE id = ?").run(status, changed_by, id);
          // Update local swap object for subsequent logic
          swap.target_user_id = changed_by;
        } else {
          db.prepare("UPDATE shift_swaps SET status = ? WHERE id = ?").run(status, id);
        }

        if (status === 'APPROVED') {
          // Perform the actual swap in the shifts table
          const s1 = db.prepare("SELECT * FROM shifts WHERE id = ?").get(swap.requester_shift_id) as any;
          const s2 = swap.target_shift_id ? db.prepare("SELECT * FROM shifts WHERE id = ?").get(swap.target_shift_id) as any : null;

          // Swap user IDs
          if (s2) {
            db.prepare("UPDATE shifts SET user_id = ? WHERE id = ?").run(swap.target_user_id, swap.requester_shift_id);
            db.prepare("UPDATE shifts SET user_id = ? WHERE id = ?").run(swap.requester_id, swap.target_shift_id);
            
            // Log the changes
            db.prepare("INSERT INTO shift_audit_logs (shift_id, action, changed_by, old_data, new_data) VALUES (?, ?, ?, ?, ?)")
              .run(swap.requester_shift_id, "SWAP", changed_by, JSON.stringify(s1), JSON.stringify({ user_id: swap.target_user_id }));
            db.prepare("INSERT INTO shift_audit_logs (shift_id, action, changed_by, old_data, new_data) VALUES (?, ?, ?, ?, ?)")
              .run(swap.target_shift_id, "SWAP", changed_by, JSON.stringify(s2), JSON.stringify({ user_id: swap.requester_id }));
          } else {
            // Giveaway: just update the requester's shift to the target user
            db.prepare("UPDATE shifts SET user_id = ? WHERE id = ?").run(swap.target_user_id, swap.requester_shift_id);
            db.prepare("INSERT INTO shift_audit_logs (shift_id, action, changed_by, old_data, new_data) VALUES (?, ?, ?, ?, ?)")
              .run(swap.requester_shift_id, "GIVEAWAY", changed_by, JSON.stringify(s1), JSON.stringify({ user_id: swap.target_user_id }));
          }

          // Notify both users
          createNotification(swap.requester_id, "Swap Approved", "Your shift swap request has been approved and the roster updated.", "SYSTEM");
          createNotification(swap.target_user_id, "Swap Approved", "A shift swap involving you has been approved and the roster updated.", "SYSTEM");
        } else if (status === 'ACCEPTED') {
          // Target user accepted, notify admins
          const admins = db.prepare("SELECT id FROM users WHERE role IN ('Admin', 'Administrator', 'Manager')").all() as any[];
          const target = db.prepare("SELECT name FROM users WHERE id = ?").get(swap.target_user_id) as any;
          admins.forEach(admin => {
            createNotification(
              admin.id,
              "Swap Pending Approval",
              `${target.name} has accepted a swap request. Admin approval required.`,
              "SYSTEM",
              id.toString()
            );
          });
        } else if (status === 'REJECTED') {
          createNotification(swap.requester_id, "Swap Rejected", "Your shift swap request was rejected.", "SYSTEM");
        }
      });

      transaction();
      res.json({ success: true });
    } catch (err) {
      console.error("Error updating shift swap:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Catch-all for undefined API routes to prevent falling through to HTML fallback
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  // Google OAuth Routes
  app.get("/api/auth/google/url", (req, res) => {
    const userId = req.query.userId as string;
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.APP_URL}/api/auth/google/callback`
    );

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      prompt: 'consent',
      state: userId // Pass userId in state to identify the user on callback
    });

    res.json({ url });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code, state } = req.query;
    const userId = state as string;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.APP_URL}/api/auth/google/callback`
    );

    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      
      if (userId) {
        db.prepare("UPDATE users SET google_access_token = ?, google_refresh_token = ? WHERE id = ?")
          .run(tokens.access_token, tokens.refresh_token || null, userId);
      }

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error in Google OAuth callback:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.post("/api/users/sync-tokens", (req, res) => {
    const { user_id, access_token, refresh_token } = req.body;
    db.prepare("UPDATE users SET google_access_token = ?, google_refresh_token = ? WHERE id = ?")
      .run(access_token, refresh_token || null, user_id);
    res.json({ success: true });
  });

  app.post("/api/shifts/sync-calendar", async (req, res) => {
    const { shift_id, user_id } = req.body;
    
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(user_id) as any;
    const shift = db.prepare(`
      SELECT s.*, st.start_time, st.end_time 
      FROM shifts s 
      JOIN shift_types st ON s.shift_code = st.code 
      WHERE s.id = ?
    `).get(shift_id) as any;

    if (!user?.google_access_token) {
      return res.status(400).json({ error: "User has not connected Google Calendar" });
    }

    try {
      const result = await syncShiftToGoogleCalendar({
        userProviderToken: user.google_access_token,
        shiftDate: shift.date,
        shiftCode: shift.shift_code,
        startTime: shift.start_time || "08:00:00",
        endTime: shift.end_time || "17:00:00"
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    try {
      console.log('[SERVER] Initializing Vite middleware...');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log('[SERVER] Vite middleware initialized');
    } catch (err) {
      console.error('[SERVER] Failed to initialize Vite middleware:', err);
    }
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[SERVER] Database: roster.db initialized`);
  }).on('error', (err) => {
    console.error('[SERVER] Failed to start server:', err);
  });
}

startServer();
