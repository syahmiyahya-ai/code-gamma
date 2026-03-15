import { Router } from "express";
import { db } from "../db/db.ts";
import { logger } from "../utils/logger.ts";

const router = Router();

router.get("/users", (req, res) => {
  try {
    const users = db.prepare("SELECT * FROM users").all();
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users", (req, res) => {
  try {
    const { id, name, role, email, avatar_url } = req.body;
    const requesterId = req.headers['x-user-id'] as string;

    if (!id || !name || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const isSelf = requesterId?.toLowerCase() === id?.toLowerCase();
    let isAdmin = false;

    if (requesterId) {
      const requester = db.prepare("SELECT role FROM users WHERE id = ?").get(requesterId) as { role: string } | undefined;
      if (requester && (requester.role === 'SystemAdmin' || requester.role === 'Admin' || requester.role === 'Administrator' || requester.role === 'RosterAdmin')) {
        isAdmin = true;
      }
    }

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: "Insufficient permissions to create this user" });
    }
    
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (existing) {
      return res.status(409).json({ error: "User already exists" });
    }

    db.prepare("INSERT INTO users (id, name, role, email, avatar_url) VALUES (?, ?, ?, ?, ?)")
      .run(id, name, role, email || null, avatar_url || null);
    
    logger.info("USER_CREATED", requesterId || "SYSTEM", { createdUserId: id, role });
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('[SERVER] POST /users error:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:id", (req, res) => {
  try {
    const { id } = req.params;
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { phone_number, email, avatar_url, role } = req.body;
    const requesterId = req.headers['x-user-id'] as string;

    const isSelf = requesterId === id;
    let isAdmin = false;

    if (requesterId) {
      const requester = db.prepare("SELECT role FROM users WHERE id = ?").get(requesterId) as { role: string } | undefined;
      if (requester && (requester.role === 'SystemAdmin' || requester.role === 'Admin' || requester.role === 'Administrator' || requester.role === 'RosterAdmin')) {
        isAdmin = true;
      }
    }

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: "Insufficient permissions to update this profile" });
    }
    
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
    if (role !== undefined && (isAdmin || isSelf)) {
      updates.push("role = ?");
      params.push(role);
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

router.delete("/users/:id", (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = req.headers['x-user-id'] as string;

    if (!requesterId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const requester = db.prepare("SELECT role FROM users WHERE id = ?").get(requesterId) as { role: string } | undefined;
    const isAdmin = requester && (requester.role === 'SystemAdmin' || requester.role === 'Admin' || requester.role === 'Administrator' || requester.role === 'RosterAdmin');

    if (!isAdmin) {
      return res.status(403).json({ error: "Insufficient permissions to delete staff" });
    }

    if (requesterId === id) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    db.transaction(() => {
      db.prepare("DELETE FROM shifts WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM tasks WHERE created_by = ?").run(id);
      db.prepare("DELETE FROM task_assignments WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM leave_requests WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM shift_swaps WHERE requester_id = ? OR target_user_id = ?").run(id, id);
      db.prepare("DELETE FROM notifications WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM owed_days WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM announcements WHERE author_id = ?").run(id);
      db.prepare("DELETE FROM documents WHERE uploaded_by = ?").run(id);
      db.prepare("DELETE FROM shift_audit_logs WHERE changed_by = ?").run(id);
      db.prepare("DELETE FROM audit_events WHERE actor_user_id = ?").run(id);
      db.prepare("DELETE FROM users WHERE id = ?").run(id);
    })();

    logger.info("USER_DELETED", requesterId, { deletedUserId: id });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
