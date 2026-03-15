import { Router } from "express";
import { db } from "../db/db.ts";
import { notificationService, NotificationType } from "../services/notificationService.ts";
import { requireRole } from "../middleware/permissionMiddleware.ts";

const router = Router();

// Leave Requests
router.get("/leave-requests", (req, res) => {
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

router.post("/leave-requests", (req, res) => {
  const { user_id, start_date, end_date, reason } = req.body;
  const result = db.prepare("INSERT INTO leave_requests (user_id, start_date, end_date, reason) VALUES (?, ?, ?, ?)")
    .run(user_id, start_date, end_date, reason);
  res.json({ success: true, id: result.lastInsertRowid });
});

router.patch("/leave-requests/:id", requireRole("Supervisor"), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const leave = db.prepare("SELECT * FROM leave_requests WHERE id = ?").get(id) as any;
  if (!leave) return res.status(404).json({ error: "Leave request not found" });

  db.prepare("UPDATE leave_requests SET status = ? WHERE id = ?").run(status, id);

  if (status === 'APPROVED') {
    notificationService.createNotification({
      userId: leave.user_id,
      title: "Leave Approved",
      message: `Your leave request from ${leave.start_date} to ${leave.end_date} has been approved.`,
      type: NotificationType.LEAVE_UPDATE,
      relatedEntityId: id.toString()
    });
  }

  res.json({ success: true });
});

// Announcements
router.get("/announcements", (req, res) => {
  const announcements = db.prepare(`
    SELECT a.*, u.name as author_name 
    FROM announcements a 
    JOIN users u ON a.author_id = u.id 
    ORDER BY is_pinned DESC, created_at DESC
  `).all();
  res.json(announcements);
});

router.post("/announcements", requireRole("Supervisor"), (req, res) => {
  const { title, content, author_id, is_pinned } = req.body;
  const result = db.prepare("INSERT INTO announcements (title, content, author_id, is_pinned) VALUES (?, ?, ?, ?)")
    .run(title, content, author_id, is_pinned ? 1 : 0);
  res.json({ success: true, id: result.lastInsertRowid });
});

// Documents
router.get("/documents", (req, res) => {
  const documents = db.prepare(`
    SELECT d.*, u.name as uploader_name 
    FROM documents d 
    JOIN users u ON d.uploaded_by = u.id 
    ORDER BY created_at DESC
  `).all();
  res.json(documents);
});

router.post("/documents", requireRole("Supervisor"), (req, res) => {
  const { title, category, file_url, uploaded_by } = req.body;
  const result = db.prepare("INSERT INTO documents (title, category, file_url, uploaded_by) VALUES (?, ?, ?, ?)")
    .run(title, category, file_url, uploaded_by);
  res.json({ success: true, id: result.lastInsertRowid });
});

// Owed Days
router.get("/owed-days", (req, res) => {
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

router.post("/owed-days", requireRole("Supervisor"), (req, res) => {
  const { user_id, type, reason, date_earned } = req.body;
  const result = db.prepare("INSERT INTO owed_days (user_id, type, reason, date_earned) VALUES (?, ?, ?, ?)")
    .run(user_id, type, reason, date_earned);
  res.json({ success: true, id: result.lastInsertRowid });
});

router.patch("/owed-days/:id", requireRole("Supervisor"), (req, res) => {
  const { id } = req.params;
  const { status, date_redeemed } = req.body;
  db.prepare("UPDATE owed_days SET status = ?, date_redeemed = ? WHERE id = ?")
    .run(status, date_redeemed || null, id);
  res.json({ success: true });
});

export default router;
