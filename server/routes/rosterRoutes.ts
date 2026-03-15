import { Router } from "express";
import { rosterService } from "../services/rosterService";
import { db } from "../db/db";
import { syncShiftToGoogleCalendar } from "../calendarUtils.ts";
import { requireRole } from "../middleware/permissionMiddleware";

const router = Router();

router.get("/shift-types", (req, res) => {
  try {
    const types = rosterService.getShiftTypes();
    res.json(types);
  } catch (err) {
    console.error("Error fetching shift types:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/shifts", (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.json([]);
    }
    const shifts = rosterService.getShifts(String(start), String(end));
    res.json(shifts);
  } catch (err) {
    console.error("Error fetching shifts:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/shifts", requireRole("RosterAdmin"), (req, res) => {
  try {
    const { user_id, date, shift_code, is_code_blue, changed_by, confirm } = req.body;
    const shift_id = rosterService.updateShift({ user_id, date, shift_code, is_code_blue, changed_by, confirm });
    res.json({ success: true, id: shift_id });
  } catch (err: any) {
    console.error("Error updating shift:", err);
    if (err.message.includes("Validation failed") || err.message.includes("requires confirmation")) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/roster/publish", requireRole("RosterAdmin"), (req, res) => {
  try {
    const { start_date, end_date, changed_by, confirm } = req.body;
    rosterService.publishRoster({ start_date, end_date, changed_by, confirm });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error publishing roster:", err);
    res.status(400).json({ error: err.message });
  }
});

router.post("/roster/delete", requireRole("RosterAdmin"), (req, res) => {
  try {
    const { start_date, end_date, changed_by, confirm } = req.body;
    const deletedCount = rosterService.deleteRoster({ start_date, end_date, changed_by, confirm });
    res.json({ success: true, deletedCount });
  } catch (err: any) {
    console.error("Error deleting roster:", err);
    res.status(400).json({ error: err.message });
  }
});

router.get("/audit-logs", (req, res) => {
  try {
    const logs = rosterService.getAuditLogs();
    res.json(logs);
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/shifts/sync-calendar", async (req, res) => {
  try {
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

    const result = await syncShiftToGoogleCalendar({
      userProviderToken: user.google_access_token,
      shiftDate: shift.date,
      shiftCode: shift.shift_code,
      startTime: shift.start_time || "08:00:00",
      endTime: shift.end_time || "17:00:00"
    });
    res.json(result);
  } catch (error: any) {
    console.error("Error syncing calendar:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/shifts/next", (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: "user_id is required" });
    
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
    
    const nextShift = db.prepare(`
      SELECT s.*, st.name as shift_name, st.start_time, st.end_time, st.background_color, st.text_color
      FROM shifts s
      JOIN shift_types st ON s.shift_code = st.code
      WHERE s.user_id = ? AND s.date >= ?
      ORDER BY s.date ASC
      LIMIT 1
    `).get(user_id, today);
    
    res.json(nextShift || null);
  } catch (err) {
    console.error("Error fetching next shift:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
