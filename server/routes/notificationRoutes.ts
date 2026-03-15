import { Router } from "express";
import { db } from "../db/db.ts";
import { notificationService } from "../services/notificationService.ts";
import { swapService } from "../services/swapService.ts";
import { logger } from "../utils/logger.ts";

const router = Router();

router.get("/notifications", (req, res) => {
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

router.post("/notifications/read-all", (req, res) => {
  const { user_id } = req.body;
  notificationService.markAllAsRead(user_id);
  res.json({ success: true });
});

router.post("/notifications/:id/read", (req, res) => {
  const { id } = req.params;
  notificationService.markAsRead(id);
  res.json({ success: true });
});

router.post("/notifications/action", (req, res) => {
  try {
    const { notification_id, action } = req.body;
    const notification = db.prepare("SELECT * FROM notifications WHERE id = ?").get(notification_id) as any;
    
    if (!notification) return res.status(404).json({ error: "Notification not found" });

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

export default router;
