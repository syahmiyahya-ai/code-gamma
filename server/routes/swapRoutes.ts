import { Router } from "express";
import { swapService } from "../services/swapService";
import { requireRole } from "../middleware/permissionMiddleware";

const router = Router();

router.get("/shift-swaps", (req, res) => {
  try {
    const { user_id, status, is_admin, is_giveaway } = req.query;
    const swaps = swapService.getSwapRequests({
      user_id: user_id as string,
      status: status as string,
      is_admin: is_admin === 'true',
      is_giveaway: is_giveaway === 'true'
    });
    res.json(swaps);
  } catch (err) {
    console.error("Error fetching shift swaps:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/shift-swaps", (req, res) => {
  try {
    const { requester_id, requester_shift_id, target_user_id, target_shift_id, reason } = req.body;
    const swapId = swapService.createSwapRequest({
      requester_id,
      requester_shift_id,
      target_user_id,
      target_shift_id,
      reason
    });
    res.json({ success: true, id: swapId });
  } catch (err) {
    console.error("Error creating shift swap:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/shift-swaps/:id", requireRole("Supervisor"), (req, res) => {
  try {
    const { id } = req.params;
    const { status, changed_by } = req.body;
    
    // Only RosterAdmin or SystemAdmin can APPROVE
    if (status === 'APPROVED') {
      return requireRole("RosterAdmin")(req, res, () => {
        swapService.updateSwapStatus(Number(id), status, changed_by);
        res.json({ success: true });
      });
    }

    swapService.updateSwapStatus(Number(id), status, changed_by);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error updating shift swap:", err);
    if (err.message === "Swap request not found") {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
