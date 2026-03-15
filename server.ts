import "dotenv/config";
console.log('[SERVER] Starting server.ts...');
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { google } from "googleapis";
import db from "./server/db/db.ts";
import rosterRoutes from "./server/routes/rosterRoutes.ts";
import swapRoutes from "./server/routes/swapRoutes.ts";
import taskRoutes from "./server/routes/taskRoutes.ts";
import { swapService } from "./server/services/swapService.ts";
import { notificationService, NotificationType } from "./server/services/notificationService.ts";
import { logger } from "./server/utils/logger.ts";
import { requireRole } from "./server/middleware/permissionMiddleware.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Global process error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[SERVER] Uncaught Exception:', err);
});

async function startServer() {
  const app = express();
  
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'Accept', 'Cache-Control']
  }));

  app.use(express.json());
  
  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    logger.info("INCOMING_REQUEST", "ANONYMOUS", { method: req.method, url: req.url });
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info("REQUEST_COMPLETED", "ANONYMOUS", { 
        method: req.method, 
        url: req.url, 
        status: res.statusCode, 
        duration: `${duration}ms` 
      });
    });
    next();
  });

  const PORT = 3000;

  // Helper to create notification
  const createNotification = (user_id: string, title: string, message: string, type: string, related_entity_id?: string) => {
    const id = Math.random().toString(36).substring(7);
    db.prepare("INSERT INTO notifications (id, user_id, title, message, type, related_entity_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, user_id, title, message, type, related_entity_id || null);
  };

  // API Router
  const apiRouter = express.Router();

  // API logging and header middleware
  apiRouter.use((req, res, next) => {
    console.log(`[SERVER] API request: ${req.method} ${req.url}`);
    res.setHeader('Content-Type', 'application/json');
    next();
  });

  apiRouter.get("/health", (req, res) => {
    console.log('[SERVER] Health check requested from:', req.ip);
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  apiRouter.get("/users", (req, res) => {
    try {
      const users = db.prepare("SELECT * FROM users").all();
      res.json(users);
    } catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  apiRouter.get("/notifications", (req, res) => {
    try {
      const { user_id } = req.query;
      if (!user_id) return res.json([]);
      const notifications = notificationService.getNotifications(user_id as string);
      res.json(notifications);
    } catch (err) {
      logger.error("FETCH_NOTIFICATIONS_FAILED", "SYSTEM", { error: (err as Error).message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  apiRouter.post("/notifications/read-all", (req, res) => {
    const { user_id } = req.body;
    notificationService.markAllAsRead(user_id);
    res.json({ success: true });
  });

  apiRouter.post("/notifications/:id/read", (req, res) => {
    const { id } = req.params;
    notificationService.markAsRead(id);
    res.json({ success: true });
  });

  apiRouter.post("/notifications/action", (req, res) => {
    try {
      const { notification_id, action } = req.body;
      const notification = db.prepare("SELECT * FROM notifications WHERE id = ?").get(notification_id) as any;
      
      if (!notification) return res.status(404).json({ error: "Notification not found" });

      // Mark notification as read
      notificationService.markAsRead(notification_id);

      if (notification.type === 'SWAP_REQUEST' && notification.related_entity_id) {
        const swapId = notification.related_entity_id;
        const status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
        
        try {
          swapService.updateSwapStatus(Number(swapId), status, notification.user_id);
        } catch (err) {
          console.error("Error processing swap from notification:", err);
        }
      }

      res.json({ success: true, message: `Action ${action} processed` });
    } catch (err) {
      console.error("Error processing notification action:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  apiRouter.post("/users", (req, res) => {
    try {
      const { id, name, role, email, avatar_url } = req.body;
      // Express lowercases all header names
      const requesterId = req.headers['x-user-id'] as string;

      console.log('[SERVER] POST /users request:', { 
        bodyId: id, 
        name, 
        role, 
        requesterId,
        headers: req.headers 
      });

      if (!id || !name || !role) {
        console.warn('[SERVER] POST /users missing fields:', { id, name, role });
        return res.status(400).json({ error: "Missing required fields", received: { id, name, role } });
      }
      
      // Allow if requester is creating their own profile, OR if requester is an Admin
      // Use case-insensitive comparison for IDs just in case
      const isSelf = requesterId?.toLowerCase() === id?.toLowerCase();
      let isAdmin = false;

      if (requesterId) {
        const requester = db.prepare("SELECT role FROM users WHERE id = ?").get(requesterId) as { role: string } | undefined;
        if (requester && (requester.role === 'SystemAdmin' || requester.role === 'Admin' || requester.role === 'Administrator' || requester.role === 'RosterAdmin')) {
          isAdmin = true;
        }
      }

      if (!isSelf && !isAdmin) {
        console.warn('[SERVER] POST /users permission denied:', { requesterId, id, isSelf, isAdmin });
        return res.status(403).json({ 
          error: "Insufficient permissions to create this user",
          debug: { requesterId, targetId: id, isSelf }
        });
      }
      
      const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      if (existing) {
        console.log('[SERVER] POST /users user already exists:', id);
        return res.status(409).json({ error: "User already exists" });
      }

      console.log('[SERVER] Inserting user into DB:', { id, name, role, email });
      db.prepare("INSERT INTO users (id, name, role, email, avatar_url) VALUES (?, ?, ?, ?, ?)")
        .run(id, name, role, email || null, avatar_url || null);
      
      logger.info("USER_CREATED", requesterId || "SYSTEM", { createdUserId: id, role });
      console.log('[SERVER] POST /users success:', id);
      res.status(201).json({ success: true });
    } catch (err) {
      console.error('[SERVER] POST /users error:', err);
      logger.error("USER_CREATION_FAILED", "SYSTEM", { error: (err as Error).message });
      res.status(500).json({ error: "Internal server error", details: (err as Error).message });
    }
  });

  apiRouter.get("/users/:id", (req, res) => {
    try {
      const { id } = req.params;
      console.log(`[SERVER] Fetching user profile for ID: ${id}`);
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      if (!user) {
        console.log(`[SERVER] User not found: ${id}`);
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (err) {
      console.error("Error fetching user:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  apiRouter.patch("/users/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { phone_number, email, avatar_url, role } = req.body;
      const requesterId = req.headers['x-user-id'] as string;

      // Allow if requester is updating their own profile, OR if requester is an Admin
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
        // In development, allow self-role updates. In production, this should be restricted to admins.
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

  apiRouter.delete("/users/:id", (req, res) => {
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

      // Prevent self-deletion if needed, or just allow it if they are admin
      if (requesterId === id) {
        return res.status(400).json({ error: "You cannot delete your own account" });
      }

      // Delete user's related data to maintain referential integrity
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

  apiRouter.get("/leave-requests", (req, res) => {
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

  apiRouter.post("/leave-requests", (req, res) => {
    const { user_id, start_date, end_date, reason } = req.body;
    const result = db.prepare("INSERT INTO leave_requests (user_id, start_date, end_date, reason) VALUES (?, ?, ?, ?)")
      .run(user_id, start_date, end_date, reason);
    res.json({ success: true, id: result.lastInsertRowid });
  });

  apiRouter.patch("/leave-requests/:id", requireRole("Supervisor"), (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const leave = db.prepare("SELECT * FROM leave_requests WHERE id = ?").get(id) as any;
    if (!leave) return res.status(404).json({ error: "Leave request not found" });

    db.prepare("UPDATE leave_requests SET status = ? WHERE id = ?").run(status, id);

    // Trigger notification if approved
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

  apiRouter.get("/announcements", (req, res) => {
    const announcements = db.prepare(`
      SELECT a.*, u.name as author_name 
      FROM announcements a 
      JOIN users u ON a.author_id = u.id 
      ORDER BY is_pinned DESC, created_at DESC
    `).all();
    res.json(announcements);
  });

  apiRouter.post("/announcements", requireRole("Supervisor"), (req, res) => {
    const { title, content, author_id, is_pinned } = req.body;
    const result = db.prepare("INSERT INTO announcements (title, content, author_id, is_pinned) VALUES (?, ?, ?, ?)")
      .run(title, content, author_id, is_pinned ? 1 : 0);
    res.json({ success: true, id: result.lastInsertRowid });
  });

  apiRouter.get("/documents", (req, res) => {
    const documents = db.prepare(`
      SELECT d.*, u.name as uploader_name 
      FROM documents d 
      JOIN users u ON d.uploaded_by = u.id 
      ORDER BY created_at DESC
    `).all();
    res.json(documents);
  });

  apiRouter.post("/documents", requireRole("Supervisor"), (req, res) => {
    const { title, category, file_url, uploaded_by } = req.body;
    const result = db.prepare("INSERT INTO documents (title, category, file_url, uploaded_by) VALUES (?, ?, ?, ?)")
      .run(title, category, file_url, uploaded_by);
    res.json({ success: true, id: result.lastInsertRowid });
  });

  apiRouter.get("/owed-days", (req, res) => {
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

  apiRouter.post("/owed-days", requireRole("Supervisor"), (req, res) => {
    const { user_id, type, reason, date_earned } = req.body;
    const result = db.prepare("INSERT INTO owed_days (user_id, type, reason, date_earned) VALUES (?, ?, ?, ?)")
      .run(user_id, type, reason, date_earned);
    res.json({ success: true, id: result.lastInsertRowid });
  });

  apiRouter.patch("/owed-days/:id", requireRole("Supervisor"), (req, res) => {
    const { id } = req.params;
    const { status, date_redeemed } = req.body;
    db.prepare("UPDATE owed_days SET status = ?, date_redeemed = ? WHERE id = ?")
      .run(status, date_redeemed || null, id);
    res.json({ success: true });
  });

  // Google OAuth Routes
  apiRouter.get("/auth/google/url", (req, res) => {
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

  apiRouter.get("/auth/google/callback", async (req, res) => {
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

  apiRouter.post("/users/sync-tokens", (req, res) => {
    const { user_id, access_token, refresh_token } = req.body;
    db.prepare("UPDATE users SET google_access_token = ?, google_refresh_token = ? WHERE id = ?")
      .run(access_token, refresh_token || null, user_id);
    res.json({ success: true });
  });

  // Mount sub-routers
  apiRouter.use(rosterRoutes);
  apiRouter.use(swapRoutes);
  apiRouter.use(taskRoutes);

  // API error handler
  apiRouter.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[SERVER] API Error:', err);
    res.status(500).json({ error: 'Internal API error', details: err.message });
  });

  // Mount API Router
  app.use("/api", apiRouter);

  // Catch-all for undefined API routes to prevent falling through to HTML fallback
  app.all("/api/*", (req, res) => {
    console.warn(`[SERVER] 404 on API route: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  // Explicitly handle favicon to avoid 404s hitting SPA fallback
  app.get('/favicon.ico', (req, res) => res.status(204).end());

  // Global error handler - MUST be after routes
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[SERVER] Global Error:', err);
    logger.error("GLOBAL_SERVER_ERROR", "SYSTEM", { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error', details: err.message });
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
    logger.info("SERVER_STARTED", "SYSTEM", { port: PORT, env: process.env.NODE_ENV || 'development' });
    console.log(`[SERVER] Server is listening on 0.0.0.0:${PORT}`);
  }).on('error', (err) => {
    logger.error("SERVER_START_FAILED", "SYSTEM", { error: err.message });
  });
}

startServer();
