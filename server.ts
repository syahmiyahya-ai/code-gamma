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

  // Import modular routes
  const { default: userRoutes } = await import("./server/routes/userRoutes.ts");
  const { default: notificationRoutes } = await import("./server/routes/notificationRoutes.ts");
  const { default: operationalRoutes } = await import("./server/routes/operationalRoutes.ts");
  const { default: authRoutes } = await import("./server/routes/authRoutes.ts");

  // Mount modular routes
  apiRouter.use(userRoutes);
  apiRouter.use(notificationRoutes);
  apiRouter.use(operationalRoutes);
  apiRouter.use(authRoutes);
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
